import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Vendor } from '../vendor.entity';

export enum PageType {
  CUSTOM = 'custom',
  ABOUT = 'about',
  CONTACT = 'contact',
  FAQ = 'faq',
  TERMS = 'terms',
  PRIVACY = 'privacy',
}

export enum PageStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('vendor_pages')
@Index(['vendorId', 'slug'], { unique: true })
export class VendorPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vendor_id' })
  @Index()
  vendorId: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.customPages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column()
  title: string;

  @Column()
  slug: string;

  @Column({
    type: 'enum',
    enum: PageType,
    default: PageType.CUSTOM,
    name: 'page_type',
  })
  pageType: PageType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  excerpt: string;

  @Column({ nullable: true, name: 'featured_image' })
  featuredImage: string;

  @Column('text', { array: true, nullable: true })
  images: string[];

  // SEO
  @Column({ nullable: true, name: 'meta_title' })
  metaTitle: string;

  @Column({ type: 'text', nullable: true, name: 'meta_description' })
  metaDescription: string;

  @Column({ type: 'text', nullable: true, name: 'meta_keywords' })
  metaKeywords: string;

  // Publishing
  @Column({
    type: 'enum',
    enum: PageStatus,
    default: PageStatus.DRAFT,
  })
  @Index()
  status: PageStatus;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ default: true, name: 'show_in_navigation' })
  showInNavigation: boolean;

  @Column({ default: false, name: 'is_home_page' })
  isHomePage: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;
}
