const { Client } = require('pg');
require('dotenv').config();

/**
 * Returns Service
 * Handles business logic for individual order item returns
 */
class ReturnsService {
  constructor(dbClient) {
    this.db = dbClient;
  }

  /**
   * Check if an order item is eligible for return
   */
  async checkReturnEligibility(orderId, orderItemId, userId) {
    try {
      const result = await this.db.query(`
        SELECT 
          oi.id,
          oi.quantity,
          oi.product_name,
          oi.price,
          oi.total,
          oi.returned_quantity,
          oi.return_status,
          o.id as order_id,
          o.order_number,
          o.status as order_status,
          o.user_id,
          o.vendor_id,
          o.delivered_at,
          v.return_policy_days,
          v.allow_returns,
          v.store_name,
          COALESCE(SUM(r.quantity), 0) as total_returned,
          COALESCE(SUM(CASE WHEN r.status IN ('requested', 'approved') THEN r.quantity ELSE 0 END), 0) as pending_returns
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN vendors v ON o.vendor_id = v.id
        LEFT JOIN returns r ON r.order_item_id = oi.id
        WHERE oi.id = $1 AND o.id = $2 AND o.user_id = $3
        GROUP BY oi.id, o.id, v.id
      `, [orderItemId, orderId, userId]);

      if (result.rows.length === 0) {
        return {
          eligible: false,
          reason: 'Order item not found or does not belong to user'
        };
      }

      const item = result.rows[0];

      // Check if vendor allows returns
      if (!item.allow_returns) {
        return {
          eligible: false,
          reason: `${item.store_name} does not accept returns`
        };
      }

      // Check if order is delivered
      if (item.order_status !== 'delivered') {
        return {
          eligible: false,
          reason: 'Order must be delivered before requesting a return'
        };
      }

      // Check return window
      if (item.delivered_at) {
        const deliveryDate = new Date(item.delivered_at);
        const today = new Date();
        const daysSinceDelivery = Math.floor((today - deliveryDate) / (1000 * 60 * 60 * 24));
        
        if (daysSinceDelivery > item.return_policy_days) {
          return {
            eligible: false,
            reason: `Return window of ${item.return_policy_days} days has expired`
          };
        }
      }

      // Check if there's quantity available to return
      const availableQuantity = item.quantity - item.total_returned - item.pending_returns;
      if (availableQuantity <= 0) {
        return {
          eligible: false,
          reason: 'All items have already been returned or have pending return requests'
        };
      }

      return {
        eligible: true,
        item: {
          ...item,
          available_quantity: availableQuantity
        }
      };
    } catch (error) {
      console.error('Error checking return eligibility:', error);
      throw error;
    }
  }

  /**
   * Create a return request for an order item
   */
  async createReturnRequest(data) {
    const {
      orderId,
      orderItemId,
      userId,
      quantity,
      reason,
      customerNotes,
      images
    } = data;

    try {
      // Start transaction
      await this.db.query('BEGIN');

      // Check eligibility
      const eligibility = await this.checkReturnEligibility(orderId, orderItemId, userId);
      if (!eligibility.eligible) {
        throw new Error(eligibility.reason);
      }

      const item = eligibility.item;

      // Validate quantity
      if (quantity > item.available_quantity) {
        throw new Error(`Cannot return ${quantity} items. Only ${item.available_quantity} available for return.`);
      }

      // Calculate refund amount
      const refundAmount = item.price * quantity;
      const refundTax = (item.tax || 0) * (quantity / item.quantity);
      const refundTotal = refundAmount + refundTax;

      // Generate return number
      const returnNumberResult = await this.db.query('SELECT generate_return_number() as return_number');
      const returnNumber = returnNumberResult.rows[0].return_number;

      // Create return request
      const returnResult = await this.db.query(`
        INSERT INTO returns (
          return_number,
          order_id,
          order_item_id,
          user_id,
          vendor_id,
          quantity,
          reason,
          status,
          product_name,
          product_sku,
          variant_options,
          original_price,
          original_quantity,
          refund_amount,
          refund_tax,
          refund_total,
          customer_notes,
          images
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        )
        RETURNING *
      `, [
        returnNumber,
        orderId,
        orderItemId,
        userId,
        item.vendor_id,
        quantity,
        reason,
        'requested',
        item.product_name,
        item.product_sku,
        item.variant_options,
        item.price,
        item.quantity,
        refundAmount,
        refundTax,
        refundTotal,
        customerNotes || null,
        images ? JSON.stringify(images) : null
      ]);

      // Update order item return status
      const newReturnedQty = (item.returned_quantity || 0) + quantity;
      const returnStatus = newReturnedQty >= item.quantity ? 'full' : 'partial';
      
      await this.db.query(`
        UPDATE order_items
        SET return_status = $1
        WHERE id = $2
      `, [returnStatus, orderItemId]);

      await this.db.query('COMMIT');

      return returnResult.rows[0];
    } catch (error) {
      await this.db.query('ROLLBACK');
      console.error('Error creating return request:', error);
      throw error;
    }
  }

  /**
   * Approve a return request (vendor/admin)
   */
  async approveReturn(returnId, approvedBy, vendorNotes = null) {
    try {
      await this.db.query('BEGIN');

      const result = await this.db.query(`
        UPDATE returns
        SET 
          status = 'approved',
          approved_at = CURRENT_TIMESTAMP,
          approved_by = $2,
          vendor_notes = COALESCE($3, vendor_notes)
        WHERE id = $1 AND status = 'requested'
        RETURNING *
      `, [returnId, approvedBy, vendorNotes]);

      if (result.rows.length === 0) {
        throw new Error('Return not found or already processed');
      }

      await this.db.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await this.db.query('ROLLBACK');
      console.error('Error approving return:', error);
      throw error;
    }
  }

  /**
   * Reject a return request (vendor/admin)
   */
  async rejectReturn(returnId, rejectedBy, rejectionReason) {
    try {
      await this.db.query('BEGIN');

      const result = await this.db.query(`
        UPDATE returns
        SET 
          status = 'rejected',
          rejected_at = CURRENT_TIMESTAMP,
          rejected_by = $2,
          rejection_reason = $3
        WHERE id = $1 AND status = 'requested'
        RETURNING *
      `, [returnId, rejectedBy, rejectionReason]);

      if (result.rows.length === 0) {
        throw new Error('Return not found or already processed');
      }

      await this.db.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await this.db.query('ROLLBACK');
      console.error('Error rejecting return:', error);
      throw error;
    }
  }

  /**
   * Mark return as received (vendor confirms receipt)
   */
  async markReturnReceived(returnId, trackingNumber = null, carrier = null) {
    try {
      const result = await this.db.query(`
        UPDATE returns
        SET 
          status = 'received',
          received_at = CURRENT_TIMESTAMP,
          tracking_number = COALESCE($2, tracking_number),
          carrier = COALESCE($3, carrier)
        WHERE id = $1 AND status = 'approved'
        RETURNING *
      `, [returnId, trackingNumber, carrier]);

      if (result.rows.length === 0) {
        throw new Error('Return not found or not in approved status');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error marking return as received:', error);
      throw error;
    }
  }

  /**
   * Process refund for a return
   */
  async processRefund(returnId, refundData) {
    const { method, transactionId, gateway, gatewayResponse, notes } = refundData;

    try {
      await this.db.query('BEGIN');

      // Get return details
      const returnResult = await this.db.query(`
        SELECT * FROM returns WHERE id = $1 AND status = 'received'
      `, [returnId]);

      if (returnResult.rows.length === 0) {
        throw new Error('Return not found or not ready for refund');
      }

      const returnItem = returnResult.rows[0];

      // Create refund record
      const refundResult = await this.db.query(`
        INSERT INTO return_refunds (
          return_id,
          amount,
          method,
          status,
          transaction_id,
          gateway,
          gateway_response,
          notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        returnId,
        returnItem.refund_total,
        method,
        'completed',
        transactionId,
        gateway,
        gatewayResponse ? JSON.stringify(gatewayResponse) : null,
        notes
      ]);

      // Update return status
      await this.db.query(`
        UPDATE returns
        SET status = 'refunded', refunded_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [returnId]);

      // Update order item returned quantity
      await this.db.query(`
        UPDATE order_items oi
        SET returned_quantity = COALESCE(returned_quantity, 0) + $2
        FROM returns r
        WHERE oi.id = r.order_item_id AND r.id = $1
      `, [returnId, returnItem.quantity]);

      await this.db.query('COMMIT');

      return {
        return: returnItem,
        refund: refundResult.rows[0]
      };
    } catch (error) {
      await this.db.query('ROLLBACK');
      console.error('Error processing refund:', error);
      throw error;
    }
  }

  /**
   * Get returns for a user
   */
  async getUserReturns(userId, filters = {}) {
    const { status, orderId } = filters;
    
    let query = `
      SELECT 
        r.*,
        o.order_number,
        v.store_name as vendor_name
      FROM returns r
      JOIN orders o ON r.order_id = o.id
      JOIN vendors v ON r.vendor_id = v.id
      WHERE r.user_id = $1
    `;
    
    const params = [userId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND r.status = $${paramCount}`;
      params.push(status);
    }

    if (orderId) {
      paramCount++;
      query += ` AND r.order_id = $${paramCount}`;
      params.push(orderId);
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get returns for a vendor
   */
  async getVendorReturns(vendorId, filters = {}) {
    const { status } = filters;
    
    let query = `
      SELECT 
        r.*,
        o.order_number,
        u.first_name,
        u.last_name,
        u.email
      FROM returns r
      JOIN orders o ON r.order_id = o.id
      JOIN users u ON r.user_id = u.id
      WHERE r.vendor_id = $1
    `;
    
    const params = [vendorId];

    if (status) {
      query += ` AND r.status = $2`;
      params.push(status);
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get return statistics for a vendor
   */
  async getVendorReturnStats(vendorId) {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as total_returns,
        COUNT(CASE WHEN status = 'requested' THEN 1 END) as pending_returns,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_returns,
        COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_returns,
        COALESCE(SUM(refund_total), 0) as total_refund_amount
      FROM returns
      WHERE vendor_id = $1
    `, [vendorId]);

    return result.rows[0];
  }
}

module.exports = ReturnsService;
