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
import { Order } from '../orders/order.entity';
import { Vendor } from '../vendors/vendor.entity';
import { User } from '../users/user.entity';
import { InvoiceItem } from './invoice-item.entity';

export enum InvoiceType {
  CUSTOMER = 'customer', // Invoice sent to customer
  VENDOR = 'vendor', // Invoice/payout statement for vendor
  PLATFORM = 'platform', // Commission invoice for platform
  REGISTRATION = 'registration', // Vendor registration fee invoice
  REFERRAL_CREDIT = 'referral_credit', // Referral credit invoice
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING = 'pending', // Waiting for action (e.g., vendor payout pending)
  SENT = 'sent',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  OVERDUE = 'overdue',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_number', unique: true })
  invoiceNumber: string;

  @Column({
    type: 'enum',
    enum: InvoiceType,
    default: InvoiceType.CUSTOMER,
  })
  type: InvoiceType;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  // Invoice dates
  @Column({ name: 'invoice_date', type: 'date' })
  invoiceDate: Date;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  // Amounts
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tax: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({ name: 'shipping_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  shippingCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  // For vendor invoices - commission details
  @Column({ name: 'commission_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  commissionAmount: number;

  @Column({ name: 'commission_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  commissionRate: number;

  @Column({ name: 'payout_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  payoutAmount: number;

  // Payment tracking
  @Column({ name: 'paid_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  paidAmount: number;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date;

  // Billing information
  @Column({ name: 'billing_name', type: 'text', nullable: true })
  billingName: string;

  @Column({ name: 'billing_email', type: 'text', nullable: true })
  billingEmail: string;

  @Column({ name: 'billing_phone', type: 'text', nullable: true })
  billingPhone: string;

  @Column({ name: 'billing_address', type: 'text', nullable: true })
  billingAddress: string;

  @Column({ name: 'billing_city', nullable: true })
  billingCity: string;

  @Column({ name: 'billing_state', nullable: true })
  billingState: string;

  @Column({ name: 'billing_postal_code', nullable: true })
  billingPostalCode: string;

  @Column({ name: 'billing_country', nullable: true })
  billingCountry: string;

  // Shipping information
  @Column({ name: 'shipping_name', type: 'text', nullable: true })
  shippingName: string;

  @Column({ name: 'shipping_email', type: 'text', nullable: true })
  shippingEmail: string;

  @Column({ name: 'shipping_phone', type: 'text', nullable: true })
  shippingPhone: string;

  @Column({ name: 'shipping_address', type: 'text', nullable: true })
  shippingAddress: string;

  @Column({ name: 'shipping_city', nullable: true })
  shippingCity: string;

  @Column({ name: 'shipping_state', nullable: true })
  shippingState: string;

  @Column({ name: 'shipping_postal_code', nullable: true })
  shippingPostalCode: string;

  @Column({ name: 'shipping_country', nullable: true })
  shippingCountry: string;

  // Tax details
  @Column({ name: 'gst_number', nullable: true })
  gstNumber: string;

  @Column({ name: 'pan_number', nullable: true })
  panNumber: string;

  // PDF file path
  @Column({ name: 'pdf_url', nullable: true })
  pdfUrl: string;

  // Notes
  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  terms: string;

  // Email tracking
  @Column({ name: 'email_sent', default: false })
  emailSent: boolean;

  @Column({ name: 'email_sent_at', type: 'timestamp', nullable: true })
  emailSentAt: Date;

  // Relations
  @ManyToOne(() => Order, { nullable: false })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => Vendor, { nullable: true })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column({ name: 'vendor_id', nullable: true })
  vendorId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  customer: User;

  @Column({ name: 'user_id', nullable: true })
  customerId: string;

  @OneToMany(() => InvoiceItem, invoiceItem => invoiceItem.invoice)
  items: InvoiceItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
