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
  @Column({ type: 'int', nullable: true, name: 'product_quality_rating' })
  productQualityRating: number;

  @Column({ type: 'int', nullable: true, name: 'shipping_speed_rating' })
  shippingSpeedRating: number;

  @Column({ type: 'int', nullable: true, name: 'customer_service_rating' })
  customerServiceRating: number;

  // Vendor response
  @Column({ type: 'text', nullable: true })
  vendorResponse: string;

  @Column({ type: 'timestamp', nullable: true })
  vendorResponseDate: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.vendorReviews)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.reviews)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column({ name: 'vendor_id' })
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
