# Razorpay Payment Gateway Integration Guide

## Overview

This marketplace platform integrates Razorpay for secure payment processing. This guide covers setup, configuration, and testing.

---

## 🚀 Quick Setup

### 1. Get Razorpay Account

1. Sign up at [https://razorpay.com/](https://razorpay.com/)
2. Complete KYC verification (for live mode)
3. Get your API credentials

### 2. Get API Keys

**Test Mode Keys (for development):**
1. Login to Razorpay Dashboard
2. Go to Settings → API Keys
3. Generate Test Keys
4. Copy:
   - `Key ID` (starts with `rzp_test_`)
   - `Key Secret`

**Live Mode Keys (for production):**
1. Complete KYC and activation
2. Switch to Live mode in dashboard
3. Generate Live Keys (starts with `rzp_live_`)

### 3. Configure Backend

Update `apps/backend/.env`:

```env
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID_HERE
RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET_HERE
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET_HERE
```

**To get Webhook Secret:**
1. Go to Settings → Webhooks
2. Add a new webhook endpoint: `https://yourdomain.com/api/v1/payments/webhook`
3. Select events: `payment.captured`, `payment.failed`, `refund.created`
4. Copy the webhook secret

---

## 📋 Features Implemented

### ✅ Payment Processing
- Create Razorpay orders
- Process online payments (UPI, Cards, Net Banking, Wallets)
- Payment signature verification
- Cash on Delivery (COD) support

### ✅ Security
- Server-side signature verification
- Webhook signature validation
- Secure payment token handling
- PCI-DSS compliant (via Razorpay)

### ✅ Refunds
- Full refunds
- Partial refunds
- Automatic refund status tracking

### ✅ Webhooks
- Automatic payment status updates
- Real-time payment notifications
- Refund status tracking

---

## 🔧 Backend Implementation

### Files Created/Modified:

1. **`apps/backend/src/modules/payments/payments.service.ts`**
   - Razorpay integration
   - Payment creation and verification
   - Refund processing
   - Webhook handling

2. **`apps/backend/src/modules/payments/payments.controller.ts`**
   - API endpoints for payment operations
   - Webhook endpoint

3. **`apps/backend/src/modules/payments/payments.module.ts`**
   - Module configuration

4. **`apps/backend/src/modules/payments/payment.entity.ts`**
   - Payment database schema (already existed)

### API Endpoints:

```
POST   /api/v1/payments/create-order       - Create Razorpay order
POST   /api/v1/payments/verify             - Verify payment
GET    /api/v1/payments/order/:orderId     - Get payment by order
POST   /api/v1/payments/refund/:paymentId  - Initiate refund
POST   /api/v1/payments/webhook            - Razorpay webhook
GET    /api/v1/payments/razorpay-key       - Get public key ID
```

---

## 🎨 Frontend Implementation

### Files Created:

1. **`apps/web/src/hooks/useRazorpay.ts`**
   - React hook for Razorpay integration
   - Script loading
   - Checkout modal handling
   - Payment verification

2. **`apps/web/src/app/checkout/page.tsx`** (updated)
   - Integrated Razorpay payment flow
   - Multi-step checkout
   - Payment success/failure handling

### Payment Flow:

```
1. User places order
   ↓
2. Backend creates Razorpay order
   ↓
3. Frontend opens Razorpay checkout modal
   ↓
4. User completes payment
   ↓
5. Razorpay returns payment details
   ↓
6. Backend verifies signature
   ↓
7. Order marked as paid
   ↓
8. User sees confirmation
```

---

## 🧪 Testing

### Test Mode Testing:

Razorpay provides test cards for different scenarios:

**Successful Payment:**
- Card Number: `4111 1111 1111 1111`
- CVV: Any 3 digits
- Expiry: Any future date

**Failed Payment:**
- Card Number: `4111 1111 1111 1234`
- CVV: Any 3 digits
- Expiry: Any future date

**Test UPI:**
- UPI ID: `success@razorpay`
- Will auto-approve

### Testing Webhooks Locally:

1. Use [ngrok](https://ngrok.com/) to expose local server:
   ```bash
   ngrok http 3001
   ```

2. Configure webhook URL in Razorpay:
   ```
   https://your-ngrok-url.ngrok.io/api/v1/payments/webhook
   ```

3. Test webhook events from Razorpay dashboard

---

## 💰 Payment Methods Supported

### Online Payment (via Razorpay):
- 💳 **Credit/Debit Cards** - Visa, Mastercard, Rupay, Amex
- 📱 **UPI** - Google Pay, PhonePe, Paytm, BHIM
- 🏦 **Net Banking** - 50+ banks
- 👛 **Wallets** - Paytm, PhonePe, Mobikwik, Freecharge
- 💵 **EMI** - Credit/Debit card EMI options

### Cash on Delivery:
- Pay when you receive the order

---

## 🔒 Security Best Practices

### ✅ Implemented:
- Server-side signature verification
- Webhook signature validation
- Secure token storage
- HTTPS required for production
- Environment variable configuration

### 🚨 Important:
- Never expose `RAZORPAY_KEY_SECRET` in frontend
- Always verify payment signatures on backend
- Use HTTPS in production
- Regularly rotate webhook secrets
- Monitor for suspicious transactions

---

## 🚀 Deployment Checklist

### Before Going Live:

- [ ] Complete Razorpay KYC verification
- [ ] Switch to Live API keys
- [ ] Update environment variables
- [ ] Configure production webhook URL
- [ ] Test full payment flow
- [ ] Set up SSL certificate (HTTPS)
- [ ] Test refund functionality
- [ ] Set up payment monitoring
- [ ] Configure payment retry logic
- [ ] Set up customer support for payment issues

### Environment Variables (Production):

```env
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=YYYYYYYYYYYYYY
RAZORPAY_WEBHOOK_SECRET=ZZZZZZZZZZZZZZ
```

---

## 📊 Database Schema

### Payment Table:

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  transaction_id VARCHAR UNIQUE,
  amount DECIMAL(10,2),
  currency VARCHAR DEFAULT 'INR',
  method ENUM (razorpay, card, upi, net_banking, wallet, cod),
  status ENUM (pending, authorized, captured, failed, refunded, partially_refunded),
  gateway_order_id VARCHAR,
  gateway_payment_id VARCHAR,
  gateway_signature VARCHAR,
  refunded_amount DECIMAL(10,2) DEFAULT 0,
  refund_transaction_id VARCHAR,
  refunded_at TIMESTAMP,
  metadata JSON,
  failure_reason TEXT,
  authorized_at TIMESTAMP,
  captured_at TIMESTAMP,
  order_id UUID REFERENCES orders(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 🐛 Troubleshooting

### Common Issues:

**1. "Razorpay is not configured"**
- Check if API keys are set in `.env`
- Restart backend server after updating `.env`

**2. "Payment signature verification failed"**
- Ensure `RAZORPAY_KEY_SECRET` is correct
- Check if payment ID and order ID match

**3. "Razorpay SDK not loaded"**
- Check internet connection
- Verify Razorpay script is loading (check browser console)
- Clear browser cache

**4. Webhook not working**
- Verify webhook URL is accessible
- Check webhook secret matches
- Check webhook signature validation

**5. Payment stuck in pending**
- Check webhook is configured correctly
- Manually check payment status in Razorpay dashboard
- Verify database connection

---

## 📞 Support

### Razorpay Support:
- Dashboard: [https://dashboard.razorpay.com/](https://dashboard.razorpay.com/)
- Docs: [https://razorpay.com/docs/](https://razorpay.com/docs/)
- Support: [https://razorpay.com/support/](https://razorpay.com/support/)

### Test Resources:
- Test Cards: [https://razorpay.com/docs/payments/payments/test-card-details/](https://razorpay.com/docs/payments/payments/test-card-details/)
- API Reference: [https://razorpay.com/docs/api/](https://razorpay.com/docs/api/)

---

## 📈 Next Steps

1. ✅ Basic payment integration (Done)
2. ⏳ Order status automation
3. ⏳ Email notifications for payments
4. ⏳ Payment analytics dashboard
5. ⏳ Subscription/recurring payments
6. ⏳ International payments
7. ⏳ Payment links
8. ⏳ QR code payments

---

## 💡 Advanced Features (Future)

- **Payment Links**: Generate shareable payment links
- **Subscriptions**: Recurring billing
- **Smart Collect**: Virtual accounts for vendor payments
- **Route**: Split payments to vendors
- **International Payments**: Accept payments from abroad
- **Payment Analytics**: Detailed payment reports

---

Last Updated: December 2, 2024
