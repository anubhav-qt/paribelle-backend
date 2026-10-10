/**
 * Invoice Service
 * Handles invoice generation for orders including return and refund adjustments
 * Uses shared utilities and avoids inline styles
 */

const { Client } = require('pg');

class InvoiceService {
  constructor(dbClient) {
    this.db = dbClient;
  }

  /**
   * Generate invoice for an order with return adjustments
   */
  async generateInvoiceWithReturns(orderId) {
    try {
      // Get order details
      const orderResult = await this.db.query(`
        SELECT 
          o.*,
          v.business_name as vendor_business_name,
          v.store_name as vendor_store_name,
          v.gst_number as vendor_gst,
          v.pan_number as vendor_pan,
          v.address as vendor_address,
          v.city as vendor_city,
          v.state as vendor_state,
          v.postal_code as vendor_postal_code,
          v.country as vendor_country,
          v.contact_email as vendor_email,
          v.contact_phone as vendor_phone,
          u.first_name,
          u.last_name,
          u.email as customer_email
        FROM orders o
        JOIN vendors v ON o.vendor_id = v.id
        JOIN users u ON o.user_id = u.id
        WHERE o.id = $1
      `, [orderId]);

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = orderResult.rows[0];

      // Get order items with return information
      const itemsResult = await this.db.query(`
        SELECT 
          oi.*,
          COALESCE(SUM(r.quantity), 0) as returned_quantity,
          COALESCE(SUM(CASE WHEN r.status = 'refunded' THEN r.refund_total ELSE 0 END), 0) as refunded_amount
        FROM order_items oi
        LEFT JOIN returns r ON r.order_item_id = oi.id AND r.status = 'refunded'
        WHERE oi.order_id = $1
        GROUP BY oi.id
      `, [orderId]);

      const items = itemsResult.rows;

      // Calculate totals - show original order amounts, then subtract returns
      let subtotal = 0;
      let totalTax = 0;
      let totalRefunded = 0;

      const invoiceItems = items.map(item => {
        // Calculate based on ORIGINAL quantity ordered
        const itemSubtotal = item.price * item.quantity;
        const itemTax = item.tax || 0;
        
        subtotal += itemSubtotal;
        totalTax += itemTax;
        totalRefunded += parseFloat(item.refunded_amount || 0);

        return {
          ...item,
          returned_quantity: item.returned_quantity,
          item_subtotal: itemSubtotal,
          item_tax: itemTax,
          item_total: itemSubtotal + itemTax
        };
      });

      // Calculate invoice total from original order
      const originalTotal = subtotal + totalTax + (order.shipping_cost || 0) - (order.discount || 0);
      // Subtract refunds for returned items
      const finalAmount = originalTotal - totalRefunded;

      return {
        order,
        items: invoiceItems,
        totals: {
          subtotal,
          tax: totalTax,
          shipping: order.shipping_cost || 0,
          discount: order.discount || 0,
          invoice_total: originalTotal,
          refunded: totalRefunded,
          final_amount: finalAmount
        },
        has_returns: totalRefunded > 0
      };
    } catch (error) {
      console.error('Error generating invoice with returns:', error);
      throw error;
    }
  }

  /**
   * Generate credit note for a return
   */
  async generateCreditNote(returnId) {
    try {
      const result = await this.db.query(`
        SELECT 
          r.*,
          o.order_number,
          o.vendor_id,
          oi.product_name,
          oi.product_sku,
          oi.product_image,
          v.business_name as vendor_business_name,
          v.store_name as vendor_store_name,
          v.gst_number as vendor_gst,
          v.address as vendor_address,
          v.city as vendor_city,
          v.state as vendor_state,
          v.postal_code as vendor_postal_code,
          v.country as vendor_country,
          u.first_name,
          u.last_name,
          u.email as customer_email,
          o.shipping_address,
          o.shipping_city,
          o.shipping_state,
          o.shipping_postal_code
        FROM returns r
        JOIN orders o ON r.order_id = o.id
        JOIN order_items oi ON r.order_item_id = oi.id
        JOIN vendors v ON r.vendor_id = v.id
        JOIN users u ON r.user_id = u.id
        WHERE r.id = $1 AND r.status = 'refunded'
      `, [returnId]);

      if (result.rows.length === 0) {
        throw new Error('Return not found or not refunded');
      }

      const creditNote = result.rows[0];

      // Get refund transaction details
      const refundResult = await this.db.query(`
        SELECT * FROM return_refunds WHERE return_id = $1
      `, [returnId]);

      creditNote.refund_transaction = refundResult.rows[0];

      return creditNote;
    } catch (error) {
      console.error('Error generating credit note:', error);
      throw error;
    }
  }

  /**
   * Create invoice record in database
   */
  async createInvoiceRecord(orderId, type = 'customer') {
    try {
      const invoiceData = await this.generateInvoiceWithReturns(orderId);
      const order = invoiceData.order;
      const totals = invoiceData.totals;

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(type);

      // Create invoice
      const invoiceResult = await this.db.query(`
        INSERT INTO invoices (
          invoice_number,
          type,
          status,
          invoice_date,
          due_date,
          subtotal,
          tax,
          discount,
          shipping_cost,
          total,
          billing_name,
          billing_email,
          billing_phone,
          billing_address,
          billing_city,
          billing_state,
          billing_postal_code,
          billing_country,
          gst_number,
          order_id,
          vendor_id,
          customer_id,
          notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23
        )
        RETURNING *
      `, [
        invoiceNumber,
        type,
        'sent',
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        totals.subtotal,
        totals.tax,
        totals.discount,
        totals.shipping,
        totals.final_amount,
        `${order.first_name} ${order.last_name}`,
        order.customer_email,
        order.shipping_phone,
        order.shipping_address,
        order.shipping_city,
        order.shipping_state,
        order.shipping_postal_code,
        order.shipping_country,
        null, // customer GST if available
        orderId,
        order.vendor_id,
        order.user_id,
        invoiceData.has_returns ? 'Invoice adjusted for returned items' : null
      ]);

      const invoice = invoiceResult.rows[0];

      // Create invoice items
      for (const item of invoiceData.items) {
        await this.db.query(`
          INSERT INTO invoice_items (
            invoice_id,
            product_id,
            name,
            description,
            quantity,
            unit_price,
            total,
            tax_amount,
            tax_rate,
            hsn_code
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          invoice.id,
          item.product_id,
          item.product_name,
          item.returned_quantity > 0 
            ? `Original quantity: ${item.quantity}, Returned: ${item.returned_quantity}` 
            : null,
          item.quantity,  // Show original quantity, not effective quantity
          item.price,
          item.item_total,
          item.item_tax,
          item.gst_rate,
          item.hsn_code
        ]);
      }

      return {
        invoice,
        items: invoiceData.items,
        totals: invoiceData.totals
      };
    } catch (error) {
      console.error('Error creating invoice record:', error);
      throw error;
    }
  }

  /**
   * Generate unique invoice number
   */
  async generateInvoiceNumber(type = 'customer') {
    const prefix = type === 'customer' ? 'INV' : 'VND';
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    
    const result = await this.db.query(`
      SELECT COUNT(*) as count
      FROM invoices
      WHERE DATE(created_at) = CURRENT_DATE AND type = $1
    `, [type]);

    const sequence = (parseInt(result.rows[0].count) + 1).toString().padStart(4, '0');
    return `${prefix}-${dateStr}-${sequence}`;
  }

  /**
   * Get invoice with return information
   */
  async getInvoiceWithReturns(invoiceId) {
    try {
      const invoiceResult = await this.db.query(`
        SELECT 
          i.*,
          o.order_number,
          v.store_name as vendor_name
        FROM invoices i
        JOIN orders o ON i.order_id = o.id
        LEFT JOIN vendors v ON i.vendor_id = v.id
        WHERE i.id = $1
      `, [invoiceId]);

      if (invoiceResult.rows.length === 0) {
        throw new Error('Invoice not found');
      }

      const invoice = invoiceResult.rows[0];

      // Get invoice items
      const itemsResult = await this.db.query(`
        SELECT * FROM invoice_items WHERE invoice_id = $1
      `, [invoiceId]);

      // Get returns for this order
      const returnsResult = await this.db.query(`
        SELECT 
          r.*,
          oi.product_name
        FROM returns r
        JOIN order_items oi ON r.order_item_id = oi.id
        WHERE r.order_id = $1 AND r.status = 'refunded'
      `, [invoice.order_id]);

      return {
        invoice,
        items: itemsResult.rows,
        returns: returnsResult.rows
      };
    } catch (error) {
      console.error('Error fetching invoice with returns:', error);
      throw error;
    }
  }
}

module.exports = InvoiceService;
