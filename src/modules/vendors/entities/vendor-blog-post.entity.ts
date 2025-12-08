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
import { PageStatus } from './vendor-page.entity';

@Entity('vendor_blog_posts')
@Index(['vendorId', 'slug'], { unique: true })
export class VendorBlogPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  vendorId: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.blogPosts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column()
  title: string;

  @Column()
  slug: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  excerpt: string;

  @Column({ nullable: true })
  featuredImage: string;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column({
    type: 'enum',
    enum: PageStatus,
    default: PageStatus.DRAFT,
  })
  @Index()
  status: PageStatus;

  @Column({ nullable: true })
  authorName: string;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  // SEO
  @Column({ nullable: true })
  metaTitle: string;

  @Column({ type: 'text', nullable: true })
  metaDescription: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;
}
