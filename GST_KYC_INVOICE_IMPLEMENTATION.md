# GST, KYC & Invoice Implementation - Task List

**Project:** Multi-Vendor Marketplace  
**Date:** December 29, 2025  
**Status:** Ready for Implementation

---

## 📋 Implementation Overview

This document provides a complete task breakdown for implementing:
1. **Vendor KYC Verification System**
2. **Product GST Configuration with Variants**
3. **Automated Invoice Generation System**

---

## 🎯 Phase 1: Vendor KYC System (Tasks 1-6)

### ✅ Task 1: Database Schema - Add KYC Fields to Vendors Table

**File to Create:** `marketplace-backend/database/migrations/add-vendor-kyc.sql`

**Actions:**
- [ ] Create migration file
- [ ] Add KYC status column (pending, submitted, under_review, approved, rejected)
- [ ] Add KYC documents JSONB column
- [ ] Add KYC timestamp fields (submittedAt, approvedAt)
- [ ] Add KYC approver reference (kycApprovedBy)
- [ ] Add rejection reason field
- [ ] Add PAN number field
- [ ] Add GST registration type (unregistered, regular, composition)
- [ ] Add GST state field
- [ ] Add invoice frequency field (per_order, daily, weekly, monthly)
- [ ] Create indexes on kycStatus
- [ ] Add check constraints for status values
- [ ] Add column comments

**SQL Fields:**
```sql
kycStatus VARCHAR(50) DEFAULT 'pending'
kycDocuments JSONB
kycSubmittedAt TIMESTAMP
kycApprovedAt TIMESTAMP
kycApprovedBy UUID
kycRejectedReason TEXT
panNumber VARCHAR(50)
gstRegistrationType VARCHAR(50) DEFAULT 'unregistered'
gstState VARCHAR(50)
invoiceFrequency VARCHAR(50) DEFAULT 'per_order'
```

---

### ✅ Task 2: Backend Entity - Update Vendor Entity

**File to Update:** `marketplace-backend/src/modules/vendors/vendor.entity.ts`

**Actions:**
- [ ] Create KYCStatus enum (pending, submitted, under_review, approved, rejected)
- [ ] Create GSTRegistrationType enum (unregistered, regular, composition)
- [ ] Add kycStatus column decorator
- [ ] Add kycDocuments column (Array of document objects)
- [ ] Add kycSubmittedAt column
- [ ] Add kycApprovedAt column
- [ ] Add kycApprovedBy column
- [ ] Add kycRejectedReason column
- [ ] Add panNumber column
- [ ] Add gstRegistrationType column
- [ ] Add gstState column
- [ ] Add isKycVerified boolean column
- [ ] Add invoiceFrequency column

**Document Interface:**
```typescript
{
  type: string;
  documentNumber?: string;
  documentUrl: string;
  uploadedAt: Date;
  fileName: string;
  fileSize: number;
}
```

---

### ✅ Task 3: Backend Service - Create KYC Service

**File to Create:** `marketplace-backend/src/modules/vendors/kyc.service.ts`

**Actions:**
- [ ] Create KYCService class
- [ ] Inject VendorRepository and UserRepository
- [ ] Inject EmailService
- [ ] Implement submitKYC(vendorId, documents) method
  - [ ] Validate vendor exists
  - [ ] Check if KYC already approved
  - [ ] Validate required documents (pan, aadhar_front, aadhar_back, bank_details, address_proof)
  - [ ] Update vendor with documents
  - [ ] Set status to SUBMITTED
  - [ ] Extract PAN number from documents
  - [ ] Send notification email to admins
- [ ] Implement approveKYC(vendorId, adminUserId) method
  - [ ] Update status to APPROVED
  - [ ] Set isKycVerified to true
  - [ ] Record approval timestamp and admin
  - [ ] Send approval email to vendor
- [ ] Implement rejectKYC(vendorId, reason, adminUserId) method
  - [ ] Update status to REJECTED
  - [ ] Store rejection reason
  - [ ] Send rejection email to vendor
- [ ] Implement getVendorsForKYCReview() method
  - [ ] Return all vendors with SUBMITTED status
  - [ ] Order by submission date
- [ ] Implement getKYCDetails(vendorId) method
- [ ] Implement validateGSTIN(gstin) utility method
  - [ ] Validate GSTIN format (15 characters)
  - [ ] Extract state code (first 2 digits)
  - [ ] Extract PAN (characters 3-12)
  - [ ] Validate state code range (01-37)
- [ ] Implement notifyAdminsOfKYCSubmission() private method

---

### ✅ Task 4: Backend Controller - Create KYC Controller

**File to Create:** `marketplace-backend/src/modules/vendors/kyc.controller.ts`

**Actions:**
- [ ] Create KYCController class
- [ ] Add @Controller('vendors') decorator
- [ ] Add @UseGuards(JwtAuthGuard) decorator
- [ ] Inject KYCService
- [ ] Create POST /kyc/submit endpoint
  - [ ] Extract vendorId from authenticated user
  - [ ] Accept documents array in body
  - [ ] Call kycService.submitKYC()
- [ ] Create GET /kyc/status endpoint
  - [ ] Return current vendor's KYC status
- [ ] Create GET /kyc/pending endpoint (Admin only)
  - [ ] Add @UseGuards(RolesGuard) decorator
  - [ ] Add @Roles('admin') decorator
  - [ ] Return all pending KYC submissions
- [ ] Create PUT /kyc/:vendorId/approve endpoint (Admin only)
  - [ ] Extract admin user ID from request
  - [ ] Call kycService.approveKYC()
- [ ] Create PUT /kyc/:vendorId/reject endpoint (Admin only)
  - [ ] Accept reason in body
  - [ ] Call kycService.rejectKYC()

---

### ✅ Task 5: Backend Service - File Upload for KYC Documents

**File to Update:** `marketplace-backend/src/modules/upload/upload.service.ts`

**Actions:**
- [ ] Create uploadKYCDocument() method
- [ ] Validate file type (PDF, JPG, JPEG, PNG)
- [ ] Validate file size (max 5MB)
- [ ] Generate unique filename with timestamp
- [ ] Upload to storage (AWS S3 or local storage)
- [ ] Return file URL
- [ ] Add error handling for upload failures

**File to Update:** `marketplace-backend/src/modules/upload/upload.controller.ts`

**Actions:**
- [ ] Create POST /upload/kyc-documents endpoint
- [ ] Add multer file upload middleware
- [ ] Accept 'file' in multipart form data
- [ ] Accept 'type' field for document type
- [ ] Call uploadService.uploadKYCDocument()
- [ ] Return uploaded file URL

---

### ✅ Task 6: Frontend - Vendor KYC Upload Interface

**File to Create:** `marketplace-web/src/app/vendor/kyc/page.tsx`

**Actions:**
- [ ] Create VendorKYCPage component
- [ ] Add state for documents array
- [ ] Add state for KYC status
- [ ] Add state for rejection reason
- [ ] Implement fetchKYCStatus() on mount
  - [ ] Fetch vendor details from API
  - [ ] Populate existing documents
- [ ] Define DOCUMENT_TYPES array:
  - [ ] PAN Card (required)
  - [ ] Aadhar Front (required)
  - [ ] Aadhar Back (required)
  - [ ] GST Certificate (optional)
  - [ ] Business License (optional)
  - [ ] Bank Details (required)
  - [ ] Address Proof (required)
- [ ] Implement handleFileSelect() for each document
  - [ ] Validate file size (5MB)
  - [ ] Update documents state
- [ ] Implement handleDocumentNumberChange() for PAN/Aadhar
- [ ] Implement handleSubmit()
  - [ ] Validate all required documents present
  - [ ] Upload each file to /api/v1/upload/kyc-documents
  - [ ] Collect all uploaded URLs
  - [ ] Submit to /api/v1/vendors/kyc/submit
  - [ ] Show success message
  - [ ] Redirect to dashboard
- [ ] Implement getStatusBadge() UI helper
  - [ ] Show colored badge based on status
  - [ ] Show appropriate icon
- [ ] Create document upload card for each type
  - [ ] Show document label with required indicator
  - [ ] Add document number input for PAN/Aadhar
  - [ ] Add file upload button
  - [ ] Show file preview/status
- [ ] Show rejection reason if status is rejected
- [ ] Show success message if status is approved
- [ ] Disable form if KYC approved
- [ ] Add loading states

---

### ✅ Task 7: Frontend - Admin KYC Verification Dashboard

**File to Create:** `marketplace-web/src/app/admin/kyc-verification/page.tsx`

**Actions:**
- [ ] Create AdminKYCVerificationPage component
- [ ] Add state for pending vendors list
- [ ] Add state for selected vendor
- [ ] Add state for modal visibility
- [ ] Add state for rejection reason
- [ ] Implement fetchPendingKYC() on mount
  - [ ] Fetch from /api/v1/vendors/kyc/pending
  - [ ] Display count of pending KYCs
- [ ] Check URL params for vendorId (from email link)
  - [ ] Auto-open details if vendorId present
- [ ] Create vendors table
  - [ ] Show vendor name
  - [ ] Show email
  - [ ] Show submission date
  - [ ] Show document count
  - [ ] Add "Review" button
- [ ] Implement handleViewDetails()
  - [ ] Set selected vendor
  - [ ] Open modal
- [ ] Create review modal
  - [ ] Show vendor details
  - [ ] Display all uploaded documents
  - [ ] Add "View Document" links (open in new tab)
  - [ ] Add document number display
  - [ ] Add rejection reason textarea
  - [ ] Add "Approve" button (green)
  - [ ] Add "Reject" button (red)
  - [ ] Add "Close" button
- [ ] Implement handleApprove()
  - [ ] Show confirmation dialog
  - [ ] Call /api/v1/vendors/kyc/:id/approve
  - [ ] Show success message
  - [ ] Refresh list
  - [ ] Close modal
- [ ] Implement handleReject()
  - [ ] Validate rejection reason not empty
  - [ ] Call /api/v1/vendors/kyc/:id/reject
  - [ ] Show success message
  - [ ] Refresh list
  - [ ] Close modal
- [ ] Implement getDocumentLabel() helper
- [ ] Add loading states
- [ ] Handle empty state (no pending KYCs)

---

## 🎯 Phase 2: Product GST Configuration & Variants (Tasks 8-15)

### ✅ Task 8: Database Schema - Add GST Fields to Products

**File to Create:** `marketplace-backend/database/migrations/add-product-gst-fields.sql`

**Actions:**
- [ ] Add hsnCode VARCHAR(20) column
- [ ] Add sacCode VARCHAR(20) column (for services)
- [ ] Add gstRate DECIMAL(5,2) DEFAULT 18.00 column
- [ ] Add priceType VARCHAR(50) DEFAULT 'selling_price_without_gst' column
- [ ] Add mrp DECIMAL(10,2) column
- [ ] Add basePrice DECIMAL(10,2) column
- [ ] Add gstAmount DECIMAL(10,2) column
- [ ] Add hasVariants BOOLEAN DEFAULT FALSE column
- [ ] Add variantOptions JSONB column
- [ ] Add check constraint for gstRate (0, 5, 12, 18, 28)
- [ ] Add check constraint for priceType (mrp_with_gst, selling_price_without_gst)
- [ ] Create indexes on hsnCode and gstRate
- [ ] Add column comments

---

### ✅ Task 9: Database Schema - Create Product Variants Table

**File:** Same as Task 8 or separate migration

**Actions:**
- [ ] Create product_variants table
  - [ ] id UUID PRIMARY KEY
  - [ ] productId UUID REFERENCES products(id) ON DELETE CASCADE
  - [ ] sku VARCHAR(255) UNIQUE NOT NULL
  - [ ] variantAttributes JSONB (e.g., {size: "M", color: "Red"})
  - [ ] price DECIMAL(10,2)
  - [ ] stockQuantity INTEGER
  - [ ] images TEXT[]
  - [ ] isActive BOOLEAN DEFAULT TRUE
  - [ ] createdAt TIMESTAMP
  - [ ] updatedAt TIMESTAMP
- [ ] Create indexes on productId and sku
- [ ] Add foreign key cascade delete

---

### ✅ Task 10: Database Schema - Create HSN Codes Master Table

**File:** Same migration or separate

**Actions:**
- [ ] Create hsn_codes table
  - [ ] id UUID PRIMARY KEY
  - [ ] code VARCHAR(20) UNIQUE NOT NULL
  - [ ] description TEXT NOT NULL
  - [ ] recommendedGstRate DECIMAL(5,2)
  - [ ] category VARCHAR(100)
  - [ ] createdAt TIMESTAMP
- [ ] Insert common HSN codes (15-20 entries)
  - [ ] 6109: T-shirts (5%)
  - [ ] 6203: Men's suits/trousers (12%)
  - [ ] 6403: Footwear (18%)
  - [ ] 8517: Smartphones (18%)
  - [ ] 8528: Televisions (18%)
  - [ ] 3304: Cosmetics (18%)
  - [ ] 4901: Books (0%)
  - [ ] 0401: Milk (0%)
  - [ ] 1001: Wheat (0%)
  - [ ] 2106: Food preparations (12%)
  - [ ] 3004: Medicines (5%)
  - [ ] 9403: Furniture (18%)
  - [ ] 9503: Toys (12%)
  - [ ] 7113: Jewelry (3%)
  - [ ] 8703: Motor vehicles (28%)
- [ ] Add ON CONFLICT DO NOTHING to prevent duplicates

---

### ✅ Task 11: Backend Entity - Update Product Entity

**File to Update:** `marketplace-backend/src/modules/products/product.entity.ts`

**Actions:**
- [ ] Add hsnCode column
- [ ] Add sacCode column
- [ ] Add gstRate column (default 18)
- [ ] Add priceType enum column
- [ ] Add mrp column
- [ ] Add basePrice column
- [ ] Add gstAmount column
- [ ] Add hasVariants column
- [ ] Add variantOptions column (JSONB)
- [ ] Create PriceType enum (mrp_with_gst, selling_price_without_gst)

---

### ✅ Task 12: Backend Entity - Create Product Variant Entity

**File to Create:** `marketplace-backend/src/modules/products/product-variant.entity.ts`

**Actions:**
- [ ] Create ProductVariant entity class
- [ ] Add id (UUID primary key)
- [ ] Add productId (Many-to-One relation)
- [ ] Add sku (unique)
- [ ] Add variantAttributes (JSONB)
- [ ] Add price column
- [ ] Add stockQuantity column
- [ ] Add images column (array)
- [ ] Add isActive column
- [ ] Add timestamps
- [ ] Add unique constraint on SKU

---

### ✅ Task 13: Backend Service - Create GST Calculation Service

**File to Create:** `marketplace-backend/src/modules/products/gst-calculation.service.ts`

**Actions:**
- [ ] Create GSTCalculationService class
- [ ] Implement calculateGST() method
  - [ ] Accept price, gstRate, priceType
  - [ ] If priceType is 'mrp_with_gst':
    - [ ] basePrice = mrp / (1 + gstRate/100)
    - [ ] gstAmount = mrp - basePrice
  - [ ] If priceType is 'selling_price_without_gst':
    - [ ] basePrice = price
    - [ ] gstAmount = basePrice * (gstRate/100)
    - [ ] mrp = basePrice + gstAmount
  - [ ] Return breakdown object
- [ ] Implement calculateOrderGST() method
  - [ ] Accept array of order items
  - [ ] Calculate total CGST, SGST, IGST
  - [ ] Handle inter-state vs intra-state
  - [ ] Return detailed breakdown
- [ ] Implement getGSTBreakdown() method
  - [ ] Return CGST, SGST, or IGST based on buyer/seller states
  - [ ] For intra-state: CGST + SGST (half each)
  - [ ] For inter-state: IGST (full)

---

### ✅ Task 14: Backend Service - Create HSN Code Service

**File to Create:** `marketplace-backend/src/modules/products/hsn-code.service.ts`

**Actions:**
- [ ] Create HSNCodeService class
- [ ] Inject HSNCodeRepository
- [ ] Implement searchHSNCodes(query) method
  - [ ] Search by code or description
  - [ ] Return matching results with recommended GST rate
- [ ] Implement getHSNByCode(code) method
- [ ] Implement getAllHSNCodes() method
- [ ] Implement addHSNCode() method (admin only)

---

### ✅ Task 15: Backend Controller - Add HSN Code Endpoints

**File to Create:** `marketplace-backend/src/modules/products/hsn-code.controller.ts`

**Actions:**
- [ ] Create HSNCodeController class
- [ ] Add @Controller('hsn-codes') decorator
- [ ] Create GET /hsn-codes endpoint
  - [ ] Accept optional 'search' query parameter
  - [ ] Return all or filtered HSN codes
- [ ] Create GET /hsn-codes/:code endpoint
  - [ ] Return specific HSN code details
- [ ] Create POST /hsn-codes endpoint (Admin only)
  - [ ] Accept code, description, gstRate, category
  - [ ] Add new HSN code

---

### ✅ Task 16: Backend Service - Update Product Service for GST

**File to Update:** `marketplace-backend/src/modules/products/product.service.ts`

**Actions:**
- [ ] Inject GSTCalculationService
- [ ] Update createProduct() method
  - [ ] Accept GST fields (hsnCode, gstRate, priceType)
  - [ ] Calculate GST breakdown using service
  - [ ] Store basePrice, gstAmount, mrp
  - [ ] Handle variant options if hasVariants is true
- [ ] Update updateProduct() method
  - [ ] Recalculate GST if price or rate changes
- [ ] Create createProductVariant() method
  - [ ] Accept productId, variantAttributes, price
  - [ ] Generate unique SKU
  - [ ] Create variant record
- [ ] Create updateProductVariant() method
- [ ] Create deleteProductVariant() method
- [ ] Create getProductVariants(productId) method

---

### ✅ Task 17: Backend Controller - Add Product Variant Endpoints

**File to Update:** `marketplace-backend/src/modules/products/product.controller.ts`

**Actions:**
- [ ] Create POST /products/:id/variants endpoint
  - [ ] Accept variant details
  - [ ] Call productService.createProductVariant()
- [ ] Create GET /products/:id/variants endpoint
  - [ ] Return all variants for product
- [ ] Create PUT /products/:id/variants/:variantId endpoint
  - [ ] Update variant details
- [ ] Create DELETE /products/:id/variants/:variantId endpoint
  - [ ] Delete variant

---

### ✅ Task 18: Frontend - Update Product Creation Form (Add GST Fields)

**File to Update:** `marketplace-web/src/app/vendor/products/add/page.tsx` or `marketplace-web/src/components/ProductForm.tsx`

**Actions:**
- [ ] Add HSN Code input with autocomplete
  - [ ] Fetch HSN codes from /api/v1/hsn-codes
  - [ ] Show dropdown with suggestions
  - [ ] Display recommended GST rate on selection
- [ ] Add GST Rate dropdown
  - [ ] Options: 0%, 5%, 12%, 18%, 28%
  - [ ] Auto-populate from HSN code selection
  - [ ] Allow manual override
- [ ] Add Price Type radio buttons
  - [ ] "MRP (with GST included)"
  - [ ] "Selling Price (without GST)"
- [ ] Add conditional price inputs based on priceType
  - [ ] If MRP: Show "MRP" input
  - [ ] If Selling Price: Show "Base Price" input
- [ ] Add GST calculation display section
  - [ ] Show Base Price
  - [ ] Show GST Amount
  - [ ] Show Final Price/MRP
  - [ ] Calculate in real-time as user types
- [ ] Add "Has Variants" checkbox
- [ ] Show variant configuration section if checked
  - [ ] Add variant attribute type (e.g., Size, Color)
  - [ ] Add values for each attribute
  - [ ] Generate variant combinations automatically
  - [ ] Show table of all variants with price/stock inputs
- [ ] Update form submission
  - [ ] Include all GST fields
  - [ ] Include variant data if applicable
  - [ ] Call updated product creation API

---

### ✅ Task 19: Frontend - Create Variant Management Interface

**File to Create:** `marketplace-web/src/app/vendor/products/[id]/variants/page.tsx`

**Actions:**
- [ ] Create ProductVariantsPage component
- [ ] Fetch product details and existing variants
- [ ] Display variant attributes header (e.g., Size, Color)
- [ ] Create variants table
  - [ ] Show SKU
  - [ ] Show attribute values
  - [ ] Show price input
  - [ ] Show stock quantity input
  - [ ] Show active/inactive toggle
  - [ ] Add edit/delete actions
- [ ] Add "Add Variant" button
  - [ ] Open modal with variant form
  - [ ] Select attribute values from dropdown
  - [ ] Enter price and stock
  - [ ] Generate SKU automatically
- [ ] Implement bulk edit functionality
  - [ ] Update prices for multiple variants at once
  - [ ] Bulk activate/deactivate
- [ ] Implement save functionality
  - [ ] Call /api/v1/products/:id/variants
  - [ ] Show success message

---

### ✅ Task 20: Frontend - Vendor Settings Page (Invoice Frequency)

**File to Create:** `marketplace-web/src/app/vendor/settings/page.tsx`

**Actions:**
- [ ] Create VendorSettingsPage component
- [ ] Fetch vendor settings from API
- [ ] Add Invoice Frequency dropdown
  - [ ] Per Order (Immediate after each order)
  - [ ] Daily (End of each day)
  - [ ] Weekly (Every Monday)
  - [ ] Monthly (1st of each month)
- [ ] Add description for each frequency option
- [ ] Add Save Settings button
- [ ] Implement handleSave()
  - [ ] Call /api/v1/vendors/settings
  - [ ] Update invoiceFrequency field
  - [ ] Show success message
- [ ] Add loading and saving states

---

## 🎯 Phase 3: Invoice Generation System (Tasks 21-30)

### ✅ Task 21: Database Schema - Create Invoices Table

**File to Create:** `marketplace-backend/database/migrations/create-invoices-table.sql`

**Actions:**
- [ ] Create invoices table
  - [ ] id UUID PRIMARY KEY
  - [ ] invoiceNumber VARCHAR(50) UNIQUE (e.g., INV-2025-001234)
  - [ ] vendorId UUID REFERENCES vendors(id)
  - [ ] orderIds UUID[] (array of order IDs included)
  - [ ] invoiceDate DATE
  - [ ] dueDate DATE
  - [ ] periodStart DATE
  - [ ] periodEnd DATE
  - [ ] subtotal DECIMAL(10,2)
  - [ ] cgstAmount DECIMAL(10,2)
  - [ ] sgstAmount DECIMAL(10,2)
  - [ ] igstAmount DECIMAL(10,2)
  - [ ] totalGst DECIMAL(10,2)
  - [ ] totalAmount DECIMAL(10,2)
  - [ ] platformCommission DECIMAL(10,2)
  - [ ] payableToVendor DECIMAL(10,2)
  - [ ] status VARCHAR(50) (generated, sent, paid, cancelled)
  - [ ] pdfUrl TEXT
  - [ ] generatedAt TIMESTAMP
  - [ ] sentAt TIMESTAMP
  - [ ] paidAt TIMESTAMP
  - [ ] paymentReference VARCHAR(255)
  - [ ] notes TEXT
  - [ ] metadata JSONB
- [ ] Create indexes on vendorId, invoiceNumber, invoiceDate, status
- [ ] Add unique constraint on invoiceNumber

---

### ✅ Task 22: Database Schema - Create Invoice Line Items Table

**File:** Same migration

**Actions:**
- [ ] Create invoice_line_items table
  - [ ] id UUID PRIMARY KEY
  - [ ] invoiceId UUID REFERENCES invoices(id) ON DELETE CASCADE
  - [ ] orderId UUID REFERENCES orders(id)
  - [ ] orderItemId UUID
  - [ ] productName TEXT
  - [ ] productSku VARCHAR(255)
  - [ ] hsnCode VARCHAR(20)
  - [ ] quantity INTEGER
  - [ ] unitPrice DECIMAL(10,2)
  - [ ] subtotal DECIMAL(10,2)
  - [ ] gstRate DECIMAL(5,2)
  - [ ] gstAmount DECIMAL(10,2)
  - [ ] totalAmount DECIMAL(10,2)
  - [ ] cgst DECIMAL(10,2)
  - [ ] sgst DECIMAL(10,2)
  - [ ] igst DECIMAL(10,2)
- [ ] Create index on invoiceId

---

### ✅ Task 23: Backend Entity - Create Invoice Entity

**File to Create:** `marketplace-backend/src/modules/invoices/invoice.entity.ts`

**Actions:**
- [ ] Create Invoice entity class
- [ ] Add all columns from schema
- [ ] Create InvoiceStatus enum (generated, sent, paid, cancelled)
- [ ] Add One-to-Many relation to InvoiceLineItem
- [ ] Add Many-to-One relation to Vendor
- [ ] Add timestamps

---

### ✅ Task 24: Backend Entity - Create Invoice Line Item Entity

**File to Create:** `marketplace-backend/src/modules/invoices/invoice-line-item.entity.ts`

**Actions:**
- [ ] Create InvoiceLineItem entity class
- [ ] Add all columns from schema
- [ ] Add Many-to-One relation to Invoice
- [ ] Add Many-to-One relation to Order

---

### ✅ Task 25: Backend Service - Create Invoice Generation Service

**File to Create:** `marketplace-backend/src/modules/invoices/invoice-generation.service.ts`

**Actions:**
- [ ] Create InvoiceGenerationService class
- [ ] Inject InvoiceRepository, OrderRepository, VendorRepository
- [ ] Inject GSTCalculationService
- [ ] Implement generateInvoicesForFrequency(frequency) method
  - [ ] Find all vendors with matching invoice frequency
  - [ ] Determine date range based on frequency:
    - [ ] per_order: Process individual orders
    - [ ] daily: Yesterday's orders
    - [ ] weekly: Last week (Monday to Sunday)
    - [ ] monthly: Last month
  - [ ] For each vendor, call generateVendorInvoice()
- [ ] Implement generateVendorInvoice(vendorId, dateRange) method
  - [ ] Fetch all completed orders for vendor in date range
  - [ ] Group orders if frequency is not per_order
  - [ ] Calculate totals and GST breakdown
  - [ ] Calculate platform commission
  - [ ] Generate invoice number (INV-YYYY-NNNNNN)
  - [ ] Create invoice record
  - [ ] Create invoice line items for each order item
  - [ ] Generate PDF
  - [ ] Send email to vendor
  - [ ] Send notification to admin
  - [ ] Return invoice
- [ ] Implement calculateInvoiceTotals(orders) method
  - [ ] Sum all order amounts
  - [ ] Calculate CGST, SGST, IGST totals
  - [ ] Calculate platform commission
  - [ ] Calculate net payable to vendor
- [ ] Implement generateInvoiceNumber() method
  - [ ] Format: INV-YYYY-NNNNNN
  - [ ] Get next sequence number from DB
  - [ ] Ensure uniqueness
- [ ] Implement regenerateInvoice(invoiceId) method (for corrections)

---

### ✅ Task 26: Backend Service - Create Invoice PDF Generation Service

**File to Create:** `marketplace-backend/src/modules/invoices/invoice-pdf.service.ts`

**Actions:**
- [ ] Install dependencies: puppeteer or pdfmake
- [ ] Create InvoicePDFService class
- [ ] Implement generateInvoicePDF(invoice) method
  - [ ] Create HTML template or use pdfmake
  - [ ] Include company/platform details
  - [ ] Include vendor details
  - [ ] Include invoice number, date, due date
  - [ ] Include invoice period
  - [ ] Create line items table with:
    - [ ] Order ID
    - [ ] Product name/SKU
    - [ ] HSN Code
    - [ ] Quantity
    - [ ] Unit Price
    - [ ] Subtotal
    - [ ] GST Rate
    - [ ] GST Amount
    - [ ] Total
  - [ ] Show GST summary (CGST, SGST, IGST totals)
  - [ ] Show platform commission deduction
  - [ ] Show net payable amount (highlighted)
  - [ ] Add terms and conditions
  - [ ] Add payment instructions
  - [ ] Add company signature/seal
  - [ ] Generate PDF buffer
  - [ ] Upload PDF to storage
  - [ ] Return PDF URL
- [ ] Implement downloadInvoicePDF(invoiceId) method

---

### ✅ Task 27: Backend Controller - Create Invoice Controller

**File to Create:** `marketplace-backend/src/modules/invoices/invoice.controller.ts`

**Actions:**
- [ ] Create InvoiceController class
- [ ] Add @Controller('invoices') decorator
- [ ] Add authentication guard
- [ ] Create GET /invoices endpoint (vendor)
  - [ ] Accept query params: page, limit, status, dateFrom, dateTo
  - [ ] Return paginated invoices for logged-in vendor
- [ ] Create GET /invoices/:id endpoint
  - [ ] Return invoice details with line items
  - [ ] Verify vendor owns invoice
- [ ] Create GET /invoices/:id/download endpoint
  - [ ] Return PDF file
  - [ ] Set Content-Type: application/pdf
  - [ ] Set Content-Disposition: attachment
- [ ] Create POST /invoices/generate endpoint (Admin only)
  - [ ] Accept frequency or vendorId + dateRange
  - [ ] Trigger invoice generation manually
  - [ ] Return generated invoices
- [ ] Create PUT /invoices/:id/mark-paid endpoint (Admin only)
  - [ ] Accept payment reference
  - [ ] Update status to 'paid'
  - [ ] Set paidAt timestamp
  - [ ] Send payment confirmation email to vendor
- [ ] Create GET /admin/invoices endpoint (Admin only)
  - [ ] Return all invoices across all vendors
  - [ ] Support filtering and pagination

---

### ✅ Task 28: Backend Service - Create Invoice Email Service

**File to Update:** `marketplace-backend/src/modules/email/email.service.ts`

**Actions:**
- [ ] Create sendInvoiceToVendor(invoice, vendor) method
  - [ ] Use email template 'vendor-invoice'
  - [ ] Attach PDF file
  - [ ] Include invoice summary
  - [ ] Include payment due date
  - [ ] Include download link
- [ ] Create sendInvoiceToAdmin(invoice, vendor) method
  - [ ] Notify admin of new invoice generation
  - [ ] Include link to admin panel
- [ ] Create sendPaymentConfirmation(invoice, vendor) method
  - [ ] Notify vendor of payment completion
  - [ ] Include payment reference

---

### ✅ Task 29: Backend - Create Invoice Generation Cron Job

**File to Create:** `marketplace-backend/src/modules/invoices/invoice.cron.ts`

**Actions:**
- [ ] Install @nestjs/schedule package
- [ ] Create InvoiceCron class
- [ ] Add @Injectable() decorator
- [ ] Inject InvoiceGenerationService
- [ ] Create generateDailyInvoices() method
  - [ ] Add @Cron('0 0 * * *') decorator (midnight daily)
  - [ ] Call invoiceGenerationService.generateInvoicesForFrequency('daily')
  - [ ] Log execution
- [ ] Create generateWeeklyInvoices() method
  - [ ] Add @Cron('0 1 * * MON') decorator (Monday 1 AM)
  - [ ] Call invoiceGenerationService.generateInvoicesForFrequency('weekly')
- [ ] Create generateMonthlyInvoices() method
  - [ ] Add @Cron('0 2 1 * *') decorator (1st of month, 2 AM)
  - [ ] Call invoiceGenerationService.generateInvoicesForFrequency('monthly')
- [ ] Add error handling and notifications
- [ ] Register in InvoiceModule

---

### ✅ Task 30: Frontend - Vendor Invoice Dashboard

**File to Create:** `marketplace-web/src/app/vendor/invoices/page.tsx`

**Actions:**
- [ ] Create VendorInvoicesPage component
- [ ] Add state for invoices list
- [ ] Add filters: date range, status
- [ ] Implement fetchInvoices() on mount
  - [ ] Call /api/v1/invoices with filters
  - [ ] Support pagination
- [ ] Create invoices table
  - [ ] Invoice Number
  - [ ] Invoice Date
  - [ ] Period
  - [ ] Total Amount
  - [ ] Platform Commission
  - [ ] Payable Amount
  - [ ] Status badge
  - [ ] Actions (View, Download)
- [ ] Implement handleDownload(invoiceId)
  - [ ] Call /api/v1/invoices/:id/download
  - [ ] Trigger file download
- [ ] Implement handleView(invoiceId)
  - [ ] Navigate to invoice details page
- [ ] Show invoice summary cards
  - [ ] Total Invoices
  - [ ] Total Amount
  - [ ] Pending Payments
  - [ ] Paid This Month
- [ ] Add export functionality (Excel/CSV)

---

### ✅ Task 31: Frontend - Vendor Invoice Details Page

**File to Create:** `marketplace-web/src/app/vendor/invoices/[id]/page.tsx`

**Actions:**
- [ ] Create VendorInvoiceDetailsPage component
- [ ] Fetch invoice details from API
- [ ] Display invoice header
  - [ ] Invoice number
  - [ ] Invoice date
  - [ ] Due date
  - [ ] Status
- [ ] Display vendor and platform details
- [ ] Display line items table
  - [ ] Order ID
  - [ ] Product details
  - [ ] HSN Code
  - [ ] Quantity
  - [ ] Unit Price
  - [ ] GST Rate
  - [ ] GST Amount
  - [ ] Total
- [ ] Display totals section
  - [ ] Subtotal
  - [ ] CGST
  - [ ] SGST
  - [ ] IGST
  - [ ] Total GST
  - [ ] Total Amount
  - [ ] Platform Commission (-)
  - [ ] Net Payable (highlighted)
- [ ] Add Download PDF button
- [ ] Add Print button
- [ ] Show payment status and reference if paid

---

### ✅ Task 32: Frontend - Admin Invoice Management Dashboard

**File to Create:** `marketplace-web/src/app/admin/invoices/page.tsx`

**Actions:**
- [ ] Create AdminInvoicesPage component
- [ ] Add filters: vendor, date range, status
- [ ] Fetch all invoices from /api/v1/admin/invoices
- [ ] Create invoices table
  - [ ] Invoice Number
  - [ ] Vendor Name
  - [ ] Invoice Date
  - [ ] Period
  - [ ] Total Amount
  - [ ] Payable Amount
  - [ ] Status
  - [ ] Actions
- [ ] Add "Mark as Paid" action for generated/sent invoices
  - [ ] Open modal for payment reference
  - [ ] Call /api/v1/invoices/:id/mark-paid
  - [ ] Show success message
- [ ] Add "Generate Invoices" button
  - [ ] Trigger manual invoice generation
  - [ ] Select frequency or specific vendor
- [ ] Add bulk download functionality
- [ ] Show dashboard statistics
  - [ ] Total Invoices Generated
  - [ ] Total Amount
  - [ ] Total Pending Payments
  - [ ] Total Paid This Month

---

### ✅ Task 33: Email Templates - Create Invoice Email Templates

**Files to Create:**
- `marketplace-backend/src/templates/emails/vendor-invoice.hbs`
- `marketplace-backend/src/templates/emails/invoice-payment-confirmation.hbs`
- `marketplace-backend/src/templates/emails/kyc-approved.hbs`
- `marketplace-backend/src/templates/emails/kyc-rejected.hbs`
- `marketplace-backend/src/templates/emails/kyc-submission-admin.hbs`

**Actions for vendor-invoice.hbs:**
- [ ] Create HTML email template
- [ ] Add invoice summary (number, date, amount)
- [ ] Add period covered
- [ ] Add link to view invoice online
- [ ] Add link to download PDF
- [ ] Add payment due date
- [ ] Add platform contact information

**Actions for invoice-payment-confirmation.hbs:**
- [ ] Create HTML template
- [ ] Include invoice number
- [ ] Include payment amount
- [ ] Include payment reference
- [ ] Include payment date
- [ ] Add thank you message

**Actions for kyc-approved.hbs:**
- [ ] Create HTML template
- [ ] Congratulatory message
- [ ] List of approved documents
- [ ] Next steps to start selling
- [ ] Link to vendor dashboard

**Actions for kyc-rejected.hbs:**
- [ ] Create HTML template
- [ ] Polite rejection message
- [ ] List rejection reason clearly
- [ ] Instructions for resubmission
- [ ] Link to KYC page
- [ ] Support contact information

**Actions for kyc-submission-admin.hbs:**
- [ ] Create HTML template
- [ ] Vendor details (name, email)
- [ ] Submission date
- [ ] Number of documents uploaded
- [ ] Link to admin KYC verification page
- [ ] Call to action to review

---

## 📊 Testing & Validation (Tasks 34-36)

### ✅ Task 34: Testing - KYC System

**Test Cases:**
- [ ] Vendor can access KYC page
- [ ] Vendor can upload all required documents
- [ ] File size validation works (reject > 5MB)
- [ ] File type validation works (accept only PDF, JPG, PNG)
- [ ] Document number validation for PAN/Aadhar
- [ ] Form submission with missing required documents shows error
- [ ] Successful submission shows confirmation
- [ ] Admin receives email notification
- [ ] Admin can see pending KYC in dashboard
- [ ] Admin can view all uploaded documents
- [ ] Admin can approve KYC
- [ ] Vendor receives approval email
- [ ] Vendor status updates to "Approved"
- [ ] Admin can reject KYC with reason
- [ ] Vendor receives rejection email with reason
- [ ] Vendor can resubmit after rejection
- [ ] Approved KYC form is read-only

---

### ✅ Task 35: Testing - Product GST & Variants

**Test Cases:**
- [ ] HSN code autocomplete works
- [ ] Selecting HSN code populates recommended GST rate
- [ ] GST rate can be manually changed
- [ ] Price type selection affects calculation
- [ ] MRP with GST: Calculation shows base price and GST breakdown
- [ ] Selling price without GST: Calculation shows MRP
- [ ] Real-time calculation updates as user types
- [ ] Product can be created with GST fields
- [ ] Product can be created without variants
- [ ] Product can be created with variants
- [ ] Variant combinations generate correctly
- [ ] Variant table shows all combinations
- [ ] Variants can be edited (price, stock)
- [ ] Variants can be deleted
- [ ] Variants can be activated/deactivated
- [ ] SKU is unique across all variants
- [ ] Product details show GST breakdown on frontend
- [ ] Order includes correct GST calculation

---

### ✅ Task 36: Testing - Invoice Generation

**Test Cases:**
- [ ] Vendor can set invoice frequency in settings
- [ ] Per-order frequency generates invoice immediately after order
- [ ] Daily frequency generates invoice at midnight for previous day's orders
- [ ] Weekly frequency generates invoice on Monday for last week
- [ ] Monthly frequency generates invoice on 1st for previous month
- [ ] Invoice includes all completed orders in period
- [ ] Invoice number is unique and sequential
- [ ] Invoice line items are correct
- [ ] GST calculation is accurate (CGST+SGST or IGST)
- [ ] Platform commission is deducted correctly
- [ ] Net payable amount is correct
- [ ] PDF generation works and is downloadable
- [ ] PDF contains all required information
- [ ] Email is sent to vendor with PDF attachment
- [ ] Vendor can view invoice list
- [ ] Vendor can download invoices
- [ ] Vendor can filter invoices by date/status
- [ ] Admin can see all invoices
- [ ] Admin can mark invoice as paid
- [ ] Payment confirmation email is sent
- [ ] Cron jobs execute at correct times
- [ ] Error handling works for failed invoice generation

---

## 🚀 Deployment Tasks (Tasks 37-40)

### ✅ Task 37: Database Migration Execution

**Actions:**
- [ ] Review all migration files
- [ ] Test migrations on development database
- [ ] Create database backup before production migration
- [ ] Execute migrations on staging environment
- [ ] Verify data integrity
- [ ] Execute migrations on production
- [ ] Verify all tables and columns created
- [ ] Verify all indexes created
- [ ] Verify all constraints working
- [ ] Document any rollback procedures

---

### ✅ Task 38: Environment Configuration

**Actions:**
- [ ] Add required environment variables:
  - [ ] AWS_S3_BUCKET (for file uploads)
  - [ ] AWS_ACCESS_KEY_ID
  - [ ] AWS_SECRET_ACCESS_KEY
  - [ ] FRONTEND_URL
  - [ ] ADMIN_URL
  - [ ] SMTP settings for email
  - [ ] COMPANY_NAME
  - [ ] COMPANY_ADDRESS
  - [ ] COMPANY_GSTIN
  - [ ] COMPANY_PAN
- [ ] Configure file upload limits
- [ ] Configure email templates path
- [ ] Configure cron job timezone
- [ ] Test all configurations in staging

---

### ✅ Task 39: Documentation

**Actions:**
- [ ] Update API documentation (Swagger/Postman)
  - [ ] Document all new endpoints
  - [ ] Add request/response examples
  - [ ] Add authentication requirements
- [ ] Create user guide for vendors
  - [ ] How to complete KYC
  - [ ] How to add products with GST
  - [ ] How to manage variants
  - [ ] How to view and download invoices
- [ ] Create admin guide
  - [ ] How to verify KYC
  - [ ] How to manage invoices
  - [ ] How to mark payments
- [ ] Document GST calculation logic
- [ ] Document invoice generation process
- [ ] Create FAQ document

---

### ✅ Task 40: Monitoring & Logging

**Actions:**
- [ ] Add logging for KYC submissions
- [ ] Add logging for KYC approvals/rejections
- [ ] Add logging for product creation with GST
- [ ] Add logging for invoice generation
- [ ] Add logging for cron job executions
- [ ] Set up alerts for:
  - [ ] Failed invoice generation
  - [ ] Failed email sending
  - [ ] Failed PDF generation
  - [ ] Failed file uploads
  - [ ] Cron job failures
- [ ] Set up dashboard for monitoring
- [ ] Test all alerts in staging

---

## 📈 Summary Statistics

**Total Tasks:** 40  
**Phase 1 (KYC):** 7 tasks  
**Phase 2 (GST & Variants):** 13 tasks  
**Phase 3 (Invoices):** 13 tasks  
**Testing:** 3 tasks  
**Deployment:** 4 tasks

**Estimated Timeline:**
- Phase 1: 5-7 days
- Phase 2: 7-10 days  
- Phase 3: 8-10 days
- Testing & Deployment: 3-5 days
- **Total: 23-32 days** (with 1-2 developers)

---

## 🎯 Quick Start Checklist

**Day 1-2:**
- [ ] Task 1: Database migrations for KYC
- [ ] Task 2: Update Vendor entity
- [ ] Task 3: Create KYC Service

**Day 3-4:**
- [ ] Task 4: Create KYC Controller
- [ ] Task 5: File upload service
- [ ] Task 6: Vendor KYC frontend

**Day 5-6:**
- [ ] Task 7: Admin KYC dashboard
- [ ] Test KYC workflow end-to-end

**Day 7-8:**
- [ ] Task 8-10: Database migrations for GST
- [ ] Task 11-12: Update Product entities

**Day 9-11:**
- [ ] Task 13-17: GST services and controllers
- [ ] Task 18-19: Product forms with GST

**Day 12:**
- [ ] Task 20: Vendor settings for invoice frequency

**Day 13-15:**
- [ ] Task 21-24: Invoice database and entities
- [ ] Task 25: Invoice generation service

**Day 16-17:**
- [ ] Task 26: PDF generation service
- [ ] Task 27: Invoice controller
- [ ] Task 28: Email templates

**Day 18-19:**
- [ ] Task 29: Cron jobs
- [ ] Task 30-31: Vendor invoice dashboards

**Day 20-21:**
- [ ] Task 32-33: Admin dashboards and emails
- [ ] Task 34-36: Testing

**Day 22-23:**
- [ ] Task 37-40: Deployment and monitoring

---

**Document Status:** ✅ Ready for Implementation  
**Last Updated:** December 29, 2025

---

## 📞 Support & Questions

For questions or clarifications on any task, contact the development team lead.

---

**End of Document**

**File:** `marketplace-backend/database/migrations/add-vendor-kyc.sql`

```sql
-- Add KYC related columns to vendors table
ALTER TABLE vendors 
  ADD COLUMN IF NOT EXISTS "kycStatus" VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "kycDocuments" JSONB,
  ADD COLUMN IF NOT EXISTS "kycSubmittedAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "kycApprovedAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "kycApprovedBy" UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS "kycRejectedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "panNumber" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "gstRegistrationType" VARCHAR(50) DEFAULT 'unregistered',
  ADD COLUMN IF NOT EXISTS "gstState" VARCHAR(50);

-- Create index for KYC status queries
CREATE INDEX IF NOT EXISTS idx_vendors_kyc_status ON vendors("kycStatus");

-- Add check constraint for KYC status
ALTER TABLE vendors 
  ADD CONSTRAINT chk_kyc_status 
  CHECK ("kycStatus" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected'));

-- Add check constraint for GST registration type
ALTER TABLE vendors 
  ADD CONSTRAINT chk_gst_registration_type 
  CHECK ("gstRegistrationType" IN ('unregistered', 'regular', 'composition'));

COMMENT ON COLUMN vendors."kycStatus" IS 'KYC verification status: pending, submitted, under_review, approved, rejected';
COMMENT ON COLUMN vendors."kycDocuments" IS 'Array of KYC documents with type, URL, and upload date';
COMMENT ON COLUMN vendors."panNumber" IS 'PAN card number for tax identification';
COMMENT ON COLUMN vendors."gstRegistrationType" IS 'GST registration type: unregistered, regular, composition';
COMMENT ON COLUMN vendors."gstState" IS 'State code extracted from GSTIN (first 2 digits)';
```

**File:** `marketplace-backend/src/modules/vendors/vendor.entity.ts`

Add these fields after the existing tax-related fields:

```typescript
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

// Add to Vendor entity:
@Column({
  type: 'enum',
  enum: KYCStatus,
  default: KYCStatus.PENDING,
})
kycStatus: KYCStatus;

@Column({ type: 'jsonb', nullable: true })
kycDocuments: Array<{
  type: string;
  documentNumber?: string;
  documentUrl: string;
  uploadedAt: Date;
  fileName: string;
  fileSize: number;
}>;

@Column({ type: 'timestamp', nullable: true })
kycSubmittedAt: Date;

@Column({ type: 'timestamp', nullable: true })
kycApprovedAt: Date;

@Column({ type: 'uuid', nullable: true })
kycApprovedBy: string;

@Column({ type: 'text', nullable: true })
kycRejectedReason: string;

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

@Column({ default: false })
isKycVerified: boolean;

@Column({ nullable: true })
invoiceFrequency: string; // per_order, daily, weekly, monthly
```

---

### Task 2: Build vendor KYC upload interface

**File:** `marketplace-web/src/app/vendor/kyc/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Upload, CheckCircle, XCircle, AlertCircle, FileText, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface KYCDocument {
  type: string;
  label: string;
  required: boolean;
  accepted: string;
  file: File | null;
  url: string | null;
  documentNumber?: string;
}

const DOCUMENT_TYPES: Omit<KYCDocument, 'file' | 'url' | 'documentNumber'>[] = [
  {
    type: 'pan',
    label: 'PAN Card',
    required: true,
    accepted: '.pdf,.jpg,.jpeg,.png',
  },
  {
    type: 'aadhar_front',
    label: 'Aadhar Card (Front)',
    required: true,
    accepted: '.pdf,.jpg,.jpeg,.png',
  },
  {
    type: 'aadhar_back',
    label: 'Aadhar Card (Back)',
    required: true,
    accepted: '.pdf,.jpg,.jpeg,.png',
  },
  {
    type: 'gst_certificate',
    label: 'GST Certificate',
    required: false,
    accepted: '.pdf,.jpg,.jpeg,.png',
  },
  {
    type: 'business_license',
    label: 'Business License/Registration',
    required: false,
    accepted: '.pdf,.jpg,.jpeg,.png',
  },
  {
    type: 'bank_details',
    label: 'Cancelled Cheque / Bank Statement',
    required: true,
    accepted: '.pdf,.jpg,.jpeg,.png',
  },
  {
    type: 'address_proof',
    label: 'Address Proof (Business Address)',
    required: true,
    accepted: '.pdf,.jpg,.jpeg,.png',
  },
];

export default function VendorKYCPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [kycStatus, setKycStatus] = useState<string>('pending');
  const [kycRejectedReason, setKycRejectedReason] = useState<string>('');
  const [documents, setDocuments] = useState<KYCDocument[]>([]);

  useEffect(() => {
    fetchKYCStatus();
  }, []);

  const fetchKYCStatus = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/v1/vendors/me`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const vendor = await response.json();
        setKycStatus(vendor.kycStatus || 'pending');
        setKycRejectedReason(vendor.kycRejectedReason || '');
        
        // Initialize documents
        const initialDocs = DOCUMENT_TYPES.map(docType => ({
          ...docType,
          file: null,
          url: null,
          documentNumber: '',
        }));

        // Populate existing documents
        if (vendor.kycDocuments && Array.isArray(vendor.kycDocuments)) {
          vendor.kycDocuments.forEach((existingDoc: any) => {
            const docIndex = initialDocs.findIndex(d => d.type === existingDoc.type);
            if (docIndex !== -1) {
              initialDocs[docIndex].url = existingDoc.documentUrl;
              initialDocs[docIndex].documentNumber = existingDoc.documentNumber || '';
            }
          });
        }

        setDocuments(initialDocs);
      }
    } catch (error) {
      console.error('Error fetching KYC status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (index: number, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    const newDocuments = [...documents];
    newDocuments[index].file = file;
    setDocuments(newDocuments);
  };

  const handleDocumentNumberChange = (index: number, value: string) => {
    const newDocuments = [...documents];
    newDocuments[index].documentNumber = value;
    setDocuments(newDocuments);
  };

  const handleSubmit = async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Validate required documents
    const missingDocs = documents.filter(
      doc => doc.required && !doc.file && !doc.url
    );

    if (missingDocs.length > 0) {
      alert(`Please upload required documents: ${missingDocs.map(d => d.label).join(', ')}`);
      return;
    }

    setSubmitting(true);

    try {
      const uploadedDocuments = [];

      // Upload each file
      for (const doc of documents) {
        if (doc.file) {
          const formData = new FormData();
          formData.append('file', doc.file);
          formData.append('type', 'kyc');

          const uploadResponse = await fetch(`${API_URL}/api/v1/upload/kyc-documents`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload ${doc.label}`);
          }

          const { url } = await uploadResponse.json();

          uploadedDocuments.push({
            type: doc.type,
            documentNumber: doc.documentNumber || '',
            documentUrl: url,
            uploadedAt: new Date(),
            fileName: doc.file.name,
            fileSize: doc.file.size,
          });
        } else if (doc.url) {
          // Keep existing documents
          uploadedDocuments.push({
            type: doc.type,
            documentNumber: doc.documentNumber || '',
            documentUrl: doc.url,
            uploadedAt: new Date(),
            fileName: 'existing',
            fileSize: 0,
          });
        }
      }

      // Submit KYC
      const submitResponse = await fetch(`${API_URL}/api/v1/vendors/kyc/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ documents: uploadedDocuments }),
      });

      if (!submitResponse.ok) {
        throw new Error('Failed to submit KYC');
      }

      alert('KYC documents submitted successfully! You will be notified once verified.');
      router.push('/vendor/dashboard');
    } catch (error: any) {
      console.error('Error submitting KYC:', error);
      alert(`Failed to submit KYC: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    const badges = {
      pending: { color: 'bg-gray-100 text-gray-800', icon: AlertCircle, text: 'Pending' },
      submitted: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle, text: 'Submitted' },
      under_review: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle, text: 'Under Review' },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, text: 'Rejected' },
    };

    const badge = badges[kycStatus as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;

    return (
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${badge.color}`}>
        <Icon className="w-5 h-5" />
        <span className="font-medium">{badge.text}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">KYC Verification</h1>
            {getStatusBadge()}
          </div>

          <p className="text-gray-600 mb-8">
            Complete your Know Your Customer (KYC) verification by uploading the required documents.
            All information is kept secure and confidential.
          </p>

          {kycStatus === 'rejected' && kycRejectedReason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900">KYC Rejected</h3>
                  <p className="text-red-700 text-sm mt-1">{kycRejectedReason}</p>
                  <p className="text-red-600 text-sm mt-2">Please update your documents and resubmit.</p>
                </div>
              </div>
            </div>
          )}

          {kycStatus === 'approved' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-green-900">KYC Approved</h3>
                  <p className="text-green-700 text-sm mt-1">Your account has been verified successfully!</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {documents.map((doc, index) => (
              <div key={doc.type} className="border rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">
                      {doc.label}
                      {doc.required && <span className="text-red-500 ml-1">*</span>}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Accepted formats: PDF, JPG, PNG (Max 5MB)
                    </p>
                  </div>
                  {doc.url && (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  )}
                </div>

                {(doc.type === 'pan' || doc.type === 'aadhar_front' || doc.type === 'aadhar_back') && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Document Number
                    </label>
                    <input
                      type="text"
                      value={doc.documentNumber}
                      onChange={(e) => handleDocumentNumberChange(index, e.target.value)}
                      placeholder={doc.type === 'pan' ? 'Enter PAN Number' : 'Enter Aadhar Number'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={kycStatus === 'approved'}
                    />
                  </div>
                )}

                <div className="relative">
                  <input
                    type="file"
                    accept={doc.accepted}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(index, file);
                    }}
                    className="hidden"
                    id={`file-${doc.type}`}
                    disabled={kycStatus === 'approved'}
                  />
                  <label
                    htmlFor={`file-${doc.type}`}
                    className={`flex items-center justify-center gap-3 px-6 py-4 border-2 border-dashed rounded-lg ${
                      doc.file || doc.url
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                    } ${kycStatus === 'approved' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} transition`}
                  >
                    {doc.file || doc.url ? (
                      <>
                        <FileText className="w-6 h-6 text-green-600" />
                        <span className="text-green-700 font-medium">
                          {doc.file ? doc.file.name : 'Document Uploaded'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-gray-400" />
                        <span className="text-gray-600">
                          Click to upload or drag and drop
                        </span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            ))}
          </div>

          {kycStatus !== 'approved' && (
            <div className="mt-8 flex gap-4">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {submitting ? 'Submitting...' : 'Submit for Verification'}
              </button>
              <button
                onClick={() => router.push('/vendor/dashboard')}
                className="px-6 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

### Task 3: Create backend KYC submission and file upload service

**File:** `marketplace-backend/src/modules/vendors/kyc.service.ts`

```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor, KYCStatus } from './vendor.entity';
import { EmailService } from '../email/email.service';
import { User } from '../users/user.entity';

export interface KYCDocument {
  type: string;
  documentNumber?: string;
  documentUrl: string;
  uploadedAt: Date;
  fileName: string;
  fileSize: number;
}

@Injectable()
export class KYCService {
  constructor(
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private emailService: EmailService,
  ) {}

  async submitKYC(vendorId: string, documents: KYCDocument[]): Promise<Vendor> {
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (vendor.kycStatus === KYCStatus.APPROVED) {
      throw new BadRequestException('KYC already approved');
    }

    // Validate required documents
    const requiredTypes = ['pan', 'aadhar_front', 'aadhar_back', 'bank_details', 'address_proof'];
    const submittedTypes = documents.map(d => d.type);
    const missingTypes = requiredTypes.filter(type => !submittedTypes.includes(type));

    if (missingTypes.length > 0) {
      throw new BadRequestException(`Missing required documents: ${missingTypes.join(', ')}`);
    }

    // Update vendor with KYC documents
    vendor.kycDocuments = documents;
    vendor.kycStatus = KYCStatus.SUBMITTED;
    vendor.kycSubmittedAt = new Date();

    // Extract PAN number if provided
    const panDoc = documents.find(d => d.type === 'pan');
    if (panDoc?.documentNumber) {
      vendor.panNumber = panDoc.documentNumber.toUpperCase();
    }

    await this.vendorRepository.save(vendor);

    // Send email to admins
    await this.notifyAdminsOfKYCSubmission(vendor);

    return vendor;
  }

  async approveKYC(vendorId: string, adminUserId: string): Promise<Vendor> {
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    vendor.kycStatus = KYCStatus.APPROVED;
    vendor.isKycVerified = true;
    vendor.kycApprovedAt = new Date();
    vendor.kycApprovedBy = adminUserId;
    vendor.kycRejectedReason = null;

    await this.vendorRepository.save(vendor);

    // Send approval email to vendor
    await this.emailService.sendEmail({
      to: vendor.user.email,
      subject: 'KYC Verification Approved - Your account is now active!',
      template: 'kyc-approved',
      context: {
        vendorName: vendor.businessName || vendor.storeName,
        approvedDate: vendor.kycApprovedAt.toLocaleDateString(),
      },
    });

    return vendor;
  }

  async rejectKYC(vendorId: string, reason: string, adminUserId: string): Promise<Vendor> {
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    vendor.kycStatus = KYCStatus.REJECTED;
    vendor.isKycVerified = false;
    vendor.kycRejectedReason = reason;

    await this.vendorRepository.save(vendor);

    // Send rejection email to vendor
    await this.emailService.sendEmail({
      to: vendor.user.email,
      subject: 'KYC Verification - Additional Information Required',
      template: 'kyc-rejected',
      context: {
        vendorName: vendor.businessName || vendor.storeName,
        reason: reason,
        resubmitUrl: `${process.env.FRONTEND_URL}/vendor/kyc`,
      },
    });

    return vendor;
  }

  async getVendorsForKYCReview(): Promise<Vendor[]> {
    return this.vendorRepository.find({
      where: { kycStatus: KYCStatus.SUBMITTED },
      relations: ['user'],
      order: { kycSubmittedAt: 'ASC' },
    });
  }

  async getKYCDetails(vendorId: string): Promise<Vendor> {
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  private async notifyAdminsOfKYCSubmission(vendor: Vendor): Promise<void> {
    // Get all admin users
    const admins = await this.userRepository.find({
      where: { role: 'admin' },
    });

    const adminUrl = process.env.ADMIN_URL || process.env.FRONTEND_URL;

    // Send email to each admin
    for (const admin of admins) {
      await this.emailService.sendEmail({
        to: admin.email,
        subject: `New KYC Submission - ${vendor.businessName || vendor.storeName}`,
        template: 'kyc-submission-admin',
        context: {
          vendorName: vendor.businessName || vendor.storeName,
          vendorEmail: vendor.user.email,
          submittedDate: vendor.kycSubmittedAt.toLocaleDateString(),
          reviewUrl: `${adminUrl}/admin/kyc-verification?vendorId=${vendor.id}`,
        },
      });
    }
  }

  validateGSTIN(gstin: string): { valid: boolean; state?: string; pan?: string } {
    if (!gstin || gstin.length !== 15) {
      return { valid: false };
    }

    // GSTIN format: 22AAAAA0000A1Z5
    // First 2 digits: State code
    // Next 10 digits: PAN
    // 13th digit: Entity number (1-9 or alphabet for multiple registrations)
    // 14th digit: Z (by default)
    // 15th digit: Check digit

    const stateCode = gstin.substring(0, 2);
    const pan = gstin.substring(2, 12);
    const checkDigit = gstin.charAt(14);

    // Validate state code (01-37)
    const stateNum = parseInt(stateCode);
    if (isNaN(stateNum) || stateNum < 1 || stateNum > 37) {
      return { valid: false };
    }

    // Validate PAN format within GSTIN
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    if (!panRegex.test(pan)) {
      return { valid: false };
    }

    return {
      valid: true,
      state: stateCode,
      pan: pan,
    };
  }
}
```

**File:** `marketplace-backend/src/modules/vendors/kyc.controller.ts`

```typescript
import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { KYCService } from './kyc.service';

@Controller('vendors')
@UseGuards(JwtAuthGuard)
export class KYCController {
  constructor(private readonly kycService: KYCService) {}

  @Post('kyc/submit')
  async submitKYC(@Request() req, @Body() body: { documents: any[] }) {
    return this.kycService.submitKYC(req.user.vendorId, body.documents);
  }

  @Get('kyc/status')
  async getKYCStatus(@Request() req) {
    return this.kycService.getKYCDetails(req.user.vendorId);
  }

  @Get('kyc/pending')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async getPendingKYC() {
    return this.kycService.getVendorsForKYCReview();
  }

  @Put('kyc/:vendorId/approve')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async approveKYC(@Param('vendorId') vendorId: string, @Request() req) {
    return this.kycService.approveKYC(vendorId, req.user.id);
  }

  @Put('kyc/:vendorId/reject')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async rejectKYC(
    @Param('vendorId') vendorId: string,
    @Body() body: { reason: string },
    @Request() req,
  ) {
    return this.kycService.rejectKYC(vendorId, body.reason, req.user.id);
  }
}
```

---

### Task 4: Build admin KYC verification dashboard

**File:** `marketplace-web/src/app/admin/kyc-verification/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Eye, Clock, FileText } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

interface Vendor {
  id: string;
  businessName: string;
  storeName: string;
  email: string;
  kycStatus: string;
  kycSubmittedAt: string;
  kycDocuments: Array<{
    type: string;
    documentUrl: string;
    documentNumber?: string;
    fileName: string;
  }>;
}

export default function AdminKYCVerificationPage() {
  const searchParams = useSearchParams();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPendingKYC();
    
    // If vendorId in query params, open that vendor's details
    const vendorId = searchParams?.get('vendorId');
    if (vendorId && vendors.length > 0) {
      const vendor = vendors.find(v => v.id === vendorId);
      if (vendor) {
        handleViewDetails(vendor);
      }
    }
  }, [searchParams]);

  const fetchPendingKYC = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/v1/vendors/kyc/pending`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setVendors(data);
      }
    } catch (error) {
      console.error('Error fetching pending KYC:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setShowModal(true);
  };

  const handleApprove = async (vendorId: string) => {
    if (!confirm('Are you sure you want to approve this KYC?')) return;

    setActionLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/v1/vendors/kyc/${vendorId}/approve`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        alert('KYC approved successfully!');
        setShowModal(false);
        fetchPendingKYC();
      } else {
        throw new Error('Failed to approve KYC');
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (vendorId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setActionLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/v1/vendors/kyc/${vendorId}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      if (response.ok) {
        alert('KYC rejected successfully!');
        setShowModal(false);
        setRejectionReason('');
        fetchPendingKYC();
      } else {
        throw new Error('Failed to reject KYC');
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getDocumentLabel = (type: string): string => {
    const labels: Record<string, string> = {
      pan: 'PAN Card',
      aadhar_front: 'Aadhar Front',
      aadhar_back: 'Aadhar Back',
      gst_certificate: 'GST Certificate',
      business_license: 'Business License',
      bank_details: 'Bank Details',
      address_proof: 'Address Proof',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">KYC Verification</h1>
            <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-medium">
              {vendors.length} Pending
            </div>
          </div>

          {vendors.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No pending KYC verifications</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Vendor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Submitted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Documents
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {vendors.map((vendor) => (
                    <tr key={vendor.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {vendor.businessName || vendor.storeName}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{vendor.email}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(vendor.kycSubmittedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                          <FileText className="w-4 h-4" />
                          {vendor.kycDocuments?.length || 0} files
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleViewDetails(vendor)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          <Eye className="w-4 h-4" />
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedVendor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedVendor.businessName || selectedVendor.storeName}
              </h2>
              <p className="text-gray-600">{selectedVendor.email}</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedVendor.kycDocuments?.map((doc, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">{getDocumentLabel(doc.type)}</h3>
                    {doc.documentNumber && (
                      <p className="text-sm text-gray-600 mb-2">
                        Number: {doc.documentNumber}
                      </p>
                    )}
                    <a
                      href={doc.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      View Document
                    </a>
                  </div>
                ))}
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-3">Rejection Reason (Optional)</h3>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter reason if rejecting KYC..."
                />
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-4">
              <button
                onClick={() => handleApprove(selectedVendor.id)}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5" />
                Approve KYC
              </button>
              <button
                onClick={() => handleReject(selectedVendor.id)}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                <XCircle className="w-5 h-5" />
                Reject KYC
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setRejectionReason('');
                }}
                className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Phase 2: Product GST Configuration & Variants

### Task 7: Add invoice frequency selection to vendor settings

**Database Migration:**

```sql
-- Add invoice frequency to vendors table
ALTER TABLE vendors 
  ADD COLUMN IF NOT EXISTS "invoiceFrequency" VARCHAR(50) DEFAULT 'per_order';

-- Add check constraint
ALTER TABLE vendors 
  ADD CONSTRAINT chk_invoice_frequency 
  CHECK ("invoiceFrequency" IN ('per_order', 'daily', 'weekly', 'monthly'));

COMMENT ON COLUMN vendors."invoiceFrequency" IS 'Invoice generation frequency: per_order, daily, weekly, monthly';
```

**File:** `marketplace-web/src/app/vendor/settings/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon } from 'lucide-react';

export default function VendorSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    invoiceFrequency: 'per_order',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/v1/vendors/me`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const vendor = await response.json();
        setSettings({
          invoiceFrequency: vendor.invoiceFrequency || 'per_order',
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/v1/vendors/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        alert('Settings saved successfully!');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-6">
            <SettingsIcon className="w-6 h-6 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Vendor Settings</h1>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Generation Frequency
              </label>
              <select
                value={settings.invoiceFrequency}
                onChange={(e) =>
                  setSettings({ ...settings, invoiceFrequency: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="per_order">Per Order (Immediate after each order)</option>
                <option value="daily">Daily (End of each day)</option>
                <option value="weekly">Weekly (Every Monday)</option>
                <option value="monthly">Monthly (1st of each month)</option>
              </select>
              <p className="text-sm text-gray-500 mt-2">
                Choose how often you want invoices to be generated and sent to you.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Invoice Frequency Options:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li><strong>Per Order:</strong> Invoice generated immediately after each order</li>
                <li><strong>Daily:</strong> Combined invoice for all orders of the day, sent at midnight</li>
                <li><strong>Weekly:</strong> Combined invoice for the week, sent every Monday</li>
                <li><strong>Monthly:</strong> Combined invoice for the month, sent on 1st of next month</li>
              </ul>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 8: Extend product schema for GST and pricing options

**Database Migration:**

```sql
-- Add GST and pricing fields to products table
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS "hsnCode" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "sacCode" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "gstRate" DECIMAL(5, 2) DEFAULT 18.00,
  ADD COLUMN IF NOT EXISTS "priceType" VARCHAR(50) DEFAULT 'selling_price_without_gst',
  ADD COLUMN IF NOT EXISTS "mrp" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "basePrice" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "gstAmount" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "hasVariants" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "variantOptions" JSONB;

-- Add check constraint for GST rate
ALTER TABLE products 
  ADD CONSTRAINT chk_gst_rate 
  CHECK ("gstRate" IN (0, 5, 12, 18, 28));

-- Add check constraint for price type
ALTER TABLE products 
  ADD CONSTRAINT chk_price_type 
  CHECK ("priceType" IN ('mrp_with_gst', 'selling_price_without_gst'));

-- Create product variants table
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "productId" UUID REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(255) UNIQUE NOT NULL,
    "variantAttributes" JSONB NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    "stockQuantity" INTEGER DEFAULT 0,
    images TEXT[],
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_products_hsn_code ON products("hsnCode");
CREATE INDEX IF NOT EXISTS idx_products_gst_rate ON products("gstRate");
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants("productId");
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);

-- Create HSN code master table
CREATE TABLE IF NOT EXISTS hsn_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    "recommendedGstRate" DECIMAL(5, 2) NOT NULL,
    category VARCHAR(100),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert common HSN codes
INSERT INTO hsn_codes (code, description, "recommendedGstRate", category) VALUES
    ('6109', 'T-shirts, singlets and other vests, knitted or crocheted', 5, 'Apparel'),
    ('6203', 'Men''s or boys'' suits, jackets, trousers', 12, 'Apparel'),
    ('6403', 'Footwear with outer soles of rubber, plastics, leather', 18, 'Footwear'),
    ('8517', 'Telephone sets, smartphones and other apparatus', 18, 'Electronics'),
    ('8528', 'Monitors, projectors, televisions', 18, 'Electronics'),
    ('3304', 'Beauty or make-up preparations and preparations for the care of the skin', 18, 'Cosmetics'),
    ('4901', 'Printed books, brochures, leaflets', 0, 'Books'),
    ('0401', 'Milk and cream', 0, 'Food'),
    ('1001', 'Wheat and meslin', 0, 'Food'),
    ('2106', 'Food preparations not elsewhere specified', 12, 'Food'),
    ('3004', 'Medicaments', 5, 'Healthcare'),
    ('9403', 'Other furniture and parts thereof', 18, 'Furniture'),
    ('9503', 'Tricycles, scooters, toys', 12, 'Toys'),
    ('7113', 'Articles of jewelry', 3, 'Jewelry'),
    ('8703', 'Motor cars and other motor vehicles', 28, 'Automobiles')
ON CONFLICT (code) DO NOTHING;

COMMENT ON COLUMN products."hsnCode" IS 'HSN (Harmonized System of Nomenclature) code for goods';
COMMENT ON COLUMN products."sacCode" IS 'SAC (Services Accounting Code) for services';
COMMENT ON COLUMN products."gstRate" IS 'GST rate percentage: 0, 5, 12, 18, or 28';
COMMENT ON COLUMN products."priceType" IS 'Whether price is MRP with GST or selling price without GST';
COMMENT ON COLUMN products."hasVariants" IS 'Whether product has variants (size, color, etc.)';
COMMENT ON COLUMN products."variantOptions" IS 'Variant configuration: {size: [S,M,L], color: [Red,Blue]}';
```

---

## Remaining Tasks Summary

Due to length constraints, the complete implementation includes:

**Phase 2 (Continued):**
- Task 9-12: Product form enhancements, variant system, bulk import

**Phase 3:**
- Task 13-18: Invoice generation, PDF templates, email notifications, admin/vendor dashboards

---

## API Endpoints Reference

### KYC Endpoints
- `POST /api/v1/vendors/kyc/submit` - Submit KYC documents
- `GET /api/v1/vendors/kyc/status` - Get KYC status
- `GET /api/v1/vendors/kyc/pending` - Get pending KYC (admin)
- `PUT /api/v1/vendors/kyc/:id/approve` - Approve KYC (admin)
- `PUT /api/v1/vendors/kyc/:id/reject` - Reject KYC (admin)

### Product GST Endpoints
- `GET /api/v1/hsn-codes` - Get HSN code suggestions
- `POST /api/v1/products` - Create product with GST
- `POST /api/v1/products/bulk-import` - Bulk import via Excel

### Invoice Endpoints
- `GET /api/v1/invoices` - List invoices
- `GET /api/v1/invoices/:id` - Get invoice details
- `GET /api/v1/invoices/:id/download` - Download PDF
- `POST /api/v1/invoices/generate` - Generate invoices (cron)
- `PUT /api/v1/invoices/:id/mark-paid` - Mark as paid (admin)

---

## Testing Checklist

### KYC Testing
- [ ] Vendor can upload all required documents
- [ ] File size validation works (5MB limit)
- [ ] Admin receives email notification
- [ ] Admin can view all documents
- [ ] Approve KYC updates vendor status
- [ ] Reject KYC sends email with reason
- [ ] Vendor can resubmit after rejection

### GST Product Testing
- [ ] Product form shows GST rate dropdown
- [ ] HSN code autocomplete works
- [ ] Price calculation based on price type
- [ ] GST breakdown displays correctly
- [ ] Variants can be added/edited
- [ ] Bulk import processes Excel correctly

### Invoice Testing
- [ ] Invoices generated per frequency setting
- [ ] PDF contains all GST details
- [ ] Email sent to vendor and admin
- [ ] Download works for single/multiple invoices
- [ ] Mark as paid updates status
- [ ] Vendor sees invoice history

---

## Next Steps

1. Run database migrations
2. Implement file upload service
3. Configure email templates
4. Test KYC workflow end-to-end
5. Implement product GST features
6. Set up invoice generation cron jobs
7. Deploy and monitor

---

## 🔍 Further Considerations

### Security & Compliance

#### KYC Document Security
- [ ] **Encryption at Rest**: Ensure all KYC documents stored in S3/storage are encrypted using AES-256
- [ ] **Encryption in Transit**: Use HTTPS/TLS 1.3 for all document uploads
- [ ] **Access Control**: Implement role-based access control (RBAC) for document viewing
  - Only vendor can view their own documents
  - Only admins with kyc_reviewer role can view pending KYC documents
  - Audit log for all document access attempts
- [ ] **Document Retention Policy**: Define retention period (e.g., 7 years as per IT Act)
- [ ] **Data Masking**: Mask PAN/Aadhar numbers in logs and non-essential displays
- [ ] **Secure Deletion**: Implement secure document deletion if vendor requests data removal
- [ ] **Two-Factor Authentication**: Enforce 2FA for admin KYC approval actions

#### GST Compliance
- [ ] **GST Rate Updates**: Create admin interface to update GST rates when government changes tax slabs
- [ ] **Historical Rate Tracking**: Store GST rate history to maintain accuracy for old orders
- [ ] **State Code Validation**: Validate state codes against official GST state code list (01-37)
- [ ] **GSTIN Verification**: Integrate with GST Portal API to verify GSTIN authenticity
- [ ] **Place of Supply Rules**: Implement correct IGST/CGST+SGST logic based on:
  - Vendor's state (Place of Supply)
  - Customer's state (Delivery location)
  - Product type (goods vs services)
- [ ] **Reverse Charge Mechanism**: Handle scenarios where buyer pays GST instead of seller
- [ ] **Composition Scheme**: Apply composition scheme rules (no input tax credit, fixed rate)
- [ ] **HSN/SAC Code Updates**: Keep HSN/SAC master table updated with government revisions

#### Data Privacy (GDPR/DPDPA Compliance)
- [ ] **Consent Management**: Obtain explicit consent for KYC document storage
- [ ] **Right to Access**: Allow vendors to download all their data
- [ ] **Right to Erasure**: Implement data deletion upon vendor request (with legal retention checks)
- [ ] **Data Minimization**: Only collect necessary KYC documents
- [ ] **Privacy Policy**: Update terms to include KYC and invoice data handling
- [ ] **Third-Party Sharing**: Document if KYC data is shared with payment gateways or tax authorities

---

### Performance & Scalability

#### File Upload Optimization
- [ ] **Chunked Uploads**: Implement multipart upload for large files (>5MB)
- [ ] **CDN Integration**: Use CloudFront/CDN for faster document access
- [ ] **Image Compression**: Auto-compress uploaded images to reduce storage costs
- [ ] **Progressive Upload**: Show upload progress bar to users
- [ ] **Parallel Processing**: Allow multiple file uploads simultaneously
- [ ] **Virus Scanning**: Integrate ClamAV or similar to scan uploaded files for malware

#### Invoice Generation Performance
- [ ] **Batch Processing**: Process invoice generation in batches of 50-100 vendors
- [ ] **Queue System**: Use Bull/Redis queue for background invoice processing
- [ ] **Retry Logic**: Implement exponential backoff for failed invoice generations
- [ ] **Rate Limiting**: Prevent invoice generation API abuse
- [ ] **Caching**: Cache HSN codes and GST rates to reduce DB queries
- [ ] **Database Indexing**: Ensure proper indexes on:
  - `orders.vendorId, orders.status, orders.createdAt`
  - `invoices.vendorId, invoices.status, invoices.invoiceDate`
  - `products.hsnCode, products.vendorId`

#### PDF Generation Optimization
- [ ] **PDF Templates**: Use pre-compiled templates to speed up generation
- [ ] **Lazy Loading**: Generate PDF only when downloaded (not during invoice creation)
- [ ] **PDF Caching**: Cache generated PDFs for 30 days to avoid regeneration
- [ ] **Watermarking**: Add "PAID" watermark for paid invoices
- [ ] **Digital Signature**: Consider adding digital signature for authenticity
- [ ] **Compression**: Compress PDFs to reduce download time and storage

---

### Edge Cases & Error Handling

#### KYC Workflow Edge Cases
- [ ] **Partial Document Upload**: Handle scenarios where upload fails mid-way
- [ ] **Concurrent Submissions**: Prevent duplicate submissions if user clicks submit multiple times
- [ ] **Admin Approval Conflicts**: Handle if two admins try to approve/reject same KYC simultaneously
- [ ] **Vendor Account Deletion**: Handle KYC documents when vendor deletes account
- [ ] **Document Expiry**: Track document expiry dates (e.g., Aadhar validity)
- [ ] **Multiple Rejections**: Limit resubmission attempts or add review delay
- [ ] **Partial Approval**: Allow approving some documents while rejecting others

#### GST Calculation Edge Cases
- [ ] **Zero-Rated Goods**: Handle products with 0% GST (books, milk, etc.)
- [ ] **Exempted Goods**: Handle GST-exempted products
- [ ] **Mixed Cart**: Handle cart with products having different GST rates
- [ ] **Discounts**: Apply GST after discount or before? (standardize approach)
- [ ] **Rounding**: Handle GST amount rounding (typically round to 2 decimals)
- [ ] **Negative Amounts**: Handle returns and refunds with GST reversal
- [ ] **Price Changes**: Handle if GST rate changes between cart and checkout
- [ ] **Inter-state Detection**: Handle scenarios where delivery address changes after order
- [ ] **Union Territories**: Special handling for UT GST vs State GST

#### Invoice Generation Edge Cases
- [ ] **Zero-Value Invoices**: Skip invoice generation if no orders in period
- [ ] **Cancelled Orders**: Exclude cancelled/refunded orders from invoices
- [ ] **Partial Refunds**: Handle partial refunds by generating credit notes
- [ ] **Invoice Number Collision**: Handle race conditions in invoice number generation
- [ ] **Failed PDF Generation**: Retry PDF generation or send invoice without PDF
- [ ] **Email Failures**: Queue failed emails for retry (up to 3 attempts)
- [ ] **Vendor Frequency Change**: Handle if vendor changes frequency mid-period
- [ ] **Multiple Payment Methods**: Handle orders split across multiple payment methods
- [ ] **Currency Conversion**: If supporting multiple currencies, convert all to base currency

---

### User Experience Enhancements

#### KYC Process Improvements
- [ ] **Progress Indicator**: Show KYC completion percentage (e.g., "4 of 7 documents uploaded")
- [ ] **Auto-Save**: Auto-save document uploads as they're added (don't wait for submit)
- [ ] **Mobile Optimization**: Optimize file upload for mobile devices (camera access)
- [ ] **Document Preview**: Show thumbnail preview of uploaded images
- [ ] **Drag-and-Drop**: Allow drag-and-drop file upload
- [ ] **Bulk Upload**: Allow uploading multiple documents at once
- [ ] **OCR Integration**: Auto-extract PAN/Aadhar numbers from uploaded images
- [ ] **Real-time Validation**: Validate PAN format in real-time (XXXXX9999X)
- [ ] **Status Notifications**: Send push notifications for KYC status changes
- [ ] **Estimated Review Time**: Show estimated time for KYC review (e.g., "Usually 2-3 days")

#### Product Management Improvements
- [ ] **HSN Code Search**: Add intelligent search with product category suggestions
- [ ] **Bulk GST Update**: Allow bulk updating GST rates for multiple products
- [ ] **Price Calculator**: Add standalone calculator tool for vendors
- [ ] **Price History**: Track and display price change history
- [ ] **Variant Templates**: Save and reuse variant configurations (e.g., "Standard T-shirt sizes")
- [ ] **CSV Import Validation**: Show detailed errors for failed CSV imports
- [ ] **Duplicate Detection**: Warn if similar product/variant already exists
- [ ] **Price Suggestions**: Suggest competitive pricing based on market data

#### Invoice Dashboard Improvements
- [ ] **Invoice Preview**: Preview invoice before download
- [ ] **Bulk Download**: Download multiple invoices as ZIP
- [ ] **Invoice Search**: Search invoices by number, date range, amount
- [ ] **Export Options**: Export invoice list as Excel/CSV
- [ ] **Payment Reminders**: Auto-remind vendors of unpaid invoices
- [ ] **Invoice Analytics**: Show charts for invoice trends, GST collected, etc.
- [ ] **Quick Filters**: One-click filters (This Month, Last Quarter, Unpaid, etc.)
- [ ] **Invoice Disputes**: Allow vendors to raise disputes on invoices

---

### Integration Points

#### Third-Party Integrations
- [ ] **GST Portal Integration**
  - Auto-file GSTR-1 (outward supplies) from invoice data
  - Fetch GSTIN details for validation
  - Reconcile with GSTR-2B (input tax credit)
  
- [ ] **Payment Gateway Integration**
  - Link invoice payments with gateway transactions
  - Auto-mark invoices as paid when payment received
  - Generate payment receipts
  
- [ ] **Accounting Software Integration**
  - Export invoices to Tally, QuickBooks, Zoho Books
  - Sync vendor payments
  - Generate TDS certificates
  
- [ ] **SMS Gateway**
  - Send KYC status updates via SMS
  - Send invoice generation notifications
  - Send payment confirmations
  
- [ ] **DigiLocker Integration**
  - Allow vendors to fetch documents directly from DigiLocker
  - Verify authenticity of Aadhar/PAN
  
- [ ] **e-Sign Integration**
  - Digital signature for invoices
  - e-Sign vendor agreements

#### API Webhooks
- [ ] **KYC Status Webhook**: Notify external systems of KYC status changes
- [ ] **Invoice Generated Webhook**: Trigger accounting system updates
- [ ] **Payment Received Webhook**: Update vendor wallet/balance
- [ ] **Product Created Webhook**: Sync with inventory systems

---

### Compliance & Audit

#### Audit Trail Requirements
- [ ] **KYC Audit Log**: Log all KYC-related actions
  - Document uploads (timestamp, IP, file hash)
  - Status changes (who, when, from, to)
  - Admin reviews (reviewer ID, decision, reason)
  - Document access (who viewed which document)
  
- [ ] **Invoice Audit Log**: Track invoice lifecycle
  - Generation (timestamp, vendor, orders included)
  - Modifications (if any corrections made)
  - Downloads (who, when)
  - Payment status changes
  
- [ ] **GST Audit Log**: Maintain GST calculation history
  - Rate changes over time
  - Recalculations due to returns/cancellations
  - Manual adjustments (if any)

#### Regulatory Reporting
- [ ] **GSTR-1 Report**: Generate monthly outward supply return
- [ ] **GSTR-3B Report**: Generate monthly summary return
- [ ] **Annual Return**: Generate GSTR-9 data
- [ ] **TDS Reporting**: Generate TDS deduction reports (if applicable)
- [ ] **Platform Commission Report**: Track platform earnings for tax filing
- [ ] **Vendor Earnings Report**: Generate Form 26AS equivalent data

#### Legal Considerations
- [ ] **Invoice Cancellation**: Implement proper process for cancelling/amending invoices
- [ ] **Credit/Debit Notes**: Generate credit notes for returns, debit notes for post-sale charges
- [ ] **E-way Bill Generation**: Integrate if selling goods >₹50,000
- [ ] **TDS Deduction**: Implement TDS on commission if vendor turnover >specified limit
- [ ] **Terms & Conditions**: Update platform T&C to cover KYC, GST, invoicing
- [ ] **Vendor Agreement**: Legal agreement covering tax obligations, compliance

---

### Monitoring & Alerts

#### System Health Monitoring
- [ ] **KYC Submission Rate**: Track submissions per day, alert if unusually low/high
- [ ] **KYC Approval Time**: Monitor average approval time, alert if exceeds threshold
- [ ] **Document Upload Success Rate**: Alert if upload failures exceed 5%
- [ ] **Invoice Generation Success Rate**: Alert if failures exceed 2%
- [ ] **PDF Generation Time**: Monitor average time, alert if >10 seconds
- [ ] **Email Delivery Rate**: Track bounces and failures
- [ ] **Cron Job Health**: Alert if cron jobs fail to execute

#### Business Metrics Tracking
- [ ] **KYC Conversion Rate**: Track % of vendors completing KYC
- [ ] **KYC Rejection Rate**: Monitor rejection rate by reason
- [ ] **Average Product GST Rate**: Track across categories
- [ ] **Total GST Collected**: Daily/monthly totals
- [ ] **Invoice Generation Volume**: Track by frequency type
- [ ] **Payment Collection Rate**: Track % of invoices paid on time
- [ ] **Vendor Earnings**: Track and compare across periods

#### Error Monitoring
- [ ] **Failed Document Uploads**: Log and analyze reasons
- [ ] **GST Calculation Errors**: Alert on negative amounts or anomalies
- [ ] **Invoice Generation Failures**: Track by vendor and reason
- [ ] **Email Bounce Tracking**: Monitor and update invalid emails
- [ ] **API Error Rates**: Track 4xx and 5xx responses
- [ ] **Database Performance**: Monitor slow queries

---

### Future Enhancements

#### Phase 4 (Future Scope)
- [ ] **Multi-Language Support**: KYC forms and invoices in regional languages
- [ ] **Video KYC**: Live video verification option
- [ ] **Aadhaar e-KYC**: Direct integration with UIDAI for instant verification
- [ ] **AI-powered Document Verification**: Auto-verify documents using OCR + ML
- [ ] **Dynamic GST Rates**: Auto-update from government API
- [ ] **GST Refund Management**: Track and manage input tax credit refunds
- [ ] **Automated Reconciliation**: Auto-match invoices with bank statements
- [ ] **Vendor Credit System**: Issue credit notes that can be used against future invoices
- [ ] **Invoice Factoring**: Allow vendors to get advance payment on invoices
- [ ] **Multi-Currency Invoicing**: Support international vendors
- [ ] **Blockchain Invoice Verification**: Immutable invoice records
- [ ] **Analytics Dashboard**: Advanced analytics for GST, earnings, trends
- [ ] **Mobile App**: Dedicated mobile app for KYC submission and invoice management
- [ ] **WhatsApp Integration**: KYC status and invoice notifications via WhatsApp

---

### Development Best Practices

#### Code Quality
- [ ] **Unit Tests**: Aim for >80% code coverage
- [ ] **Integration Tests**: Test entire KYC and invoice workflows
- [ ] **E2E Tests**: Automated browser tests for critical user journeys
- [ ] **Code Reviews**: Mandatory peer review for all changes
- [ ] **Static Analysis**: Use ESLint, Prettier, SonarQube
- [ ] **API Documentation**: Maintain up-to-date Swagger/OpenAPI specs
- [ ] **Error Handling**: Consistent error response format across all APIs
- [ ] **Logging Standards**: Use structured logging (JSON format)

#### Database Best Practices
- [ ] **Migration Versioning**: Use sequential migration numbers
- [ ] **Rollback Scripts**: Maintain rollback migrations for each change
- [ ] **Database Backups**: Automated daily backups with 30-day retention
- [ ] **Query Optimization**: Review and optimize N+1 queries
- [ ] **Connection Pooling**: Proper connection pool configuration
- [ ] **Transaction Management**: Use transactions for multi-table operations
- [ ] **Soft Deletes**: Implement soft delete for critical data (vendors, invoices)

#### Deployment Strategy
- [ ] **Feature Flags**: Use feature flags for gradual rollout
- [ ] **Blue-Green Deployment**: Zero-downtime deployments
- [ ] **Canary Releases**: Test with small % of users first
- [ ] **Rollback Plan**: Documented rollback procedure for each phase
- [ ] **Load Testing**: Test with 10x expected load
- [ ] **Disaster Recovery**: Document and test DR procedures
- [ ] **Health Checks**: Implement health check endpoints for all services

---

### Risk Mitigation

#### Technical Risks
- **Risk**: Large PDF files causing memory issues
  - **Mitigation**: Stream PDF generation, set memory limits, implement pagination
  
- **Risk**: Cron job failures causing missed invoices
  - **Mitigation**: Implement job monitoring, retry logic, manual trigger option, alerts
  
- **Risk**: GSTIN API downtime during verification
  - **Mitigation**: Cache verified GSTINs, allow manual override with admin approval
  
- **Risk**: Storage costs escalating with KYC documents
  - **Mitigation**: Implement document compression, lifecycle policies, archive old docs to Glacier

#### Business Risks
- **Risk**: High KYC rejection rate discouraging vendors
  - **Mitigation**: Clear guidelines, example documents, support chat during KYC
  
- **Risk**: Vendors disputing invoice amounts
  - **Mitigation**: Show breakdown in vendor dashboard, allow raising disputes, transparent calculation
  
- **Risk**: Tax regulation changes invalidating calculations
  - **Mitigation**: Configurable GST rates, easy update mechanism, maintain historical accuracy
  
- **Risk**: Vendors not completing KYC, leaving marketplace
  - **Mitigation**: Gradual enforcement, grace period, assisted KYC support

---

### Documentation Requirements

#### Technical Documentation
- [ ] **Architecture Diagram**: System architecture with all components
- [ ] **Database Schema Diagram**: ER diagram with relationships
- [ ] **API Documentation**: Complete Swagger/Postman collection
- [ ] **Sequence Diagrams**: For KYC, invoice generation workflows
- [ ] **Deployment Guide**: Step-by-step deployment instructions
- [ ] **Troubleshooting Guide**: Common issues and resolutions

#### User Documentation
- [ ] **Vendor KYC Guide**: Step-by-step with screenshots
- [ ] **Product GST Guide**: How to set GST rates, calculate prices
- [ ] **Invoice Guide**: Understanding invoices, downloading, queries
- [ ] **Admin Manual**: KYC verification, invoice management procedures
- [ ] **FAQ Document**: Frequently asked questions
- [ ] **Video Tutorials**: Screen recordings for complex workflows

#### Compliance Documentation
- [ ] **Privacy Policy**: Updated with KYC data handling
- [ ] **Terms of Service**: KYC requirements, tax obligations
- [ ] **Data Retention Policy**: Document retention periods
- [ ] **Security Policy**: Document security measures
- [ ] **Audit Report**: Regular audit reports for compliance

---

**Document Version:** 1.0  
**Last Updated:** December 29, 2025  
**Status:** Implementation Guide