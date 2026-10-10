# How to Reset & Seed Database on Render

## Current Situation
- Neon database has users but passwords might be incorrect
- Render deployment needs updated seeding configuration
- Local changes not yet deployed

## Quick Fix (Already Done)
✅ You already ran SQL in Neon to fix admin password:
```sql
UPDATE users 
SET password = '$2b$10$XL/tvIca6p0z4qrffpKEi.cwdG9SC75skOQGqrM7Y6pr7FA0hGimS'
WHERE email = 'admin@marketplace.com';
```

**Try login now with:** `admin@marketplace.com` / `admin123`

---

## Deploy Automatic Seeding (Permanent Fix)

### Step 1: Deploy Changes
```powershell
cd marketplace-backend
.\deploy-to-render.ps1
```

Or manually:
```powershell
git add seed-all-render.js package.json render.yaml RENDER_SEED_GUIDE.md
git commit -m "Add automatic seeding for Render"
git push
```

### Step 2: Monitor Deployment
1. Go to https://dashboard.render.com
2. Select your `marketplace-backend` service
3. Click on the latest deployment
4. Watch the logs for:
   ```
   🌱 Starting Render Database Seeding
   📦 Seeding: Admin User & Platform Settings...
   📦 Seeding: Physical Products...
   ```

### Step 3: Verify
After deployment completes:
- Try login: `admin@marketplace.com` / `admin123`
- Check products in your app

---

## Manual Reset on Render (If Needed)

### Using Render Dashboard

**Note:** Render Free tier might not have Shell access. Use Neon SQL Editor instead.

If you DO have Shell access:
1. Go to Render Dashboard → Your Service → **Shell** tab
2. Run:
   ```bash
   cd /opt/render/project/src
   
   # Run seed
   npm run seed
   
   # Run product seeds
   node seed-physical-products.js
   node seed-tour-products.js
   node seed-service-products.js
   ```

### Using Neon SQL Editor (Easier)

1. Go to Neon Console → Your Database → SQL Editor
2. Run:
   ```sql
   -- Truncate and reseed (WARNING: Deletes all data)
   TRUNCATE users, vendors, categories, products CASCADE;
   
   -- Then redeploy on Render to run seed scripts
   ```

3. Trigger manual deploy on Render:
   - Dashboard → Your Service → Manual Deploy → Deploy Latest Commit

---

## Environment Variables on Render

Verify these are set in Render Dashboard → Environment tab:
- `DATABASE_URL` - Should be your Neon connection string
- `NODE_ENV` - Should be `production`
- `JWT_SECRET` - Should be set
- `ALLOWED_ORIGINS` - Should include your Vercel URL

---

## Troubleshooting

### Login still fails after deployment
1. Check Render logs for seed errors
2. Verify DATABASE_URL points to Neon
3. Run password update SQL in Neon (see top)

### No products after seeding
1. Check if product seed scripts exist in deployment
2. Verify seed-all-render.js ran successfully in logs
3. Run individual seed scripts manually

### "Role does not exist" errors
- Check DATABASE_URL format includes `?sslmode=require`
- Verify Neon credentials are correct

---

## What Changed

### Before (Old Render Config)
```json
"render:start": "node run-migrations.js && node dist/main"
```
❌ Only ran migrations, no seeding

### After (New Render Config)
```json
"render:start": "node run-migrations.js && node seed-all-render.js && node dist/main"
```
✅ Runs migrations + comprehensive seeding + starts app

---

## Default Login Credentials

After successful seeding:

**Admin User:**
- Email: `admin@marketplace.com`
- Password: `admin123`

**Vendor User:**
- Email: `vendor@marketplace.com`
- Password: `vendor123`

**Customer User:**
- Email: `test@marketplace.com`
- Password: `test`
