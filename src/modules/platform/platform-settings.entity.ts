import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

export enum BusinessType {
  PROPRIETORSHIP = 'proprietorship',
  PARTNERSHIP = 'partnership',
  PRIVATE_LIMITED = 'private_limited',
  LLP = 'llp',
  PUBLIC_LIMITED = 'public_limited',
}

export enum GSTRegistrationType {
  UNREGISTERED = 'unregistered',
  REGULAR = 'regular',
  COMPOSITION = 'composition',
}

export enum PlatformKYCStatus {
  PENDING = 'pending',
  INCOMPLETE = 'incomplete',
  COMPLETE = 'complete',
  NEEDS_UPDATE = 'needs_update',
}

export interface KYCDocument {
  type: 'pan' | 'tan' | 'gst_certificate' | 'incorporation_certificate' | 'bank_statement' | 'address_proof' | 'cancelled_cheque' | 'moa' | 'aoa';
  documentNumber?: string;
  fileUrl: string;
  uploadedAt: Date;
}

@Entity('platform_settings')
export class PlatformSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Business Information
  @Column({ name: 'business_name', length: 255 })
  businessName: string;

  @Column({ name: 'business_legal_name', length: 255 })
  businessLegalName: string;

  @Column({ name: 'business_type', type: 'varchar', length: 50 })
  businessType: BusinessType;

  @Column({ name: 'business_email', length: 255 })
  businessEmail: string;

  @Column({ name: 'business_phone', length: 20 })
  businessPhone: string;

  // Registered Address
  @Column({ name: 'registered_address_line1', length: 255 })
  registeredAddressLine1: string;

  @Column({ name: 'registered_address_line2', length: 255, nullable: true })
  registeredAddressLine2?: string;

  @Column({ name: 'registered_city', length: 100 })
  registeredCity: string;

  @Column({ name: 'registered_state', length: 100 })
  registeredState: string;

  @Column({ name: 'registered_pincode', length: 10 })
  registeredPincode: string;

  @Column({ name: 'registered_country', length: 100, default: 'India' })
  registeredCountry: string;

  // Tax Information
  @Column({ name: 'pan_number', length: 10, unique: true, nullable: true })
  panNumber?: string;

  @Column({ name: 'tan_number', length: 10, nullable: true })
  tanNumber?: string;

  @Column({ name: 'gst_registration_type', type: 'varchar', length: 20, nullable: true })
  gstRegistrationType?: GSTRegistrationType;

  @Column({ name: 'gstin', length: 15, unique: true, nullable: true })
  gstin?: string;

  @Column({ name: 'gst_state', length: 100, nullable: true })
  gstState?: string;

  @Column({ name: 'gst_registration_date', type: 'date', nullable: true })
  gstRegistrationDate?: Date;

  // Bank Details
  @Column({ name: 'bank_name', length: 255, nullable: true })
  bankName?: string;

  @Column({ name: 'bank_account_number', length: 50, nullable: true })
  bankAccountNumber?: string;

  @Column({ name: 'bank_ifsc_code', length: 11, nullable: true })
  bankIfscCode?: string;

  @Column({ name: 'bank_account_holder_name', length: 255, nullable: true })
  bankAccountHolderName?: string;

  @Column({ name: 'bank_branch', length: 255, nullable: true })
  bankBranch?: string;

  // KYC Documents
  @Column({ name: 'kyc_documents', type: 'jsonb', default: '[]' })
  kycDocuments: KYCDocument[];

  // Platform Commission
  @Column({ name: 'default_commission_percentage', type: 'decimal', precision: 5, scale: 2, default: 10.00 })
  defaultCommissionPercentage: number;

  // Contact Person
  @Column({ name: 'contact_person_name', length: 255, nullable: true })
  contactPersonName?: string;

  @Column({ name: 'contact_person_designation', length: 100, nullable: true })
  contactPersonDesignation?: string;

  @Column({ name: 'contact_person_email', length: 255, nullable: true })
  contactPersonEmail?: string;

  @Column({ name: 'contact_person_phone', length: 20, nullable: true })
  contactPersonPhone?: string;

  // KYC Status
  @Column({ name: 'kyc_status', type: 'varchar', length: 20, default: PlatformKYCStatus.PENDING })
  kycStatus: PlatformKYCStatus;

  @Column({ name: 'kyc_completed_at', type: 'timestamp with time zone', nullable: true })
  kycCompletedAt?: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'kyc_updated_by' })
  kycUpdatedBy?: User;

  // Metadata
  @Column({ name: 'settings_updated_at', type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  settingsUpdatedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'settings_updated_by' })
  settingsUpdatedBy?: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
