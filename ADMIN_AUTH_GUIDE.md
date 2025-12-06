# Admin Authentication System - Implementation Complete

## Overview
Implemented a comprehensive role-based access control system with:
- **Super Admin** (Site Owner)
- **Vendor Admin** (Store Managers)
- **Customer** (Buyers)

---

## What's Implemented

### 1. User Roles
- `SUPER_ADMIN` - Full system access
- `VENDOR_ADMIN` - Limited to their vendor's data
- `CUSTOMER` - Browse and purchase

### 2. Backend Components

#### User Entity Updated
- Added `SUPER_ADMIN` and `VENDOR_ADMIN` roles
- Added `vendorId` field for vendor admin association

#### Guards & Decorators
- `RolesGuard` - Check user roles before accessing routes
- `@Roles()` decorator - Define required roles for endpoints
- `@CurrentUser()` decorator - Get current user in controllers

#### Vendors Service Enhanced
- Automatically creates vendor admin user when creating vendor
- Links vendor admin to their vendor via `vendorId`

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

### Step 2: Login
Navigate to: `http://localhost:3000/admin/login`

### Step 3: Create Vendors with Admins
When creating a vendor via API, include admin credentials:

```typescript
POST /api/v1/vendors
{
  "storeName": "TechStore",
  "businessName": "TechStore Pvt Ltd",
  "contactEmail": "contact@techstore.com",
  "description": "Electronics store",
  "adminEmail": "admin@techstore.com",    // Vendor admin email
  "adminPassword": "VendorAdmin@123"      // Vendor admin password
}
```

This will:
1. Create the vendor
2. Automatically create a vendor admin user
3. Link the admin to the vendor

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
3. Create vendors (which creates vendor admins)
4. View all analytics and data

### Vendor Admin Workflow
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

---

## Next Steps (Optional Enhancements)

1. **Email Verification** - Send credentials to vendor admin
2. **Password Reset** - Allow password recovery
3. **Activity Logging** - Track admin actions
4. **2FA** - Two-factor authentication
5. **Session Management** - Active session monitoring
6. **IP Whitelisting** - Restrict admin access by IP

---

## Files Created/Modified

### Created:
- `apps/backend/src/common/decorators/roles.decorator.ts`
- `apps/backend/src/common/decorators/current-user.decorator.ts`
- `apps/backend/src/common/guards/roles.guard.ts`
- `apps/backend/src/database/seed-admin.ts`
- `apps/web/src/app/admin/login/page.tsx`

### Modified:
- `apps/backend/src/modules/users/user.entity.ts`
- `apps/backend/src/modules/vendors/vendors.service.ts`
- `apps/backend/src/modules/vendors/vendors.module.ts`
- `apps/backend/package.json`

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

### Test Vendor Creation with Admin
```bash
curl -X POST http://localhost:3001/api/v1/vendors \
  -H "Content-Type: application/json" \
  -d '{
    "storeName": "TestStore",
    "contactEmail": "test@store.com",
    "adminEmail": "admin@teststore.com",
    "adminPassword": "Test@123"
  }'
```

---

## Troubleshooting

**Issue**: Super admin seed fails
**Fix**: Check database connection and ensure User table exists

**Issue**: Login returns 401
**Fix**: Verify JWT secret is configured in .env

**Issue**: Vendor admin can see all products
**Fix**: Ensure you're checking `user.vendorId` in queries

---

## Support

For questions or issues, check:
1. Database migrations are run
2. JWT_SECRET is set in .env
3. Super admin is seeded
4. Auth guards are applied to routes
