# Configurable Return Policy Implementation

## Overview
Implemented vendor-specific and platform-wide return policies to replace the hardcoded 7-day return window.

## Changes Made

### 1. Database Schema Changes

#### Vendor Entity (`vendor.entity.ts`)
Added two new fields:
- `returnPolicyDays` (INTEGER, default: 7) - Number of days after delivery for returns (0 = no returns)
- `allowReturns` (BOOLEAN, default: true) - Whether vendor accepts returns

#### Platform Settings Entity (`platform-settings.entity.ts`)
Added two new fields:
- `defaultReturnPolicyDays` (INTEGER, default: 7) - Default return policy for the marketplace
- `allowVendorCustomReturnPolicy` (BOOLEAN, default: true) - Allow vendors to override default policy

### 2. Migration Scripts

#### SQL Migration (`add-return-policy-columns.sql`)
- Adds return policy columns to both tables
- Sets default values for existing records

#### JavaScript Migration (`add-return-policy-columns.js`)
- Automated migration script
- Updates existing vendors and platform settings
- Provides migration status and next steps

**Run migration:**
```bash
node add-return-policy-columns.js
```

### 3. Backend Logic Changes

#### Orders Service (`orders.service.ts`)

**`requestReturn` method:**
- Loads product vendor information
- Checks vendor's `allowReturns` and `returnPolicyDays`
- Validates return window based on vendor-specific policy
- Returns detailed error messages with policy information

**`transformOrder` method:**
- Includes `returnPolicy` object in order response:
  ```typescript
  returnPolicy: {
    allowReturns: boolean,
    returnPolicyDays: number,
    vendorName: string
  }
  ```

### 4. Frontend Changes

#### Orders Page (`orders/page.tsx`)

**Updated Order Interface:**
- Added `returnPolicy` field with vendor-specific settings

**New Functions:**
- `canReturnOrder(order)` - Uses dynamic return policy from order
- `getReturnPolicyMessage(order)` - Shows vendor-specific return policy message

**UI Updates:**
- Return button only shows if vendor allows returns
- Tooltip displays vendor's return policy (e.g., "Return within 5 days")
- Confirmation dialog shows vendor name and their specific policy
- Handles edge cases (0 days = no returns, vendor doesn't accept returns)

## Business Rules

### Return Policy Hierarchy
1. **Vendor Level**: Each vendor can set their own return policy
2. **Platform Level**: Default policy applies if vendor hasn't set custom policy
3. **No Returns**: Setting `returnPolicyDays = 0` or `allowReturns = false` disables returns

### Stock Management
- Stock is restored immediately when return is requested
- Return status changes to `RETURNED`
- Credit note generated for paid orders

## Vendor Dashboard Integration

Vendors can now configure:
- Whether they accept returns (`allowReturns`)
- Return window in days (`returnPolicyDays`)
- Setting 0 days effectively disables returns

Example vendor policies:
- Electronics vendor: 15 days
- Fashion vendor: 30 days
- Custom products vendor: No returns (0 days)
- Food vendor: No returns allowed

## API Endpoints

### Get Order Details
```
GET /api/v1/orders/:id
```
Response includes:
```json
{
  "id": "...",
  "orderNumber": "...",
  "returnPolicy": {
    "allowReturns": true,
    "returnPolicyDays": 15,
    "vendorName": "Electronics Store"
  }
}
```

### Request Return
```
POST /api/v1/orders/:id/return
Body: { "reason": "..." }
```
Validates against vendor's return policy before processing.

## Testing Checklist

- [ ] Run migration script successfully
- [ ] Verify default values (7 days, returns allowed)
- [ ] Test vendor with custom policy (e.g., 30 days)
- [ ] Test vendor with no returns (0 days)
- [ ] Test vendor with returns disabled (allowReturns = false)
- [ ] Verify return button shows correct message
- [ ] Test return request within policy window
- [ ] Test return request after policy expires
- [ ] Verify stock restoration on return
- [ ] Check credit note generation

## Future Enhancements

1. **Admin Interface**: Add return policy settings to vendor admin dashboard
2. **Platform Settings Page**: Allow platform admin to set default policy
3. **Category-Specific Policies**: Different policies for different product categories
4. **Return Reasons**: Track common return reasons per vendor
5. **Return Analytics**: Dashboard showing return rates by vendor/product
6. **Email Notifications**: Send return policy reminders to customers
7. **Return Shipping**: Track return shipping and costs

## Migration Steps

1. **Run the migration:**
   ```bash
   cd marketplace-backend
   node add-return-policy-columns.js
   ```

2. **Restart backend services:**
   ```bash
   .\restart-services.ps1
   ```

3. **Restart frontend:**
   ```bash
   cd marketplace-web
   npm run dev
   ```

4. **Verify:**
   - Check vendor dashboard for return policy settings
   - Place a test order
   - Check return button tooltip shows correct policy
   - Test return request validation

## Notes

- Default policy is 7 days (backward compatible)
- Existing orders will use 7-day policy
- New orders will use vendor-specific policy
- Return button only appears for delivered orders with return policy > 0
- Multi-vendor orders will use the first product's vendor policy (enhancement needed for multi-vendor support)
