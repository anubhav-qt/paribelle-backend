# Complete Schema Verification Checklist

## Fixed Issues (Commits)
1. ✅ Foreign key columns (user_id, vendor_id, product_id, order_id) - Commit 7c64db7
2. ✅ 174+ entity column mappings - Commits a0c34ca, 91740ee
3. ✅ product_variants table (variant_attributes, stock_quantity, images) - Commit 600acb8
4. ✅ marketplace_pages and vendor_pages tables (page_type, status, etc.) - Commit c7bc1d2
5. ✅ vendor_blog_posts table and indexes (status instead of is_published) - Commit 4f61e35

## What Was Wrong
- Entity files had @Column() without name parameter, causing TypeORM to query camelCase column names
- SQL schema had snake_case columns
- Mismatch caused "column does not exist" errors in production
- SnakeNamingStrategy only works for auto-generated queries, not explicit @Column mappings

## Testing Before Deployment
Run these commands locally with production-like schema:

```bash
# 1. Reset local database with production schema
cd D:\workdir\Copilot\GIT\workspace\marketplace-backend
node initialsetup/init-database.js --force

# 2. Run seed data
npm run seed

# 3. Start server
npm start

# 4. Test all major endpoints
curl http://localhost:3000/api/v1/products
curl http://localhost:3000/api/v1/categories
curl http://localhost:3000/api/v1/marketplace/pages
curl http://localhost:3000/api/v1/vendors

# 5. Check for any "column does not exist" errors in logs
```

## Deploy to Render
1. Go to Render Dashboard
2. Select marketplace-backend service
3. Click "Manual Deploy" → **"Clear build cache & deploy"**
4. Wait for deployment to complete
5. Monitor logs for errors

## Prevention
- Always add explicit `name: 'snake_case'` to @Column() for multi-word properties
- Keep init-database.sql in sync with entity definitions
- Test locally with --force flag before deploying
