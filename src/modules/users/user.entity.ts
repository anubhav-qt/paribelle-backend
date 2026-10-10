import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Order } from '../orders/order.entity';
import { Review } from '../reviews/review.entity';

/**
 * `vendor_admin` is the store's own admin account (the name is from the
 * marketplace this grew out of); `super_admin` can also do destructive things.
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  VENDOR_ADMIN = 'vendor_admin',
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

  // Never comes back from an ordinary find(). The only caller that needs it is
  // the login check, via UsersService.findByEmailWithPassword().
  @Column({ select: false })
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

  /** The Google account id, when this user has signed in with Google. */
  @Column({ type: 'varchar', nullable: true, name: 'google_id' })
  googleId: string | null;

  // `select: false`: a user object goes out in API responses, and a reset
  // token in one is a password reset for whoever reads it. Only
  // AuthService.resetPassword asks for these back.
  @Column({ type: 'varchar', nullable: true, name: 'password_reset_token', select: false })
  passwordResetToken: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'password_reset_token_expiry', select: false })
  passwordResetTokenExpiry: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'phone_verified_at' })
  phoneVerifiedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'last_login_at' })
  lastLoginAt: Date;

  /** Store credit, from cancelled orders and exchanges. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'wallet_balance' })
  walletBalance: number;

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToMany(() => Review, (review) => review.user)
  reviews: Review[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
