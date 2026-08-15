import { Controller, Get, Post, Body, Param, UseGuards, Request, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ExchangesService } from './exchanges.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { UserRole } from '../users/user.entity';
import { InspectionResult } from './return.entity';

@Controller()
@UseGuards(JwtAuthGuard)
export class ExchangesController {
  constructor(private readonly exchangesService: ExchangesService) {}

  @Post('orders/:orderId/items/:orderItemId/exchange')
  requestExchange(
    @Param('orderId') orderId: string,
    @Param('orderItemId') orderItemId: string,
    @Request() req,
    @Body() body: {
      quantity: number;
      reason: string;
      exchangeVariantId?: string | null;
      /** Required — uploaded first via `POST upload/exchange-video`. */
      videoUrl: string;
      customerNotes?: string;
      images?: string[];
      /** How the customer wants to pay the courier charge, when there is one. */
      courierChargePaymentMethod?: 'wallet' | 'cod' | 'online' | null;
    },
  ) {
    return this.exchangesService.request(
      orderId,
      orderItemId,
      req.user.id,
      body.quantity,
      body.reason,
      body.exchangeVariantId,
      body.videoUrl,
      body.customerNotes,
      body.images,
      body.courierChargePaymentMethod,
    );
  }

  /**
   * Both the customer's own order page and the admin decision panel read
   * this, so it cannot be `@AdminOnly()`. Scoped in the controller (not the
   * service, since the service is also used for admin listings) — a customer
   * sees only their own order's exchange requests.
   */
  @Get('orders/:orderId/exchanges')
  async getOrderExchanges(@Param('orderId') orderId: string, @Request() req) {
    const isAdmin =
      req.user.role === UserRole.SUPER_ADMIN || req.user.role === UserRole.VENDOR_ADMIN;
    const rows = await this.exchangesService.findByOrder(orderId);
    if (!isAdmin && rows.some((r) => r.userId !== req.user.id)) {
      throw new NotFoundException('Order not found');
    }
    return rows;
  }

  @Post('exchanges/:id/in-transit')
  markInTransit(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { trackingNumber?: string },
  ) {
    return this.exchangesService.markInTransit(id, req.user.id, body?.trackingNumber);
  }

  @Get('exchanges/admin/all')
  @AdminOnly()
  findAllForAdmin() {
    return this.exchangesService.findAllForAdmin();
  }

  @Post('exchanges/:id/approve')
  @AdminOnly()
  approve(@Param('id') id: string, @Request() req) {
    return this.exchangesService.approve(id, req.user.id);
  }

  @Post('exchanges/:id/reject')
  @AdminOnly()
  reject(@Param('id') id: string, @Request() req, @Body() body: { reason: string }) {
    return this.exchangesService.reject(id, req.user.id, body.reason);
  }

  @Post('exchanges/:id/inspection')
  @AdminOnly()
  recordInspection(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { result: InspectionResult; notes?: string },
  ) {
    return this.exchangesService.recordInspection(id, req.user.id, body.result, body.notes);
  }

  @Post('exchanges/:id/ship-replacement')
  @AdminOnly()
  shipReplacement(@Param('id') id: string, @Body() body: { trackingNumber?: string }) {
    return this.exchangesService.shipReplacement(id, body?.trackingNumber);
  }

  @Post('exchanges/:id/create-replacement-order')
  @AdminOnly()
  createReplacementOrder(@Param('id') id: string, @Request() req) {
    return this.exchangesService.createReplacementOrder(id, req.user.id);
  }

  @Post('exchanges/:id/settle-as-credit')
  @AdminOnly()
  settleAsCredit(@Param('id') id: string, @Request() req) {
    return this.exchangesService.settleAsCredit(id, req.user.id);
  }
}
