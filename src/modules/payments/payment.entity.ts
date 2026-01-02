import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from '../orders/order.entity';

export enum PaymentMethod {
  RAZORPAY = 'razorpay',
  CARD = 'card',
  UPI = 'upi',
  NET_BANKING = 'net_banking',
  WALLET = 'wallet',
  COD = 'cod',
}

export enum PaymentStatus {
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'transaction_id' })
  transactionId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'INR' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  method: PaymentMethod;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  // Gateway details
  @Column({ type: 'varchar', nullable: true, name: 'gateway_order_id' })
  gatewayOrderId: string;

  @Column({ type: 'varchar', nullable: true, name: 'gateway_payment_id' })
  gatewayPaymentId: string;

  @Column({ nullable: true, name: 'gateway_signature' })
  gatewaySignature: string;

  // Refund details
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'refunded_amount' })
  refundedAmount: number;

  @Column({ type: 'varchar', nullable: true, name: 'refund_transaction_id' })
  refundTransactionId: string;

  @Column({ type: 'timestamp', nullable: true, name: 'refunded_at' })
  refundedAt: Date;

  // Payment metadata
  @Column({ type: 'json', nullable: true })
  metadata: any;

  @Column({ type: 'text', nullable: true, name: 'failure_reason' })
  failureReason: string;

  // Timestamps
  @Column({ type: 'timestamp', nullable: true, name: 'authorized_at' })
  authorizedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'captured_at' })
  capturedAt: Date;

  // Relations
  @ManyToOne(() => Order, (order) => order.payments)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id' })
  orderId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
