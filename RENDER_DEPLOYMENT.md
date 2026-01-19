# Render Deployment Guide

## Automatic Migration on Startup

The database migration for CASCADE delete on reviews is now **automatically executed** when the application starts in production.

### How It Works

1. **start-prod.js** runs the migration script before starting the app
2. **add-cascade-delete-reviews.js** handles the database schema update
3. The migration is **idempotent** (safe to run multiple times)

### Render Configuration

#### Build Command
```bash
npm install && npm run build
```

#### Start Command
```bash
npm run start:prod
```

That's it! The migration will run automatically on every deployment.

### Alternative: Manual Migration

If you prefer to run migrations manually, you can:

#### Option 1: Use Render Shell
```bash
npm run migrate:reviews-cascade
```

#### Option 2: One-time Command in Render Dashboard
Set as a one-time job or run via Shell:
```bash
node add-cascade-delete-reviews.js
```

### Environment Variables Required

Make sure these are set in Render:

- `DATABASE_URL` - PostgreSQL connection string (automatically provided by Render)
- `NODE_ENV=production`

### What the Migration Does

- Drops existing foreign key constraint on `reviews.product_id`
- Recreates it with `ON DELETE CASCADE`
- When a product is deleted, all its reviews are automatically deleted
- Prevents foreign key constraint violations

### Migration Safety

✅ **Safe to run multiple times** - Uses `IF EXISTS` checks  
✅ **Non-destructive** - Only modifies foreign key constraint  
✅ **No data loss** - Doesn't delete any existing data  
✅ **Automatic rollback** - On error, existing constraint remains

### Troubleshooting

If migration fails:
1. Check database connection in Render logs
2. Verify `DATABASE_URL` is set correctly
3. Check PostgreSQL permissions (needs ALTER TABLE rights)
4. The app will continue to start even if migration fails (with warning)

### Testing Locally

```bash
node add-cascade-delete-reviews.js
```

Or use the npm script:
```bash
npm run migrate:reviews-cascade
```
