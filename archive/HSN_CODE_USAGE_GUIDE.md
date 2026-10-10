# HSN Code Usage Guide

## Overview
HSN (Harmonized System of Nomenclature) codes are used to classify products for GST taxation in India. This guide explains how vendors use HSN codes in your marketplace.

## How It Works

### 1. **Vendor Creates Product**
When adding a product, the vendor:
- Enters product name (e.g., "Men's Cotton T-Shirt")
- Searches for HSN code using autocomplete
- Types "tshirt" or "6109" → System shows suggestions
- Selects correct HSN code → GST rate auto-fills

### 2. **HSN Code Search**
Vendors can search by:
- **Code**: "6109" → Shows T-shirts (5% GST)
- **Description**: "smartphone" → Shows 8517 (18% GST)
- **Category**: Browse Electronics, Apparel, Food, etc.

### 3. **Auto GST Rate**
When HSN code is selected:
- System fetches recommended GST rate
- Pre-fills GST rate field (vendor can override if needed)
- Shows product category for reference

### 4. **Invoice Generation**
HSN codes appear on invoices:
```
Item: Men's Cotton T-Shirt
HSN: 6109
Qty: 2
Rate: ₹500
GST @5%: ₹50
Total: ₹1,050
```

## Common HSN Codes in Your Database

| HSN Code | Description | GST Rate | Category |
|----------|-------------|----------|----------|
| 6109 | T-shirts, vests | 5% | Apparel |
| 6203 | Men's suits, jackets | 12% | Apparel |
| 6403 | Footwear | 18% | Footwear |
| 8517 | Smartphones, phones | 18% | Electronics |
| 8528 | TVs, monitors | 18% | Electronics |
| 3304 | Cosmetics | 18% | Cosmetics |
| 4901 | Printed books | 0% | Books |
| 0401 | Milk | 0% | Food |
| 1905 | Biscuits, cakes | 18% | Food |
| 3004 | Medicines | 5% | Healthcare |
| 9403 | Furniture | 18% | Furniture |
| 8703 | Motor cars | 28% | Automobiles |

## API Endpoints

### Search HSN Codes
```
GET /api/v1/hsn-codes/search?q=tshirt&limit=10
```
Returns matching HSN codes for autocomplete.

### Get HSN Details
```
GET /api/v1/hsn-codes/6109
```
Returns full details of HSN code 6109.

### Get Recommended GST Rate
```
GET /api/v1/hsn-codes/6109/gst-rate
```
Returns: `{ "hsnCode": "6109", "recommendedGstRate": 5 }`

### Get Categories
```
GET /api/v1/hsn-codes/meta/categories
```
Returns all available categories.

### Smart Suggestions
```
GET /api/v1/hsn-codes/meta/suggest?name=Cotton+Tshirt&description=Mens+casual+wear
```
AI-powered suggestions based on product details.

## Usage in Product Form

### Step 1: Add Component to Product Form
```tsx
import HsnCodeAutocomplete from '@/components/HsnCodeAutocomplete';

// In your form state
const [formData, setFormData] = useState({
  name: '',
  price: '',
  hsnCode: '',
  gstRate: 18, // Default
  priceType: 'selling_price_without_gst',
  // ... other fields
});

// In your JSX
<div>
  <label>HSN Code (Optional)</label>
  <HsnCodeAutocomplete
    value={formData.hsnCode}
    onSelect={(hsnCode, recommendedGstRate) => {
      setFormData({
        ...formData,
        hsnCode,
        gstRate: recommendedGstRate,
      });
    }}
    placeholder="Search by HSN code or product type..."
  />
</div>
```

### Step 2: GST Rate Field Auto-Fills
```tsx
<div>
  <label>GST Rate (%)</label>
  <select
    value={formData.gstRate}
    onChange={(e) => setFormData({ ...formData, gstRate: parseFloat(e.target.value) })}
  >
    <option value="0">0% - Essential Items</option>
    <option value="5">5% - Basic Goods</option>
    <option value="12">12% - Standard Items</option>
    <option value="18">18% - Most Products (Default)</option>
    <option value="28">28% - Luxury Items</option>
  </select>
  <p className="text-xs text-gray-500">
    Auto-filled from HSN code. You can change if needed.
  </p>
</div>
```

## Validation Rules

1. **HSN Code Format**: 4-8 digits only
2. **GST Rate**: Must be one of: 0, 5, 12, 18, 28
3. **Optional Field**: HSN code is optional but recommended for compliance
4. **Invoice Requirement**: If order value > ₹50,000, HSN code is mandatory

## Benefits for Vendors

1. **Automatic GST Calculation**: No manual calculation needed
2. **Compliance**: Proper tax classification for filing
3. **Invoice Accuracy**: Professional GST-compliant invoices
4. **Tax Filing**: Easy GSTR-1 report generation
5. **Error Reduction**: Reduces wrong GST rate application

## Benefits for Marketplace

1. **Tax Compliance**: Meet Indian GST regulations
2. **Audit Trail**: Complete record of tax classifications
3. **Reports**: Generate tax reports by HSN category
4. **Vendor Support**: Help vendors with correct tax rates

## Example Workflow

### Scenario: Vendor Adding a Smartphone

1. Vendor fills product name: "Samsung Galaxy S23"
2. Vendor clicks HSN field → Types "smart"
3. Autocomplete shows:
   - **8517** - Smartphones (18% GST) ✓
4. Vendor selects 8517
5. System auto-fills: GST Rate = 18%
6. Vendor continues with price, images, etc.
7. Product saved with HSN 8517
8. When order is placed → Invoice shows:
   ```
   Samsung Galaxy S23
   HSN: 8517
   Price: ₹70,000
   CGST @9%: ₹6,300
   SGST @9%: ₹6,300
   Total: ₹82,600
   ```

## Optional vs Mandatory

**Currently Optional** - Vendors can skip HSN code
**Recommended to make Mandatory for:**
- Products > ₹1,000
- B2B orders
- Products requiring tax compliance

You can enforce this with validation:
```typescript
if (formData.price > 1000 && !formData.hsnCode) {
  alert('HSN code is required for products above ₹1,000');
  return;
}
```

## Admin Functions

### Add New HSN Codes
Admins can add industry-specific HSN codes:
```sql
INSERT INTO hsn_codes (code, description, "recommendedGstRate", category)
VALUES ('9999', 'Custom Product Type', 18, 'Other');
```

### Update GST Rates
When government changes rates:
```sql
UPDATE hsn_codes 
SET "recommendedGstRate" = 12 
WHERE code = '6109';
```

### View Usage Statistics
```sql
SELECT 
  h.code, 
  h.description, 
  COUNT(p.id) as product_count
FROM hsn_codes h
LEFT JOIN products p ON p."hsnCode" = h.code
GROUP BY h.code, h.description
ORDER BY product_count DESC;
```

## Testing

### Test HSN Search
```bash
curl "http://localhost:3001/api/v1/hsn-codes/search?q=tshirt"
```

### Test Auto GST Rate
```bash
curl "http://localhost:3001/api/v1/hsn-codes/6109/gst-rate"
```

## Next Steps

1. ✅ HSN codes table created with 40+ common codes
2. ✅ HSN service and controller implemented
3. ✅ Autocomplete component created
4. 🔄 TODO: Add to product form
5. 🔄 TODO: Show on invoices
6. 🔄 TODO: Use in GST reports

---

**Quick Reference**: HSN = Product Classification | Auto GST Rate | Invoice Compliance
