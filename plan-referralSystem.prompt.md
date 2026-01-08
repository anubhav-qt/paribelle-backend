# Referral System Implementation Plan

## Overview
Implement a comprehensive referral system where customers and vendors can refer new vendors to join the platform and earn credits. New vendors get a discount using a referral code, and referrers receive a percentage of the registration fee as credit.

## Requirements Summary
- Referral codes for both customers and vendors (unlimited usage, reusable)
- 1 referral per day limit per user (fraud prevention)
- Vendor registration requires payment AFTER admin approval
- Referral discount: REFERRAL_PERCENTAGE of REGISTRATIONCOST
- Referrer credit: REFERRAL_CREDIT_PERCENTAGE of REGISTRATIONCOST
- Customers use credits as wallet balance for future orders
- Vendors receive credits in their vendor balance (withdrawable)
- Create About Us page with referral program information
- Generate invoices for registration fees and referral credits

## Code Reuse Strategy

### Leverage Existing Systems
1. **Theme System**: Use existing `useThemeClasses()` hook and vendor theme config - no custom CSS
2. **Invoice System**: Extend existing Invoice entity with new types (REGISTRATION, REFERRAL_CREDIT)
3. **Settings System**: Use existing SiteSetting entity for all configuration
4. **Dashboard Components**: Reuse existing card/stats components for referral dashboard
5. **Form Components**: Reuse Input, Button, Card from existing components
6. **Vendor Balance**: Extend existing VendorBalance entity for referral credits
7. **Payment Flow**: Reuse existing Razorpay integration for registration payment

### Components to Reuse
- `marketplace-web/src/components/Input.tsx`
- `marketplace-web/src/components/Button.tsx`
- `marketplace-web/src/components/Card.tsx`
- `marketplace-web/src/hooks/useThemeClasses.ts`
- `marketplace-backend/src/modules/invoices/invoices.service.ts`
- `marketplace-backend/src/modules/invoices/invoice-pdf.service.ts`
- `marketplace-backend/src/modules/admin/settings.service.ts`

## Database Schema Changes

### 1. Migration File: `add-referral-system.js`

**Users Table Additions:**
```sql
ALTER TABLE users 
ADD COLUMN referral_code VARCHAR(20) UNIQUE,
ADD COLUMN referred_by UUID REFERENCES users(id),
ADD COLUMN wallet_balance DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN referral_credits_earned DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN last_referral_date TIMESTAMP;
```

**Vendors Table Additions:**
```sql
ALTER TABLE vendors
ADD COLUMN referred_by UUID REFERENCES users(id),
ADD COLUMN registration_fee_paid DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN registration_paid_at TIMESTAMP,
ADD COLUMN referral_discount DECIMAL(10, 2) DEFAULT 0;
```

**New Table: referral_transactions**
```sql
CREATE TABLE referral_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id),
  referred_vendor_id UUID NOT NULL REFERENCES vendors(id),
  credit_amount DECIMAL(10, 2) NOT NULL,
  registration_invoice_id UUID REFERENCES invoices(id),
  status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  credited_at TIMESTAMP
);
```

**Indexes:**
```sql
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_users_referred_by ON users(referred_by);
CREATE INDEX idx_vendors_referred_by ON vendors(referred_by);
CREATE INDEX idx_referral_transactions_referrer ON referral_transactions(referrer_id);
CREATE INDEX idx_referral_transactions_vendor ON referral_transactions(referred_vendor_id);
```

**Settings:**
```sql
INSERT INTO site_settings (key, value, description)
VALUES 
  ('VENDOR_REGISTRATION_COST', '20000', 'Vendor registration fee in INR'),
  ('REFERRAL_PERCENTAGE', '10', 'Percentage discount for referred vendors'),
  ('REFERRAL_CREDIT_PERCENTAGE', '10', 'Percentage credited to referrer'),
  ('REFERRAL_DAILY_LIMIT', '1', 'Max referrals per day per user');
```

## Backend Implementation

### 1. Update Entities

**File: `user.entity.ts`**
- Add fields: referralCode, referredBy, walletBalance, referralCreditsEarned, lastReferralDate
- Add relation: referrals (OneToMany to ReferralTransaction)
- Add method: `hasReachedDailyReferralLimit()` - check if lastReferralDate is today

**File: `vendor.entity.ts`**
- Add fields: referredBy, registrationFeePaid, registrationPaidAt, referralDiscount
- Add relation: referralTransaction (OneToOne to ReferralTransaction)

**New File: `referral-transaction.entity.ts`**
- Fields: id, referrerId, referredVendorId, creditAmount, registrationInvoiceId, status, notes, createdAt, creditedAt
- Relations: referrer (ManyToOne User), referredVendor (ManyToOne Vendor), registrationInvoice (ManyToOne Invoice)

**File: `invoice.entity.ts`**
- Update InvoiceType enum: add REGISTRATION, REFERRAL_CREDIT
- No structural changes needed

### 2. Referral Service

**New File: `referral.service.ts`**
```typescript
class ReferralService {
  // Generate unique 8-char code: REF-{random}
  async generateReferralCode(): Promise<string>
  
  // Validate code exists and is not user's own
  async validateReferralCode(code: string, userId: string): Promise<User>
  
  // Check if user has reached daily limit (1 per day)
  async checkDailyLimit(userId: string): Promise<boolean>
  
  // Calculate discounted registration fee
  async calculateDiscountedFee(referralCode?: string): Promise<{
    baseFee: number,
    discount: number,
    finalFee: number,
    referrerId: string
  }>
  
  // Process referral credit after vendor payment
  async processReferralCredit(
    vendorId: string,
    registrationInvoiceId: string
  ): Promise<void>
  
  // Get user's referral stats
  async getReferralStats(userId: string): Promise<{
    code: string,
    totalReferrals: number,
    totalEarned: number,
    pendingCredits: number,
    referrals: ReferralTransaction[]
  }>
}
```

### 3. Update Auth Service

**File: `auth.service.ts` - Method: `registerVendor()`**
- Add parameter: `referralCode?: string`
- Generate referral code for new user: `user.referralCode = await referralService.generateReferralCode()`
- If referralCode provided:
  - Validate code: `referrer = await referralService.validateReferralCode(referralCode)`
  - Check daily limit: `await referralService.checkDailyLimit(referrer.id)`
  - Set `user.referredBy = referrer.id` and `vendor.referredBy = referrer.id`
  - Calculate discount: `vendor.referralDiscount = baseFee * (REFERRAL_PERCENTAGE / 100)`
- Vendor status remains PENDING (payment happens later)

**New Endpoint: `POST /auth/validate-referral/:code`**
```typescript
async validateReferral(@Param('code') code: string, @Req() req) {
  const user = await referralService.validateReferralCode(code, req.user?.id);
  return { valid: true, referrerName: `${user.firstName} ${user.lastName}` };
}
```

### 4. Vendor Approval & Payment Flow

**File: `vendors.service.ts`**

**New Method: `approveVendor(vendorId: string)`**
- Change vendor.status to ACTIVE
- Calculate registration fee: `await referralService.calculateDiscountedFee(vendor.referredBy)`
- Create REGISTRATION invoice via invoices.service
- Send email to vendor with payment link
- Return invoice with payment URL

**New Method: `processRegistrationPayment(vendorId: string, paymentData)`**
- Update vendor: registrationFeePaid, registrationPaidAt
- Update invoice status to PAID
- If vendor.referredBy exists:
  - Call `referralService.processReferralCredit(vendorId, invoiceId)`
  - This creates ReferralTransaction and credits referrer
- Send confirmation email

### 5. Invoices Service Updates

**File: `invoices.service.ts`**

**New Method: `createRegistrationInvoice(vendor, fee, discount)`**
```typescript
// Similar to createFromOrder but for registration
const invoice = {
  type: InvoiceType.REGISTRATION,
  invoiceNumber: `REG-${timestamp}-${random}`,
  vendorId: vendor.id,
  customerId: vendor.userId, // Vendor is also customer for registration
  subtotal: fee,
  discount: discount,
  tax: 0, // Registration fee is usually GST-exempt or handled separately
  total: fee - discount,
  billingName: vendor.businessName,
  // ... other vendor details
  status: InvoiceStatus.PENDING
}
```

**New Method: `createReferralCreditInvoice(referrer, amount, registrationInvoiceId)`**
```typescript
// Credit note showing referral earnings
const invoice = {
  type: InvoiceType.REFERRAL_CREDIT,
  invoiceNumber: `RFC-${timestamp}-${random}`,
  customerId: referrer.id,
  vendorId: referrer.vendorId, // If referrer is vendor
  subtotal: amount,
  total: amount,
  status: InvoiceStatus.PAID, // Auto-credited
  paidAt: new Date(),
  notes: `Referral credit for referring vendor registration ${registrationInvoiceId}`
}
```

**Update PDF Service:** Add templates for REGISTRATION and REFERRAL_CREDIT invoice types

### 6. Checkout Integration for Wallet Balance

**File: `orders.service.ts` - Method: `create()`**
- Before payment, check if user has walletBalance
- If walletBalance > 0:
  - Calculate: `amountToApply = Math.min(walletBalance, orderTotal)`
  - Deduct from order: `finalTotal = orderTotal - amountToApply`
  - Deduct from wallet: `user.walletBalance -= amountToApply`
  - Record in order notes: "Wallet balance applied: ₹{amount}"
- Proceed with payment for finalTotal

### 7. API Endpoints Summary

**Auth Module:**
- `POST /auth/register/vendor` - Add referralCode param
- `GET /auth/validate-referral/:code` - Validate code

**Vendors Module:**
- `POST /vendors/:id/approve` - Admin approves vendor, generates invoice
- `POST /vendors/:id/registration-payment` - Process registration payment
- `GET /vendors/:id/registration-invoice` - Get registration invoice details

**Referral Module (new):**
- `GET /referrals/my-code` - Get own referral code
- `GET /referrals/stats` - Get referral statistics
- `GET /referrals/transactions` - List referral transactions

**Users Module:**
- `GET /users/me/wallet` - Get wallet balance
- `GET /users/me/wallet/transactions` - Wallet transaction history

## Frontend Implementation

### 1. Vendor Registration Form

**File: `marketplace-web/src/app/vendor-registration/page.tsx`**
- Add referral code input field (optional)
- Add "Validate Code" button that calls `/auth/validate-referral/:code`
- Show referrer name if valid: "Referred by: John Doe"
- Show pricing calculation:
  ```
  Registration Fee: ₹5,000
  Referral Discount (20%): -₹1,000
  Amount Payable: ₹4,000 (after admin approval)
  ```
- Use existing Input and Button components
- Apply theme using `useThemeClasses()`
- On submit, include referralCode in registration payload

### 2. Admin Vendor Approval

**File: `marketplace-web/src/app/admin/vendors/page.tsx`**
- Add "Approve & Generate Invoice" button for PENDING vendors
- On approve, call `POST /vendors/:id/approve`
- Show modal with invoice details and payment instructions
- Email sent automatically to vendor

### 3. Vendor Payment Page

**New File: `marketplace-web/src/app/vendor-payment/[invoiceId]/page.tsx`**
- Fetch registration invoice details
- Show invoice summary (reuse existing invoice display component)
- Integrate Razorpay payment button
- After successful payment, redirect to dashboard with success message
- Reuse theme system for styling

### 4. Referral Dashboard Widget

**File: `marketplace-web/src/app/dashboard/page.tsx`**
- Add referral stats card to existing dashboard
- Use existing Card component
- Show:
  - My Referral Code (with copy button)
  - Total Referrals: X vendors
  - Total Earned: ₹X
  - Pending Credits: ₹X
  - Share buttons (WhatsApp, Email, Copy Link)
- For customers: Show wallet balance
- For vendors: Show referral credits in vendor balance
- Use existing theme classes

### 5. Wallet Balance Display

**File: `marketplace-web/src/app/profile/page.tsx`**
- Add "Wallet Balance" section for customers
- Show current balance
- Show transaction history
- Use existing Card and table components

**File: `marketplace-web/src/app/checkout/page.tsx`**
- Add wallet balance display in order summary
- Add checkbox: "Use wallet balance (₹X available)"
- Automatically calculate discounted total
- Show: "Wallet Applied: -₹X" in breakdown

### 6. About Us Page

**New File: `marketplace-web/src/app/about-us/page.tsx`**

**Sections:**
1. **Hero Section**
   - Title: "Join India's Growing Multi-Vendor Marketplace"
   - Subtitle: "Empower your business with our platform"
   - CTA: "Start Selling Today"
   - Use hero pattern from existing pages

2. **Platform Benefits**
   - Cards showing key features (reuse Card component):
     - Wide Customer Reach
     - Easy Store Management
     - Secure Payments
     - Marketing Tools
     - 24/7 Support
   - Use grid layout from existing category pages

3. **Vendor Success Stories**
   - Testimonials section
   - Metrics: "500+ Active Vendors | ₹10Cr+ Monthly Sales"
   - Reuse review card styling

4. **Referral Program Section**
   - Title: "Earn Rewards by Referring Vendors"
   - How it works (3 steps with icons):
     1. Share your unique referral code
     2. New vendor registers & pays discounted fee
     3. You earn instant credits
   - Example calculation:
     ```
     Registration Fee: ₹5,000
     Your Referral Discount: 20% (₹1,000 off)
     You Earn: 20% (₹1,000 credit)
     Win-Win!
     ```
   - CTA: "Get My Referral Code" (redirects to dashboard/login)

5. **Pricing Plan**
   - Show registration fee clearly
   - Show commission structure
   - Highlight referral discount
   - Use pricing card pattern

6. **FAQ Section**
   - Common questions about referrals:
     - How do I get my referral code?
     - When do I receive credits?
     - Can I refer unlimited vendors?
     - How do customers use wallet credits?
   - Use accordion component (build simple one with theme)

7. **CTA Section**
   - Large button: "Register as Vendor"
   - Secondary button: "Learn More"

**Styling:**
- Use `useThemeClasses()` throughout
- Responsive grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Spacing: consistent with existing pages
- Colors: from theme config
- No custom CSS files

### 7. Referral Link Sharing

**New Component: `marketplace-web/src/components/ReferralShare.tsx`**
- Reuse Button component
- Share options:
  - Copy referral code
  - Copy registration link with code pre-filled
  - WhatsApp share (use WhatsApp API URL)
  - Email share (mailto: link)
- Use theme for styling
- Add success toast on copy (reuse existing toast)

## Settings Management

### Admin Settings UI

**File: `marketplace-web/src/app/admin/settings/page.tsx`**
- Add "Referral System" section with existing form pattern
- Fields:
  - VENDOR_REGISTRATION_COST (number input, ₹)
  - REFERRAL_PERCENTAGE (number input, %)
  - REFERRAL_CREDIT_PERCENTAGE (number input, %)
  - REFERRAL_DAILY_LIMIT (number input)
- Use existing Input components
- Save to site_settings via existing settings API

## Testing Checklist

### Backend Tests
- [ ] Referral code generation (uniqueness)
- [ ] Daily limit enforcement (1 per day)
- [ ] Discount calculation accuracy
- [ ] Credit calculation accuracy
- [ ] Prevent self-referral
- [ ] Invoice generation for registration
- [ ] Invoice generation for referral credit
- [ ] Wallet balance deduction at checkout
- [ ] Vendor balance credit for vendor referrers

### Frontend Tests
- [ ] Referral code validation on registration form
- [ ] Pricing display updates with valid code
- [ ] Payment flow after approval
- [ ] Dashboard displays correct stats
- [ ] Wallet balance shown at checkout
- [ ] About Us page loads and renders
- [ ] Share buttons work correctly
- [ ] Theme styles apply correctly

### Integration Tests
- [ ] End-to-end: Customer refers vendor → vendor pays → customer gets credit → customer uses credit
- [ ] End-to-end: Vendor refers vendor → vendor pays → vendor receives credit in balance
- [ ] Daily limit resets after 24 hours
- [ ] Multiple referrals from same code

## Implementation Order

### Phase 1: Database & Entities
1. Run migration script
2. Update User entity
3. Update Vendor entity
4. Create ReferralTransaction entity
5. Update Invoice entity enum

### Phase 2: Core Backend Services
1. Create ReferralService
2. Update AuthService (registration)
3. Update VendorsService (approval, payment)
4. Update InvoicesService (new invoice types)
5. Update OrdersService (wallet integration)

### Phase 3: API Endpoints
1. Add referral validation endpoint
2. Add vendor approval endpoint
3. Add registration payment endpoint
4. Add referral stats endpoints
5. Add wallet endpoints

### Phase 4: Admin Interface
1. Add settings management UI
2. Update vendor approval flow

### Phase 5: User-Facing Frontend
1. Update vendor registration form
2. Create vendor payment page
3. Add referral dashboard widget
4. Add wallet balance to checkout
5. Create About Us page
6. Create referral share component

### Phase 6: Testing & Polish
1. Test all flows
2. Add error handling
3. Add loading states
4. Add success/error messages
5. Documentation

## Notes

### Code Reuse Emphasis
- **NO custom CSS files** - use theme system exclusively
- **Reuse ALL existing components** - Input, Button, Card, etc.
- **Extend existing services** - don't duplicate invoice/payment logic
- **Follow existing patterns** - match dashboard, settings page structure
- **Use existing hooks** - useThemeClasses, useToast, etc.

### Settings-Driven Approach
- All values configurable via admin settings
- No hardcoded amounts in code
- Easy to adjust without deployment

### Security Considerations
- Validate referral codes server-side
- Prevent self-referral
- Rate limit referral validation requests
- Verify payment before crediting referrer
- Audit trail via ReferralTransaction table

### Performance Considerations
- Index all referral-related foreign keys
- Cache referral stats for dashboard
- Lazy load referral transactions list
- Optimize About Us page images
