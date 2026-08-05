import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request, Query, Res, Headers, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { UserRole } from '../users/user.entity';
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
      // `findByVendorId` joins `order.user`, so it returns every customer's
      // name, email and shipping address for that vendor's orders. It was
      // reachable by any signed-in user who supplied a vendor id — nothing
      // tied the id to the caller. Restricted to admins; no frontend caller
      // uses this branch, the admin UI reads `GET /orders/admin/all`.
      const isAdmin =
        req.user.role === UserRole.SUPER_ADMIN || req.user.role === UserRole.VENDOR_ADMIN;
      if (!isAdmin) {
        throw new ForbiddenException('Not allowed to list another seller\'s orders');
      }
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

  @Get('admin/stats')
  @AdminOnly()
  getAdminStats() {
    return this.ordersService.getAdminStats();
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

  // The four endpoints below started the old "return or refund" flow. Store
  // policy changed (see Task 8 in the implementation plan): no refunds, no
  // customer-initiated returns — only an exchange, requested via
  // POST /orders/:orderId/items/:orderItemId/exchange. Refused here at the
  // API with the policy stated, rather than deleted — the service methods
  // and the historic rows they created stay intact and still render in
  // admin; a customer just cannot start a new one this way any more.
  private static readonly RETIRED_RETURN_POLICY_MESSAGE =
    'Returns and refunds are no longer offered. Once your order is delivered, ' +
    'you can request an exchange for a different variant of the same item instead.';

  @Post(':id/refund')
  requestRefund() {
    throw new BadRequestException(OrdersController.RETIRED_RETURN_POLICY_MESSAGE);
  }

  @Post(':id/return')
  requestReturn() {
    throw new BadRequestException(OrdersController.RETIRED_RETURN_POLICY_MESSAGE);
  }

  @Post(':id/items/:itemId/return')
  requestItemReturn() {
    throw new BadRequestException(OrdersController.RETIRED_RETURN_POLICY_MESSAGE);
  }

  // Everything below decides the outcome of a return: approving it, rejecting
  // it, confirming the goods came back, and — through the credit notes those
  // trigger — moving money. They are store decisions, so every one of them is
  // `@AdminOnly()`. Until this was added they carried only the class-level
  // `JwtAuthGuard`, which authenticates but does not authorise: any signed-in
  // customer could approve their own return and issue their own credit note.
  @Post(':id/return/approve')
  @AdminOnly()
  approveReturnRequest(@Param('id') id: string) {
    return this.ordersService.approveReturnRequest(id);
  }

  @Post(':id/return/confirm-received')
  @AdminOnly()
  confirmItemReceived(@Param('id') id: string, @Body() body: { itemIds?: string[] }) {
    return this.ordersService.confirmItemReceived(id, body.itemIds);
  }

  @Post(':id/return/reject')
  @AdminOnly()
  rejectReturn(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.ordersService.rejectReturn(id, body.reason);
  }

  @Post(':orderId/returns/bulk-request')
  requestBulkReturns() {
    throw new BadRequestException(OrdersController.RETIRED_RETURN_POLICY_MESSAGE);
  }

  @Post(':orderId/returns/approve-all')
  @AdminOnly()
  approveAllReturns(@Param('orderId') orderId: string) {
    return this.ordersService.approveAllReturns(orderId);
  }

  @Post(':orderId/returns/reject-all')
  @AdminOnly()
  rejectAllReturns(@Param('orderId') orderId: string, @Body() body: { reason: string }) {
    return this.ordersService.rejectAllReturns(orderId, body.reason);
  }

  @Post(':orderId/returns/confirm-all')
  @AdminOnly()
  confirmAllReturns(@Param('orderId') orderId: string) {
    return this.ordersService.confirmAllReturns(orderId);
  }

  @Post('returns/:returnId/approve')
  @AdminOnly()
  approveItemReturn(@Param('returnId') returnId: string) {
    return this.ordersService.approveItemReturn(returnId);
  }

  @Post('returns/:returnId/reject')
  @AdminOnly()
  rejectItemReturn(@Param('returnId') returnId: string, @Body() body: { reason: string }) {
    return this.ordersService.rejectItemReturn(returnId, body.reason);
  }

  @Post('returns/:returnId/received')
  @AdminOnly()
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

  /**
   * Both the customer's orders page and the admin's read this, so it cannot be
   * `@AdminOnly()`. It is scoped in the service instead: a customer sees only
   * their own order's return details. Previously any signed-in user could read
   * any order's — including the RMA number and the return address — given only
   * its id.
   */
  @Get(':id/return-details')
  getReturnDetails(@Param('id') id: string, @Request() req) {
    return this.ordersService.getReturnDetails(id, req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.ordersService.findOne(id, req.user.id);
  }
}
