# Billing Address Feature

## Overview
The marketplace now supports separate billing and shipping addresses during checkout, providing customers with flexibility in how they receive orders and receive invoices.

## Features

### 1. Separate Billing Address Option
- Customers can choose to use a different billing address from their shipping address
- Default behavior: Billing address is the same as shipping address (checkbox checked)
- Option to uncheck and specify a different billing address

### 2. Address Management
- Use existing saved addresses for billing
- Add new billing address on the fly
- Edit or delete saved billing addresses
- Set default billing address

### 3. Invoice Generation
- Customer invoices now display separate billing and shipping addresses
- Three-column layout: Sold By | Billing Address | Shipping Address
- Amazon/Flipkart compliant invoice format

## User Experience

### Checkout Flow

1. **Shipping Address Section**
   - Customer selects or adds shipping address
   - Required fields: Full Name, Phone, Address, City, State, Postal Code, Country

2. **Billing Address Section**
   - Default: Checkbox "Billing address is same as shipping address" is checked
   - When checked: Billing address automatically syncs with shipping address
   - When unchecked: Second address form appears for billing address selection

3. **Validation**
   - Shipping address validation (always required)
   - Billing address validation (required only if different from shipping)
   - Both addresses must be complete before proceeding to payment

## Technical Implementation

### Frontend (marketplace-web)

#### Checkout Page Changes
**File:** `src/app/checkout/page.tsx`

```typescript
// State management
const [shippingAddress, setShippingAddress] = useState<Address>({...});
const [billingAddress, setBillingAddress] = useState<Address>({...});
const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);

// Sync billing with shipping when checkbox is checked
useEffect(() => {
  if (billingSameAsShipping) {
    setBillingAddress(shippingAddress);
  }
}, [billingSameAsShipping, shippingAddress]);

// Order submission includes both addresses
const orderData = {
  items: [...],
  shippingAddress: shippingAddress,
  billingAddress: billingSameAsShipping ? shippingAddress : billingAddress,
  paymentMethod,
  ...
};
```

#### UI Components
- Checkbox control for "Billing address is same as shipping"
- Conditional rendering of billing address form
- Two instances of AddressManager component (one for shipping, one for billing)

### Backend (marketplace-backend)

#### Order Entity
**File:** `src/modules/orders/order.entity.ts`

New fields added:
```typescript
@Column({ default: true, name: 'billing_address_same_as_shipping' })
billingAddressSameAsShipping: boolean;

@Column({ nullable: true, name: 'billing_name' })
billingName: string;

@Column({ nullable: true, name: 'billing_email' })
billingEmail: string;

@Column({ nullable: true, name: 'billing_phone' })
billingPhone: string;

@Column({ type: 'text', nullable: true, name: 'billing_address' })
billingAddress: string;

@Column({ nullable: true, name: 'billing_city' })
billingCity: string;

@Column({ nullable: true, name: 'billing_state' })
billingState: string;

@Column({ nullable: true, name: 'billing_country' })
billingCountry: string;

@Column({ nullable: true, name: 'billing_postal_code' })
billingPostalCode: string;
```

#### Orders Service
**File:** `src/modules/orders/orders.service.ts`

```typescript
// Accepts billingAddress in createOrderDto
async create(userId: string, createOrderDto: any) {
  const { items, shippingAddress, billingAddress, ... } = createOrderDto;
  
  // Order creation with billing fields
  const order = this.orderRepository.create({
    ...
    shippingName: shippingAddress.fullName,
    shippingEmail: shippingAddress.email,
    shippingPhone: shippingAddress.phone,
    shippingAddress: `${shippingAddress.addressLine1}...`,
    // Billing fields (fallback to shipping if not provided)
    billingName: billingAddress?.fullName || shippingAddress.fullName,
    billingEmail: billingAddress?.email || shippingAddress.email,
    billingPhone: billingAddress?.phone || shippingAddress.phone,
    billingAddress: billingAddress ? `${billingAddress.addressLine1}...` : ...,
    ...
  });
}
```

#### Invoice Service
**File:** `src/modules/invoices/invoices.service.ts`

```typescript
// Uses order's billing fields for invoice
billingName: order.billingName || order.shippingName,
billingEmail: order.billingEmail || order.shippingEmail,
billingPhone: order.billingPhone || order.shippingPhone,
billingAddress: order.billingAddress || order.shippingAddress,
// ... shipping fields remain separate
```

### Database Schema

#### Orders Table
```sql
-- Billing Information
billing_address_same_as_shipping BOOLEAN DEFAULT TRUE,
billing_name VARCHAR(255),
billing_email VARCHAR(255),
billing_phone VARCHAR(20),
billing_address TEXT,
billing_city VARCHAR(100),
billing_state VARCHAR(100),
billing_postal_code VARCHAR(20),
billing_country VARCHAR(100),
```

## Migration

### For Existing Databases

Run the migration script to add new billing contact fields:

```bash
# Using JavaScript migration
node add-billing-contact-fields.js

# Or using SQL migration
psql -U postgres -d marketplace -f add-billing-contact-fields.sql
```

The migration will:
1. Add `billing_name`, `billing_email`, `billing_phone` columns
2. Copy shipping contact info to billing contact info for existing orders
3. Add column comments for documentation

### For Fresh Installations

The `init-database.sql` script already includes all billing fields, so no migration needed.

## API Changes

### Create Order Endpoint
**POST** `/api/v1/orders`

Request body now accepts:
```json
{
  "items": [...],
  "shippingAddress": {
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+91-9876543210",
    "addressLine1": "123 Main St",
    "addressLine2": "Apt 4B",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postalCode": "400001",
    "country": "India"
  },
  "billingAddress": {
    // Same structure as shippingAddress
    // Can be omitted or same as shippingAddress if billing is same as shipping
  },
  "paymentMethod": "cod",
  "subtotal": 1000,
  "shippingCost": 50,
  "tax": 180,
  "totalAmount": 1230
}
```

## Testing Checklist

### Frontend Testing
- [ ] Checkbox defaults to checked
- [ ] Billing address syncs with shipping when checked
- [ ] Billing address form appears when unchecked
- [ ] Can select saved billing address
- [ ] Can add new billing address
- [ ] Validation works for both addresses
- [ ] Order submits with correct addresses

### Backend Testing
- [ ] Order creation accepts billingAddress field
- [ ] Order saves billing fields to database
- [ ] Billing fields populated correctly when same as shipping
- [ ] Billing fields populated correctly when different from shipping
- [ ] Invoice uses correct billing address
- [ ] Invoice PDF displays both addresses in three columns

### Database Testing
- [ ] Migration adds new columns
- [ ] Existing orders updated with billing contact info
- [ ] New orders save billing fields correctly
- [ ] Queries work with new fields

## Backward Compatibility

- Existing orders without billing fields will display shipping address as billing
- API accepts orders without explicit billingAddress (uses shipping)
- Frontend defaults to "same as shipping" for smooth user experience
- Migration automatically populates billing contact fields for existing orders

## Future Enhancements

1. **Address Type Labels**: Mark saved addresses as "Billing", "Shipping", or "Both"
2. **Quick Address Toggle**: Button to swap shipping and billing addresses
3. **Address Validation**: Integrate with address verification services
4. **International Support**: Better handling of international address formats
5. **Tax Calculation**: Use billing address for tax jurisdiction determination
6. **Business Addresses**: Support for business/company billing addresses with tax IDs

## Support

For questions or issues related to the billing address feature:
- Check the database migration logs
- Verify entity field mappings
- Review invoice PDF generation
- Test address synchronization logic
