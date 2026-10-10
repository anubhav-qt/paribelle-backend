# Deploying to Render - Database Setup Guide

## Overview

Render provides managed PostgreSQL databases. This guide shows you how to initialize your marketplace database on Render for the first time.

## 🎯 Deployment Strategy

### Option 1: Using Build Command (Recommended)

Render will automatically run your initialization script during deployment.

### Option 2: Using Render Shell

Manually run the script after deployment using Render's shell.

---

## 📋 Step-by-Step Setup on Render

### 1. Create PostgreSQL Database on Render

1. Go to Render Dashboard → **New** → **PostgreSQL**
2. Configure database:
   - **Name**: `marketplace-db` (or your choice)
   - **Database**: `marketplace`
   - **User**: `marketplace_user` (auto-generated)
   - **Region**: Choose closest to your backend
   - **Plan**: Select appropriate plan

3. **Copy the connection details** (Render provides):
   - Internal Database URL (use this for your backend)
   - External Database URL (for local connections)
   - Host, Port, Database, User, Password

### 2. Configure Your Backend Service

1. Go to Render Dashboard → **New** → **Web Service**
2. Connect your GitHub repository
3. Configure the service:

   **Basic Settings:**
   - **Name**: `marketplace-backend`
   - **Environment**: `Node`
   - **Region**: Same as database
   - **Branch**: `main` (or your default)
   - **Root Directory**: `marketplace-backend` (if in monorepo)

   **Build & Deploy:**
   
   **Build Command:**
   ```bash
   npm install && npm run build && npm run db:init
   ```
   
   **Start Command:**
   ```bash
   npm run start:prod
   ```

### 3. Add Environment Variables

In Render Dashboard → Your Service → Environment:

```env
# Database (from Render PostgreSQL)
DATABASE_URL=<paste Internal Database URL from Render>

# Or individual variables (Render provides these)
DB_HOST=<from Render PostgreSQL>
DB_PORT=5432
DB_USERNAME=<from Render PostgreSQL>
DB_PASSWORD=<from Render PostgreSQL>
DB_DATABASE=marketplace

# Other required variables
NODE_ENV=production
JWT_SECRET=<your-secure-secret>
ALLOWED_ORIGINS=https://your-frontend.onrender.com

# Add all other environment variables your app needs
```

### 4. Deploy!

Click **Deploy** and Render will:
1. Build your application
2. Run database initialization (`npm run db:init`)
3. Start your backend

---

## 🔧 Alternative Setup Methods

### Method A: One-Time Build Command (First Deploy Only)

For the **first deployment**, use this build command:

```bash
npm install && npm run build && npm run db:init:create && npm run seed
```

Then change it to regular build command for subsequent deploys:

```bash
npm install && npm run build
```

### Method B: Manual Initialization via Render Shell

If you prefer to run initialization manually:

1. Deploy your app normally
2. Go to Render Dashboard → Your Service → **Shell**
3. Run the initialization:

```bash
npm run db:init:create
# or
node init-database.js --create-database
```

### Method C: Using Render's PostgreSQL External Connection

Initialize from your local machine:

1. Copy the **External Database URL** from Render PostgreSQL
2. Parse the URL to get credentials
3. Run locally:

```bash
node init-database.js \
  --host <external-host> \
  --port <port> \
  --user <user> \
  --password <password> \
  --database marketplace \
  --create-database
```

Or use the connection string directly in `.env`:
```env
DATABASE_URL=<External Database URL from Render>
```
Then run:
```bash
npm run db:init:create
```

---

## 📝 Recommended Build Commands for Different Stages

### First Deployment (with database initialization)
```bash
npm install && npm run build && npm run db:init:create && npm run seed:admin
```

### Regular Deployments (after database exists)
```bash
npm install && npm run build
```

### When You Have Migrations to Run
```bash
npm install && npm run build && npm run migration:run
```

---

## 🔍 Verify Database Setup

After deployment, check if tables were created:

### Option 1: Using Render Shell
```bash
# In Render Shell
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => 
  client.query(\`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  \`)
).then(res => {
  console.log('Tables created:', res.rows.length);
  res.rows.forEach(r => console.log('-', r.table_name));
  client.end();
});
"
```

### Option 2: Using Render's PostgreSQL External Connection
Connect with any PostgreSQL client (pgAdmin, DBeaver, etc.) using the External URL.

---

## 🛡️ Important Production Considerations

### 1. TypeORM Configuration for Production

Ensure your `data-source.ts` has:
```typescript
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL, // Render provides this
  entities: [path.join(process.cwd(), 'dist/**/*.entity{.ts,.js}')],
  migrations: [path.join(process.cwd(), 'dist/migrations/*{.ts,.js}')],
  synchronize: false, // NEVER true in production!
  logging: false, // or ['error'] for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false // Required for Render
  } : false,
});
```

### 2. Update Your AppModule

Ensure your NestJS app uses the Render DATABASE_URL:

```typescript
// app.module.ts
TypeOrmModule.forRootAsync({
  useFactory: () => ({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    synchronize: false, // Never true in production!
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false,
  }),
}),
```

### 3. Database Backups

Render provides automatic backups on paid plans. For free tier:
- Set up a backup strategy
- Export data regularly
- Consider upgrading to Starter plan for backups

### 4. Connection Pooling

Render has connection limits. Configure TypeORM pooling:

```typescript
{
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  ssl: { rejectUnauthorized: false },
  extra: {
    max: 10, // Maximum pool size
    min: 2,  // Minimum pool size
    idleTimeoutMillis: 30000,
  }
}
```

---

## 🚨 Common Issues & Solutions

### Issue: "Database does not exist"
**Solution:** Use `npm run db:init:create` in build command instead of `npm run db:init`

### Issue: "Connection timeout"
**Solution:** 
- Check environment variables are set correctly
- Ensure using Internal Database URL (not External)
- Verify SSL is configured

### Issue: "Permission denied to create database"
**Solution:** 
- Use Render's pre-created database
- Don't use `--create-database` flag
- Just run `npm run db:init`

### Issue: "Tables already exist"
**Solution:** 
- Remove database initialization from build command after first deploy
- Or use conditional logic (check if tables exist before running)

### Issue: Build fails with "Cannot find module 'pg'"
**Solution:** Ensure `pg` is in `dependencies` (not `devDependencies`) in package.json

---

## 📊 Monitoring & Maintenance

### Check Database Usage
Render Dashboard → PostgreSQL → **Metrics** tab

### Run Migrations
```bash
# In Render Shell or build command
npm run migration:run
```

### Seed Data (if needed)
```bash
# In Render Shell
npm run seed
```

### Database Logs
Render Dashboard → PostgreSQL → **Logs** tab

---

## 🎯 Best Practices for Render Deployment

1. **Never use `synchronize: true`** in production
2. **Use environment variables** for all configuration
3. **Enable SSL** for database connections
4. **Set up health checks** in Render
5. **Monitor database size** and query performance
6. **Use migrations** for schema changes
7. **Keep backups** of your database
8. **Test locally** with production-like setup before deploying

---

## 📱 Complete Deployment Checklist

- [ ] Create PostgreSQL database on Render
- [ ] Create Web Service on Render
- [ ] Add all environment variables
- [ ] Set build command with `db:init:create` for first deploy
- [ ] Deploy and verify tables are created
- [ ] Update build command to remove `db:init:create`
- [ ] Test API endpoints
- [ ] Check logs for errors
- [ ] Set up monitoring
- [ ] Configure backups (if on paid plan)

---

## 🔗 Useful Links

- [Render PostgreSQL Docs](https://render.com/docs/databases)
- [Render Environment Variables](https://render.com/docs/environment-variables)
- [Render Shell Access](https://render.com/docs/shell)
- [TypeORM Production Guide](https://typeorm.io/#/connection-options)

---

## 💡 Pro Tips

1. **Conditional Initialization**: Modify the init script to check if tables exist first:
   ```javascript
   // Add to init-database.js before running SQL
   const checkTables = await client.query(`
     SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_schema = 'public'
   `);
   
   if (parseInt(checkTables.rows[0].count) > 0) {
     console.log('Tables already exist, skipping initialization');
     process.exit(0);
   }
   ```

2. **Use Render's Build Logs**: Check the logs during build to see if initialization succeeded

3. **Separate Services**: Consider using Render's Background Workers for migrations

4. **Health Check Endpoint**: Add a `/health` endpoint that checks database connection

---

## 🎉 You're Ready!

Your marketplace backend is now ready to deploy on Render with proper database initialization!
