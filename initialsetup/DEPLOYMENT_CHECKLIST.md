# 🚀 Complete Deployment Checklist

Complete step-by-step guide for deploying your Marketplace Backend for the first time.

## 📚 Documentation Index

- **[ENVIRONMENT_CONFIGURATION.md](ENVIRONMENT_CONFIGURATION.md)** - All environment variables explained
- **[DATABASE_INIT_GUIDE.md](DATABASE_INIT_GUIDE.md)** - Database setup instructions
- **[RENDER_DEPLOYMENT_GUIDE.md](RENDER_DEPLOYMENT_GUIDE.md)** - Render-specific deployment
- **[WHY_NOT_SYNCHRONIZE.md](WHY_NOT_SYNCHRONIZE.md)** - TypeORM synchronize explained
- **[README_DATABASE_SETUP.md](README_DATABASE_SETUP.md)** - Quick database reference

---

## ✅ Pre-Deployment Checklist

### 1️⃣ Code Preparation

- [ ] All code committed to Git
- [ ] `.env` file is in `.gitignore` (never commit secrets!)
- [ ] `.env.example` is up to date
- [ ] `package.json` has all dependencies
- [ ] Build succeeds locally: `npm run build`
- [ ] Tests pass (if you have tests)

### 2️⃣ Database Setup

- [ ] PostgreSQL database created
- [ ] Database credentials available
- [ ] Can connect to database
- [ ] Database initialization script ready (`init-database.sql`)

### 3️⃣ Third-Party Services

**Required:**
- [ ] Email provider setup (Gmail/SendGrid/Mailgun)
- [ ] File storage setup (AWS S3 or Cloudinary)

**Optional but Recommended:**
- [ ] Payment gateway setup (Razorpay)
- [ ] Google OAuth credentials (if using)
- [ ] Redis instance (for caching)

### 4️⃣ Environment Variables

- [ ] All required variables documented
- [ ] Secrets generated (JWT_SECRET, etc.)
- [ ] CORS origins configured
- [ ] Production URLs ready

---

## 🎯 Deployment Steps

### Option A: Deploy to Render (Recommended)

**Step 1: Create Database**
1. Go to Render Dashboard → **New** → **PostgreSQL**
2. Configure:
   - Name: `marketplace-db`
   - Database: `marketplace`
   - Plan: Free or Starter
3. Copy the **Internal Database URL**

**Step 2: Create Web Service**
1. Go to Render Dashboard → **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `marketplace-backend`
   - **Environment**: `Node`
   - **Build Command**: 
     ```bash
     npm install && npm run build && npm run db:init
     ```
   - **Start Command**: 
     ```bash
     npm run start:prod
     ```

**Step 3: Set Environment Variables**

Go to Environment tab and add:

```env
# Application
NODE_ENV=production
PORT=3001

# Database (from Render PostgreSQL)
DATABASE_URL=<paste-internal-database-url>

# Security (CRITICAL: Generate unique values!)
JWT_SECRET=<generate-64-char-random-string>
JWT_EXPIRATION=7d

# CORS (Add your frontend URL)
ALLOWED_ORIGINS=https://your-frontend.onrender.com
WEB_APP_URL=https://your-frontend.onrender.com

# Email (Required for production)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<your-sendgrid-key>
SMTP_FROM=noreply@yourdomain.com

# Storage (Required for uploads)
AWS_ACCESS_KEY_ID=<your-aws-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret>
AWS_REGION=us-east-1
AWS_S3_BUCKET=marketplace-production

# Payment (Required for checkout)
RAZORPAY_KEY_ID=rzp_live_XXXX
RAZORPAY_KEY_SECRET=<your-secret>
```

**Step 4: Deploy**
1. Click **Deploy**
2. Wait for build to complete
3. Check logs for errors
4. Test API: `https://your-backend.onrender.com`

**Step 5: Verify**
- [ ] Backend is running
- [ ] Database tables created (check logs)
- [ ] API responds to requests
- [ ] No errors in logs

---

### Option B: Deploy Locally (Development)

**Step 1: Install PostgreSQL**
```bash
# Download and install PostgreSQL
# Windows: https://www.postgresql.org/download/windows/
# Mac: brew install postgresql@15
# Linux: sudo apt-get install postgresql-15
```

**Step 2: Create Database**
```bash
# Start PostgreSQL service
# Then initialize database
npm run db:init:create
```

**Step 3: Configure Environment**
```bash
# Copy example
cp .env.example .env

# Edit .env with your values
# See ENVIRONMENT_CONFIGURATION.md for details
```

**Step 4: Start Backend**
```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Or build and run production
npm run build
npm run start:prod
```

**Step 5: Verify**
```bash
# Test health endpoint
curl http://localhost:3001

# Check database connection
npm run migration:run
```

---

## 🔧 Environment Variables Quick Reference

### Minimal Configuration (Local Dev)

```env
NODE_ENV=development
PORT=3001
APP_URL=http://localhost:3001

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=admin
DB_DATABASE=marketplace

JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRATION=7d

ALLOWED_ORIGINS=http://localhost:3000
WEB_APP_URL=http://localhost:3000
```

### Full Production Configuration

```env
NODE_ENV=production
PORT=3001
APP_URL=https://api.yourdomain.com

DATABASE_URL=postgresql://user:pass@host:5432/marketplace

JWT_SECRET=<64-char-secure-random-string>
JWT_EXPIRATION=7d

ALLOWED_ORIGINS=https://www.yourdomain.com,https://yourdomain.com
WEB_APP_URL=https://www.yourdomain.com
PRODUCTION_DOMAIN=yourdomain.com

SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<sendgrid-api-key>
SMTP_FROM=noreply@yourdomain.com

AWS_ACCESS_KEY_ID=<aws-key>
AWS_SECRET_ACCESS_KEY=<aws-secret>
AWS_REGION=us-east-1
AWS_S3_BUCKET=marketplace-production

RAZORPAY_KEY_ID=rzp_live_XXXX
RAZORPAY_KEY_SECRET=<razorpay-secret>
RAZORPAY_WEBHOOK_SECRET=<webhook-secret>

DEFAULT_COMMISSION_RATE=10.0

# Optional but recommended
REDIS_URL=redis://:password@host:6379
```

---

## 🛠️ Database Initialization Methods

### Method 1: Automated (Render Build Command)

Build command includes database initialization:
```bash
npm install && npm run build && npm run db:init
```

✅ Automatic on every deploy
✅ Safe (checks if tables exist first)
✅ No manual steps needed

### Method 2: Manual (Render Shell)

1. Deploy app first
2. Open Render Shell
3. Run:
```bash
npm run db:init:create
```

### Method 3: Local/Remote Connection

From your local machine:
```bash
# Using Node.js script
node init-database.js \
  --host <render-external-host> \
  --port 5432 \
  --user <user> \
  --password <password> \
  --database marketplace \
  --create-database

# Or using npm script with .env configured
npm run db:init:create
```

---

## 📊 Post-Deployment Verification

### 1. Health Check

```bash
# Test backend is running
curl https://your-backend.onrender.com

# Should return API info or 200 OK
```

### 2. Database Verification

**Via Render Shell:**
```bash
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => 
  client.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \\'public\\'')
).then(res => {
  console.log('Tables:', res.rows.length);
  client.end();
});
"
```

Expected: ~27 tables

### 3. API Endpoints

Test key endpoints:

```bash
# Health check
GET https://your-backend.onrender.com/

# Register user
POST https://your-backend.onrender.com/api/auth/register
{
  "email": "test@example.com",
  "password": "Test123!",
  "firstName": "Test",
  "lastName": "User"
}

# Get categories
GET https://your-backend.onrender.com/api/categories
```

### 4. Logs Review

Check Render logs for:
- ✅ No database connection errors
- ✅ No environment variable errors
- ✅ Server started successfully
- ✅ Database tables created/verified

---

## 🚨 Common Issues & Solutions

### Issue: "Cannot connect to database"

**Solution:**
1. Check `DATABASE_URL` is set correctly in Render
2. Use **Internal Database URL** (not External)
3. Verify database is in the same region as backend

### Issue: "Tables not created"

**Solution:**
```bash
# Run manually in Render Shell
npm run db:init:create

# Or add to build command (first deploy only)
npm install && npm run build && npm run db:init:create && npm run seed:admin
```

### Issue: "CORS errors from frontend"

**Solution:**
```env
# Add frontend URL to ALLOWED_ORIGINS
ALLOWED_ORIGINS=https://your-frontend.onrender.com,https://www.yourdomain.com
```

### Issue: "JWT_SECRET not set"

**Solution:**
```bash
# Generate secure secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Set in Render environment variables
JWT_SECRET=<generated-value>
```

### Issue: "Email/Upload/Payment not working"

**Solution:**
Check respective service configuration in [ENVIRONMENT_CONFIGURATION.md](ENVIRONMENT_CONFIGURATION.md)

---

## 📈 Scaling & Optimization

### Performance Tips

1. **Enable Redis Caching**
   ```env
   REDIS_URL=redis://:password@host:6379
   ```

2. **Increase Connection Pool**
   - Default: 10 connections
   - Render Starter: Increase to 20-50
   - Monitor with Render metrics

3. **Add Health Checks**
   - Set Health Check Path to `/health`
   - Monitor uptime in Render

4. **Enable Database Backups**
   - Upgrade to Render Starter plan
   - Set up automatic backups

### Monitoring Setup

1. **Application Logs**
   - Render Dashboard → Logs tab
   - Set up log retention

2. **Database Metrics**
   - Render PostgreSQL → Metrics tab
   - Monitor connections, queries, size

3. **Uptime Monitoring**
   - Use external service (Uptime Robot, Pingdom)
   - Set up alerts

---

## 🎓 Next Steps After Deployment

### 1. Security Hardening

- [ ] Enable HTTPS (Render does this automatically)
- [ ] Set up rate limiting
- [ ] Review CORS settings
- [ ] Enable Helmet security headers (already configured)
- [ ] Set up monitoring/alerts

### 2. Data Seeding (Optional)

```bash
# In Render Shell or locally
npm run seed:admin    # Create admin user
npm run seed          # Seed sample data
```

### 3. Frontend Deployment

- Deploy frontend app (Next.js/React)
- Update ALLOWED_ORIGINS with frontend URL
- Configure frontend API_URL to point to backend

### 4. Domain Setup

1. Purchase domain
2. Point to Render backend
3. Update environment variables:
   ```env
   APP_URL=https://api.yourdomain.com
   ALLOWED_ORIGINS=https://www.yourdomain.com
   ```

### 5. Monitoring & Maintenance

- Set up error tracking (Sentry)
- Configure backup strategy
- Plan database migration workflow
- Document deployment process for team

---

## 📚 Reference Commands

```bash
# Database initialization
npm run db:init              # Initialize existing database
npm run db:init:create       # Create and initialize database

# Migrations
npm run migration:generate   # Generate migration from entities
npm run migration:run        # Run pending migrations
npm run migration:revert     # Revert last migration

# Seeding
npm run seed                 # Seed full sample data
npm run seed:admin           # Create admin user only

# Development
npm run dev                  # Start in development mode
npm run build                # Build for production
npm run start:prod           # Run production build

# Testing
npm run test                 # Run tests
npm run lint                 # Check code style
```

---

## 🎉 Success Checklist

After completing deployment, verify:

### Backend
- [ ] Backend is accessible at production URL
- [ ] API endpoints respond correctly
- [ ] No errors in logs
- [ ] Database is populated

### Authentication
- [ ] Can register new user
- [ ] Can login
- [ ] JWT tokens work
- [ ] Password reset works (if email configured)

### CORS
- [ ] Frontend can connect
- [ ] No CORS errors in browser
- [ ] All HTTP methods work

### Features
- [ ] File uploads work (if configured)
- [ ] Emails send (if configured)
- [ ] Payments process (if configured)
- [ ] All API endpoints functional

### Performance
- [ ] Response times acceptable
- [ ] Database queries optimized
- [ ] No memory leaks
- [ ] Caching works (if Redis configured)

---

## 🆘 Getting Help

- **Environment Issues**: See [ENVIRONMENT_CONFIGURATION.md](ENVIRONMENT_CONFIGURATION.md)
- **Database Issues**: See [DATABASE_INIT_GUIDE.md](DATABASE_INIT_GUIDE.md)
- **Render Issues**: See [RENDER_DEPLOYMENT_GUIDE.md](RENDER_DEPLOYMENT_GUIDE.md)
- **TypeORM Issues**: See [WHY_NOT_SYNCHRONIZE.md](WHY_NOT_SYNCHRONIZE.md)

---

## 💡 Pro Tips

1. **Start Simple**: Deploy with minimal config first, add features incrementally
2. **Use Staging**: Set up staging environment before production
3. **Monitor Early**: Add monitoring from day 1
4. **Document Changes**: Keep deployment notes for team
5. **Automate**: Use CI/CD for deployments (GitHub Actions + Render)
6. **Backup Regularly**: Database backups are critical
7. **Test Locally**: Always test changes locally first
8. **Security First**: Never skip security configurations

---

**🎊 Congratulations! Your Marketplace Backend is now deployed and running!**

For ongoing maintenance, refer to the specific documentation files for each topic.
