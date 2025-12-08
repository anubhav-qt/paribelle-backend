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

  @Column({ nullable: true })
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
  @JoinColumn({ name: 'cityId' })
  locationCity: City | null;

  @Column({ nullable: true })
  cityId: string;

  @ManyToOne(() => SubLocation, { nullable: true, eager: true })
  @JoinColumn({ name: 'subLocationId' })
  locationSubLocation: SubLocation | null;

  @Column({ nullable: true })
  subLocationId: string;

  @Column({ nullable: true })
  pincode: string;

  // Google location data
  @Column({ nullable: true })
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
