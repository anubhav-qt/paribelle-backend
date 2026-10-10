# Platform (Super Admin) KYC Implementation - Complete Guide

## Overview

This document describes the **Platform KYC system** that enables the super admin (marketplace platform owner) to complete KYC verification. This is separate from vendor KYC and is essential for:

- **GST Filing**: Platform files GST returns on commission income from vendors
- **Invoice Generation**: Platform generates invoices for commission charges
- **Regulatory Compliance**: Legal requirement for operating a marketplace in India
- **Payment Processing**: Required for receiving vendor commission payments

## Architecture

### Database
- **Table**: `platform_settings` (singleton - only one row exists)
- **Location**: `database/migrations/add-platform-settings.sql`
- **Purpose**: Stores platform business details, tax information, bank account, and KYC documents

### Backend
- **Module**: `PlatformModule` (`src/modules/platform/`)
- **Entity**: `PlatformSettings` with enums for BusinessType, GSTRegistrationType, PlatformKYCStatus
- **Service**: `PlatformSettingsService` with methods for updating settings and completing KYC
- **Controller**: `PlatformSettingsController` with 7 REST endpoints
- **Access Control**: `super_admin` role required for updates, `admin` role can view

### Frontend
- **Page**: `/admin/platform-kyc` (Super Admin only)
- **Dashboard Link**: Added to admin dashboard with red Shield icon
- **Features**: Form with 9 document types, validation, upload status tracking

## Database Schema

### Platform Settings Table

```sql
CREATE TABLE platform_settings (
    id UUID PRIMARY KEY,
    
    -- Business Information
    business_name VARCHAR(255) NOT NULL,
    business_legal_name VARCHAR(255) NOT NULL,
    business_type VARCHAR(50) NOT NULL, -- 'proprietorship', 'partnership', 'private_limited', 'llp', 'public_limited'
    business_email VARCHAR(255) NOT NULL,
    business_phone VARCHAR(20) NOT NULL,
    
    -- Registered Address
    registered_address_line1 VARCHAR(255) NOT NULL,
    registered_address_line2 VARCHAR(255),
    registered_city VARCHAR(100) NOT NULL,
    registered_state VARCHAR(100) NOT NULL,
    registered_pincode VARCHAR(10) NOT NULL,
    registered_country VARCHAR(100) DEFAULT 'India',
    
    -- Tax Information
    pan_number VARCHAR(10) UNIQUE,
    tan_number VARCHAR(10),
    gst_registration_type VARCHAR(20), -- 'unregistered', 'regular', 'composition'
    gstin VARCHAR(15) UNIQUE,
    gst_state VARCHAR(100),
    gst_registration_date DATE,
    
    -- Bank Details (for commission collection)
    bank_name VARCHAR(255),
    bank_account_number VARCHAR(50),
    bank_ifsc_code VARCHAR(11),
    bank_account_holder_name VARCHAR(255),
    bank_branch VARCHAR(255),
    
    -- KYC Documents (JSONB array)
    kyc_documents JSONB DEFAULT '[]',
    
    -- Platform Settings
    default_commission_percentage DECIMAL(5,2) DEFAULT 10.00,
    
    -- Contact Person
    contact_person_name VARCHAR(255),
    contact_person_designation VARCHAR(100),
    contact_person_email VARCHAR(255),
    contact_person_phone VARCHAR(20),
    
    -- KYC Status
    kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'incomplete', 'complete', 'needs_update'
    kyc_completed_at TIMESTAMP WITH TIME ZONE,
    kyc_updated_by UUID REFERENCES users(id),
    
    -- Metadata
    settings_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settings_updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint to ensure only one row exists (singleton pattern)
CREATE UNIQUE INDEX idx_platform_settings_singleton ON platform_settings((1));
```

### KYC Documents Structure

```typescript
interface KYCDocument {
  type: 'pan' | 'tan' | 'gst_certificate' | 'incorporation_certificate' | 
        'bank_statement' | 'address_proof' | 'cancelled_cheque' | 'moa' | 'aoa';
  documentNumber?: string;
  fileUrl: string;
  uploadedAt: Date;
}
```

## API Endpoints

### 1. GET /platform/settings
**Access**: Super Admin, Admin  
**Purpose**: Get platform settings  
**Response**:
```json
{
  "id": "uuid",
  "businessName": "My Marketplace",
  "businessLegalName": "My Marketplace Private Limited",
  "kycStatus": "complete",
  "gstin": "27AAAAA0000A1Z5",
  ...
}
```

### 2. PUT /platform/settings
**Access**: Super Admin only  
**Purpose**: Update platform settings  
**Body**: `UpdatePlatformSettingsDto`  
**Response**: Updated platform settings

### 3. POST /platform/kyc/complete
**Access**: Super Admin only  
**Purpose**: Complete platform KYC submission  
**Body**: `CompletePlatformKYCDto`
```json
{
  "panNumber": "ABCDE1234F",
  "tanNumber": "ABCD12345E",
  "gstRegistrationType": "regular",
  "gstin": "27AAAAA0000A1Z5",
  "gstState": "Maharashtra",
  "bankName": "HDFC Bank",
  "bankAccountNumber": "1234567890",
  "bankIfscCode": "HDFC0001234",
  "bankAccountHolderName": "My Marketplace Pvt Ltd",
  "kycDocuments": [...]
}
```

### 4. POST /platform/kyc/validate-gstin
**Access**: Super Admin only  
**Purpose**: Validate GSTIN format  
**Body**: `{ "gstin": "27AAAAA0000A1Z5" }`  
**Response**:
```json
{
  "valid": true,
  "state": "Maharashtra",
  "pan": "AAAAA0000A"
}
```

### 5. GET /platform/kyc/status
**Access**: Super Admin, Admin  
**Purpose**: Check if platform KYC is complete  
**Response**: `{ "kycComplete": true }`

### 6. GET /platform/gstin
**Access**: Super Admin, Admin, Vendor  
**Purpose**: Get platform GSTIN (for invoice generation)  
**Response**: `{ "gstin": "27AAAAA0000A1Z5" }`

### 7. GET /platform/commission
**Access**: Super Admin, Admin, Vendor  
**Purpose**: Get platform commission percentage  
**Response**: `{ "commissionPercentage": 10.00 }`

## Document Requirements

### Required Documents (4)
1. **PAN Card** - Permanent Account Number of the business entity
2. **GST Certificate** - GST registration certificate
3. **Bank Statement** - Last 3 months bank statement
4. **Cancelled Cheque** - For bank account verification

### Optional Documents (5)
5. **TAN Document** - Tax Deduction Account Number (if applicable)
6. **Incorporation Certificate** - Certificate of Incorporation (for companies)
7. **Business Address Proof** - Additional address verification
8. **MOA** - Memorandum of Association (for companies)
9. **AOA** - Articles of Association (for companies)

## Business Flow

### Step 1: Initial Setup (One-time)
```bash
# Run migration to create platform_settings table
cd marketplace-backend
.\run-platform-settings-migration.ps1
```

### Step 2: Super Admin Completes KYC
1. Super Admin logs in and navigates to Admin Dashboard
2. Clicks "Platform KYC" card (red Shield icon)
3. Fills out business information form:
   - Business details (name, type, email, phone)
   - Registered address
   - Tax information (PAN, TAN, GSTIN)
   - Bank details for commission collection
   - Platform commission percentage
4. Uploads required documents (minimum 4)
5. Submits form
6. System validates all required fields and documents
7. KYC status changes to "complete"

### Step 3: Platform Can Now File GST
- Platform GSTIN is available via API
- Invoices can include platform GST details
- Commission collection is legally compliant

## Implementation Files

### Backend Files Created
```
marketplace-backend/
├── database/migrations/
│   └── add-platform-settings.sql          # Database migration
├── run-platform-settings-migration.ps1     # Migration runner script
└── src/modules/platform/
    ├── platform-settings.entity.ts         # Entity with enums
    ├── platform-settings.service.ts        # Business logic
    ├── platform-settings.controller.ts     # REST API
    ├── platform.module.ts                  # Module definition
    └── dto/
        └── platform-settings.dto.ts        # DTOs with validation
```

### Frontend Files Created
```
marketplace-web/
└── src/app/admin/
    └── platform-kyc/
        └── page.tsx                        # KYC form page
```

### Modified Files
```
marketplace-backend/src/app.module.ts       # Added PlatformModule import
marketplace-web/src/app/admin/page.tsx      # Added Platform KYC card
```

## Installation Steps

### 1. Run Database Migration
```powershell
cd marketplace-backend
.\run-platform-settings-migration.ps1
```

**Verifies**:
- Creates `platform_settings` table
- Inserts default row with placeholder values
- Creates indexes

### 2. Restart Backend
```powershell
npm run start:dev
```

**Verifies**:
- PlatformModule is loaded
- 7 API endpoints are registered
- TypeORM recognizes PlatformSettings entity

### 3. Test Frontend Access
1. Login as super admin
2. Go to http://localhost:3000/admin
3. Click "Platform KYC" card (top-left, red)
4. Verify form loads with existing data

## Validation Rules

### PAN Number
- Format: `ABCDE1234F` (5 letters, 4 digits, 1 letter)
- Length: Exactly 10 characters
- Case: Uppercase

### TAN Number
- Format: `ABCD12345E` (4 letters, 5 digits, 1 letter)
- Length: Exactly 10 characters
- Case: Uppercase

### GSTIN
- Format: `27AAAAA0000A1Z5` (2 digits state code, 10 chars PAN, 1 entity number, Z, 1 checksum)
- Length: Exactly 15 characters
- Case: Uppercase
- Validation: Extracts state code and PAN from GSTIN

### IFSC Code
- Format: `ABCD0123456` (4 letters bank code, 0, 6 alphanumeric branch code)
- Length: Exactly 11 characters
- Case: Uppercase

### Commission Percentage
- Range: 0% to 100%
- Decimal: Up to 2 decimal places
- Default: 10.00%

## KYC Status States

1. **pending**: Initial state, no data entered
2. **incomplete**: Partial data entered, missing required fields
3. **complete**: All required fields and documents submitted
4. **needs_update**: KYC was complete but now needs updating (e.g., GST renewal)

## File Upload Constraints

- **Max Size**: 5 MB per file
- **Allowed Types**: PDF, JPG, JPEG, PNG
- **Endpoint**: POST /upload/kyc (reuses existing upload endpoint)
- **Storage**: Local filesystem (production: AWS S3)

## Integration with Other Features

### 1. Invoice Generation (Phase 3)
```typescript
// Get platform GSTIN for invoice
const platform = await platformSettingsService.getPlatformSettings();
const platformGSTIN = platform.gstin;

// Include in invoice
invoice.platformGSTIN = platformGSTIN;
invoice.platformName = platform.businessLegalName;
```

### 2. Commission Calculation
```typescript
// Get commission percentage
const commission = await platformSettingsService.getCommissionPercentage();
const commissionAmount = orderTotal * (commission / 100);
```

### 3. GST Filing
- Platform files GSTR-1 (outward supplies) for commission income
- Platform files GSTR-3B monthly/quarterly returns
- Platform GSTIN is used on all commission invoices to vendors

## Security Considerations

### Access Control
- **Super Admin**: Full CRUD access to platform settings
- **Admin**: Read-only access to platform settings
- **Vendor**: Can only read GSTIN and commission percentage (for transparency)
- **Customer**: No access to platform settings

### Data Protection
- PAN, TAN, GSTIN are sensitive tax identifiers
- Bank account details are stored (consider encryption in production)
- Document URLs are protected by authentication
- Single row pattern prevents accidental duplication

### Audit Trail
- `kyc_updated_by`: Tracks who completed KYC
- `settings_updated_by`: Tracks who updated settings
- `kyc_completed_at`: Timestamp of KYC completion
- `settings_updated_at`: Timestamp of last update

## Testing Guide

### 1. Test Migration
```powershell
cd marketplace-backend
.\run-platform-settings-migration.ps1
```
**Expected**: Table created, default row inserted

### 2. Test API Endpoints
```powershell
# Get platform settings
curl http://localhost:4000/platform/settings -H "Authorization: Bearer $TOKEN"

# Update settings
curl -X PUT http://localhost:4000/platform/settings -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{...}'

# Complete KYC
curl -X POST http://localhost:4000/platform/kyc/complete -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{...}'

# Validate GSTIN
curl -X POST http://localhost:4000/platform/kyc/validate-gstin -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"gstin":"27AAAAA0000A1Z5"}'
```

### 3. Test Frontend
1. Login as super admin
2. Navigate to /admin/platform-kyc
3. Fill all required fields
4. Upload 4 required documents
5. Submit form
6. Verify KYC status badge shows "Complete"
7. Verify documents show "✓ Uploaded" badges

### 4. Test Validation
- Try invalid PAN: Should show error "Invalid PAN format"
- Try invalid GSTIN: Should show error "Invalid GSTIN format"
- Try invalid IFSC: Should show error "Invalid IFSC code format"
- Try uploading without required docs: Should show error "Missing required documents"

## Troubleshooting

### Issue: Migration fails with "relation already exists"
**Solution**: Table already exists, no action needed

### Issue: API returns 403 Forbidden
**Solution**: Ensure user has `super_admin` role in database

### Issue: Documents not uploading
**Solution**: Check `public/uploads/kyc` directory exists and has write permissions

### Issue: GSTIN validation fails
**Solution**: Ensure GSTIN matches format: 2 digits + 10 chars PAN + 1 digit + Z + 1 digit

### Issue: Form doesn't load existing data
**Solution**: Check backend logs, ensure default row exists in `platform_settings` table

## Future Enhancements

1. **Document Verification**: Integrate with government APIs to verify PAN/GSTIN
2. **Expiry Tracking**: Alert when GST registration or other documents near expiry
3. **Multi-Currency**: Support for commission in different currencies
4. **TDS Deduction**: Calculate and track TDS on commission payments
5. **Automated GST Filing**: Integration with GST portal for automated filing
6. **Document Encryption**: Encrypt sensitive documents at rest
7. **Approval Workflow**: Add second-level approval for platform KYC changes
8. **Audit Logs**: Detailed activity logs for compliance

## Compliance Notes

### GST Requirements for Marketplaces in India
- **Electronic Commerce Operator (ECO)**: Marketplace is classified as ECO
- **TCS (Tax Collected at Source)**: ECO must collect 1% TCS from vendor payments (if applicable)
- **GSTR-8**: Monthly return for TCS collected by ECO
- **GSTR-1**: Outward supplies (commission income)
- **ITC (Input Tax Credit)**: Platform can claim ITC on operational expenses

### Income Tax Requirements
- **TAN**: Required for TDS deduction on vendor payments
- **TDS on Commission**: Deduct TDS if commission > threshold
- **26AS Reporting**: Report TDS deductions in Form 26AS

## Summary

This Platform KYC implementation enables the marketplace super admin to:
- ✅ Complete platform-level KYC verification
- ✅ Store business registration and tax details
- ✅ Maintain bank account for commission collection
- ✅ Upload required compliance documents
- ✅ Set default commission percentage
- ✅ Enable GST filing for platform commission income
- ✅ Generate legally compliant commission invoices

The system is now ready for Phase 2 (Product GST) and Phase 3 (Invoice Generation).
