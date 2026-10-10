import { IsString, IsEmail, IsOptional, IsEnum, IsNumber, IsDateString, IsArray, ValidateNested, IsNotEmpty, Length, Matches, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessType, GSTRegistrationType, PlatformKYCStatus } from '../platform-settings.entity';

export class KYCDocumentDto {
  @IsString()
  @IsEnum(['pan', 'tan', 'gst_certificate', 'incorporation_certificate', 'bank_statement', 'address_proof', 'cancelled_cheque', 'moa', 'aoa'])
  type: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsDateString()
  uploadedAt: string;
}

export class UpdatePlatformSettingsDto {
  // Business Information
  @IsOptional()
  @IsString()
  @Length(2, 255)
  businessName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 255)
  businessLegalName?: string;

  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @IsOptional()
  @IsString()
  @Length(10, 20)
  businessPhone?: string;

  // Registered Address
  @IsOptional()
  @IsString()
  @Length(5, 255)
  registeredAddressLine1?: string;

  @IsOptional()
  @IsString()
  registeredAddressLine2?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  registeredCity?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  registeredState?: string;

  @IsOptional()
  @IsString()
  @Length(6, 10)
  registeredPincode?: string;

  @IsOptional()
  @IsString()
  registeredCountry?: string;

  // Tax Information
  @IsOptional()
  @IsString()
  @Length(10, 10)
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Invalid PAN format' })
  panNumber?: string;

  @IsOptional()
  @IsString()
  @Length(10, 10)
  @Matches(/^[A-Z]{4}[0-9]{5}[A-Z]{1}$/, { message: 'Invalid TAN format' })
  tanNumber?: string;

  @IsOptional()
  @IsEnum(GSTRegistrationType)
  gstRegistrationType?: GSTRegistrationType;

  @IsOptional()
  @IsString()
  @Length(15, 15)
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { message: 'Invalid GSTIN format' })
  gstin?: string;

  @IsOptional()
  @IsString()
  gstState?: string;

  @IsOptional()
  @IsDateString()
  gstRegistrationDate?: string;

  // Bank Details
  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  @Length(11, 11)
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'Invalid IFSC code format' })
  bankIfscCode?: string;

  @IsOptional()
  @IsString()
  bankAccountHolderName?: string;

  @IsOptional()
  @IsString()
  bankBranch?: string;

  // KYC Documents
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KYCDocumentDto)
  kycDocuments?: KYCDocumentDto[];

  // Platform Commission
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultCommissionPercentage?: number;

  // Contact Person
  @IsOptional()
  @IsString()
  contactPersonName?: string;

  @IsOptional()
  @IsString()
  contactPersonDesignation?: string;

  @IsOptional()
  @IsEmail()
  contactPersonEmail?: string;

  @IsOptional()
  @IsString()
  contactPersonPhone?: string;
}

export class CompletePlatformKYCDto {
  @IsNotEmpty()
  @IsString()
  @Length(10, 10)
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Invalid PAN format' })
  panNumber: string;

  @IsOptional()
  @IsString()
  @Length(10, 10)
  @Matches(/^[A-Z]{4}[0-9]{5}[A-Z]{1}$/, { message: 'Invalid TAN format' })
  tanNumber?: string;

  @IsEnum(GSTRegistrationType)
  gstRegistrationType: GSTRegistrationType;

  @IsOptional()
  @IsString()
  @Length(15, 15)
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { message: 'Invalid GSTIN format' })
  gstin?: string;

  @IsOptional()
  @IsString()
  gstState?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KYCDocumentDto)
  kycDocuments: KYCDocumentDto[];

  @IsNotEmpty()
  @IsString()
  bankName: string;

  @IsNotEmpty()
  @IsString()
  bankAccountNumber: string;

  @IsNotEmpty()
  @IsString()
  @Length(11, 11)
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'Invalid IFSC code format' })
  bankIfscCode: string;

  @IsNotEmpty()
  @IsString()
  bankAccountHolderName: string;
}

export class ValidateGSTINDto {
  @IsNotEmpty()
  @IsString()
  @Length(15, 15)
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { message: 'Invalid GSTIN format' })
  gstin: string;
}
