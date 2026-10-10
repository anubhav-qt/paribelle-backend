import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request, Query, Res, Headers, NotFoundException, BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { OrderStatus } from './order.entity';
import { ReviewsService } from '../reviews/reviews.service';
import { Response } from 'express';
import { codEnabled } from '../../common/features';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly reviewsService: ReviewsService,
  ) {}

  @Post()
  create(@Request() req, @Body() createOrderDto: any, @Headers('idempotency-key') idempotencyKey?: string) {
    // A checkout without a method used to fall back to COD. With COD archived
    // (COD_ENABLED off) the store is prepaid only. Checked here, on the
    // shopper's route, because the service also places replacement and
    // refusal orders that ride on an existing order's payment.
    const method = createOrderDto?.paymentMethod;
    if (!codEnabled() && (!method || method === 'cod')) {
      throw new BadRequestException('Cash on Delivery isn\'t available. Please pay online (UPI, card or net banking).');
    }
    return this.ordersService.create(req.user.id, createOrderDto, idempotencyKey);
  }

  @Get()
  findAll(@Request() req, @Query('status') status?: string) {
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
   * A dispatched COD order was refused at the door. Admin picks one of two
   * outcomes here; the third ("exchange, as requested") goes through
   * `POST /orders/:id/cod-refused-exchange` instead, since it needs a
   * replacement product.
   */
  @Post(':id/cod-refused')
  @AdminOnly()
  resolveCodRefusal(
    @Param('id') id: string,
    @Body() body: { decision: 'credit' | 'nothing'; creditAmount?: number; reason?: string },
  ) {
    return this.ordersService.resolveCodRefusal(id, body.decision, {
      creditAmount: body.creditAmount,
      reason: body.reason,
    });
  }

  @Post(':id/cod-refused-exchange')
  @AdminOnly()
  resolveCodRefusalWithExchange(
    @Param('id') id: string,
    @Body() body: { productId: string; variantId: string; quantity: number; reason?: string },
  ) {
    return this.ordersService.resolveCodRefusalWithExchange(
      id,
      body.productId,
      body.variantId,
      body.quantity,
      body.reason || '',
    );
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
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: OrderStatus; reason?: string; trackingNumber?: string; carrier?: string },
  ) {
    return this.ordersService.updateStatus(id, body.status, body.reason, {
      trackingNumber: body.trackingNumber,
      carrier: body.carrier,
    });
  }

  @Patch(':id/payment-status')
  @AdminOnly()
  updatePaymentStatus(@Param('id') id: string, @Body() body: { paymentStatus: string }) {
    return this.ordersService.updatePaymentStatus(id, body.paymentStatus);
  }

  @Get(':id/review')
  async getOrderReviews(@Param('id') id: string, @Request() req) {
    return { items: await this.reviewsService.getOrderItemsWithReviews(id, req.user.id) };
  }

  @Get(':id/invoice/download')
  async downloadInvoice(
    @Param('id') id: string,
    @Request() req,
    @Res() res: Response,
  ) {
    return this.ordersService.downloadOrderInvoice(id, req.user, res);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.ordersService.findOne(id, req.user.id);
  }
}
