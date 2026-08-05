import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  ManyToOne,
  JoinColumn,
  Tree,
  TreeParent,
  TreeChildren,
  Index,
} from 'typeorm';
import { Product } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';

@Entity('categories')
@Tree('closure-table')
@Index(['slug']) // Already unique but explicit index for lookups
@Index(['vendorId', 'isActive']) // Optimize vendor category queries
@Index(['isActive', 'sortOrder']) // Optimize category listings
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  image: string;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'int', default: 0, name: 'sort_order' })
  sortOrder: number;

  // Vendor-specific category (null means global category)
  @ManyToOne(() => Vendor, { nullable: true })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor | null;

  @Column({ type: 'uuid', nullable: true, name: 'vendor_id' })
  vendorId: string | null;

  // SEO
  @Column({ nullable: true, name: 'meta_title' })
  metaTitle: string;

  @Column({ type: 'text', nullable: true, name: 'meta_description' })
  metaDescription: string;

  // Filter configuration (JSON field). For a filter derived from the
  // catalogue (see CategoriesService.getEffectiveFilters), `sortOrder` and
  // `hidden` are the only fields that apply — `options` on those is never
  // read, since options come from what products actually carry.
  @Column({ type: 'jsonb', nullable: true, name: 'filter_config' })
  filterConfig: {
    filters: Array<{
      id: string;
      label: string;
      type: 'select' | 'multiselect' | 'checkbox' | 'range';
      options?: Array<{ value: string; label: string }>;
      min?: number;
      max?: number;
      step?: number;
      sortOrder?: number;
      hidden?: boolean;
    }>;
  };

  // Tree structure
  @TreeParent()
  parent: Category;

  @TreeChildren()
  children: Category[];

  // Relations
  @ManyToMany(() => Product, (product) => product.categories)
  products: Product[];

  // Transient property for product count (not stored in DB)
  productCount?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
