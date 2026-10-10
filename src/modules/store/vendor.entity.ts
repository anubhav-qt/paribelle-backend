import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export interface StorePolicy {
  enabled: boolean;
  days?: number;
  text: string;
}

/**
 * The shop's own business details, in the `vendors` table it inherited from
 * the marketplace this codebase grew out of. PariBelle sells only its own
 * pieces, so one row matters: STORE_ID. Its GSTIN and address go on every
 * invoice and shipping label, and orders snapshot them when placed.
 *
 * Only the columns still read are mapped; the table keeps the marketplace's
 * other columns (KYC, bank details, commission), unused.
 */
@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'store_name' })
  storeName: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true, name: 'business_name' })
  businessName: string;

  @Column({ nullable: true, name: 'gst_number' })
  gstNumber: string;

  @Column({ nullable: true, name: 'pan_number' })
  panNumber: string;

  @Column({ nullable: true, name: 'contact_email' })
  contactEmail: string;

  @Column({ nullable: true, name: 'contact_phone' })
  contactPhone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true, name: 'postal_code' })
  postalCode: string;

  /** Overrides the shop-wide `return_policy` setting when set. */
  @Column({ type: 'jsonb', nullable: true, name: 'return_policy' })
  returnPolicy: StorePolicy | null;

  /** Overrides the shop-wide `cancellation_policy` setting when set. */
  @Column({ type: 'jsonb', nullable: true, name: 'cancellation_policy' })
  cancellationPolicy: StorePolicy | null;

  @Column({ name: 'user_id' })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
