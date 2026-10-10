# Admin Authentication System - Implementation Complete

## Overview
Implemented a comprehensive role-based access control system with vendor self-registration:
- **Super Admin** (Site Owner)
- **Vendor Admin** (Store Managers)
- **Customer** (Buyers)

---

## What's Implemented

### 1. User Roles
- `SUPER_ADMIN` - Full system access
- `VENDOR_ADMIN` - Limited to their vendor's data
- `CUSTOMER` - Browse and purchase

### 2. Vendor Registration Methods

#### Option A: Self-Registration (NEW - Recommended)
Vendors can now register themselves through a public registration page with:
https://yourdomain.com/vendor/register
- Email/password registration
- Google OAuth integration
- Automatic account creation
- Pending approval workflow

#### Option B: Admin-Created (Legacy)
Super admin can still create vendors manually via API

### 3. Backend Components

#### User Entity Updated
- Added `SUPER_ADMIN` and `VENDOR_ADMIN` roles
- Added `vendorId` field for vendor admin association

#### Guards & Decorators
- `RolesGuard` - Check user roles before accessing routes
- `@Roles()` decorator - Define required roles for endpoints
- `@CurrentUser()` decorator - Get current user in controllers

#### Google OAuth Strategy
- Integrated Google OAuth 2.0
- Automatic profile extraction
- Seamless account creation

#### Auth Service Enhanced
- `registerVendor()` - Self-service vendor registration
- `googleLogin()` - OAuth authentication
- Automatic vendor admin creation
- Status set to PENDING for approval

#### Seed Script
- Created `seed-admin.ts` to create super admin on first run

---

## How to Use

### Step 1: Create Super Admin
```bash
cd apps/backend
npm run seed:admin
```

**Default credentials:**
- Email: `admin@marketplace.com`
- Password: `Admin@123`

### Step 2: Configure Google OAuth (Optional)

Add to `.env` file:
```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/v1/auth/google/callback
```

Get credentials from: https://console.cloud.google.com/

### Step 3: Vendor Self-Registration

#### Option 1: Email/Password Registration
1. Navigate to: `http://localhost:3000/vendor/register`
2. Fill out the registration form:
   - Personal information (name, email, password, phone)
   - Store information (store name, business name, description)
   - Address (optional)
3. Click "Register Store"
4. Account created with status **PENDING**
5. Wait for admin approval

#### Option 2: Google OAuth Registration
1. Navigate to: `http://localhost:3000/vendor/register`
2. Click "Continue with Google"
3. Sign in with your Google account
4. Complete store information form
5. Account created with status **PENDING**
6. Wait for admin approval

### Step 4: Admin Approval

Super admin can approve vendors via:
```typescript
PATCH /api/v1/vendors/:id
{
  "status": "active"  // or "rejected"
}
```

Or through the admin dashboard (to be implemented).

### Step 5: Vendor Login

After approval:
1. Navigate to: `http://localhost:3000/admin/login`
2. Login with registered email/password
3. Access vendor dashboard

---

## Vendor Registration Flow

```
┌─────────────────────┐
│  Vendor Registration │
│  /vendor/register    │
└──────────┬───────────┘
           │
     ┌─────▼──────┐
     │ Choose:    │
     │ Email or   │
     │ Google     │
     └─────┬──────┘
           │
     ┌─────▼──────────┐
     │ Fill Form:     │
     │ - Personal     │
     │ - Store Info   │
     │ - Address      │
     └─────┬──────────┘
           │
     ┌─────▼──────────┐
     │ Account Created│
     │ Status: PENDING│
     └─────┬──────────┘
           │
     ┌─────▼──────────┐
     │ Admin Reviews  │
     │ & Approves     │
     └─────┬──────────┘
           │
     ┌─────▼──────────┐
     │ Status: ACTIVE │
     │ Can Sell!      │
     └────────────────┘
```

---

## Vendor Status Workflow

### Status Types
- **PENDING** - Awaiting admin approval (default after registration)
- **ACTIVE** - Approved, can sell products
- **SUSPENDED** - Temporarily disabled
- **REJECTED** - Application denied

### Dashboard Behavior by Status

#### PENDING
- Shows yellow warning banner
- Limited access to settings
- Cannot create products or view orders
- Helpful tips for while waiting

#### ACTIVE
- Full access to all features
- Can create/edit products
- Can view and manage orders
- Access to analytics

#### SUSPENDED
- Shows red warning banner
- Read-only access
- Contact support message

#### REJECTED
- Shows red error banner
- No access to features
- Contact support message

---

## API Endpoints

### Public Endpoints (No Auth Required)

#### Register Vendor
```typescript
POST /api/v1/auth/register-vendor
Content-Type: application/json

{
  "email": "vendor@example.com",
  "password": "SecurePass@123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "storeName": "My Awesome Store",
  "description": "We sell amazing products",
  "businessName": "Awesome Store LLC",
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "country": "USA",
  "postalCode": "10001"
}

Response:
{
  "message": "Vendor registration successful. Your account is pending approval.",
  "vendor": {
    "id": "uuid",
    "storeName": "My Awesome Store",
    "status": "pending"
  },
  "user": { ... },
  "token": "jwt-token"
}
```

#### Google OAuth Flow
```typescript
// 1. Initiate OAuth
GET /api/v1/auth/google
// Redirects to Google sign-in

// 2. Callback (handled automatically)
GET /api/v1/auth/google/callback
// Returns token and user data
```

#### Login
```typescript
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "vendor@example.com",
  "password": "SecurePass@123"
}

Response:
{
  "access_token": "jwt-token",
  "user": { ... }
}
```

### Protected Endpoints (Auth Required)

#### Update Vendor Status (Super Admin Only)
```typescript
PATCH /api/v1/vendors/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "active"  // pending, active, suspended, rejected
}
```

---

## Protecting Routes

### Example 1: Super Admin Only
```typescript
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@UseGuards(RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Get('analytics')
async getAnalytics() {
  // Only super admin can access
}
```

### Example 2: Super Admin or Vendor Admin
```typescript
@UseGuards(RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.VENDOR_ADMIN)
@Get('products')
async getProducts(@CurrentUser() user: User) {
  if (user.role === UserRole.VENDOR_ADMIN) {
    // Return only their vendor's products
    return this.productsService.findByVendor(user.vendorId);
  }
  // Super admin sees all products
  return this.productsService.findAll();
}
```

---

## User Workflows

### Super Admin Workflow
1. Login at `/admin/login`
2. Access all admin features
3. Review pending vendor applications
4. Approve/reject vendors
5. View all analytics and data
6. Manage all products and orders

### Vendor Admin Workflow (Self-Registration)
1. Register at `/vendor/register`
2. Choose email/password or Google OAuth
3. Fill out registration form
4. Submit and receive confirmation
5. Wait for approval (1-2 business days)
6. Receive email notification when approved
7. Login at `/admin/login`
8. Access vendor dashboard
9. Manage own products and orders

### Vendor Admin Workflow (Legacy - Admin Created)
1. Super admin creates vendor with admin credentials
2. Vendor admin receives email/password
3. Login at `/admin/login`
4. Access only their vendor's data:
   - Products
   - Orders
   - Analytics (filtered)

### Customer Workflow
1. Register on main site
2. Browse and purchase
3. No admin access

---

## Security Features

✅ **Password Hashing** - bcrypt with 10 rounds
✅ **JWT Authentication** - Secure token-based auth
✅ **Role-Based Access** - Guards prevent unauthorized access
✅ **Vendor Scoping** - Vendor admins can't see other vendors' data
✅ **Type Safety** - TypeScript enums for roles
✅ **Google OAuth** - Secure third-party authentication
✅ **Approval Workflow** - Prevent spam/fraudulent vendors
✅ **Input Validation** - Validate all registration fields

---

## Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRATION=7d

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/v1/auth/google/callback

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/marketplace
```

---

## Next Steps (Optional Enhancements)

### High Priority
1. ✅ **Vendor Self-Registration** - Implemented
2. ✅ **Google OAuth** - Implemented
3. ✅ **Vendor Dashboard** - Implemented
4. ⏳ **Email Verification** - Send verification email on registration
5. ⏳ **Admin Approval UI** - Dashboard for reviewing vendors
6. ⏳ **Email Notifications** - Notify vendors of approval/rejection

### Medium Priority
7. **Password Reset** - Allow password recovery
8. **Activity Logging** - Track admin actions
9. **KYC Verification** - Document upload for vendors
10. **Bank Account Setup** - Payout configuration

### Low Priority
11. **2FA** - Two-factor authentication
12. **Session Management** - Active session monitoring
13. **IP Whitelisting** - Restrict admin access by IP
14. **Rate Limiting** - Prevent registration spam

---

## Files Created/Modified

### Created:
- `apps/backend/src/modules/auth/strategies/google.strategy.ts`
- `apps/backend/src/common/decorators/roles.decorator.ts`
- `apps/backend/src/common/decorators/current-user.decorator.ts`
- `apps/backend/src/common/guards/roles.guard.ts`
- `apps/backend/src/database/seed-admin.ts`
- `apps/web/src/app/admin/login/page.tsx`
- `apps/web/src/app/vendor/register/page.tsx`
- `apps/web/src/app/vendor/dashboard/page.tsx`

### Modified:
- `apps/backend/src/modules/auth/auth.module.ts` - Added Google OAuth strategy
- `apps/backend/src/modules/auth/auth.service.ts` - Added registerVendor method
- `apps/backend/src/modules/auth/auth.controller.ts` - Added registration endpoints
- `apps/backend/src/modules/users/user.entity.ts` - Added role enums
- `apps/backend/src/modules/vendors/vendors.service.ts` - Enhanced vendor creation
- `apps/backend/src/modules/vendors/vendors.module.ts` - Module updates
- `apps/backend/package.json` - Added OAuth dependencies

---

## Testing

### Test Super Admin Login
```bash
# Run seed
npm run seed:admin

# Try login at http://localhost:3000/admin/login
Email: admin@marketplace.com
Password: Admin@123
```

### Test Vendor Self-Registration
```bash
# 1. Open browser
http://localhost:3000/vendor/register

# 2. Fill form with test data
Email: testvendor@example.com
Password: Test@123
Store Name: Test Store

# 3. Submit and check database
# Vendor should have status: 'pending'

# 4. Approve vendor (as super admin)
curl -X PATCH http://localhost:3001/api/v1/vendors/{vendor-id} \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'

# 5. Login as vendor
http://localhost:3000/admin/login
Email: testvendor@example.com
Password: Test@123
```

### Test Google OAuth
```bash
# 1. Configure Google OAuth credentials in .env
# 2. Navigate to registration page
http://localhost:3000/vendor/register

# 3. Click "Continue with Google"
# 4. Sign in with Google account
# 5. Complete registration form
# 6. Check vendor status is 'pending'
```

---

## Troubleshooting

**Issue**: Google OAuth fails
**Fix**: 
1. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env
2. Verify callback URL matches Google Console settings
3. Enable Google+ API in Google Cloud Console

**Issue**: Vendor registration fails
**Fix**: 
1. Check all required fields are provided
2. Ensure email is unique
3. Verify store name is unique
4. Check password meets requirements (8+ characters)

**Issue**: Super admin seed fails
**Fix**: Check database connection and ensure User table exists

**Issue**: Login returns 401
**Fix**: Verify JWT secret is configured in .env

**Issue**: Vendor admin can see all products
**Fix**: Ensure you're checking `user.vendorId` in queries

**Issue**: Pending vendor can't access dashboard
**Fix**: This is expected behavior - vendors must be approved first

---

## Vendor Registration URL

Share this URL with potential vendors:
```
http://localhost:3000/vendor/register
```

For production:
```
https://yoursite.com/vendor/register
```

---

## Support

For questions or issues, check:
1. Database migrations are run
2. JWT_SECRET is set in .env
3. Super admin is seeded
4. Auth guards are applied to routes
5. Google OAuth credentials are configured (if using OAuth)
6. Vendor entity includes status field
