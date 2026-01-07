import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vendor } from '../vendors/vendor.entity';

@Entity('vendor_balances')
export class VendorBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column({ name: 'vendor_id' })
  vendorId: string;

  // Total from all payout invoices (positive)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'total_sales' })
  totalSales: number;

  // Total from deduction invoices (returns + cancellations)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'total_deductions' })
  totalDeductions: number;

  // Total commission charged
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'total_commission' })
  totalCommission: number;

  // Amount not yet paid out
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'pending_payout' })
  pendingPayout: number;

  // Amount already paid out
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'paid_out' })
  paidOut: number;

  // Current available balance (totalSales - totalDeductions - totalCommission - paidOut)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'available_balance' })
  availableBalance: number;

  // Count of invoices
  @Column({ type: 'int', default: 0, name: 'invoice_count' })
  invoiceCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
