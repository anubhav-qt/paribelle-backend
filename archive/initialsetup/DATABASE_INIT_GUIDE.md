# Database Initialization Guide

This guide explains how to set up the database schema for the Marketplace Backend when hosting for the first time.

## 🚀 Quick Start (TL;DR)

```bash
# 1. Ensure you have a .env file with database credentials
# 2. Run the initialization script
npm run db:init:create

# 3. (Optional) Seed with sample data
npm run seed

# 4. Start your backend
npm run dev
```

## Files Included

- **`init-database.sql`** - Complete SQL schema with all tables, indexes, and constraints
- **`init-database.ps1`** - PowerShell script to automate the database setup
- **`init-database.js`** - Node.js script for cross-platform database initialization

## Prerequisites

1. PostgreSQL installed (version 12 or higher recommended)
2. For PowerShell script: `psql` command-line tool available in your PATH
3. For Node.js script: `pg` package installed (`npm install pg`)
4. Database credentials (host, port, username, password)

## Quick Start

### Option 1: Using Node.js Script (Recommended - Cross-Platform)

First, ensure you have the `pg` package installed:
```bash
npm install pg
```

Run the Node.js script using npm scripts (easiest):

```bash
# Using .env file configuration
npm run db:init

# Create database if it doesn't exist
npm run db:init:create
```

Or run directly with custom options:

```bash
# Using .env file configuration
node init-database.js

# Create database if it doesn't exist
node init-database.js --create-database

# With custom credentials
node init-database.js --host localhost --port 5432 --user admin --password your_password --database marketplace --create-database

# Show help
node init-database.js --help
```

**Configuration Priority:**
1. Command-line arguments (highest priority)
2. Environment variables from `.env` file
3. Default values (lowest priority)

### Option 2: Using PowerShell Script (Windows)

Run the PowerShell script with your database credentials:

```powershell
# If database already exists
.\init-database.ps1

# If you need to create the database first
.\init-database.ps1 -CreateDatabase

# With custom credentials
.\init-database.ps1 -DBHost "localhost" -DBPort "5432" -DBUser "admin" -DBPassword "your_password" -DBName "marketplace"
```

### Option 3: Manual SQL Execution

If you prefer to run the SQL file manually:

1. Open pgAdmin or your preferred PostgreSQL client
2. Connect to your PostgreSQL server
3. Create the database if it doesn't exist:
   ```sql
   CREATE DATABASE marketplace OWNER admin;
   ```
4. Connect to the `marketplace` database
5. Execute the `init-database.sql` file

Or using psql command line:
```bash
# Create database (if needed)
psql -h localhost -U admin -d postgres -c "CREATE DATABASE marketplace OWNER admin;"

# Run initialization script
psql -h localhost -U admin -d marketplace -f init-database.sql
```

## What Gets Created

The initialization script creates:

### Core Tables
- ✅ `users` - User accounts and authentication
- ✅ `categories` - Product categories with hierarchy
- ✅ `addresses` - User shipping/billing addresses
- ✅ `hsn_codes` - HSN codes for GST compliance

### Vendor Tables
- ✅ `vendors` - Vendor/store information
- ✅ `vendor_pages` - Custom vendor pages
- ✅ `vendor_blog_posts` - Vendor blog system
- ✅ `vendor_navigation` - Custom vendor navigation menus

### Product Tables
- ✅ `products` - Main product catalog
- ✅ `product_variants` - Product variations (size, color, etc.)

### Order & Payment Tables
- ✅ `orders` - Customer orders
- ✅ `order_items` - Individual items in orders
- ✅ `payments` - Payment transactions
- ✅ `bookings` - Service bookings (appointments)

### Invoice Tables
- ✅ `invoices` - Invoice headers
- ✅ `invoice_items` - Invoice line items with GST details

### Review Tables
- ✅ `reviews` - Product reviews
- ✅ `vendor_reviews` - Vendor ratings

### Settings & Configuration
- ✅ `settings` - General system settings
- ✅ `platform_settings` - Platform-wide configuration
- ✅ `homepage_settings` - Homepage customization
- ✅ `footer_settings` - Footer configuration
- ✅ `marketplace_pages` - Custom CMS pages

### Location Tables
- ✅ `cities` - City master data
- ✅ `sub_locations` - Areas/localities within cities

### Additional Features
- ✅ Performance indexes on all major tables
- ✅ Foreign key constraints for data integrity
- ✅ UUID primary keys for scalability
- ✅ Timestamps (created_at, updated_at) on all tables
- ✅ Proper data types for prices, dates, and text

## After Database Setup

1. **Update Environment Variables**
   
   Create or update your `.env` file in the backend root:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=admin
   DB_PASSWORD=your_password
   DB_DATABASE=marketplace
   ```

2. **Seed Initial Data (Optional)**
   
   Run the seeding script to populate test data:
   ```bash
   npm run seed
   ```
   
   Or seed just admin user:
   ```bash
   npm run seed:admin
   ```

3. **Run Database Migrations (If Any)**
   
   If you have pending migrations:
   ```bash
   npm run migration:run
   ```

4. **Start the Backend**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm run build
   npm run start:prod
   ```

## Verification

After running the initialization, verify the setup:

```sql
-- Check if all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check table counts
SELECT 
    schemaname,
    tablename,
    (xpath('/row/count/text()', 
        query_to_xml(format('select count(*) as count from %I.%I', 
        schemaname, tablename), false, true, '')))[1]::text::int AS row_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

## Troubleshooting

### Connection Issues
- Verify PostgreSQL service is running
- Check firewall settings
- Ensure credentials are correct
- Verify database exists

### Permission Issues
- Ensure the database user has CREATE privileges
- Grant necessary permissions:
  ```sql
  GRANT ALL PRIVILEGES ON DATABASE marketplace TO admin;
  ```

### Existing Data
- If tables already exist, the script will drop and recreate them
- **Warning:** This will delete all existing data
- Backup your database before running if you have important data

### UUID Extension Error
If you get an error about uuid-ossp extension:
```sql
-- Run as superuser
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Production Deployment

For production environments:

1. **Use Strong Credentials**
   - Generate strong database passwords
   - Use environment variables (never commit credentials)

2. **Database Backup**
   - Set up automated backups
   - Test restore procedures

3. **Connection Pooling**
   - Configure connection pooling in your backend (TypeORM handles this)
   - Adjust pool size based on load

4. **Monitoring**
   - Set up database monitoring
   - Track query performance
   - Monitor table sizes and indexes

5. **Security**
   - Use SSL connections for remote databases
   - Restrict database access by IP
   - Follow least-privilege principle for users

## Support

For issues or questions:
- Check the backend logs
- Review PostgreSQL logs
- Consult the main project documentation

## Schema Updates

When you need to update the schema:
- Use TypeORM migrations: `npm run migration:generate`
- Never manually modify production databases
- Always test migrations in staging first
