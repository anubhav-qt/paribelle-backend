import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PageType {
  CUSTOM = 'custom',
  ABOUT = 'about',
  CONTACT = 'contact',
  FAQ = 'faq',
  TERMS = 'terms',
  PRIVACY = 'privacy',
  COOKIE = 'cookie',
  BLOG = 'blog',
}

export enum PageStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('marketplace_pages')
@Index(['slug'], { unique: true })
export class MarketplacePage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ unique: true })
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

  // Blog-specific fields
  @Column('text', { array: true, nullable: true })
  tags: string[];

  @Column({ type: 'int', default: 0, name: 'view_count' })
  viewCount: number;

  @Column({ nullable: true, name: 'author_name' })
  authorName: string;

  // Publishing
  @Column({
    type: 'enum',
    enum: PageStatus,
    default: PageStatus.DRAFT,
  })
  @Index()
  status: PageStatus;

  @Column({ default: true })
  showInNavigation: boolean;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
