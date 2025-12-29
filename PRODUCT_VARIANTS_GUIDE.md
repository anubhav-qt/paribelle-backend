# Product Variants Implementation Guide

## Overview
This guide explains the custom product variants feature that allows vendors to create products with multiple options (Size, Color, Material, Packet Size, etc.) independent of category attributes.

## Database Schema

### product_variants Table
```sql
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  productId UUID REFERENCES products(id) ON DELETE CASCADE,
  variantAttributes JSONB NOT NULL, -- e.g., {"size": "M", "color": "Red"}
  sku VARCHAR UNIQUE NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stockQuantity INTEGER DEFAULT 0,
  images TEXT[],
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_product_variants_product_id ON product_variants(productId);
CREATE UNIQUE INDEX idx_product_variants_sku ON product_variants(sku);
```

### products Table Extensions
```sql
ALTER TABLE products ADD COLUMN hasVariants BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN variantOptions JSONB; -- e.g., [{"id": "opt1", "name": "Size", "values": ["S", "M", "L"]}]
```

## Features

### 1. Dynamic Variant Types
- Vendors can add custom variant types (Size, Color, Material, Packet Size, Weight, Flavor, etc.)
- No dependency on category attributes
- Flexible for any product type

### 2. Multiple Values per Type
- Each variant type can have unlimited values
- Example: Size → S, M, L, XL, XXL

### 3. Auto-generate Combinations
- System automatically creates all possible combinations
- Example: 3 colors × 4 sizes = 12 unique variants
- Uses Cartesian product algorithm

### 4. Individual Variant Control
- Unique SKU for each combination
- Individual price override
- Separate stock tracking
- Enable/disable specific combinations

### 5. Bulk Operations
- Apply same price to all variants
- Set stock levels in bulk
- Quick inventory management

## Frontend Usage

### Component: ProductVariantManager

**Location:** `marketplace-web/src/components/ProductVariantManager.tsx`

**Props:**
```typescript
interface ProductVariantManagerProps {
  onVariantsChange: (options: VariantOption[], combinations: VariantCombination[]) => void;
  initialOptions?: VariantOption[];
  initialCombinations?: VariantCombination[];
}
```

**Usage Example:**
```tsx
<ProductVariantManager
  onVariantsChange={(options, combinations) => {
    setVariantOptions(options);
    setVariantCombinations(combinations);
  }}
  initialOptions={[]}
  initialCombinations={[]}
/>
```

### Integration in Product Form

**File:** `marketplace-web/src/app/vendor/products/add/page.tsx`

**State Management:**
```typescript
const [hasCustomVariants, setHasCustomVariants] = useState(false);
const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
const [variantCombinations, setVariantCombinations] = useState<VariantCombination[]>([]);
```

**Submission:**
```typescript
if (hasCustomVariants && variantOptions.length > 0) {
  productData.hasVariants = true;
  productData.variantOptions = variantOptions;
  productData.variants = variantCombinations.filter(v => v.enabled).map(combo => ({
    attributes: combo.attributes,
    sku: combo.sku,
    price: combo.price,
    stock: combo.stock,
  }));
}
```

## Backend Implementation

### Entity: ProductVariant

**File:** `marketplace-backend/src/modules/products/product-variant.entity.ts`

**Key Fields:**
- `productId`: Parent product UUID
- `variantAttributes`: JSONB storing variant attributes (e.g., `{"size": "M", "color": "Red"}`)
- `sku`: Unique identifier
- `price`: Variant-specific price
- `stockQuantity`: Individual stock level
- `isActive`: Enable/disable flag

### Service: ProductsService

**File:** `marketplace-backend/src/modules/products/products.service.ts`

**Variant Creation Logic:**
```typescript
if (variants && Array.isArray(variants) && variants.length > 0) {
  for (const variant of variants) {
    const productVariant = this.productVariantsRepository.create({
      productId: parentProduct.id,
      variantAttributes: variant.attributes,
      sku: variant.sku,
      price: variant.price,
      stockQuantity: variant.stock,
      isActive: true,
    });
    
    await this.productVariantsRepository.save(productVariant);
  }
}
```

## API Endpoints

### Create Product with Variants

**Endpoint:** `POST /api/v1/products`

**Request Body:**
```json
{
  "name": "Premium Coffee Beans",
  "description": "High-quality coffee beans",
  "price": 500,
  "hasVariants": true,
  "variantOptions": [
    {
      "id": "opt_roast",
      "name": "Roast",
      "values": ["Light", "Medium", "Dark"]
    },
    {
      "id": "opt_size",
      "name": "Size",
      "values": ["250g", "500g", "1kg"]
    }
  ],
  "variants": [
    {
      "attributes": {"Roast": "Light", "Size": "250g"},
      "sku": "COFFEE-LIGHT-250",
      "price": 300,
      "stock": 50
    },
    {
      "attributes": {"Roast": "Medium", "Size": "500g"},
      "sku": "COFFEE-MED-500",
      "price": 550,
      "stock": 30
    }
    // ... more combinations
  ]
}
```

**Response:**
```json
{
  "id": "product-uuid",
  "name": "Premium Coffee Beans",
  "hasVariants": true,
  "variantOptions": [...],
  "createdAt": "2025-12-29T..."
}
```

### Get Product with Variants

**Endpoint:** `GET /api/v1/products/:id`

**Response includes:**
- Product details
- `hasVariants` flag
- `variantOptions` array
- Related `variants` (fetched via relation)

## Use Cases

### Example 1: T-Shirt with Size and Color
```
Variant Types:
- Size: S, M, L, XL
- Color: Red, Blue, Black, White

Generated Combinations: 4 sizes × 4 colors = 16 variants
Each variant has unique SKU, price, and stock
```

### Example 2: Coffee Beans
```
Variant Types:
- Roast Level: Light, Medium, Dark
- Pack Size: 250g, 500g, 1kg

Generated Combinations: 3 roasts × 3 sizes = 9 variants
Larger packs can have different pricing (e.g., 1kg = better per-gram price)
```

### Example 3: Mobile Phone Accessories
```
Variant Types:
- Color: Black, Silver, Rose Gold
- Material: Leather, Silicone, Hard Plastic

Generated Combinations: 3 colors × 3 materials = 9 variants
Premium materials (leather) priced higher than others
```

### Example 4: Food Products
```
Variant Types:
- Flavor: Chocolate, Vanilla, Strawberry
- Size: 100g, 250g, 500g
- Type: Regular, Sugar-Free

Generated Combinations: 3 flavors × 3 sizes × 2 types = 18 variants
Complex inventory management with health-conscious options
```

## Best Practices

### 1. SKU Naming Convention
- Use consistent format: `{VENDOR}-{PRODUCT}-{VARIANT}`
- Example: `VENDOR123-TSHIRT-RED-M`
- Makes inventory tracking easier

### 2. Pricing Strategy
- Base price on parent product
- Adjust individual variants as needed
- Bulk pricing discounts (larger sizes cheaper per unit)

### 3. Stock Management
- Start with conservative stock levels
- Monitor best-selling combinations
- Disable slow-moving variants instead of deleting

### 4. Variant Type Names
- Keep names clear and consistent
- Use singular form: "Size" not "Sizes"
- Match customer expectations (Color vs Colour)

### 5. Performance
- Limit variant combinations to reasonable numbers (<50)
- Too many combinations = poor UX
- Consider splitting into separate products if needed

## Differences from Category-Based Variations

| Feature | Custom Variants | Category Variations |
|---------|----------------|---------------------|
| **Dependency** | Independent | Requires category attributes |
| **Flexibility** | Fully customizable | Limited to category filters |
| **Use Case** | Any product type | Category-specific products |
| **Storage** | `product_variants` table | Child products with `parentProductId` |
| **Attributes** | JSONB object | Category filter values |
| **Performance** | Single table joins | Multiple product records |

## Troubleshooting

### Issue: No Combinations Generated
**Cause:** Not all variant types have values added
**Solution:** Ensure every variant type has at least one value

### Issue: Duplicate SKU Error
**Cause:** SKU already exists in database
**Solution:** Use unique SKU format, include timestamp or random suffix

### Issue: Too Many Combinations
**Cause:** 5 types × 5 values each = 3,125 combinations
**Solution:** Reduce variant types or values, split into multiple products

### Issue: Price Calculations Wrong
**Cause:** Frontend not updating GST calculations
**Solution:** Ensure variant prices include GST based on parent product's GST settings

## Future Enhancements

1. **Variant Images:** Upload specific images for each combination
2. **Variant Descriptions:** Add unique descriptions per variant
3. **Variant Analytics:** Track which combinations sell best
4. **Conditional Variants:** Hide certain combinations (e.g., XL only in specific colors)
5. **Variant Import:** Bulk import via Excel with variant columns
6. **Min/Max Quantities:** Set min order quantities per variant

## Testing

### Test Cases

1. **Create product with 2×2 variants (4 combinations)**
   - Verify all combinations are saved
   - Check unique SKU constraint
   - Validate stock levels

2. **Bulk price update**
   - Apply price to all variants
   - Verify database update
   - Check frontend refresh

3. **Disable specific variant**
   - Set `isActive = false`
   - Verify hidden in product listing
   - Ensure SKU remains reserved

4. **Delete parent product**
   - Verify CASCADE delete removes variants
   - Check no orphaned variant records

5. **Frontend validation**
   - Empty variant type name
   - Duplicate variant values
   - Missing SKU or price

## Conclusion

The custom variant system provides vendors with maximum flexibility to create products that match real-world inventory scenarios. It's independent of category constraints, performant with JSONB storage, and user-friendly with auto-generation of combinations.

For questions or issues, refer to:
- Backend: `marketplace-backend/src/modules/products/`
- Frontend: `marketplace-web/src/components/ProductVariantManager.tsx`
- Database: `marketplace-backend/database/migrations/add-gst-invoice-fields.sql`
