import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request, Query, Res, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
  create(@Request() req, @Body() createOrderDto: any) {
    return this.ordersService.create(req.user.id, createOrderDto);
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
  findAllForAdmin(@Request() req) {
    // TODO: Add admin role check guard
    return this.ordersService.findAllForAdmin();
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Request() req, @Body() body: { reason?: string }) {
    return this.ordersService.cancel(id, req.user.id, body.reason);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: OrderStatus }) {
    return this.ordersService.updateStatus(id, body.status);
  }

  @Patch(':id/payment-status')
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

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.ordersService.findOne(id, req.user.id);
  }
}
