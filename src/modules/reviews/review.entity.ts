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

  @Column({ default: false })
  isVerifiedPurchase: boolean;

  @Column({ default: true })
  isApproved: boolean;

  @Column('simple-array', { nullable: true })
  images: string[];

  // Vendor response
  @Column({ type: 'text', nullable: true })
  vendorResponse: string;

  @Column({ type: 'timestamp', nullable: true })
  vendorResponseDate: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.reviews)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Product, (product) => product.reviews)
  @JoinColumn()
  product: Product;

  @Column()
  productId: string;

  @ManyToOne(() => OrderItem, { nullable: true })
  @JoinColumn()
  orderItem: OrderItem;

  @Column({ type: 'uuid', nullable: true })
  orderItemId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
