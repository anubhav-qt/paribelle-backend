/**
 * Returns API Routes
 * Endpoints for managing individual order item returns
 * Uses shared components and avoids inline styles
 */

const express = require('express');
const router = express.Router();
const ReturnsService = require('../services/ReturnsService');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * @route   POST /api/returns/check-eligibility
 * @desc    Check if an order item is eligible for return
 * @access  Private (Customer)
 */
router.post('/check-eligibility', authenticateToken, async (req, res) => {
  try {
    const { orderId, orderItemId } = req.body;
    const userId = req.user.id;

    if (!orderId || !orderItemId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and Order Item ID are required'
      });
    }

    const returnsService = new ReturnsService(req.db);
    const eligibility = await returnsService.checkReturnEligibility(
      orderId,
      orderItemId,
      userId
    );

    res.json({
      success: true,
      data: eligibility
    });
  } catch (error) {
    console.error('Error checking return eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check return eligibility',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/returns
 * @desc    Create a new return request
 * @access  Private (Customer)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      orderId,
      orderItemId,
      quantity,
      reason,
      customerNotes,
      images
    } = req.body;

    // Validation
    if (!orderId || !orderItemId || !quantity || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Order ID, Order Item ID, quantity, and reason are required'
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      });
    }

    const returnsService = new ReturnsService(req.db);
    const returnRequest = await returnsService.createReturnRequest({
      orderId,
      orderItemId,
      userId: req.user.id,
      quantity,
      reason,
      customerNotes,
      images
    });

    res.status(201).json({
      success: true,
      message: 'Return request created successfully',
      data: returnRequest
    });
  } catch (error) {
    console.error('Error creating return request:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create return request',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/returns/my-returns
 * @desc    Get all returns for the authenticated user
 * @access  Private (Customer)
 */
router.get('/my-returns', authenticateToken, async (req, res) => {
  try {
    const { status, orderId } = req.query;
    const userId = req.user.id;

    const returnsService = new ReturnsService(req.db);
    const returns = await returnsService.getUserReturns(userId, {
      status,
      orderId
    });

    res.json({
      success: true,
      data: returns
    });
  } catch (error) {
    console.error('Error fetching user returns:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch returns',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/returns/vendor/:vendorId
 * @desc    Get all returns for a vendor
 * @access  Private (Vendor, Admin)
 */
router.get('/vendor/:vendorId', authenticateToken, authorizeRoles('vendor', 'admin'), async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { status } = req.query;

    // Vendors can only see their own returns
    if (req.user.role === 'vendor' && req.user.vendorId !== vendorId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const returnsService = new ReturnsService(req.db);
    const returns = await returnsService.getVendorReturns(vendorId, { status });

    res.json({
      success: true,
      data: returns
    });
  } catch (error) {
    console.error('Error fetching vendor returns:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor returns',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/returns/vendor/:vendorId/stats
 * @desc    Get return statistics for a vendor
 * @access  Private (Vendor, Admin)
 */
router.get('/vendor/:vendorId/stats', authenticateToken, authorizeRoles('vendor', 'admin'), async (req, res) => {
  try {
    const { vendorId } = req.params;

    // Vendors can only see their own stats
    if (req.user.role === 'vendor' && req.user.vendorId !== vendorId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const returnsService = new ReturnsService(req.db);
    const stats = await returnsService.getVendorReturnStats(vendorId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching vendor return stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch return statistics',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/returns/:returnId/approve
 * @desc    Approve a return request
 * @access  Private (Vendor, Admin)
 */
router.put('/:returnId/approve', authenticateToken, authorizeRoles('vendor', 'admin'), async (req, res) => {
  try {
    const { returnId } = req.params;
    const { vendorNotes } = req.body;
    const approvedBy = req.user.id;

    const returnsService = new ReturnsService(req.db);
    const approvedReturn = await returnsService.approveReturn(
      returnId,
      approvedBy,
      vendorNotes
    );

    res.json({
      success: true,
      message: 'Return request approved successfully',
      data: approvedReturn
    });
  } catch (error) {
    console.error('Error approving return:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve return request',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/returns/:returnId/reject
 * @desc    Reject a return request
 * @access  Private (Vendor, Admin)
 */
router.put('/:returnId/reject', authenticateToken, authorizeRoles('vendor', 'admin'), async (req, res) => {
  try {
    const { returnId } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const rejectedBy = req.user.id;

    const returnsService = new ReturnsService(req.db);
    const rejectedReturn = await returnsService.rejectReturn(
      returnId,
      rejectedBy,
      rejectionReason
    );

    res.json({
      success: true,
      message: 'Return request rejected',
      data: rejectedReturn
    });
  } catch (error) {
    console.error('Error rejecting return:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reject return request',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/returns/:returnId/received
 * @desc    Mark return as received by vendor
 * @access  Private (Vendor, Admin)
 */
router.put('/:returnId/received', authenticateToken, authorizeRoles('vendor', 'admin'), async (req, res) => {
  try {
    const { returnId } = req.params;
    const { trackingNumber, carrier } = req.body;

    const returnsService = new ReturnsService(req.db);
    const receivedReturn = await returnsService.markReturnReceived(
      returnId,
      trackingNumber,
      carrier
    );

    res.json({
      success: true,
      message: 'Return marked as received',
      data: receivedReturn
    });
  } catch (error) {
    console.error('Error marking return as received:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark return as received',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/returns/:returnId/refund
 * @desc    Process refund for a return
 * @access  Private (Admin)
 */
router.post('/:returnId/refund', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { returnId } = req.params;
    const { method, transactionId, gateway, gatewayResponse, notes } = req.body;

    if (!method) {
      return res.status(400).json({
        success: false,
        message: 'Refund method is required'
      });
    }

    const returnsService = new ReturnsService(req.db);
    const result = await returnsService.processRefund(returnId, {
      method,
      transactionId,
      gateway,
      gatewayResponse,
      notes
    });

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: result
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process refund',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/returns/:returnId
 * @desc    Get details of a specific return
 * @access  Private
 */
router.get('/:returnId', authenticateToken, async (req, res) => {
  try {
    const { returnId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const result = await req.db.query(`
      SELECT 
        r.*,
        o.order_number,
        v.store_name as vendor_name,
        u.first_name,
        u.last_name,
        u.email,
        oi.product_image,
        (SELECT json_agg(rr) FROM return_refunds rr WHERE rr.return_id = r.id) as refunds
      FROM returns r
      JOIN orders o ON r.order_id = o.id
      JOIN vendors v ON r.vendor_id = v.id
      JOIN users u ON r.user_id = u.id
      JOIN order_items oi ON r.order_item_id = oi.id
      WHERE r.id = $1
    `, [returnId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Return not found'
      });
    }

    const returnData = result.rows[0];

    // Check access permissions
    if (
      userRole !== 'admin' &&
      returnData.user_id !== userId &&
      (userRole !== 'vendor' || returnData.vendor_id !== req.user.vendorId)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: returnData
    });
  } catch (error) {
    console.error('Error fetching return details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch return details',
      error: error.message
    });
  }
});

module.exports = router;
