# Product Variations Feature

## Overview

The Product Variations feature enables vendors to create products with multiple options (like color, size, material, etc.) similar to Amazon's product variation system. Each variation can have:
- Different stock quantities
- Different prices
- Different images
- Unique SKUs

## Architecture

### Backend Changes

#### 1. Database Schema
New columns added to `products` table:
- `isParent`: Boolean flag indicating if this is a parent product with variations
- `parentProductId`: UUID reference to the parent product (for variation products)
- `variationThemes`: Array of attribute types (e.g., ['color', 'size'])
- `variationAttributes`: JSONB object storing specific values (e.g., {color: 'red', size: 'M'})

#### 2. Product Entity ([product.entity.ts](marketplace-backend/src/modules/products/product.entity.ts))
```typescript
@Column({ default: false })
isParent: boolean;

@Column({ nullable: true })
parentProductId: string;

@ManyToOne(() => Product, (product) => product.variations)
parentProduct: Product;

@OneToMany(() => Product, (product) => product.parentProduct)
variations: Product[];

@Column('simple-array', { nullable: true })
variationThemes: string[];

@Column({ type: 'jsonb', nullable: true })
variationAttributes: Record<string, string>;
```

#### 3. Product Service ([products.service.ts](marketplace-backend/src/modules/products/products.service.ts))
New methods:
- `findVariations(parentProductId)`: Get all variations for a parent product
- `findVariationByAttributes(parentProductId, attributes)`: Find specific variation by attributes

Enhanced `create()` method to automatically create child variation products.

### Frontend Changes

#### 1. Variation Builder Component ([ProductVariationBuilder.tsx](marketplace-web/src/components/ProductVariationBuilder.tsx))
Interactive UI for creating product variations:
- Select which category attributes to use as variations
- Choose specific options for each variation theme
- Auto-generate all possible combinations
- Edit individual variation properties (SKU, price, stock, images)

#### 2. Product Add Form ([vendor/products/add/page.tsx](marketplace-web/src/app/vendor/products/add/page.tsx))
- Checkbox to enable variations
- Integration with ProductVariationBuilder
- Hides stock quantity field when variations are enabled (stock is tracked per variation)
- Sends variations array to backend

#### 3. Variation Selector Component ([VariationSelector.tsx](marketplace-web/src/components/VariationSelector.tsx))
Customer-facing variation picker:
- Shows color swatches for color attributes
- Shows buttons for other attributes (size, material, etc.)
- Disables out-of-stock options
- Updates price based on selected variation
- Visual feedback for selected options

#### 4. Product Detail Page ([products/[slug]/page.tsx](marketplace-web/src/app/products/[slug]/page.tsx))
- Renders VariationSelector for products with variations
- Updates stock quantity based on selected variation
- Disables "Add to Cart" until all options are selected
- Uses correct variation ID when adding to cart

#### 5. Product Grid ([ProductGrid.tsx](marketplace-web/src/components/ProductGrid.tsx))
- Shows "X options available" indicator for parent products

#### 6. Vendor Products List ([vendor/products/page.tsx](marketplace-web/src/app/vendor/products/page.tsx))
- Shows variation count badge on parent products
- Shows "(Variant)" label on child products
- Displays variation attributes for child products

## How to Use

### Creating a Product with Variations

1. **Add a New Product**
   - Navigate to Vendor Dashboard → Products → Add Product
   - Fill in basic product information (name, description, categories, etc.)
   - Select at least one category that has filters/attributes configured

2. **Enable Variations**
   - Check the "This product has multiple options" checkbox
   - The Variation Builder section will appear

3. **Configure Variations**
   - Select which attributes to use as variations (e.g., Color, Size)
   - For each selected attribute, choose the specific options you want to offer
   - The system will auto-generate all possible combinations

4. **Customize Variations**
   - Review the generated variations
   - Edit individual SKUs if needed
   - Set specific prices for variations (defaults to base price)
   - Set stock quantities for each variation
   - Optionally add variation-specific images

5. **Submit**
   - Click "Create Product"
   - The system creates one parent product + all variation child products

### Customer Experience

1. **Browsing Products**
   - Products with variations show "X options available" on cards
   
2. **Viewing Product Details**
   - Variation selector appears below the price
   - Customer must select all options (color, size, etc.)
   - Price and stock update based on selection
   - "Add to Cart" disabled until all options selected

3. **Adding to Cart**
   - Selected variation is added to cart with specific attributes
   - Cart shows variation details (e.g., "T-Shirt - Red - Medium")

## Database Migration

The variation columns have been added to the database. If you need to run it manually:

```bash
cd marketplace-backend
node add-variation-columns.js
```

Or use the TypeORM migration:
```bash
npm run migration:run
```

## API Changes

### Creating a Product with Variations

**POST** `/api/v1/products`

```json
{
  "name": "Premium T-Shirt",
  "slug": "premium-tshirt",
  "description": "High quality cotton t-shirt",
  "price": 29.99,
  "sku": "TSHIRT-BASE",
  "categoryIds": ["..."],
  "variations": [
    {
      "attributes": { "color": "red", "size": "S" },
      "sku": "TSHIRT-RED-S",
      "price": 29.99,
      "stockQuantity": 50,
      "images": []
    },
    {
      "attributes": { "color": "red", "size": "M" },
      "sku": "TSHIRT-RED-M",
      "price": 29.99,
      "stockQuantity": 75,
      "images": []
    }
  ],
  "variationThemes": ["color", "size"]
}
```

### Fetching Product with Variations

**GET** `/api/v1/products/:id` or `/api/v1/products/slug/:slug`

Response includes:
```json
{
  "id": "...",
  "name": "Premium T-Shirt",
  "isParent": true,
  "variationThemes": ["color", "size"],
  "variations": [
    {
      "id": "...",
      "parentProductId": "...",
      "variationAttributes": { "color": "red", "size": "S" },
      "price": 29.99,
      "stockQuantity": 50
    }
  ]
}
```

## Best Practices

1. **Category Attributes**: Ensure categories have well-defined filters/attributes before creating variations
2. **SKU Naming**: Use consistent SKU patterns (e.g., BASE-COLOR-SIZE)
3. **Stock Management**: Set realistic stock quantities for each variation
4. **Pricing**: Consider different pricing for premium variations (e.g., larger sizes)
5. **Images**: Add variation-specific images when colors or styles differ visually

## Future Enhancements

Potential improvements:
- Bulk edit variations
- Clone existing variation products
- Variation-specific SEO
- Quick variation switcher in search results
- Variation comparison view
- Import/export variations via Excel

## Troubleshooting

### Variations not showing
- Verify the product has `isParent: true`
- Check that `variations` array is populated
- Ensure `variationThemes` is set

### Cannot select variation
- Verify variation has `stockQuantity > 0`
- Check `variationAttributes` matches available themes

### Add to cart disabled
- User must select ALL variation options
- Check browser console for errors

## Files Changed

**Backend:**
- `src/modules/products/product.entity.ts` - Entity updates
- `src/modules/products/products.service.ts` - Service logic
- `src/migrations/AddProductVariations.ts` - Database migration
- `add-variation-columns.js` - Manual migration script

**Frontend:**
- `src/components/ProductVariationBuilder.tsx` - Variation builder
- `src/components/VariationSelector.tsx` - Customer variation picker
- `src/app/vendor/products/add/page.tsx` - Product form
- `src/app/products/[slug]/page.tsx` - Product detail page
- `src/components/ProductGrid.tsx` - Product cards
- `src/app/vendor/products/page.tsx` - Vendor products list
