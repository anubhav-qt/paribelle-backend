import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request, Query, Res, Headers, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { OrderStatus } from './order.entity';
import { ReviewsService } from '../reviews/reviews.service';
import { Response } from 'express';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly reviewsService: ReviewsService,
  ) {}

  @Post()
  create(@Request() req, @Body() createOrderDto: any, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.ordersService.create(req.user.id, createOrderDto, idempotencyKey);
  }

  @Get()
  findAll(@Request() req, @Query('vendorId') vendorId?: string, @Query('status') status?: string) {
    if (vendorId) {
      return this.ordersService.findByVendorId(vendorId);
    }
    if (status) {
      return this.ordersService.findByUserAndStatus(req.user.id, status as OrderStatus);
    }
    return this.ordersService.findAll(req.user.id);
  }

  @Get('admin/all')
  @AdminOnly()
  findAllForAdmin(@Request() req) {
    return this.ordersService.findAllForAdmin();
  }

  @Get('wallet-balance')
  async getWalletBalance(@Request() req) {
    const balance = await this.ordersService.getWalletBalance(req.user.id);
    return { balance };
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Request() req, @Body() body: { reason?: string }) {
    return this.ordersService.cancel(id, req.user.id, body.reason);
  }

  /**
   * The customer's payment attempt failed or they dismissed the gateway. Lets
   * the checkout page release the order immediately rather than waiting on a
   * webhook that never arrives when the modal is simply closed.
   */
  @Patch(':id/payment-failed')
  async paymentFailed(@Param('id') id: string, @Request() req, @Body() body: { reason?: string }) {
    const order = await this.ordersService.findOne(id, req.user.id);
    if (!order) throw new NotFoundException('Order not found');
    return this.ordersService.markPaymentFailed(id, body?.reason || 'Payment not completed');
  }

  @Patch(':id/status')
  @AdminOnly()
  updateStatus(@Param('id') id: string, @Body() body: { status: OrderStatus }) {
    return this.ordersService.updateStatus(id, body.status);
  }

  @Patch(':id/payment-status')
  @AdminOnly()
  updatePaymentStatus(@Param('id') id: string, @Body() body: { paymentStatus: string }) {
    return this.ordersService.updatePaymentStatus(id, body.paymentStatus);
  }

  @Post(':id/refund')
  requestRefund(@Param('id') id: string, @Request() req, @Body() body: { reason: string }) {
    return this.ordersService.requestRefund(id, req.user.id, body.reason);
  }

  @Post(':id/return')
  requestReturn(@Param('id') id: string, @Request() req, @Body() body: { reason: string; itemIds?: string[] }) {
    return this.ordersService.requestReturn(id, req.user.id, body.reason, body.itemIds);
  }

  @Post(':id/items/:itemId/return')
  requestItemReturn(
    @Param('id') orderId: string,
    @Param('itemId') orderItemId: string,
    @Request() req,
    @Body() body: { quantity: number; reason: string; customerNotes?: string; images?: string[] }
  ) {
    return this.ordersService.requestItemReturn(
      orderId,
      orderItemId,
      req.user.id,
      body.quantity,
      body.reason,
      body.customerNotes,
      body.images
    );
  }

  @Post(':id/return/approve')
  approveReturnRequest(@Param('id') id: string) {
    return this.ordersService.approveReturnRequest(id);
  }

  @Post(':id/return/confirm-received')
  confirmItemReceived(@Param('id') id: string, @Body() body: { itemIds?: string[] }) {
    return this.ordersService.confirmItemReceived(id, body.itemIds);
  }

  @Post(':id/return/reject')
  rejectReturn(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.ordersService.rejectReturn(id, body.reason);
  }

  @Post(':orderId/returns/bulk-request')
  requestBulkReturns(
    @Param('orderId') orderId: string,
    @Request() req,
    @Body() body: { 
      items: Array<{
        orderItemId: string;
        quantity: number;
        reason: string;
        customerNotes?: string;
        images?: string[];
      }>
    }
  ) {
    return this.ordersService.requestBulkReturns(orderId, req.user.id, body.items);
  }

  @Post(':orderId/returns/approve-all')
  approveAllReturns(@Param('orderId') orderId: string) {
    return this.ordersService.approveAllReturns(orderId);
  }

  @Post(':orderId/returns/reject-all')
  rejectAllReturns(@Param('orderId') orderId: string, @Body() body: { reason: string }) {
    return this.ordersService.rejectAllReturns(orderId, body.reason);
  }

  @Post(':orderId/returns/confirm-all')
  confirmAllReturns(@Param('orderId') orderId: string) {
    return this.ordersService.confirmAllReturns(orderId);
  }

  @Post('returns/:returnId/approve')
  approveItemReturn(@Param('returnId') returnId: string) {
    return this.ordersService.approveItemReturn(returnId);
  }

  @Post('returns/:returnId/reject')
  rejectItemReturn(@Param('returnId') returnId: string, @Body() body: { reason: string }) {
    return this.ordersService.rejectItemReturn(returnId, body.reason);
  }

  @Post('returns/:returnId/received')
  confirmItemReturnReceived(@Param('returnId') returnId: string, @Body() body: { refundNow?: boolean }) {
    return this.ordersService.confirmItemReturnReceived(returnId, body.refundNow);
  }

  @Get(':id/review')
  async getOrderReviews(@Param('id') id: string, @Request() req) {
    const [items, vendorReview] = await Promise.all([
      this.reviewsService.getOrderItemsWithReviews(id, req.user.id),
      this.reviewsService.getOrderVendorReview(id, req.user.id),
    ]);

    return {
      items,
      vendorReview,
    };
  }

  @Get(':id/invoice/download')
  async downloadInvoice(
    @Param('id') id: string,
    @Request() req,
    @Res() res: Response,
  ) {
    return this.ordersService.downloadOrderInvoice(id, req.user.id, res);
  }

  @Get(':id/return-details')
  getReturnDetails(@Param('id') id: string) {
    return this.ordersService.getReturnDetails(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.ordersService.findOne(id, req.user.id);
  }
}
