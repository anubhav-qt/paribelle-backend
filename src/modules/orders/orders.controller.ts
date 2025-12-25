import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrderStatus } from './order.entity';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Request() req, @Body() createOrderDto: any) {
    return this.ordersService.create(req.user.id, createOrderDto);
  }

  @Get()
  findAll(@Request() req, @Query('vendorId') vendorId?: string) {
    if (vendorId) {
      return this.ordersService.findByVendorId(vendorId);
    }
    return this.ordersService.findAll(req.user.id);
  }

  @Get('admin/all')
  findAllForAdmin(@Request() req) {
    // TODO: Add admin role check guard
    return this.ordersService.findAllForAdmin();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.ordersService.findOne(id, req.user.id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Request() req, @Body() body: { reason?: string }) {
    return this.ordersService.cancel(id, req.user.id, body.reason);
  }

  @Post(':id/refund')
  requestRefund(@Param('id') id: string, @Request() req, @Body() body: { reason: string }) {
    return this.ordersService.requestRefund(id, req.user.id, body.reason);
  }

  @Post(':id/return')
  requestReturn(@Param('id') id: string, @Request() req, @Body() body: { reason: string; itemIds?: string[] }) {
    return this.ordersService.requestReturn(id, req.user.id, body.reason, body.itemIds);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: OrderStatus }) {
    return this.ordersService.updateStatus(id, body.status);
  }
}
