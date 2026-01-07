# Price Type Scenarios: Tax-Inclusive vs Tax-Exclusive

## Overview
The system supports two pricing models:
1. **mrp_with_gst** (Tax-Inclusive) - Default
2. **selling_price_without_gst** (Tax-Exclusive)

## Scenario 1: Tax-Inclusive Product (mrp_with_gst)

### Product Setup
```json
{
  "name": "Laptop Stand",
  "price": 100.00,
  "priceType": "mrp_with_gst",
  "gstRate": 18
}
```

### Customer Experience

**Product Page:** 
- Displays: **₹100.00**
- Customer sees final price

**Cart:**
- Item price: ₹100.00
- Quantity: 1
- Subtotal: ₹100.00
- Note: "Inclusive of all taxes"

**Checkout:**
- Subtotal: ₹100.00
  - • Base Price: ₹84.75
  - • GST (included): ₹15.25
- Shipping: ₹50.00
- **Total: ₹150.00**

### Calculation Logic
```javascript
itemTotal = 100.00
gstRate = 18

// Extract GST from inclusive price
basePrice = 100 / 1.18 = 84.75
gstAmount = 100 - 84.75 = 15.25
totalWithTax = 100.00 // No change

finalTotal = 100.00 + 50.00 = ₹150.00
```

---

## Scenario 2: Tax-Exclusive Product (selling_price_without_gst)

### Product Setup
```json
{
  "name": "Custom T-Shirt",
  "price": 100.00,
  "priceType": "selling_price_without_gst",
  "gstRate": 18
}
```

### Customer Experience

**Product Page:** 
- Displays: **₹100.00**
- ⚠️ Customer sees base price (GST will be added at checkout)

**Cart:**
- Item price: ₹100.00
- Quantity: 1
- Subtotal: ₹100.00
- ⚠️ Note should say: "GST will be calculated at checkout"

**Checkout:**
- Subtotal: ₹118.00 ✅
  - • Base Price: ₹100.00
  - • GST (18%): ₹18.00
- Shipping: ₹50.00
- **Total: ₹168.00**

### Calculation Logic
```javascript
itemTotal = 100.00
gstRate = 18

// Add GST on top of price
basePrice = 100.00
gstAmount = 100 × 0.18 = 18.00
totalWithTax = 100.00 + 18.00 = 118.00 ✅

finalTotal = 118.00 + 50.00 = ₹168.00
```

---

## Scenario 3: Mixed Cart (Both Types)

### Products
1. **Laptop Stand** - ₹100.00 (tax-inclusive, 18%)
2. **Custom T-Shirt** - ₹100.00 (tax-exclusive, 18%)

### Checkout Calculation

**Item 1 (Tax-Inclusive):**
```
Price: ₹100.00
Base: 100/1.18 = ₹84.75
GST: 100-84.75 = ₹15.25
With Tax: ₹100.00
```

**Item 2 (Tax-Exclusive):**
```
Price: ₹100.00
Base: ₹100.00
GST: 100×0.18 = ₹18.00
With Tax: ₹118.00
```

**Checkout Summary:**
- Subtotal: ₹218.00 (100 + 118)
  - • Base Price: ₹184.75 (84.75 + 100)
  - • GST: ₹33.25 (15.25 + 18)
- Shipping: FREE (over ₹500 threshold not met, but > ₹200)
- **Total: ₹268.00**

---

## Scenario 4: Zero GST Product (Tax-Exempt)

### Product Setup
```json
{
  "name": "Educational Book",
  "price": 500.00,
  "priceType": "mrp_with_gst",
  "gstRate": 0
}
```

### Checkout Calculation
```javascript
itemTotal = 500.00
gstRate = 0

// No tax to extract or add
basePrice = 500.00
gstAmount = 0.00
totalWithTax = 500.00

finalTotal = 500.00 + 0.00 (free shipping) = ₹500.00
```

---

## Scenario 5: Custom GST Rate (5%)

### Product Setup
```json
{
  "name": "Restaurant Meal",
  "price": 250.00,
  "priceType": "mrp_with_gst",
  "gstRate": 5
}
```

### Checkout Calculation
```javascript
itemTotal = 250.00
gstRate = 5

// Extract 5% GST
basePrice = 250 / 1.05 = 238.10
gstAmount = 250 - 238.10 = 11.90
totalWithTax = 250.00

finalTotal = 250.00 + 50.00 = ₹300.00
```

---

## Backend Order Creation

### What Gets Sent
```json
{
  "items": [
    {
      "productId": "uuid",
      "quantity": 1,
      "price": 100.00  // Original price from product
    }
  ],
  "subtotal": 184.75,    // Total base price (before tax)
  "tax": 33.25,          // Total GST amount
  "shippingCost": 50.00,
  "totalAmount": 268.00  // subtotal + tax + shipping
}
```

### Backend Processing
The backend receives these values and stores them in the order:
- Uses `subtotal` as the base amount
- Uses `tax` as the GST amount
- Calculates commission from `total`
- Generates invoices with proper tax breakdown

---

## Key Differences

| Aspect | Tax-Inclusive | Tax-Exclusive |
|--------|---------------|---------------|
| Price shown | Final price | Base price |
| Cart total | Same as shown | Higher than shown |
| GST calculation | Extract from price | Add to price |
| Customer surprise | None | Price increases at checkout ⚠️ |
| Recommended | ✅ Yes | ⚠️ Use with caution |

---

## Recommendation

**Always use `mrp_with_gst` (tax-inclusive) for better customer experience:**

✅ No surprises at checkout
✅ Clear pricing (what you see is what you pay)
✅ Industry standard for e-commerce
✅ Better conversion rates

**Only use `selling_price_without_gst` if:**
- B2B marketplace where businesses expect base pricing
- Legal requirement to show pre-tax pricing
- Specific industry norms require it

⚠️ **If using tax-exclusive pricing, clearly indicate "Plus GST" or "Taxes Extra" on product pages!**

---

## System Behavior

### Default (No priceType specified)
```javascript
priceType: 'mrp_with_gst'  // ✅ Tax-inclusive by default
gstRate: 18                 // ✅ 18% GST by default
```

### Validation Layers
1. Database entity defaults
2. Service layer enforcement
3. Frontend fallbacks
4. Checkout safeguards

**Result:** System always works correctly, regardless of how product was created!
