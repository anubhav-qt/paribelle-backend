import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Vendor } from '../vendors/vendor.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from '../payments/payment.entity';
import { Invoice } from '../invoices/invoice.entity';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURN_REQUESTED = 'return_requested',
  RETURN_APPROVED = 'return_approved',
  RETURNED = 'returned',
  REFUNDED = 'refunded',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'order_number' })
  orderNumber: string;

  // Order amounts
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tax: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'shipping_cost' })
  shippingCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  // Commission for marketplace
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'commission_amount' })
  commissionAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'commission_rate' })
  commissionRate: number;

  // Vendor payout
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'vendor_payout' })
  vendorPayout: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
    name: 'payment_status',
  })
  paymentStatus: PaymentStatus;

  // Shipping address
  @Column({ name: 'shipping_name' })
  shippingName: string;

  @Column({ name: 'shipping_email' })
  shippingEmail: string;

  @Column({ name: 'shipping_phone' })
  shippingPhone: string;

  @Column({ type: 'text', name: 'shipping_address' })
  shippingAddress: string;

  @Column({ name: 'shipping_city' })
  shippingCity: string;

  @Column({ name: 'shipping_state' })
  shippingState: string;

  @Column({ name: 'shipping_country' })
  shippingCountry: string;

  @Column({ name: 'shipping_postal_code' })
  shippingPostalCode: string;

  // Billing address
  @Column({ default: true, name: 'billing_address_same_as_shipping' })
  billingAddressSameAsShipping: boolean;

  @Column({ type: 'text', nullable: true, name: 'billing_address' })
  billingAddress: string;

  @Column({ nullable: true, name: 'billing_city' })
  billingCity: string;

  @Column({ nullable: true, name: 'billing_state' })
  billingState: string;

  @Column({ nullable: true, name: 'billing_country' })
  billingCountry: string;

  @Column({ nullable: true, name: 'billing_postal_code' })
  billingPostalCode: string;

  // Tracking
  @Column({ nullable: true, name: 'tracking_number' })
  trackingNumber: string;

  @Column({ nullable: true })
  carrier: string;

  // Notes
  @Column({ type: 'text', nullable: true, name: 'customer_notes' })
  customerNotes: string;

  @Column({ type: 'text', nullable: true, name: 'admin_notes' })
  adminNotes: string;

  // Timestamps
  @Column({ type: 'timestamp', nullable: true, name: 'confirmed_at' })
  confirmedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'shipped_at' })
  shippedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'delivered_at' })
  deliveredAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'cancelled_at' })
  cancelledAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'returned_at' })
  returnedAt: Date;

  @Column({ type: 'text', nullable: true, name: 'return_reason' })
  returnReason: string;

  // Relations
  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.orders)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column({ name: 'vendor_id' })
  vendorId: string;

  // Vendor snapshot at time of order (for invoices and historical accuracy)
  @Column({ name: 'vendor_business_name', nullable: true })
  vendorBusinessName: string;

  @Column({ name: 'vendor_store_name', nullable: true })
  vendorStoreName: string;

  @Column({ name: 'vendor_gst_number', nullable: true })
  vendorGstNumber: string;

  @Column({ name: 'vendor_address', type: 'text', nullable: true })
  vendorAddress: string;

  @Column({ name: 'vendor_city', nullable: true })
  vendorCity: string;

  @Column({ name: 'vendor_state', nullable: true })
  vendorState: string;

  @Column({ name: 'vendor_postal_code', nullable: true })
  vendorPostalCode: string;

  @Column({ name: 'vendor_country', nullable: true })
  vendorCountry: string;

  @Column({ name: 'vendor_contact_email', nullable: true })
  vendorContactEmail: string;

  @Column({ name: 'vendor_contact_phone', nullable: true })
  vendorContactPhone: string;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, { cascade: true })
  items: OrderItem[];

  @OneToMany(() => Payment, (payment) => payment.order)
  payments: Payment[];

  @OneToMany(() => Invoice, (invoice) => invoice.order)
  invoices: Invoice[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
