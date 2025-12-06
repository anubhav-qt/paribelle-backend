import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod } from './payment.entity';

@Injectable()
export class PaymentsService {
  private razorpay: Razorpay;

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private configService: ConfigService,
  ) {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    if (keyId && keySecret) {
      this.razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    }
  }

  async createRazorpayOrder(orderId: string, amount: number, currency: string = 'INR') {
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay is not configured');
    }

    try {
      const options = {
        amount: Math.round(amount * 100), // Razorpay expects amount in smallest currency unit (paise)
        currency,
        receipt: orderId,
        notes: {
          orderId,
        },
      };

      const razorpayOrder = await this.razorpay.orders.create(options);

      // Create payment record
      const payment = this.paymentRepository.create({
        transactionId: `txn_${Date.now()}_${orderId}`,
        amount,
        currency,
        method: PaymentMethod.RAZORPAY,
        status: PaymentStatus.PENDING,
        gatewayOrderId: razorpayOrder.id,
        orderId,
        metadata: {
          razorpayOrder,
        },
      });

      await this.paymentRepository.save(payment);

      return {
        id: razorpayOrder.id,
        currency: razorpayOrder.currency,
        amount: razorpayOrder.amount,
        paymentId: payment.id,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to create Razorpay order: ${error.message}`);
    }
  }

  async verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<boolean> {
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay is not configured');
    }

    try {
      const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
      
      if (!keySecret) {
        throw new BadRequestException('Razorpay key secret not configured');
      }
      
      const text = `${razorpayOrderId}|${razorpayPaymentId}`;
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(text)
        .digest('hex');

      return generatedSignature === razorpaySignature;
    } catch (error) {
      console.error('Payment verification error:', error);
      return false;
    }
  }

  async updatePaymentStatus(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    status: 'success' | 'failed',
  ) {
    const payment = await this.paymentRepository.findOne({
      where: { gatewayOrderId: razorpayOrderId },
    });

    if (!payment) {
      throw new BadRequestException('Payment record not found');
    }

    if (status === 'success') {
      const isValid = await this.verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);

      if (!isValid) {
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = 'Signature verification failed';
        await this.paymentRepository.save(payment);
        throw new BadRequestException('Payment signature verification failed');
      }

      payment.status = PaymentStatus.CAPTURED;
      payment.gatewayPaymentId = razorpayPaymentId;
      payment.gatewaySignature = razorpaySignature;
      payment.capturedAt = new Date();
    } else {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = 'Payment failed';
    }

    await this.paymentRepository.save(payment);
    return payment;
  }

  async getPaymentByOrderId(orderId: string) {
    return await this.paymentRepository.findOne({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  async initiateRefund(paymentId: string, amount?: number) {
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay is not configured');
    }

    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    if (payment.status !== PaymentStatus.CAPTURED) {
      throw new BadRequestException('Only captured payments can be refunded');
    }

    try {
      const refundAmount = amount || payment.amount;
      const refund = await this.razorpay.payments.refund(payment.gatewayPaymentId, {
        amount: Math.round(refundAmount * 100),
      });

      payment.refundedAmount = (payment.refundedAmount || 0) + refundAmount;
      payment.refundTransactionId = refund.id;
      payment.refundedAt = new Date();
      
      if (payment.refundedAmount >= payment.amount) {
        payment.status = PaymentStatus.REFUNDED;
      } else {
        payment.status = PaymentStatus.PARTIALLY_REFUNDED;
      }

      await this.paymentRepository.save(payment);

      return {
        success: true,
        refund,
        payment,
      };
    } catch (error) {
      throw new BadRequestException(`Refund failed: ${error.message}`);
    }
  }

  async handleWebhook(body: any, signature: string) {
    const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.warn('Razorpay webhook secret not configured');
      return { received: true };
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = body.event;
    const payloadData = body.payload.payment.entity;

    // Handle different webhook events
    switch (event) {
      case 'payment.captured':
        await this.handlePaymentCaptured(payloadData);
        break;
      case 'payment.failed':
        await this.handlePaymentFailed(payloadData);
        break;
      case 'refund.created':
        await this.handleRefundCreated(payloadData);
        break;
      default:
        console.log('Unhandled webhook event:', event);
    }

    return { received: true };
  }

  private async handlePaymentCaptured(paymentData: any) {
    const payment = await this.paymentRepository.findOne({
      where: { gatewayOrderId: paymentData.order_id },
    });

    if (payment) {
      payment.status = PaymentStatus.CAPTURED;
      payment.gatewayPaymentId = paymentData.id;
      payment.capturedAt = new Date();
      await this.paymentRepository.save(payment);
    }
  }

  private async handlePaymentFailed(paymentData: any) {
    const payment = await this.paymentRepository.findOne({
      where: { gatewayOrderId: paymentData.order_id },
    });

    if (payment) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = paymentData.error_description || 'Payment failed';
      await this.paymentRepository.save(payment);
    }
  }

  private async handleRefundCreated(refundData: any) {
    const payment = await this.paymentRepository.findOne({
      where: { gatewayPaymentId: refundData.payment_id },
    });

    if (payment) {
      const refundAmount = refundData.amount / 100;
      payment.refundedAmount = (payment.refundedAmount || 0) + refundAmount;
      payment.refundTransactionId = refundData.id;
      payment.refundedAt = new Date();
      
      if (payment.refundedAmount >= payment.amount) {
        payment.status = PaymentStatus.REFUNDED;
      } else {
        payment.status = PaymentStatus.PARTIALLY_REFUNDED;
      }

      await this.paymentRepository.save(payment);
    }
  }

  getRazorpayKeyId(): string {
    return this.configService.get<string>('RAZORPAY_KEY_ID') || '';
  }
}
