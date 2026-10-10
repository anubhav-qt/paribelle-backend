# Email Verification Setup Guide

This guide explains how to set up email verification for your marketplace application using Gmail SMTP.

## Overview

The email verification system has been implemented with the following features:

- **Email/Password Registration**: Users registering with email/password receive a verification link
- **Google OAuth**: Users logging in with Google are automatically verified (trusted by Google)
- **Verification Link**: Simple click-to-verify link (valid for 24 hours)
- **Resend Functionality**: Users can request a new verification email
- **Login Protection**: Unverified users cannot login (except Google OAuth users)

## Gmail SMTP Setup

### Step 1: Enable Gmail App Passwords

1. Go to your Google Account: https://myaccount.google.com/
2. Select **Security** in the left sidebar
3. Under "Signing in to Google", select **2-Step Verification** (you must enable this first)
4. Scroll down to **App passwords**
5. Click **Select app** → Choose "Mail"
6. Click **Select device** → Choose "Other (Custom name)" → Enter "Marketplace"
7. Click **Generate**
8. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

### Step 2: Configure Environment Variables

Add the following to your `apps/backend/.env` file:

```env
# Email Configuration (Gmail SMTP)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password-here
MAIL_FROM=noreply@marketplace.com
APP_NAME=Marketplace
APP_URL=http://localhost:3000

# For Production
# APP_URL=https://yourdomain.com
```

**Important Notes:**
- Replace `your-email@gmail.com` with your actual Gmail address
- Replace `your-app-password-here` with the 16-character app password (remove spaces)
- `MAIL_FROM` can be any email address (it's the sender name)
- `APP_URL` is used to generate verification links

## API Endpoints

### 1. Register with Email/Password

**POST** `/api/v1/auth/register`

```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "message": "Registration successful. Please check your email to verify your account."
}
```

A verification email will be sent to the user's email address.

### 2. Verify Email

**GET** `/api/v1/auth/verify-email?token=<verification-token>`

When users click the link in their email, this endpoint verifies their account.

**Response:**
```json
{
  "message": "Email verified successfully. You can now login."
}
```

### 3. Resend Verification Email

**POST** `/api/v1/auth/resend-verification`

```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "Verification email sent. Please check your inbox."
}
```

### 4. Login (Email/Password)

**POST** `/api/v1/auth/login`

```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (if not verified):**
```json
{
  "statusCode": 401,
  "message": "Please verify your email before logging in. Check your inbox for the verification link."
}
```

**Response (if verified):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### 5. Google OAuth Login

**POST** `/api/v1/auth/google-login`

```json
{
  "email": "user@gmail.com",
  "name": "John Doe",
  "googleId": "1234567890"
}
```

Google OAuth users are **automatically verified** and can login immediately.

## Email Template

The verification email includes:
- Beautiful HTML design with gradient header
- Clear verification link button
- 24-hour expiration notice
- Support contact information
- Responsive design for mobile devices

## Testing

### Local Testing (Development)

1. Register a new user:
```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456",
    "firstName": "Test",
    "lastName": "User"
  }'
```

2. Check your email inbox for the verification link

3. Click the verification link or copy the token and visit:
```
http://localhost:3000/verify-email?token=<your-token>
```

4. Try to login:
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456"
  }'
```

### Testing Verification Expiry

Verification tokens expire after 24 hours. To test:

1. Register a new user
2. Wait 24 hours (or manually update `emailVerificationTokenExpiry` in database)
3. Try to verify with the old token
4. Should receive error: "Verification token has expired"
5. Use the resend endpoint to get a new token

## Frontend Integration

Create a verification page at `apps/web/src/app/verify-email/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link');
      return;
    }

    fetch(`http://localhost:4000/api/v1/auth/verify-email?token=${token}`)
      .then(res => res.json())
      .then(data => {
        setStatus('success');
        setMessage(data.message);
        setTimeout(() => router.push('/login'), 3000);
      })
      .catch(err => {
        setStatus('error');
        setMessage('Verification failed. Token may be invalid or expired.');
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        {status === 'loading' && <p>Verifying your email...</p>}
        {status === 'success' && (
          <>
            <h1 className="text-2xl font-bold text-green-600">✓ Email Verified!</h1>
            <p className="mt-2">{message}</p>
            <p className="mt-4 text-gray-600">Redirecting to login...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-2xl font-bold text-red-600">✗ Verification Failed</h1>
            <p className="mt-2">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
```

## Gmail Sending Limits

**Free Gmail Account:**
- **500 emails per day** (rolling 24-hour period)
- Ideal for MVP and small-scale deployments
- No cost

**Google Workspace (Paid):**
- **2,000 emails per day**
- Better deliverability
- Custom domain support
- $6/user/month

## Production Recommendations

### For Small Scale (< 500 users/day)
✅ Use Gmail SMTP (free, simple setup)

### For Medium Scale (500-5000 users/day)
Consider these alternatives:
- **SendGrid**: 100 emails/day free, then $19.95/month for 50k emails
- **Mailgun**: 5,000 emails/month free, then pay-as-you-go
- **Amazon SES**: $0.10 per 1,000 emails (cheapest for high volume)

### Migration Path

When you outgrow Gmail:

1. Keep the same `SimpleEmailService` interface
2. Just swap the `nodemailer` transporter configuration
3. No code changes needed in `auth.service.ts`

Example for SendGrid:

```typescript
// simple-email.service.ts
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY,
  },
});
```

## Security Best Practices

✅ **Implemented:**
- Random 32-byte verification tokens (crypto.randomBytes)
- 24-hour token expiration
- Tokens stored as plain text (safe - they're single-use and expire)
- Email verification required before login
- Google OAuth users auto-verified

⚠️ **Consider for Production:**
- Rate limiting on resend endpoint (prevent spam)
- CAPTCHA on registration (prevent bot signups)
- Domain verification (SPF, DKIM, DMARC records)
- Email deliverability monitoring

## Troubleshooting

### Emails not sending?

1. Check Gmail app password is correct (no spaces)
2. Verify 2-Step Verification is enabled on Google account
3. Check backend logs for error messages
4. Test SMTP connection:
```bash
curl -X POST http://localhost:4000/api/v1/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test-email@gmail.com"}'
```

### Emails going to spam?

1. Add proper email headers (already included in template)
2. Use a custom domain for `MAIL_FROM`
3. Set up SPF, DKIM, DMARC records
4. Warm up your sending domain gradually

### Token expired errors?

- Tokens expire after 24 hours
- Use the resend endpoint to get a new token
- Consider extending expiry for production (48-72 hours)

## Implementation Checklist

- [x] SimpleEmailService created with Gmail SMTP
- [x] Email verification methods added to AuthService
- [x] Verification endpoints added to AuthController
- [x] Google OAuth users auto-verified
- [x] SimpleEmailModule imported in AppModule
- [x] nodemailer package installed
- [ ] Configure .env with Gmail credentials
- [ ] Create frontend verification page
- [ ] Test registration flow
- [ ] Test verification flow
- [ ] Test resend functionality
- [ ] Test Google OAuth auto-verification

## Next Steps

1. **Configure .env** with your Gmail app password
2. **Restart backend** to load new environment variables
3. **Create frontend verification page** (see example above)
4. **Test the complete flow** (register → verify → login)
5. **Monitor email delivery** in production

## Support

If you encounter issues:
- Check backend logs: `pm2 logs backend`
- Verify database schema has verification fields
- Test Gmail SMTP credentials manually
- Review this guide's troubleshooting section
