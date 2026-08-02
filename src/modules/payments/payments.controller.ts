import { Controller, Post, Body, Get, Param, Headers, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
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

  @Post('create-order')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createOrder(@Body() body: { orderId: string; amount: number; currency?: string }) {
    return await this.paymentsService.createRazorpayOrder(
      body.orderId,
      body.amount,
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
    @Headers('x-razorpay-signature') signature: string,
  ) {
    return await this.paymentsService.handleWebhook(body, signature);
  }

  @Get('razorpay-key')
  getRazorpayKey() {
    return {
      keyId: this.paymentsService.getRazorpayKeyId(),
    };
  }
}
