import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { User } from '../users/user.entity';
import { Vendor } from '../vendors/vendor.entity';
import { ProductVariant } from '../products/product-variant.entity';

/**
 * `request_type` in the database. The `return` value only ever labels rows
 * created before the policy changed to "no refunds, exchanges only" — no new
 * row can be created with it. See Task 8 in the implementation plan.
 */
export enum ReturnRequestType {
  RETURN = 'return',
  EXCHANGE = 'exchange',
}

/**
 * The exchange sub-machine (see the implementation plan's diagram in Task 8):
 *
 *   requested --admin approves--> approved --customer ships--> in_transit
 *        |                                                        |
 *        |                                              admin receives + inspects
 *   admin rejects                                            /        \
 *        |                                             passes            fails
 *        v                                                |                |
 *    rejected                                    replacement_shipped   rejected
 *                                                       |             (see the
 *                                                  completed          exchange_failed_inspection
 *                                                                     setting for what "rejected"
 *                                                                     means physically)
 *
 * `refunded` and the plain `received`/`cancelled` values are legacy — they
 * only appear on rows created under the old return policy.
 */
export enum ReturnStatus {
  REQUESTED = 'requested',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  IN_TRANSIT = 'in_transit',
  RECEIVED = 'received',
  REPLACEMENT_SHIPPED = 'replacement_shipped',
  COMPLETED = 'completed',
  // Legacy-only — reachable by historic rows, never assigned to a new one.
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

export enum InspectionResult {
  PASSED = 'passed',
  FAILED = 'failed',
}

@Entity('returns')
export class Return {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'return_number', unique: true })
  returnNumber: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => OrderItem)
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;

  @Column({ name: 'order_item_id' })
  orderItemId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column({ name: 'vendor_id' })
  vendorId: string;

  @Column({ type: 'varchar', name: 'request_type', default: ReturnRequestType.RETURN })
  requestType: ReturnRequestType;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', default: ReturnStatus.REQUESTED })
  status: ReturnStatus;

  // Item snapshot, taken at request time.
  @Column({ name: 'product_name' })
  productName: string;

  @Column({ name: 'product_sku', nullable: true })
  productSku: string;

  @Column({ name: 'variant_options', type: 'jsonb', nullable: true })
  variantOptions: Record<string, string> | null;

  @Column({ name: 'original_price', type: 'decimal', precision: 10, scale: 2 })
  originalPrice: number;

  @Column({ name: 'original_quantity', type: 'int' })
  originalQuantity: number;

  /**
   * Always 0 for an exchange — no money moves, the customer swaps one variant
   * for another of the same price. These are mapped and written explicitly
   * rather than left to the database because the table predates this code in
   * production, where `refund_amount` and `refund_total` are NOT NULL with no
   * DEFAULT. A fresh database gets them with `DEFAULT 0` from the migration,
   * so omitting them would insert fine locally and fail only in production.
   * They stay on the entity so historic return rows keep rendering.
   */
  @Column({ name: 'refund_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  refundAmount: number;

  @Column({ name: 'refund_tax', type: 'decimal', precision: 10, scale: 2, default: 0 })
  refundTax: number;

  @Column({ name: 'refund_total', type: 'decimal', precision: 10, scale: 2, default: 0 })
  refundTotal: number;

  /**
   * The variant the customer wants instead — same product, different variant
   * only (decided; see the plan). Never a different product: enforced in
   * `ExchangesService.request`, not by this column's type.
   */
  @ManyToOne(() => ProductVariant, { nullable: true })
  @JoinColumn({ name: 'exchange_variant_id' })
  exchangeVariant: ProductVariant | null;

  @Column({ type: 'uuid', name: 'exchange_variant_id', nullable: true })
  exchangeVariantId: string | null;

  /**
   * How much more the replacement costs than the original item (route 2
   * only) — 0 when the replacement is the same price or cheaper, or for
   * routes 1 and 3. `creditAmount`/`refundTotal` always credits the
   * *original* item's value regardless of this; the customer covers the gap
   * themselves, either from their own wallet balance or COD when the
   * replacement order is created — see `topUpPaymentMethod`.
   */
  @Column({ name: 'top_up_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  topUpAmount: number;

  /**
   * How the customer chose to cover `topUpAmount`: 'wallet' means they had
   * enough existing wallet balance at request time and it's drawn down
   * automatically when the replacement order is created; 'cod' means the
   * gap is collected as cash/UPI on delivery of the replacement. Null when
   * there is no gap to cover.
   */
  @Column({ type: 'varchar', name: 'top_up_payment_method', nullable: true })
  topUpPaymentMethod: 'wallet' | 'cod' | null;

  @Column({ type: 'jsonb', nullable: true })
  images: string[] | null;

  @Column({ name: 'customer_notes', type: 'text', nullable: true })
  customerNotes: string | null;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'varchar', name: 'customer_tracking_number', nullable: true })
  customerTrackingNumber: string | null;

  @Column({ name: 'inspection_result', type: 'varchar', nullable: true })
  inspectionResult: InspectionResult | null;

  @Column({ name: 'inspection_notes', type: 'text', nullable: true })
  inspectionNotes: string | null;

  @Column({ name: 'inspected_at', type: 'timestamp', nullable: true })
  inspectedAt: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'inspected_by' })
  inspectedBy: User | null;

  @Column({ type: 'varchar', name: 'replacement_tracking_number', nullable: true })
  replacementTrackingNumber: string | null;

  // Timestamps for each transition.
  @Column({ name: 'requested_at', type: 'timestamp', nullable: true })
  requestedAt: Date;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'rejected_at', type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @Column({ name: 'in_transit_at', type: 'timestamp', nullable: true })
  inTransitAt: Date | null;

  @Column({ name: 'received_at', type: 'timestamp', nullable: true })
  receivedAt: Date | null;

  @Column({ name: 'replacement_shipped_at', type: 'timestamp', nullable: true })
  replacementShippedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  /**
   * The order that fulfilled a different-product exchange (route 2 — see
   * `ExchangesService.createReplacementOrder`). A same-variant swap (route 1)
   * ships off the original order and never sets this; a no-replacement
   * exchange (route 3) never needs an order at all.
   */
  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'completed_order_id' })
  completedOrder: Order | null;

  @Column({ type: 'uuid', name: 'completed_order_id', nullable: true })
  completedOrderId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'rejected_by' })
  rejectedBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
