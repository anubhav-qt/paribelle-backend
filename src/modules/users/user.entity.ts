import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { Vendor } from '../vendors/vendor.entity';
import { Order } from '../orders/order.entity';
import { Review } from '../reviews/review.entity';
import { VendorReview } from '../reviews/vendor-review.entity';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  VENDOR_ADMIN = 'vendor_admin',
  VENDOR = 'vendor',
  CUSTOMER = 'customer',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column()
  password: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role: UserRole;

  @Column({ type: 'uuid', nullable: true, name: 'vendor_id' })
  vendorId: string;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ nullable: true })
  avatar: string;

  @Column({ type: 'timestamp', nullable: true, name: 'email_verified_at' })
  emailVerifiedAt: Date;

  @Column({ type: 'varchar', nullable: true, name: 'email_verification_token' })
  emailVerificationToken: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'email_verification_token_expiry' })
  emailVerificationTokenExpiry: Date | null;

  @Column({ type: 'varchar', nullable: true, name: 'password_reset_token' })
  passwordResetToken: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'password_reset_token_expiry' })
  passwordResetTokenExpiry: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'phone_verified_at' })
  phoneVerifiedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'last_login_at' })
  lastLoginAt: Date;

  // Referral System Fields
  @Column({ type: 'varchar', length: 20, unique: true, nullable: true, name: 'referral_code' })
  referralCode: string;

  @Column({ type: 'uuid', nullable: true, name: 'referred_by' })
  referredBy: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'wallet_balance' })
  walletBalance: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'referral_credits_earned' })
  referralCreditsEarned: number;

  @Column({ type: 'timestamp', nullable: true, name: 'last_referral_date' })
  lastReferralDate: Date;

  @OneToOne(() => Vendor, (vendor) => vendor.user)
  vendor: Vendor;

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToMany(() => Review, (review) => review.user)
  reviews: Review[];

  @OneToMany(() => VendorReview, (review) => review.user)
  vendorReviews: VendorReview[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
