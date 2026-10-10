# Uncategorized Products Feature

## Overview
This feature allows the marketplace to display products that don't have any categories assigned to them. These products appear in a dedicated "More Products" section on the home page.

## Implementation Details

### Frontend Changes (apps/web/src/app/page.tsx)

#### 1. State Management
Added state to track uncategorized products:
```typescript
const [uncategorizedProducts, setUncategorizedProducts] = useState<Product[]>([]);
```

#### 2. Data Fetching
Created `fetchUncategorizedProducts()` function that fetches products from the API with the `uncategorized=true` parameter:
```typescript
const fetchUncategorizedProducts = async () => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/products?uncategorized=true`);
  // Fetches only active products without categories
}
```

This function is called in the `useEffect` hook when the component mounts.

#### 3. Navigation Menu
Added "More Products" link in the categories toolbar (appears only when uncategorized products exist):
- Located at the beginning of the category navigation bar
- Smooth scrolls to the "More Products" section when clicked
- Only visible when `uncategorizedProducts.length > 0`

#### 4. Display Section
Created a dedicated section to display uncategorized products:
- **Section ID**: `more-products-section` (for scroll navigation)
- **Title**: "More Products"
- **Description**: "Discover other amazing products"
- **Layout**: Horizontal scrollable grid (same style as category sections)
- **Features**:
  - Product images with fallback handling
  - Discount badges (when applicable)
  - Star ratings and review counts
  - Price display with compare-at-price strikethrough
  - Hover effects and smooth transitions
  - Left/Right scroll buttons

### Backend Changes

#### 1. Products Service (apps/backend/src/modules/products/products.service.ts)

##### Updated `findAll()` Method
Added `uncategorized` parameter to filter products without categories:

```typescript
async findAll(
  page: number = 1,
  limit: number = 20,
  status?: string,
  search?: string,
  vendorId?: string,
  uncategorized?: boolean, // NEW PARAMETER
)
```

##### Query Logic
When `uncategorized=true`:
- Uses `LEFT JOIN` on product.categories
- Filters where `category.id IS NULL` (no categories assigned)
- Only returns products with `status = 'active'`
- Excludes products that have any categories

Query implementation:
```typescript
if (uncategorized) {
  queryBuilder
    .leftJoin('product.categories', 'category')
    .andWhere('category.id IS NULL')
    .andWhere('product.status = :activeStatus', { activeStatus: ProductStatus.ACTIVE });
} else {
  queryBuilder.leftJoinAndSelect('product.categories', 'category');
}
```

#### 2. Products Controller (apps/backend/src/modules/products/products.controller.ts)

##### Added Query Parameter
Added `@ApiQuery` decorator for Swagger documentation:
```typescript
@ApiQuery({ name: 'uncategorized', required: false })
```

##### Updated Handler
Modified the `findAll()` method to accept and process the `uncategorized` parameter:
```typescript
async findAll(
  @Query('uncategorized') uncategorized?: string,
  // ... other parameters
) {
  const isUncategorized = uncategorized === 'true';
  return this.productsService.findAll(pageNum, limitNum, status, search, vendorId, isUncategorized);
}
```

## User Experience

### For Customers
1. **Navigation**: Click "More Products" in the top category bar to jump to the section
2. **Discovery**: Browse products that might not fit into specific categories
3. **Consistent UI**: Same viewing experience as categorized products

### For Vendors
- Products created without categories are now visible to customers
- No products are hidden from the marketplace
- Encourages proper categorization while maintaining product visibility

## API Endpoint

### GET /api/v1/products?uncategorized=true

**Query Parameters**:
- `uncategorized`: boolean (pass "true" to get uncategorized products)
- `page`: number (default: 1)
- `limit`: number (default: 20)

**Response**:
```json
{
  "products": [...],
  "total": 5,
  "page": 1,
  "limit": 20
}
```

**Filters Applied**:
- Only products with NO categories
- Only products with `status = 'active'`
- Ordered by creation date (newest first)

## Testing

### To Test the Feature:

1. **Create an uncategorized product**:
   - Go to vendor dashboard → Add Product
   - Fill in all required fields
   - **Do not select any categories**
   - Set status to "Active"
   - Save the product

2. **Verify display**:
   - Navigate to home page (localhost:3000)
   - Check browser console for: `"Uncategorized products count: X"`
   - "More Products" should appear in the category toolbar
   - Scroll down to see the "More Products" section

3. **Test navigation**:
   - Click "More Products" in the toolbar
   - Page should smooth scroll to the section

### Browser Console Debugging:
The frontend logs useful information:
```
Fetching uncategorized products... 200
Uncategorized products data: {...}
Uncategorized products count: 5
```

## Technical Notes

### Why LEFT JOIN?
- `LEFT JOIN` ensures we get all products
- Filtering on `category.id IS NULL` identifies products without categories
- This is more efficient than using a NOT IN subquery

### Performance Considerations
- Products are loaded on page mount
- Horizontal scroll implemented with CSS (no pagination needed)
- Images use lazy loading and error handling

### Edge Cases Handled
1. **No uncategorized products**: Section doesn't render
2. **Image load failures**: Fallback to placeholder image
3. **Missing price data**: Gracefully handles null values
4. **Empty state**: Navigation link hidden if no products

## Future Enhancements

Possible improvements:
1. Add "View All Uncategorized Products" page
2. Admin dashboard to identify uncategorized products
3. Bulk categorization tools
4. Automated category suggestions based on product attributes
5. Analytics on uncategorized product views/sales

## Related Files

### Frontend
- `apps/web/src/app/page.tsx` - Main home page component

### Backend
- `apps/backend/src/modules/products/products.service.ts` - Product business logic
- `apps/backend/src/modules/products/products.controller.ts` - API endpoint handler
- `apps/backend/src/modules/products/product.entity.ts` - Product data model

## Database Schema Impact

No schema changes required. The feature uses existing:
- `product` table
- `product_categories_category` junction table (for many-to-many relationship)

## Rollback Procedure

If needed to remove this feature:

1. **Frontend**: Remove uncategorized products state, fetch function, and UI section
2. **Backend**: Remove `uncategorized` parameter from service and controller
3. **No database changes needed** - feature is purely application-level

## Deployment Notes

- No migrations required
- Feature is backward compatible
- Can be enabled/disabled via frontend conditional rendering
- API endpoint supports both old and new query parameters
