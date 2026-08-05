import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';

export enum NotificationAudience {
  USER = 'user',
  ADMIN = 'admin',
}

/**
 * The event catalogue from Task 9 in the implementation plan. Each value here
 * is one row a shopper or admin can see in the bell.
 */
export enum NotificationType {
  ORDER_PLACED = 'order_placed',
  ORDER_CONFIRMED = 'order_confirmed',
  ORDER_REJECTED = 'order_rejected',
  ORDER_PROCESSING = 'order_processing',
  ORDER_SHIPPED = 'order_shipped',
  ORDER_DELIVERED = 'order_delivered',
  ORDER_CANCELLED = 'order_cancelled',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  EXCHANGE_REQUESTED = 'exchange_requested',
  EXCHANGE_APPROVED = 'exchange_approved',
  EXCHANGE_REJECTED = 'exchange_rejected',
  EXCHANGE_IN_TRANSIT = 'exchange_in_transit',
  EXCHANGE_INSPECTION_PASSED = 'exchange_inspection_passed',
  EXCHANGE_INSPECTION_FAILED = 'exchange_inspection_failed',
  EXCHANGE_REPLACEMENT_SHIPPED = 'exchange_replacement_shipped',
  LOW_STOCK = 'low_stock',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Null for an admin-audience notification — every admin sees it, not one user. */
  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar' })
  audience: NotificationAudience;

  @Column({ type: 'varchar' })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  /** A relative path the frontend navigates to on click, e.g. `/orders`. */
  @Column({ type: 'varchar', nullable: true })
  link: string | null;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @Column({ type: 'uuid', name: 'order_id', nullable: true })
  orderId: string | null;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
