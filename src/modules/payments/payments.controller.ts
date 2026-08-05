import { Controller, Post, Body, Get, Param, Headers, HttpCode, HttpStatus, UseGuards, Req, Request, RawBodyRequest, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { UserRole } from '../users/user.entity';
import { PaymentsService } from './payments.service';

/**
 * `webhook` stays unauthenticated on purpose — Razorpay calls it, and it is
 * authenticated by HMAC signature inside the service, not by a JWT.
 */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * The amount charged comes from the order itself, never from `body.amount`
   * — a client that controls the price paid can pay whatever it likes for
   * whatever it orders. `OrdersService.findOne(orderId, userId)` throws
   * `NotFoundException` for an order that doesn't exist *or* doesn't belong
   * to the caller, which is also the ownership check: nobody could
   * previously start a Razorpay payment against another customer's order id.
   */
  @Post('create-order')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createOrder(
    @Request() req,
    @Body() body: { orderId: string; currency?: string },
  ) {
    return await this.paymentsService.createRazorpayOrder(
      body.orderId,
      req.user.id,
      body.currency || 'INR',
    );
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async verifyPayment(
    @Body()
    body: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
      status: 'success' | 'failed';
    },
  ) {
    return await this.paymentsService.updatePaymentStatus(
      body.razorpayOrderId,
      body.razorpayPaymentId,
      body.razorpaySignature,
      body.status,
    );
  }

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getPaymentByOrder(@Param('orderId') orderId: string) {
    return await this.paymentsService.getPaymentByOrderId(orderId);
  }

  @Post('refund/:paymentId')
  @AdminOnly(UserRole.SUPER_ADMIN)
  async refundPayment(
    @Param('paymentId') paymentId: string,
    @Body() body: { amount?: number },
  ) {
    return await this.paymentsService.initiateRefund(paymentId, body.amount);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: any,
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    // Razorpay signs the exact bytes it sent. `req.rawBody` is that buffer,
    // captured by main.ts's `rawBody: true`; `body` is the parsed object the
    // rest of the handler still needs to read `event` and `payload` from.
    if (!req.rawBody) {
      throw new BadRequestException('Raw request body was not captured for signature verification');
    }
    return await this.paymentsService.handleWebhook(body, req.rawBody, signature);
  }

  @Get('razorpay-key')
  getRazorpayKey() {
    return {
      keyId: this.paymentsService.getRazorpayKeyId(),
    };
  }
}
