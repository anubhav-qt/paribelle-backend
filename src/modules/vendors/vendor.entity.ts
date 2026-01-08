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

  @Column({ unique: true, name: 'store_name' })
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
    name: 'vendor_type',
  })
  vendorType: VendorType;

  @Column({
    type: 'enum',
    enum: VendorStatus,
    default: VendorStatus.PENDING,
  })
  status: VendorStatus;

  // Commission settings
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 10.0, name: 'commission_rate' })
  commissionRate: number;

  // Shipping settings
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'free_shipping_threshold' })
  freeShippingThreshold: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 50.0, name: 'shipping_cost' })
  shippingCost: number;

  // Return policy settings
  @Column({ type: 'int', default: 7, name: 'return_policy_days', comment: 'Number of days after delivery for returns (0 = no returns)' })
  returnPolicyDays: number;

  @Column({ type: 'boolean', default: true, name: 'allow_returns', comment: 'Whether this vendor accepts returns' })
  allowReturns: boolean;

  // Business details
  @Column({ nullable: true, name: 'business_name' })
  businessName: string;

  @Column({ type: 'varchar', nullable: true, name: 'tax_id' })
  taxId: string;

  @Column({ nullable: true, name: 'gst_number' })
  gstNumber: string;

  // Bank details for payouts
  @Column({ nullable: true, name: 'bank_account_number' })
  bankAccountNumber: string;

  @Column({ nullable: true, name: 'bank_ifsc_code' })
  bankIfscCode: string;

  @Column({ nullable: true, name: 'bank_account_name' })
  bankAccountName: string;

  // Contact details
  @Column({ nullable: true, name: 'contact_email' })
  contactEmail: string;

  @Column({ nullable: true, name: 'contact_phone' })
  contactPhone: string;

  // Address
  @Column({ type: 'text', nullable: true })
  address: string;

  @ManyToOne(() => City, { nullable: true, eager: true })
  @JoinColumn({ name: 'city_id' })
  locationCity: City | null;

  @Column({ type: 'uuid', nullable: true, name: 'city_id' })
  cityId: string;

  @ManyToOne(() => SubLocation, { nullable: true, eager: true })
  @JoinColumn({ name: 'sub_location_id' })
  locationSubLocation: SubLocation | null;

  @Column({ type: 'uuid', nullable: true, name: 'sub_location_id' })
  subLocationId: string;

  @Column({ nullable: true })
  pincode: string;

  // Google location data
  @Column({ type: 'varchar', nullable: true, name: 'google_place_id' })
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

  @Column({ nullable: true, name: 'postal_code' })
  postalCode: string;

  // KYC verification
  @Column({ default: false, name: 'is_kyc_verified' })
  isKycVerified: boolean;

  @Column({ nullable: true, name: 'kyc_document_type' })
  kycDocumentType: string;

  @Column({ nullable: true, name: 'kyc_document_url' })
  kycDocumentUrl: string;

  @Column({ type: 'timestamp', nullable: true, name: 'kyc_verified_at' })
  kycVerifiedAt: Date;

  // New comprehensive KYC fields
  @Column({
    type: 'enum',
    enum: KYCStatus,
    default: KYCStatus.PENDING,
    name: 'kyc_status',
  })
  kycStatus: KYCStatus;

  @Column({ type: 'jsonb', nullable: true, name: 'kyc_documents' })
  kycDocuments: KYCDocument[];

  @Column({ type: 'timestamp', nullable: true, name: 'kyc_submitted_at' })
  kycSubmittedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'kyc_approved_at' })
  kycApprovedAt: Date;

  @Column({ type: 'uuid', nullable: true, name: 'kyc_approved_by' })
  kycApprovedBy: string;

  @Column({ type: 'text', nullable: true, name: 'kyc_rejected_reason' })
  kycRejectedReason: string | null;

  @Column({ nullable: true, name: 'pan_number' })
  panNumber: string;

  @Column({
    type: 'enum',
    enum: GSTRegistrationType,
    default: GSTRegistrationType.UNREGISTERED,
    name: 'gst_registration_type',
  })
  gstRegistrationType: GSTRegistrationType;

  @Column({ nullable: true, name: 'gst_state' })
  gstState: string;

  @Column({ default: 'per_order', name: 'invoice_frequency' })
  invoiceFrequency: string; // per_order, daily, weekly, monthly

  // Subdomain/custom domain support
  @Column({ nullable: true, unique: true })
  subdomain: string;

  @Column({ nullable: true, unique: true, name: 'custom_domain' })
  customDomain: string;

  // Hero banners configuration
  @Column({ type: 'jsonb', nullable: true, name: 'hero_banners' })
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
  @Column({ type: 'jsonb', nullable: true, name: 'theme_config' })
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
  @Column({ type: 'varchar', length: 10, default: 'sidebar', nullable: true, name: 'category_display_mode' })
  categoryDisplayMode: string;

  // About & Content
  @Column({ type: 'text', nullable: true, name: 'about_content' })
  aboutContent: string;

  @Column({ type: 'jsonb', nullable: true, name: 'about_images' })
  aboutImages: string[];

  // SEO Configuration
  @Column({ nullable: true, name: 'meta_title' })
  metaTitle: string;

  @Column({ type: 'text', nullable: true, name: 'meta_description' })
  metaDescription: string;

  @Column({ type: 'text', nullable: true, name: 'meta_keywords' })
  metaKeywords: string;

  // Store Features
  @Column({ default: true, name: 'show_reviews' })
  showReviews: boolean;

  @Column({ default: true, name: 'show_related_products' })
  showRelatedProducts: boolean;

  @Column({ default: false, name: 'enable_blog' })
  enableBlog: boolean;

  @Column({ default: false, name: 'enable_custom_pages' })
  enableCustomPages: boolean;

  // Metrics
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'total_sales' })
  totalSales: number;

  @Column({ type: 'int', default: 0, name: 'total_orders' })
  totalOrders: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  // Return & Cancellation Policies (vendor-specific, falls back to marketplace defaults)
  @Column({ type: 'jsonb', nullable: true, name: 'return_policy' })
  returnPolicy: {
    enabled: boolean;
    days?: number;
    text: string;
  } | null;

  @Column({ type: 'jsonb', nullable: true, name: 'cancellation_policy' })
  cancellationPolicy: {
    enabled: boolean;
    text: string;
  } | null;

  // Referral System Fields
  @Column({ type: 'uuid', nullable: true, name: 'referred_by' })
  referredBy: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'registration_fee_paid' })
  registrationFeePaid: number;

  @Column({ type: 'timestamp', nullable: true, name: 'registration_paid_at' })
  registrationPaidAt: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'referral_discount' })
  referralDiscount: number;

  // Relations
  @OneToOne(() => User, (user) => user.vendor)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
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
