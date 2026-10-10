import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod } from './payment.entity';
import { OrdersService } from '../orders/orders.service';
import { UserRole } from '../users/user.entity';

@Injectable()
export class PaymentsService {
  private razorpay: Razorpay;

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private configService: ConfigService,
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
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

  /**
   * The amount charged is the order's own `total`, fetched server-side —
   * never a figure the client supplies. `OrdersService.findOne(orderId,
   * userId)` scopes the lookup to the caller and throws `NotFoundException`
   * for anyone else's order, which doubles as the ownership check. `total`
   * already reflects any wallet credit applied at checkout (it is
   * `OrdersService.create`'s post-wallet figure, not subtotal+tax+shipping),
   * so this is exactly what the customer still owes.
   */
  async createRazorpayOrder(orderId: string, userId: string, currency: string = 'INR') {
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    }

    const order = await this.ordersService.findOne(orderId, userId);
    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.paymentStatus === 'paid') {
      throw new BadRequestException('Order is already paid');
    }

    if (order.status === 'cancelled') {
      throw new BadRequestException('Cannot initiate payment for a cancelled order');
    }

    const amount = Number(order.total);
    const amountInPaise = Math.round(amount * 100);

    // Razorpay requires minimum 100 paise (₹1)
    if (amountInPaise < 100) {
      throw new BadRequestException('Order amount must be at least ₹1 (100 paise) for Razorpay checkout');
    }

    try {
      const options = {
        amount: amountInPaise,
        currency,
        receipt: orderId,
        notes: {
          orderId,
          userId,
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

      const genBuf = Buffer.from(generatedSignature, 'utf8');
      const sigBuf = Buffer.from(razorpaySignature || '', 'utf8');

      return genBuf.length === sigBuf.length && crypto.timingSafeEqual(genBuf, sigBuf);
    } catch (error) {
      console.error('Payment verification error:', error);
      return false;
    }
  }

  /**
   * The shopper's browser reporting a successful Razorpay payment. Only ever
   * moves a payment forward: a bad signature is refused without touching the
   * row, and a failed attempt is not reported here at all — Razorpay keeps
   * the sheet open for a retry, and its `payment.failed` webhook is the
   * authority on failure. This used to accept `status: "failed"` and mark
   * the payment and order failed, for any order, from any signed-in user.
   */
  async confirmPayment(
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ) {
    const payment = await this.paymentRepository.findOne({
      where: { gatewayOrderId: razorpayOrderId },
    });

    if (!payment || !payment.orderId || !(await this.ordersService.isOwnedBy(payment.orderId, userId))) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === PaymentStatus.CAPTURED) {
      return payment;
    }

    const isValid = await this.verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      throw new BadRequestException('Payment signature verification failed');
    }

    payment.status = PaymentStatus.CAPTURED;
    payment.gatewayPaymentId = razorpayPaymentId;
    payment.gatewaySignature = razorpaySignature;
    payment.capturedAt = new Date();
    await this.paymentRepository.save(payment);

    await this.ordersService.updatePaymentStatus(payment.orderId, 'paid');
    return payment;
  }

  /** The latest payment on an order. Admins see any; a customer only their own. */
  async getPaymentByOrderId(orderId: string, user: { id: string; role: UserRole }) {
    const isAdmin = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.VENDOR_ADMIN;
    if (!isAdmin && !(await this.ordersService.isOwnedBy(orderId, user.id))) {
      throw new NotFoundException('Payment not found');
    }
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

  /**
   * `rawBody` must be the exact bytes Razorpay sent — Buffer, not a
   * re-serialization of `body`. Razorpay's HMAC is computed over the literal
   * request bytes; JSON.stringify(body) can differ in whitespace and key
   * order from what was actually sent, which produces a different digest and
   * rejects every genuine webhook. `body` is still needed for the parsed
   * `event`/`payload` fields the handlers below read.
   */
  async handleWebhook(body: any, rawBody: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.warn('Razorpay webhook secret not configured');
      return { received: true };
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expBuf = Buffer.from(expectedSignature, 'utf8');
    const sigBuf = Buffer.from(signature || '', 'utf8');

    if (expBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expBuf, sigBuf)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = body.event;

    // Refund events carry `payload.refund.entity`, not `payload.payment.entity`
    // — reading the payment path for them meant the refund handler either threw
    // or acted on the wrong record.
    switch (event) {
      case 'payment.captured':
        await this.handlePaymentCaptured(body.payload?.payment?.entity);
        break;
      case 'payment.failed':
        await this.handlePaymentFailed(body.payload?.payment?.entity);
        break;
      case 'refund.created':
        await this.handleRefundCreated(body.payload?.refund?.entity);
        break;
      case 'refund.processed':
        // The money has actually moved. This is the only place an order is
        // allowed to become REFUNDED.
        await this.handleRefundProcessed(body.payload?.refund?.entity);
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
      payment.capturedAt = payment.capturedAt ?? new Date();
      await this.paymentRepository.save(payment);

      // The webhook is the only confirmation when the shopper paid but never
      // made it back to the site (closed the tab, UPI app switch killed the
      // page), so it must settle the order too — not just the payment row.
      // `updatePaymentStatus` only generates invoices on the first transition
      // to paid, so a redelivery or a prior /verify is harmless.
      if (payment.orderId) {
        await this.ordersService.updatePaymentStatus(payment.orderId, 'paid');
      }
    }
  }

  private async handlePaymentFailed(paymentData: any) {
    const payment = await this.paymentRepository.findOne({
      where: { gatewayOrderId: paymentData.order_id },
    });

    // One Razorpay order can carry a failed attempt and then a successful
    // retry, and the webhooks can arrive in either order. A late
    // `payment.failed` must not overwrite a capture — that row is what
    // refunds are issued against.
    if (payment && payment.status !== PaymentStatus.CAPTURED) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = paymentData.error_description || 'Payment failed';
      await this.paymentRepository.save(payment);

      // Don't strand the order in `pending` holding stock nobody can buy.
      if (payment.orderId) {
        await this.ordersService.markPaymentFailed(
          payment.orderId,
          payment.failureReason,
        );
      }
    }
  }

  /**
   * Razorpay has accepted the refund but not yet settled it. Record the amount
   * against the payment; the order stays in REFUND_PENDING until
   * `refund.processed` arrives.
   */
  private async handleRefundCreated(refundData: any) {
    const payment = await this.findPaymentForRefund(refundData);
    if (!payment) return;

    const refundAmount = (refundData.amount ?? 0) / 100;
    payment.refundedAmount = (payment.refundedAmount || 0) + refundAmount;
    payment.refundTransactionId = refundData.id;
    payment.refundedAt = new Date();
    payment.status =
      payment.refundedAmount >= payment.amount
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;

    await this.paymentRepository.save(payment);
    console.log(`[webhook] refund.created for payment ${payment.id} (${refundAmount})`);
  }

  /**
   * The refund has settled. This is the point at which the customer's money is
   * genuinely back, and the only place the order becomes REFUNDED.
   */
  private async handleRefundProcessed(refundData: any) {
    const payment = await this.findPaymentForRefund(refundData);
    if (!payment) return;

    // `refund.created` may or may not have arrived first, and either event can
    // be redelivered — take the gateway's total rather than adding to ours.
    const refundAmount = (refundData.amount ?? 0) / 100;
    payment.refundedAmount = Math.max(payment.refundedAmount || 0, refundAmount);
    payment.refundTransactionId = refundData.id;
    payment.refundedAt = new Date();
    payment.status =
      payment.refundedAmount >= payment.amount
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;

    await this.paymentRepository.save(payment);

    if (payment.status === PaymentStatus.REFUNDED && payment.orderId) {
      await this.ordersService.markRefundSettled(payment.orderId);
    }
    console.log(`[webhook] refund.processed for payment ${payment.id} (${refundAmount})`);
  }

  private async findPaymentForRefund(refundData: any): Promise<Payment | null> {
    if (!refundData?.payment_id) {
      console.warn('[webhook] refund event without payment_id, ignoring');
      return null;
    }
    const payment = await this.paymentRepository.findOne({
      where: { gatewayPaymentId: refundData.payment_id },
    });
    if (!payment) {
      console.warn(`[webhook] no payment found for gateway payment ${refundData.payment_id}`);
    }
    return payment ?? null;
  }

  getRazorpayKeyId(): string {
    return this.configService.get<string>('RAZORPAY_KEY_ID') || '';
  }
}
