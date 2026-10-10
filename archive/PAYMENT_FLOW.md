# Payment Flow Documentation

## Overview
This document explains how payment status is managed in the marketplace system, particularly with Razorpay integration.

## Payment Status Flow

### 1. Order Creation
When an order is created ([orders.service.ts](src/modules/orders/orders.service.ts#L150)):
- Initial `paymentStatus` is set to `PENDING` for all payment methods (COD and Razorpay)
- A corresponding `Payment` entity is created in the database

### 2. Payment Initiation (Razorpay)
When customer initiates Razorpay payment:
1. Frontend calls `createRazorpayOrder` to get Razorpay order ID
2. Razorpay checkout modal opens
3. Customer completes payment with Razorpay

### 3. Payment Verification (AUTOMATIC)
After successful Razorpay payment ([payments.service.ts](src/modules/payments/payments.service.ts#L106-L145)):

**What happens automatically:**
1. Frontend receives Razorpay response with:
   - `razorpay_order_id`
   - `razorpay_payment_id`
   - `razorpay_signature`

2. Frontend calls `/api/v1/payments/verify` endpoint

3. Backend `PaymentsService.updatePaymentStatus()` method:
   - Verifies signature with Razorpay
   - Updates `Payment` entity status to `CAPTURED`
   - **Automatically updates `Order.paymentStatus` to `paid`** ✅

**Code Flow:**
```typescript
// When payment is successful:
payment.status = PaymentStatus.CAPTURED;
payment.gatewayPaymentId = razorpayPaymentId;
payment.gatewaySignature = razorpaySignature;
payment.capturedAt = new Date();

// Automatically update order payment status
await this.ordersService.updatePaymentStatus(payment.orderId, 'paid');
```

### 4. Payment Failure Handling
If payment fails:
- `Payment` entity status set to `FAILED`
- **Order payment status automatically set to `failed`** ✅

## Order Payment Status Values

| Status | Description | When Set |
|--------|-------------|----------|
| `pending` | Payment not completed | Order creation |
| `paid` | Payment successfully captured | Automatic after Razorpay verification |
| `failed` | Payment failed | Automatic after payment failure |
| `refunded` | Payment refunded | Manual by admin |

## Invoice Generation Requirements

Invoices are automatically generated for orders that meet **BOTH** criteria:
1. `order.status = 'delivered'`
2. `order.paymentStatus = 'paid'` ✅

**This is now handled automatically!**

## COD (Cash on Delivery) Payment Flow

For COD orders:
1. Order created with `paymentStatus = 'pending'`
2. Admin must manually update payment status to `paid` after receiving payment
3. Can be updated via Admin GUI → Orders → Payment Status dropdown

## Manual Payment Status Update (Admin)

Admins can manually update payment status via:
- **GUI:** Admin Orders page → Payment Status dropdown
- **API:** `PUT /api/v1/orders/:id/payment-status`

Use cases:
- COD payment confirmation
- Manual payment corrections
- Refund processing

## Implementation Details

### Module Dependencies
To avoid circular dependencies, modules use `forwardRef`:

```typescript
// payments.module.ts
imports: [
  forwardRef(() => OrdersModule),
]

// orders.module.ts
imports: [
  forwardRef(() => PaymentsModule),
]
```

### Service Injection
```typescript
// payments.service.ts
constructor(
  @Inject(forwardRef(() => OrdersService))
  private ordersService: OrdersService,
) {}
```

## Summary

✅ **Payment status IS automatically set by Razorpay response**
- When Razorpay payment succeeds, order payment status is automatically updated to `paid`
- When Razorpay payment fails, order payment status is automatically updated to `failed`
- No manual intervention needed for Razorpay payments
- Manual update only needed for COD orders

## Testing Checklist

- [ ] Place order with Razorpay payment
- [ ] Complete payment successfully
- [ ] Verify order payment status is `paid`
- [ ] Change order status to `delivered`
- [ ] Run invoice auto-generation
- [ ] Verify invoices are created for the order
