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
import { Product } from '../products/product.entity';
import { OrderItem } from '../orders/order-item.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text' })
  comment: string;

  @Column({ default: false, name: 'is_verified_purchase' })
  isVerifiedPurchase: boolean;

  @Column({ default: true, name: 'is_approved' })
  isApproved: boolean;

  @Column('simple-array', { nullable: true })
  images: string[];

  // Vendor response
  @Column({ type: 'text', nullable: true, name: 'vendor_response' })
  vendorResponse: string;

  @Column({ type: 'timestamp', nullable: true, name: 'vendor_response_date' })
  vendorResponseDate: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.reviews)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Product, (product) => product.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => OrderItem, { nullable: true })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;

  @Column({ type: 'uuid', nullable: true, name: 'order_item_id' })
  orderItemId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
