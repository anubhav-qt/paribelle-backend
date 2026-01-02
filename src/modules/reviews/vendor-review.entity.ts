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
import { Order } from '../orders/order.entity';

@Entity('vendor_reviews')
export class VendorReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text' })
  comment: string;

  @Column({ default: false })
  isVerifiedPurchase: boolean;

  @Column({ default: true })
  isApproved: boolean;

  // Specific ratings
  @Column({ type: 'int', nullable: true })
  productQualityRating: number;

  @Column({ type: 'int', nullable: true })
  shippingSpeedRating: number;

  @Column({ type: 'int', nullable: true })
  customerServiceRating: number;

  // Vendor response
  @Column({ type: 'text', nullable: true })
  vendorResponse: string;

  @Column({ type: 'timestamp', nullable: true })
  vendorResponseDate: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.vendorReviews)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.reviews)
  @JoinColumn()
  vendor: Vendor;

  @Column()
  vendorId: string;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn()
  order: Order;

  @Column({ type: 'uuid', nullable: true })
  orderId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
