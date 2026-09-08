import { Controller, Post, Body, Get, Param, Headers, HttpCode, HttpStatus, UseGuards, Req, Request, RawBodyRequest, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { IsString, IsNotEmpty, IsOptional, IsIn, IsNumber, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { UserRole } from '../users/user.entity';
import { PaymentsService } from './payments.service';

export class CreatePaymentOrderDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsOptional()
  currency?: string;
}

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  razorpayOrderId: string;

  @IsString()
  @IsNotEmpty()
  razorpayPaymentId: string;

  @IsString()
  @IsNotEmpty()
  razorpaySignature: string;

  @IsOptional()
  @IsIn(['success', 'failed'])
  status?: 'success' | 'failed';
}

export class RefundPaymentDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;
}

/**
 * `webhook` stays unauthenticated on purpose — Razorpay calls it, and it is
 * authenticated by HMAC signature inside the service, not by a JWT.
 */
@ApiTags('payments')
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
    @Body() body: CreatePaymentOrderDto,
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
    @Body() body: VerifyPaymentDto,
  ) {
    return await this.paymentsService.updatePaymentStatus(
      body.razorpayOrderId,
      body.razorpayPaymentId,
      body.razorpaySignature,
      body.status || 'success',
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
    @Body() body: RefundPaymentDto,
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
