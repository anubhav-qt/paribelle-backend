# Render First-Time Database Setup Guide

## 🚀 Current Configuration (First-Time Setup)

The current Render configuration will:
1. **Drop all tables** (clean slate)
2. **Create fresh tables** from TypeORM entities
3. **Seed all data** (admin, products, categories)
4. **Start the application**

### package.json scripts:
```json
"render:drop": "node render-drop-tables.js",           // Drops all tables
"render:create_tables": "node render-create-tables.js", // Creates tables from entities
"render:seed_data": "node seed-all-render.js",         // Seeds data
"render:start": "npm run render:drop && npm run render:create_tables && npm run render:seed_data && node dist/main"
```

### render.yaml:
```yaml
startCommand: npm run render:start
```

---

## ✅ After First Successful Deployment

Once your first deployment completes successfully and you can login:

### Step 1: Update package.json

Change the `render:start` script to use migrations instead of drop/create:

```json
"render:start": "npm run render:start:normal",
```

Or simply:
```json
"render:start": "node run-migrations.js && node dist/main",
```

### Step 2: Update render.yaml

Change the startCommand:

```yaml
startCommand: npm run render:start:normal
# or
startCommand: node run-migrations.js && node dist/main
```

### Step 3: Commit and Deploy

```powershell
git add package.json render.yaml
git commit -m "Switch to normal Render startup (migrations only)"
git push
```

---

## 📋 What Gets Seeded

On first deployment, the database will be populated with:

### Users:
- **Admin:** admin@marketplace.com / admin123
- **Vendor:** vendor@marketplace.com / vendor123
- **Customer:** test@marketplace.com / test

### Products:
- ✅ Physical products (Electronics, Fashion, etc.)
- ✅ Tour products (Travel packages)
- ✅ Service products (Appointments, Bookings)

### Other Data:
- Categories
- Platform vendor
- Platform settings

---

## ⚠️ Important Notes

1. **First deployment only**: The drop/create scripts should only run ONCE
2. **Data loss**: Keep `render:drop` in the command = ALL data deleted on every deploy
3. **After first deploy**: Switch to `render:start:normal` to preserve data
4. **Future deployments**: Will run migrations instead of dropping tables

---

## 🛠️ Troubleshooting

### Deployment fails during drop
- Check DATABASE_URL is set correctly
- Verify Neon database is accessible
- Check Render logs for specific error

### Tables not created
- Ensure TypeORM entities are compiled (check dist folder)
- Verify synchronize setting in data source config
- Check for entity import errors

### Seeding fails
- Verify seed scripts exist in deployment
- Check for foreign key constraint errors
- Look for duplicate key violations

### Can't login after deployment
1. Check Render logs: did seed-all-render.js run?
2. Verify admin user created: check Neon SQL Editor
3. Try password reset SQL:
   ```sql
   UPDATE users 
   SET password = '$2b$10$XL/tvIca6p0z4qrffpKEi.cwdG9SC75skOQGqrM7Y6pr7FA0hGimS'
   WHERE email = 'admin@marketplace.com';
   ```

---

## 📝 Deployment Checklist

- [ ] Commit all changes (scripts + package.json + render.yaml)
- [ ] Push to trigger Render deployment
- [ ] Monitor deployment logs
- [ ] Wait for "🌱 Seeding complete" message
- [ ] Test login: admin@marketplace.com / admin123
- [ ] Verify products visible in app
- [ ] **Switch to normal mode** (Step 1-3 above)
- [ ] Deploy again to confirm migrations work

---

## 🔄 Normal Mode (After First Deployment)

In normal mode, Render will:
1. Run migrations (update schema without data loss)
2. Start application
3. **NO seeding** (data preserved)
4. **NO table drops** (data preserved)

This is production-safe and won't delete data on redeployments.
