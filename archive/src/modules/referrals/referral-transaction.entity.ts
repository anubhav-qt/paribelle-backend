import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Vendor } from '../vendors/vendor.entity';
import { Invoice } from '../invoices/invoice.entity';

export enum ReferralTransactionStatus {
  PENDING = 'pending',
  CREDITED = 'credited',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('referral_transactions')
export class ReferralTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'referrer_id' })
  referrerId: string;

  @Column({ type: 'uuid', name: 'referred_vendor_id' })
  referredVendorId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'credit_amount' })
  creditAmount: number;

  @Column({ type: 'uuid', nullable: true, name: 'registration_invoice_id' })
  registrationInvoiceId: string;

  @Column({
    type: 'enum',
    enum: ReferralTransactionStatus,
    default: ReferralTransactionStatus.PENDING,
  })
  status: ReferralTransactionStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'timestamp', nullable: true, name: 'credited_at' })
  creditedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referrer_id' })
  referrer: User;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'referred_vendor_id' })
  referredVendor: Vendor;

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'registration_invoice_id' })
  registrationInvoice: Invoice;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
