import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { Order } from '../orders/order.entity';
import { City } from '../locations/entities/city.entity';
import { SubLocation } from '../locations/entities/sub-location.entity';
import { VendorPage } from './entities/vendor-page.entity';
import { VendorBlogPost } from './entities/vendor-blog-post.entity';
import { VendorNavigation } from './entities/vendor-navigation.entity';
import { VendorReview } from '../reviews/vendor-review.entity';

export enum VendorStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  REJECTED = 'rejected',
}

export enum VendorType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
}

export enum KYCStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum GSTRegistrationType {
  UNREGISTERED = 'unregistered',
  REGULAR = 'regular',
  COMPOSITION = 'composition',
}

export interface KYCDocument {
  type: string;
  documentNumber?: string;
  documentUrl: string;
  uploadedAt: Date;
  fileName: string;
  fileSize: number;
}

@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  storeName: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  banner: string;

  @Column({
    type: 'enum',
    enum: VendorType,
    default: VendorType.INDIVIDUAL,
  })
  vendorType: VendorType;

  @Column({
    type: 'enum',
    enum: VendorStatus,
    default: VendorStatus.PENDING,
  })
  status: VendorStatus;

  // Commission settings
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 10.0 })
  commissionRate: number;

  // Shipping settings
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  freeShippingThreshold: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 50.0 })
  shippingCost: number;

  // Business details
  @Column({ nullable: true })
  businessName: string;

  @Column({ type: 'varchar', nullable: true })
  taxId: string;

  @Column({ nullable: true })
  gstNumber: string;

  // Bank details for payouts
  @Column({ nullable: true })
  bankAccountNumber: string;

  @Column({ nullable: true })
  bankIfscCode: string;

  @Column({ nullable: true })
  bankAccountName: string;

  // Contact details
  @Column({ nullable: true })
  contactEmail: string;

  @Column({ nullable: true })
  contactPhone: string;

  // Address
  @Column({ type: 'text', nullable: true })
  address: string;

  @ManyToOne(() => City, { nullable: true, eager: true })
  @JoinColumn({ name: 'city_id' })
  locationCity: City | null;

  @Column({ type: 'uuid', nullable: true })
  cityId: string;

  @ManyToOne(() => SubLocation, { nullable: true, eager: true })
  @JoinColumn({ name: 'sub_location_id' })
  locationSubLocation: SubLocation | null;

  @Column({ type: 'uuid', nullable: true })
  subLocationId: string;

  @Column({ nullable: true })
  pincode: string;

  // Google location data
  @Column({ type: 'varchar', nullable: true })
  googlePlaceId: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  postalCode: string;

  // KYC verification
  @Column({ default: false })
  isKycVerified: boolean;

  @Column({ nullable: true })
  kycDocumentType: string;

  @Column({ nullable: true })
  kycDocumentUrl: string;

  @Column({ type: 'timestamp', nullable: true })
  kycVerifiedAt: Date;

  // New comprehensive KYC fields
  @Column({
    type: 'enum',
    enum: KYCStatus,
    default: KYCStatus.PENDING,
  })
  kycStatus: KYCStatus;

  @Column({ type: 'jsonb', nullable: true })
  kycDocuments: KYCDocument[];

  @Column({ type: 'timestamp', nullable: true })
  kycSubmittedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  kycApprovedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  kycApprovedBy: string;

  @Column({ type: 'text', nullable: true })
  kycRejectedReason: string | null;

  @Column({ nullable: true })
  panNumber: string;

  @Column({
    type: 'enum',
    enum: GSTRegistrationType,
    default: GSTRegistrationType.UNREGISTERED,
  })
  gstRegistrationType: GSTRegistrationType;

  @Column({ nullable: true })
  gstState: string;

  @Column({ default: 'per_order' })
  invoiceFrequency: string; // per_order, daily, weekly, monthly

  // Subdomain/custom domain support
  @Column({ nullable: true, unique: true })
  subdomain: string;

  @Column({ nullable: true, unique: true })
  customDomain: string;

  // Hero banners configuration
  @Column({ type: 'jsonb', nullable: true })
  heroBanners: Array<{
    id: string;
    imageUrl: string;
    title?: string;
    subtitle?: string;
    ctaText?: string;
    ctaLink?: string;
    order: number;
  }>;

  // Theme & Branding Configuration
  @Column({ type: 'jsonb', nullable: true })
  themeConfig: {
    // Colors
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    textColor?: string;
    
    // Typography
    fontFamily?: string;
    headingFont?: string;
    
    // Layout
    layout?: 'modern' | 'classic' | 'minimal' | 'bold';
    
    // Custom CSS
    customCss?: string;
    
    // Header/Footer
    showLogo?: boolean;
    showSearchBar?: boolean;
    footerText?: string;
    
    // Social Links
    socialLinks?: {
      facebook?: string;
      instagram?: string;
      twitter?: string;
      youtube?: string;
      linkedin?: string;
    };
  };

  // Category Display Mode
  @Column({ type: 'varchar', length: 10, default: 'sidebar', nullable: true })
  categoryDisplayMode: string;

  // About & Content
  @Column({ type: 'text', nullable: true })
  aboutContent: string;

  @Column({ type: 'jsonb', nullable: true })
  aboutImages: string[];

  // SEO Configuration
  @Column({ nullable: true })
  metaTitle: string;

  @Column({ type: 'text', nullable: true })
  metaDescription: string;

  @Column({ type: 'text', nullable: true })
  metaKeywords: string;

  // Store Features
  @Column({ default: true })
  showReviews: boolean;

  @Column({ default: true })
  showRelatedProducts: boolean;

  @Column({ default: false })
  enableBlog: boolean;

  @Column({ default: false })
  enableCustomPages: boolean;

  // Metrics
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalSales: number;

  @Column({ type: 'int', default: 0 })
  totalOrders: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  // Return & Cancellation Policies (vendor-specific, falls back to marketplace defaults)
  @Column({ type: 'jsonb', nullable: true })
  returnPolicy: {
    enabled: boolean;
    days?: number;
    text: string;
  } | null;

  @Column({ type: 'jsonb', nullable: true })
  cancellationPolicy: {
    enabled: boolean;
    text: string;
  } | null;

  // Relations
  @OneToOne(() => User, (user) => user.vendor)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @OneToMany(() => Product, (product) => product.vendor)
  products: Product[];

  @OneToMany(() => Order, (order) => order.vendor)
  orders: Order[];

  @OneToMany(() => VendorPage, (page) => page.vendor)
  customPages: VendorPage[];

  @OneToMany(() => VendorBlogPost, (post) => post.vendor)
  blogPosts: VendorBlogPost[];

  @OneToMany(() => VendorNavigation, (nav) => nav.vendor)
  navigationItems: VendorNavigation[];

  @OneToMany(() => VendorReview, (review) => review.vendor)
  reviews: VendorReview[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
