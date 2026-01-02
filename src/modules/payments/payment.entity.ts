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

  @Column({ unique: true })
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
  @Column({ type: 'varchar', nullable: true })
  gatewayOrderId: string;

  @Column({ type: 'varchar', nullable: true })
  gatewayPaymentId: string;

  @Column({ nullable: true })
  gatewaySignature: string;

  // Refund details
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  refundedAmount: number;

  @Column({ type: 'varchar', nullable: true })
  refundTransactionId: string;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt: Date;

  // Payment metadata
  @Column({ type: 'json', nullable: true })
  metadata: any;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  // Timestamps
  @Column({ type: 'timestamp', nullable: true })
  authorizedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
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
