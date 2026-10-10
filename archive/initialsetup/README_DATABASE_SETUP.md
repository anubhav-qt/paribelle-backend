# 🗄️ Database Setup - Quick Reference

## Files Created

| File | Purpose |
|------|---------|
| `init-database.sql` | Complete SQL schema (all 27 tables) |
| `init-database.js` | Node.js initialization script |
| `init-database.ps1` | PowerShell initialization script |
| `DATABASE_INIT_GUIDE.md` | Detailed documentation |

## 🚀 Fastest Way to Initialize

```bash
# Method 1: Using npm scripts (Recommended)
npm run db:init:create

# Method 2: Using Node.js directly
node init-database.js --create-database

# Method 3: Using PowerShell (Windows)
.\init-database.ps1 -CreateDatabase
```

## 📋 What Gets Created

### Database Schema Includes:
- ✅ **27 Tables** for complete marketplace functionality
- ✅ **Foreign Keys** for data integrity
- ✅ **Indexes** for optimal performance
- ✅ **UUID** support for scalability

### Table Categories:
1. **Core** (4 tables): users, categories, addresses, hsn_codes
2. **Vendors** (4 tables): vendors, vendor_pages, vendor_blog_posts, vendor_navigation
3. **Products** (2 tables): products, product_variants
4. **Orders** (4 tables): orders, order_items, payments, bookings
5. **Invoices** (2 tables): invoices, invoice_items
6. **Reviews** (2 tables): reviews, vendor_reviews
7. **Settings** (5 tables): settings, platform_settings, homepage_settings, footer_settings, marketplace_pages
8. **Locations** (2 tables): cities, sub_locations

## ⚙️ Configuration

### Option 1: Environment Variables (.env file)
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=your_password
DB_DATABASE=marketplace
```

### Option 2: Command Line Arguments
```bash
node init-database.js \
  --host localhost \
  --port 5432 \
  --user admin \
  --password your_password \
  --database marketplace \
  --create-database
```

## 📝 Complete Workflow

```bash
# Step 1: Clone repository and install dependencies
npm install

# Step 2: Create .env file with database credentials
# (Copy from .env.example if available)

# Step 3: Initialize database
npm run db:init:create

# Step 4: (Optional) Seed sample data
npm run seed

# Step 5: Start backend server
npm run dev
```

## 🔧 Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run db:init` | Initialize database (must exist) |
| `npm run db:init:create` | Create & initialize database |
| `npm run seed` | Seed sample data |
| `npm run seed:admin` | Create admin user only |
| `npm run migration:run` | Run TypeORM migrations |

## 🐛 Troubleshooting

### "Cannot connect to database"
```bash
# Check PostgreSQL is running
# Windows:
Get-Service postgresql*

# Linux/Mac:
sudo systemctl status postgresql
```

### "Database already exists"
```bash
# Drop and recreate (WARNING: deletes all data!)
psql -U admin -d postgres -c "DROP DATABASE marketplace;"
npm run db:init:create
```

### "UUID extension error"
```sql
-- Run as PostgreSQL superuser
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## 📚 Full Documentation

For detailed information, see [DATABASE_INIT_GUIDE.md](DATABASE_INIT_GUIDE.md)

## 🎯 Production Deployment Checklist

- [ ] Use strong database passwords
- [ ] Set up database backups
- [ ] Enable SSL connections
- [ ] Configure connection pooling
- [ ] Set up monitoring
- [ ] Test restore procedures
- [ ] Restrict database access by IP
- [ ] Review and adjust indexes based on usage

## 💡 Tips

- The `pg` package is already included in `package.json`
- All scripts support both .env and command-line configuration
- Tables are created with proper indexes for performance
- Schema matches TypeORM entity definitions exactly
- Safe to run multiple times (drops existing tables first)

---

**Need help?** Check the [DATABASE_INIT_GUIDE.md](DATABASE_INIT_GUIDE.md) for comprehensive documentation.
