# Testing Guide - Phase 1 KYC Implementation

## 🚀 Quick Start Testing (5 minutes)

### Step 1: Run Database Migration

```powershell
cd marketplace-backend
.\run-kyc-migration.ps1
```

**Expected Output:**
```
====================================
  Migration completed successfully!
====================================
KYC fields added to vendors table:
  - kycStatus
  - kycDocuments
  ...
```

### Step 2: Restart Backend Server

```powershell
# Stop existing services
.\stop-all.ps1

# Start backend
npm run start:dev
```

**Verify Backend Running:**
- Open http://localhost:3001/api/v1/vendors/kyc/pending (should return 401 if not logged in - this is correct)

### Step 3: Start Frontend

```powershell
cd ..\marketplace-web
npm run dev
```

**Verify Frontend Running:**
- Open http://localhost:3000

---

## 📋 Complete Testing Workflow

### Test 1: Vendor Registration & Login

1. **Create a vendor account** (if you don't have one)
   - Go to http://localhost:3000/vendor-registration
   - Fill in all details
   - Submit registration

2. **Login as vendor**
   - Go to http://localhost:3000/login
   - Enter vendor credentials
   - Should redirect to vendor dashboard

---

### Test 2: Vendor KYC Submission

#### Access KYC Page
1. Navigate to http://localhost:3000/vendor/kyc
2. You should see the KYC verification page
3. Status badge should show "Pending"

#### Upload Documents

**Test Document 1: PAN Card**
- Click on PAN Card upload area
- Select a PDF or image file (<5MB)
- Enter PAN number: `ABCDE1234F`
- File should show as uploaded with green checkmark

**Test Document 2: Aadhar Front**
- Click on Aadhar Front upload area
- Select a PDF or image file
- Enter Aadhar number: `123456789012`
- Verify upload successful

**Test Document 3: Aadhar Back**
- Upload Aadhar back image
- Enter same Aadhar number: `123456789012`

**Test Document 4: Bank Details**
- Upload cancelled cheque or bank statement
- No document number required

**Test Document 5: Address Proof**
- Upload utility bill or rental agreement
- No document number required

**Optional Documents:**
- GST Certificate (if vendor has GST)
- Business License

#### Submit KYC

1. Click "Submit for Verification"
2. Should see success alert: "KYC documents submitted successfully!"
3. Should redirect to vendor dashboard
4. Status badge should change to "Submitted"

---

### Test 3: Admin KYC Verification

#### Login as Admin

1. Logout from vendor account
2. Login with admin credentials
   - Email: admin@marketplace.com (or your admin email)
   - Password: your_admin_password

#### Access Admin Dashboard

1. Navigate to http://localhost:3000/admin/kyc-verification
2. You should see the pending KYC list
3. Should show "1 Pending" badge

#### Review KYC Documents

1. Click "Review" button on the vendor row
2. Modal should open showing vendor details
3. Verify all information:
   - Vendor name
   - Email
   - PAN number
   - Document count

#### View Documents

1. Click "View Document" on each document type
2. Document should open in new tab
3. Verify all 5-7 documents are accessible

#### Approve KYC

1. Click "Approve KYC" button
2. Confirm approval
3. Should see success message
4. Modal should close
5. Vendor should disappear from pending list

---

### Test 4: Verify Vendor Status After Approval

1. Logout from admin account
2. Login as the vendor again
3. Navigate to http://localhost:3000/vendor/kyc
4. Status badge should show "Approved" (green)
5. Documents should be visible but not editable

---

### Test 5: Test KYC Rejection Flow

#### Submit Another Vendor KYC

1. Create and login as another vendor account
2. Submit KYC documents (follow Test 2)

#### Reject as Admin

1. Login as admin
2. Go to http://localhost:3000/admin/kyc-verification
3. Click "Review" on the new vendor
4. Enter rejection reason: "PAN card image is not clear. Please upload a clearer image."
5. Click "Reject KYC"
6. Confirm rejection

#### Verify Rejection Display

1. Logout and login as the rejected vendor
2. Go to http://localhost:3000/vendor/kyc
3. Status badge should show "Rejected" (red)
4. Should see red alert box with rejection reason
5. Documents should be editable
6. Can resubmit with updated documents

---

## 🧪 Edge Case Testing

### Test 6: File Size Validation

1. Try uploading a file >5MB
2. Should see error: "File size must be less than 5MB"
3. Upload should be rejected

### Test 7: File Type Validation

1. Try uploading a .txt or .doc file
2. Backend should reject with error
3. Only PDF, JPG, PNG should work

### Test 8: Required Document Validation

1. Try submitting without all required documents
2. Should see error listing missing documents
3. Submit button should validate

### Test 9: Duplicate Submission Prevention

1. Submit KYC as vendor
2. Try submitting again immediately
3. Should show appropriate message

### Test 10: Admin Authorization

1. Try accessing http://localhost:3000/admin/kyc-verification as vendor
2. Should be denied access or redirected
3. Only admin role should access

---

## 🔍 API Testing (Using Postman/Thunder Client)

### Test API Endpoints Directly

#### 1. Get KYC Status (Vendor)
```http
GET http://localhost:3001/api/v1/vendors/kyc/status
Authorization: Bearer YOUR_VENDOR_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "kycStatus": "pending",
    "kycDocuments": [],
    "isKycVerified": false,
    "panNumber": null
  }
}
```

#### 2. Upload KYC Document
```http
POST http://localhost:3001/api/v1/upload/kyc-documents
Authorization: Bearer YOUR_VENDOR_TOKEN
Content-Type: multipart/form-data

file: [select file from system]
```

**Expected Response:**
```json
{
  "success": true,
  "url": "/uploads/kyc/1735468800000-pan.pdf",
  "filename": "1735468800000-pan.pdf",
  "originalName": "pan.pdf",
  "size": 102400,
  "mimetype": "application/pdf"
}
```

#### 3. Submit KYC
```http
POST http://localhost:3001/api/v1/vendors/kyc/submit
Authorization: Bearer YOUR_VENDOR_TOKEN
Content-Type: application/json

{
  "documents": [
    {
      "type": "pan",
      "documentNumber": "ABCDE1234F",
      "documentUrl": "/uploads/kyc/1735468800000-pan.pdf",
      "uploadedAt": "2025-12-29T10:00:00Z",
      "fileName": "pan.pdf",
      "fileSize": 102400
    }
  ]
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "KYC documents submitted successfully...",
  "data": {
    "kycStatus": "submitted",
    "kycSubmittedAt": "2025-12-29T10:00:00Z"
  }
}
```

#### 4. Get Pending KYC (Admin)
```http
GET http://localhost:3001/api/v1/vendors/kyc/pending
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "uuid",
      "businessName": "Test Vendor",
      "storeName": "Test Store",
      "email": "vendor@test.com",
      "kycStatus": "submitted",
      "kycSubmittedAt": "2025-12-29T10:00:00Z",
      "kycDocuments": [...]
    }
  ]
}
```

#### 5. Approve KYC (Admin)
```http
PUT http://localhost:3001/api/v1/vendors/kyc/{vendorId}/approve
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "message": "KYC approved successfully...",
  "data": {
    "vendorId": "uuid",
    "kycStatus": "approved",
    "kycApprovedAt": "2025-12-29T10:05:00Z",
    "isKycVerified": true
  }
}
```

#### 6. Reject KYC (Admin)
```http
PUT http://localhost:3001/api/v1/vendors/kyc/{vendorId}/reject
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "reason": "PAN card image is not clear"
}
```

---

## 🗄️ Database Verification

### Check Database Tables

```sql
-- Connect to database
psql -U postgres -d marketplace

-- Check if columns exist
\d vendors

-- Check vendor KYC status
SELECT 
  id,
  "storeName",
  "kycStatus",
  "kycSubmittedAt",
  "kycApprovedAt",
  "isKycVerified",
  "panNumber"
FROM vendors
WHERE "kycStatus" != 'pending';

-- Check KYC documents
SELECT 
  "storeName",
  "kycStatus",
  jsonb_array_length("kycDocuments") as document_count,
  "kycDocuments"
FROM vendors
WHERE "kycDocuments" IS NOT NULL;

-- Count vendors by status
SELECT 
  "kycStatus",
  COUNT(*) as count
FROM vendors
GROUP BY "kycStatus";
```

---

## ✅ Testing Checklist

### Basic Flow
- [ ] Migration runs successfully
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can access vendor KYC page
- [ ] Can upload all 7 document types
- [ ] Can enter document numbers
- [ ] Can submit KYC
- [ ] Status changes to "Submitted"
- [ ] Admin can see pending KYC
- [ ] Admin can view documents
- [ ] Admin can approve KYC
- [ ] Status changes to "Approved"
- [ ] Approved page is read-only

### Rejection Flow
- [ ] Admin can reject with reason
- [ ] Rejection reason displays to vendor
- [ ] Vendor can resubmit after rejection
- [ ] Status updates correctly after resubmission

### Validation
- [ ] File size >5MB is rejected
- [ ] Non-PDF/JPG/PNG files are rejected
- [ ] Missing required documents show error
- [ ] Invalid PAN format is validated
- [ ] Empty rejection reason is prevented

### Security
- [ ] Vendor can only see own KYC
- [ ] Vendor cannot access admin endpoints
- [ ] Admin can see all pending KYCs
- [ ] Authentication required for all endpoints
- [ ] JWT token is validated

### Edge Cases
- [ ] Can handle no documents uploaded
- [ ] Can handle partial document upload
- [ ] Can handle already approved KYC
- [ ] Can handle concurrent approvals
- [ ] Can handle very long rejection reasons
- [ ] Can handle special characters in document numbers

---

## 🐛 Common Issues & Solutions

### Issue 1: Migration Fails
**Error:** `relation "vendors" does not exist`

**Solution:**
```powershell
# Create vendors table first or check if it exists
psql -U postgres -d marketplace -c "\d vendors"
```

### Issue 2: Upload Directory Not Found
**Error:** `ENOENT: no such file or directory, open 'uploads/kyc'`

**Solution:**
```powershell
# Create upload directories
cd marketplace-backend
mkdir -p public/uploads/kyc
```

### Issue 3: Authentication Fails
**Error:** `401 Unauthorized`

**Solution:**
- Check if JWT token is in localStorage
- Verify token hasn't expired
- Check Authorization header format: `Bearer {token}`

### Issue 4: Admin Cannot Access Dashboard
**Error:** `403 Forbidden`

**Solution:**
```sql
-- Update user role to admin
UPDATE users 
SET role = 'admin' 
WHERE email = 'your@email.com';
```

### Issue 5: Documents Don't Open
**Error:** `404 Not Found`

**Solution:**
- Check if files exist in `public/uploads/kyc/`
- Verify backend serves static files
- Check file URL format

---

## 📊 Performance Testing

### Load Testing with Sample Data

```sql
-- Insert test vendors with KYC data
INSERT INTO vendors (
  "storeName",
  slug,
  "userId",
  "kycStatus",
  "kycDocuments",
  "panNumber"
) 
SELECT 
  'Test Vendor ' || i,
  'test-vendor-' || i,
  (SELECT id FROM users WHERE role = 'vendor' LIMIT 1),
  'submitted',
  '[{"type":"pan","documentUrl":"/test.pdf"}]'::jsonb,
  'TEST' || LPAD(i::text, 5, '0') || 'X'
FROM generate_series(1, 100) i;

-- Check query performance
EXPLAIN ANALYZE 
SELECT * FROM vendors 
WHERE "kycStatus" = 'submitted' 
ORDER BY "kycSubmittedAt" ASC;
```

---

## 🎯 Success Criteria

✅ **Phase 1 is working correctly if:**

1. Vendor can upload all required documents
2. Documents are validated (size, type)
3. Submission creates record with status "submitted"
4. Admin dashboard shows pending KYC
5. Admin can view all documents
6. Admin can approve KYC (status → approved)
7. Admin can reject KYC with reason
8. Rejection reason displays to vendor
9. Vendor can resubmit after rejection
10. Database records are created correctly
11. No console errors in browser or backend
12. All API endpoints return correct responses

---

## 📹 Video Testing Guide

### Record Your Testing Session

1. Start screen recording
2. Go through complete flow (vendor submit → admin approve)
3. Test rejection flow
4. Test edge cases
5. Share recording with team for review

---

## 🚀 Next Steps After Testing

Once all tests pass:

1. **Mark Phase 1 as Complete** ✅
2. **Document any issues found**
3. **Begin Phase 2 (GST & Product Variants)**
4. **Set up email service for notifications**
5. **Configure AWS S3 for file storage**
6. **Add monitoring and logging**

---

**Testing Guide Version:** 1.0  
**Last Updated:** December 29, 2025  
**Status:** Ready for Testing
