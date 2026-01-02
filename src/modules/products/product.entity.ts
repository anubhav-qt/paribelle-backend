import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { Vendor } from '../vendors/vendor.entity';
import { Category } from '../categories/category.entity';
import { OrderItem } from '../orders/order-item.entity';
import { Review } from '../reviews/review.entity';
import { ProductVariant } from './product-variant.entity';

export enum ProductStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OUT_OF_STOCK = 'out_of_stock',
}

export enum ProductType {
  PHYSICAL = 'physical',
  BOOKING = 'booking',
}

@Entity('products')
@Index(['vendorId', 'status']) // Optimize vendor product queries with status filter
@Index(['slug']) // Already unique but explicit index for lookups
@Index(['status', 'createdAt']) // Optimize listing products by status and date
@Index(['vendorId', 'createdAt']) // Optimize vendor product listings by date
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  shortDescription: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  compareAtPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  costPerItem: number;

  // GST and Tax fields
  @Column({ nullable: true })
  hsnCode: string;

  @Column({ nullable: true })
  sacCode: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 18.00 })
  gstRate: number;

  @Column({ default: 'selling_price_without_gst' })
  priceType: string; // 'mrp_with_gst' | 'selling_price_without_gst'

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  mrp: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  basePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  gstAmount: number;

  @Column()
  sku: string;

  @Column({ type: 'int', default: 0 })
  stockQuantity: number;

  @Column({ type: 'int', nullable: true })
  lowStockThreshold: number;

  @Column({ default: true })
  trackInventory: boolean;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.DRAFT,
  })
  status: ProductStatus;

  @Column({
    type: 'enum',
    enum: ProductType,
    default: ProductType.PHYSICAL,
  })
  productType: ProductType;

  // Images
  @Column('text', { array: true, nullable: true, default: [] })
  images: string[];

  @Column({ nullable: true })
  featuredImage: string;

  // SEO
  @Column({ nullable: true })
  metaTitle: string;

  @Column({ type: 'text', nullable: true })
  metaDescription: string;

  @Column('simple-array', { nullable: true })
  metaKeywords: string[];

  // Product variants support
  @Column({ type: 'json', nullable: true })
  variants: any;

  // Product attributes/metadata for filtering
  @Column({ type: 'jsonb', nullable: true })
  attributes: Record<string, any>;

  // Enhanced Variants Support
  @Column({ default: false })
  hasVariants: boolean;

  @Column({ type: 'jsonb', nullable: true })
  variantOptions: Record<string, string[]>; // e.g., { size: ['S', 'M', 'L'], color: ['Red', 'Blue'] }

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  productVariants: ProductVariant[];

  // Product Variations Support (legacy)
  @Column({ default: false })
  isParent: boolean;

  @Column({ type: 'uuid', nullable: true })
  parentProductId: string;

  @ManyToOne(() => Product, (product) => product.variations, { nullable: true })
  @JoinColumn({ name: 'parent_product_id' })
  parentProduct: Product;

  @OneToMany(() => Product, (product) => product.parentProduct)
  variations: Product[];

  // Variation themes for parent products (e.g., ['color', 'size'])
  @Column('text', { array: true, nullable: true })
  variationThemes: string[];

  // Specific attributes for this variation (e.g., {color: 'red', size: 'M'})
  @Column({ type: 'jsonb', nullable: true })
  variationAttributes: Record<string, string>;

  // Shipping
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  weight: number;

  @Column({ nullable: true })
  weightUnit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  length: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  width: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  height: number;

  @Column({ nullable: true })
  dimensionUnit: string;

  // Statistics
  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'int', default: 0 })
  salesCount: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  averageRating: number;

  @Column({ type: 'int', default: 0 })
  reviewCount: number;

  // Relations
  @ManyToOne(() => Vendor, (vendor) => vendor.products)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column({ name: 'vendor_id' })
  vendorId: string;

  @ManyToMany(() => Category, (category) => category.products)
  @JoinTable({
    name: 'product_categories',
    joinColumn: { name: 'product_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories: Category[];

  @OneToMany(() => OrderItem, (orderItem) => orderItem.product)
  orderItems: OrderItem[];

  @OneToMany(() => Review, (review) => review.product)
  reviews: Review[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
