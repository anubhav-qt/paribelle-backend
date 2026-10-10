# Environment Configuration Guide

Complete guide for configuring all environment variables needed for the Marketplace Backend to work properly.

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Required Variables](#required-variables)
3. [Optional Variables](#optional-variables)
4. [Platform-Specific Setup](#platform-specific-setup)
5. [Environment Examples](#environment-examples)
6. [Validation Checklist](#validation-checklist)

---

## 🚀 Quick Start

### For Local Development

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Update these **REQUIRED** variables:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=admin
   DB_PASSWORD=your_password
   DB_DATABASE=marketplace
   JWT_SECRET=change-this-to-a-secure-random-string
   ```

3. Start the server:
   ```bash
   npm run dev
   ```

### For Render/Production

1. Set these variables in Render Dashboard
2. Use `DATABASE_URL` instead of individual DB variables
3. See [Platform-Specific Setup](#platform-specific-setup) below

---

## ✅ Required Variables

These variables are **REQUIRED** for the backend to start and function properly.

### 1. Application Settings

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development`, `production` | ✅ Yes |
| `PORT` | Server port | `3001` | ✅ Yes |
| `APP_URL` | Backend API URL | `http://localhost:3001` | ✅ Yes |

**Why needed:** Core application configuration. Backend won't know which mode to run in without these.

### 2. Database Configuration

**Option A: Individual Variables (Local Development)**

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL host | `localhost` | ✅ Yes |
| `DB_PORT` | PostgreSQL port | `5432` | ✅ Yes |
| `DB_USERNAME` | Database user | `admin` | ✅ Yes |
| `DB_PASSWORD` | Database password | `your_password` | ✅ Yes |
| `DB_DATABASE` | Database name | `marketplace` | ✅ Yes |

**Option B: Connection String (Render/Heroku/Production)**

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://user:pass@host:5432/marketplace` | ✅ Yes (in production) |

**Why needed:** Backend cannot connect to database without these. All data is stored here.

**Note:** If `DATABASE_URL` is set, it takes precedence over individual DB variables.

### 3. Authentication & Security

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-key-min-32-chars` | ✅ Yes |
| `JWT_EXPIRATION` | Token expiration time | `7d`, `24h`, `30m` | ✅ Yes |

**Why needed:** User authentication, login sessions, and API security depend on these.

**⚠️ CRITICAL:** Use a strong, unique JWT_SECRET in production!
```bash
# Generate a secure secret:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. CORS Configuration

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `ALLOWED_ORIGINS` | Allowed frontend URLs (comma-separated) | `http://localhost:3000,https://myapp.com` | ✅ Yes |
| `WEB_APP_URL` | Main web app URL | `http://localhost:3000` | ✅ Yes |

**Why needed:** Frontend applications cannot make API requests without proper CORS setup.

**For Render:**
```env
ALLOWED_ORIGINS=https://your-frontend.onrender.com,https://www.yourdomain.com
WEB_APP_URL=https://your-frontend.onrender.com
```

**For local development with vendor subdomains:**
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006
PRODUCTION_DOMAIN=yourdomain.com
```

---

## 🔧 Optional Variables

These variables are **OPTIONAL** but enable specific features.

### 1. Email Configuration (SMTP)

**Required for:** Password reset, email verification, order notifications, invoices

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `SMTP_HOST` | SMTP server host | `smtp.gmail.com` | ⚠️ For emails |
| `SMTP_PORT` | SMTP server port | `587` (TLS) or `465` (SSL) | ⚠️ For emails |
| `SMTP_USER` | SMTP username/email | `your-email@gmail.com` | ⚠️ For emails |
| `SMTP_PASSWORD` | SMTP password/app password | `your-app-password` | ⚠️ For emails |
| `SMTP_FROM` | From email address | `noreply@marketplace.com` | ⚠️ For emails |

**Gmail Setup:**
1. Enable 2-Factor Authentication
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use the generated password in `SMTP_PASSWORD`

**SendGrid/Mailgun:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your_sendgrid_api_key
SMTP_FROM=noreply@yourdomain.com
```

**What breaks without it:** Password reset, email verification, order confirmations won't work.

### 2. File Storage (AWS S3)

**Required for:** Product images, vendor logos, file uploads

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIAIOSFODNN7EXAMPLE` | ⚠️ For uploads |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` | ⚠️ For uploads |
| `AWS_REGION` | AWS region | `us-east-1`, `ap-south-1` | ⚠️ For uploads |
| `AWS_S3_BUCKET` | S3 bucket name | `marketplace-uploads` | ⚠️ For uploads |

**Setup Steps:**
1. Create AWS account
2. Create S3 bucket
3. Create IAM user with S3 permissions
4. Generate access keys

**What breaks without it:** Image uploads, vendor logos, product images won't work.

### 3. File Storage (Cloudinary Alternative)

**Alternative to AWS S3** for file uploads

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | `your-cloud-name` | ⚠️ For uploads |
| `CLOUDINARY_API_KEY` | Cloudinary API key | `123456789012345` | ⚠️ For uploads |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | `your-api-secret` | ⚠️ For uploads |

**Setup:** Sign up at https://cloudinary.com

**Note:** Use either AWS S3 OR Cloudinary, not both.

### 4. Payment Gateway (Razorpay)

**Required for:** Payment processing, order checkout

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `RAZORPAY_KEY_ID` | Razorpay key ID | `rzp_test_1234567890` | ⚠️ For payments |
| `RAZORPAY_KEY_SECRET` | Razorpay secret key | `your_secret_key` | ⚠️ For payments |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook secret for verification | `your_webhook_secret` | ⚠️ For payments |

**Setup Steps:**
1. Create Razorpay account: https://dashboard.razorpay.com/signup
2. Get API keys from Dashboard → Settings → API Keys
3. Set up webhooks in Dashboard → Settings → Webhooks

**Test vs Live:**
```env
# Test mode (for development)
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXX
RAZORPAY_KEY_SECRET=test_secret_key

# Live mode (for production)
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXX
RAZORPAY_KEY_SECRET=live_secret_key
```

**What breaks without it:** Payment processing won't work, orders cannot be completed.

### 5. Google OAuth (Optional)

**Required for:** Google Sign-In feature

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `123456-abcdef.apps.googleusercontent.com` | ⚠️ For Google login |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `your-client-secret` | ⚠️ For Google login |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL | `http://localhost:3001/api/auth/google/callback` | ⚠️ For Google login |

**Setup:** Follow guide in `GOOGLE_OAUTH_SETUP.md`

**What breaks without it:** Google Sign-In button won't work.

### 6. Redis Cache (Optional but Recommended)

**Required for:** Performance optimization, caching

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `REDIS_HOST` | Redis server host | `localhost` | ⚠️ For caching |
| `REDIS_PORT` | Redis server port | `6379` | ⚠️ For caching |
| `REDIS_PASSWORD` | Redis password (if required) | `your-redis-password` | Optional |
| `REDIS_URL` | Redis connection URL | `redis://:password@host:6379` | Alternative |

**Setup:**
```bash
# Install Redis locally
# Windows: https://github.com/microsoftarchive/redis/releases
# Mac: brew install redis
# Linux: sudo apt-get install redis-server

# Or use Redis Cloud (free tier): https://redis.com/try-free/
```

**What breaks without it:** App will work but slower. No caching for frequently accessed data.

### 7. Platform Settings

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DEFAULT_COMMISSION_RATE` | Default vendor commission % | `10.0` | Optional |
| `PRODUCTION_DOMAIN` | Production domain for vendor subdomains | `marketplace.com` | ⚠️ For vendor sites |

---

## 🌍 Platform-Specific Setup

### Local Development

Create `.env` file:

```env
# Application
NODE_ENV=development
PORT=3001
APP_URL=http://localhost:3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=admin
DB_DATABASE=marketplace

# Security
JWT_SECRET=local-development-secret-key-change-in-production
JWT_EXPIRATION=7d

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006
WEB_APP_URL=http://localhost:3000

# Email (Optional - skip for now)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
# SMTP_FROM=noreply@marketplace.com

# Storage (Optional - skip for now)
# AWS_ACCESS_KEY_ID=your_key
# AWS_SECRET_ACCESS_KEY=your_secret
# AWS_REGION=us-east-1
# AWS_S3_BUCKET=marketplace-dev

# Payment (Optional - use test mode)
# RAZORPAY_KEY_ID=rzp_test_XXXX
# RAZORPAY_KEY_SECRET=test_secret
```

### Render Deployment

Set in Render Dashboard → Environment:

```env
# Application
NODE_ENV=production
PORT=3001
APP_URL=https://your-backend.onrender.com

# Database (Render provides this automatically)
DATABASE_URL=postgresql://user:pass@host:5432/marketplace

# Security (MUST CHANGE!)
JWT_SECRET=<generate-a-secure-64-char-random-string>
JWT_EXPIRATION=7d

# CORS
ALLOWED_ORIGINS=https://your-frontend.onrender.com,https://yourdomain.com
WEB_APP_URL=https://your-frontend.onrender.com

# Email (REQUIRED for production)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<your-sendgrid-api-key>
SMTP_FROM=noreply@yourdomain.com

# Storage (REQUIRED for uploads)
AWS_ACCESS_KEY_ID=<your-aws-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret>
AWS_REGION=us-east-1
AWS_S3_BUCKET=marketplace-production

# Payment (REQUIRED for payments)
RAZORPAY_KEY_ID=rzp_live_XXXX
RAZORPAY_KEY_SECRET=<your-live-secret>
RAZORPAY_WEBHOOK_SECRET=<your-webhook-secret>

# Platform
DEFAULT_COMMISSION_RATE=10.0
PRODUCTION_DOMAIN=yourdomain.com
```

### Heroku Deployment

Similar to Render, set via CLI or Dashboard:

```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET="your-secret"
heroku config:set DATABASE_URL="postgresql://..."
# ... etc
```

### Docker Deployment

Create `.env.production` file or use docker-compose environment:

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://user:pass@db:5432/marketplace
      JWT_SECRET: ${JWT_SECRET}
      # ... etc
```

---

## 📝 Environment Examples

### Minimal (Local Development)

```env
NODE_ENV=development
PORT=3001
APP_URL=http://localhost:3001

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=admin
DB_DATABASE=marketplace

JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRATION=7d

ALLOWED_ORIGINS=http://localhost:3000
WEB_APP_URL=http://localhost:3000
```

**Features:** Basic functionality only. No emails, uploads, or payments.

### Full (Local Development)

```env
NODE_ENV=development
PORT=3001
APP_URL=http://localhost:3001

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=admin
DB_DATABASE=marketplace

JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRATION=7d

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006
WEB_APP_URL=http://localhost:3000

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@marketplace.com

AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=marketplace-dev

RAZORPAY_KEY_ID=rzp_test_XXXX
RAZORPAY_KEY_SECRET=test_secret

DEFAULT_COMMISSION_RATE=10.0
```

**Features:** All features enabled for local testing.

### Production (Render/Cloud)

```env
NODE_ENV=production
PORT=3001
APP_URL=https://api.yourdomain.com

DATABASE_URL=postgresql://user:pass@host:5432/marketplace

JWT_SECRET=<64-char-random-string-generated-securely>
JWT_EXPIRATION=7d

ALLOWED_ORIGINS=https://www.yourdomain.com,https://yourdomain.com
WEB_APP_URL=https://www.yourdomain.com
PRODUCTION_DOMAIN=yourdomain.com

SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxxxxxxxxxx
SMTP_FROM=noreply@yourdomain.com

AWS_ACCESS_KEY_ID=AKIAXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxx
AWS_REGION=us-east-1
AWS_S3_BUCKET=yourdomain-production

RAZORPAY_KEY_ID=rzp_live_XXXX
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=webhook_secret_xxxx

DEFAULT_COMMISSION_RATE=10.0

REDIS_URL=redis://:password@redis-host:6379
```

**Features:** Production-ready with all services configured.

---

## ✅ Validation Checklist

Use this checklist to verify your environment configuration:

### Basic Functionality
- [ ] Backend starts without errors: `npm run dev`
- [ ] Can connect to database
- [ ] API responds at: `http://localhost:3001`
- [ ] Health check works: `GET /`

### Authentication
- [ ] Can register new user
- [ ] Can login with email/password
- [ ] JWT token is generated
- [ ] Protected routes require authentication

### CORS
- [ ] Frontend can make API requests
- [ ] No CORS errors in browser console
- [ ] POST/PUT/DELETE requests work

### Email (if configured)
- [ ] Password reset email sends
- [ ] Verification email sends
- [ ] No SMTP errors in logs

### File Upload (if configured)
- [ ] Can upload product images
- [ ] Can upload vendor logos
- [ ] Files are accessible via URL
- [ ] No AWS/Cloudinary errors

### Payment (if configured)
- [ ] Razorpay checkout loads
- [ ] Can create test order
- [ ] Payment webhook receives events
- [ ] No Razorpay errors in logs

---

## 🔍 Troubleshooting

### "Cannot connect to database"

**Check:**
```env
DB_HOST=localhost  # Correct host?
DB_PORT=5432       # PostgreSQL running?
DB_USERNAME=admin  # User exists?
DB_PASSWORD=admin  # Correct password?
DB_DATABASE=marketplace  # Database exists?
```

**Fix:**
```bash
# Verify PostgreSQL is running
Get-Service postgresql*  # Windows
sudo systemctl status postgresql  # Linux

# Test connection
psql -h localhost -U admin -d marketplace

# If database doesn't exist
npm run db:init:create
```

### "CORS error"

**Check:**
```env
ALLOWED_ORIGINS=http://localhost:3000  # Includes your frontend URL?
```

**Fix:** Add all frontend URLs (comma-separated):
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006,https://yourdomain.com
```

### "JWT malformed" or "Invalid token"

**Check:**
```env
JWT_SECRET=your-secret-key  # Same across all instances?
```

**Fix:** Ensure JWT_SECRET is consistent and not empty.

### "SMTP authentication failed"

**For Gmail:**
1. Enable 2FA
2. Generate App Password
3. Use App Password (not your Gmail password)

**Check:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587  # NOT 465 for Gmail
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # 16-char app password
```

### "AWS S3 Access Denied"

**Check IAM policy:**
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject",
    "s3:GetObject",
    "s3:DeleteObject"
  ],
  "Resource": "arn:aws:s3:::your-bucket/*"
}
```

---

## 📚 Related Documentation

- [Database Initialization Guide](DATABASE_INIT_GUIDE.md)
- [Render Deployment Guide](RENDER_DEPLOYMENT_GUIDE.md)
- [Why Not Synchronize](WHY_NOT_SYNCHRONIZE.md)
- [Google OAuth Setup](GOOGLE_OAUTH_SETUP.md)

---

## 🔐 Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong JWT_SECRET** (64+ characters) in production
3. **Rotate secrets** regularly
4. **Use different credentials** for dev/staging/production
5. **Enable SSL** for database connections in production
6. **Use environment-specific** S3 buckets
7. **Enable 2FA** on all third-party services
8. **Monitor** for leaked credentials (use GitHub secret scanning)

---

## 💡 Pro Tips

1. **Use dotenv-vault** for team secret management
2. **Set up staging environment** with separate credentials
3. **Use Redis** for caching in production (significant performance boost)
4. **Monitor environment variables** with health checks
5. **Document custom variables** for your team
6. **Use secret managers** (AWS Secrets Manager, HashiCorp Vault) for large teams

---

## ✨ Quick Commands

```bash
# Validate environment
node -e "require('dotenv').config(); console.log(Object.keys(process.env).filter(k => k.startsWith('DB_') || k.startsWith('JWT_')))"

# Generate secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Test database connection
node -e "require('dotenv').config(); const {Client}=require('pg'); const c=new Client({connectionString:process.env.DATABASE_URL||`postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`}); c.connect().then(()=>console.log('✅ DB Connected')).catch(e=>console.error('❌',e.message))"

# Check if all required vars are set
node -e "require('dotenv').config(); const req=['NODE_ENV','PORT','DB_HOST','DB_PORT','DB_USERNAME','DB_PASSWORD','DB_DATABASE','JWT_SECRET','JWT_EXPIRATION','ALLOWED_ORIGINS']; req.forEach(v=>console.log(process.env[v]?'✅':'❌',v))"
```

---

**Need help?** Check the troubleshooting section or reach out to the team!

🎉 **Your environment is configured and ready to go!**
