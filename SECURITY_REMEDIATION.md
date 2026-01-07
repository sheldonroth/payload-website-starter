# Security Remediation - CRITICAL Action Required

## Overview

A security audit has identified **critical secrets exposure** in the git history. Even though `.env` files are now in `.gitignore`, they were committed previously and remain in the repository history.

**ALL secrets listed below must be rotated IMMEDIATELY.**

---

## Priority 1: Rotate Immediately (High Value Targets)

### Stripe (Payment Processing)
- `STRIPE_SECRET_KEY` - Live key starting with `sk_live_`
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret
- **Action**: Generate new keys in Stripe Dashboard > Developers > API keys

### OpenAI (API Access)
- `OPENAI_API_KEY` - Starting with `sk-proj-`
- **Action**: Generate new key at platform.openai.com/api-keys

### Database Credentials (Full Data Access)
- `DATABASE_URL` / `POSTGRES_URL` - Neon database credentials
- `PGPASSWORD` - Direct Postgres password
- All `POSTGRES_CMS_*` variants
- **Action**: Rotate passwords in Neon Dashboard for both databases

### Google Service Account (Private Key Exposed!)
- `GOOGLE_SERVICE_ACCOUNT_KEY` - Contains full private key
- **Action**: Delete and recreate service account in Google Cloud Console

---

## Priority 2: Rotate Soon (Service Access)

### RevenueCat (Revenue/Subscription Data)
- `REVENUECAT_API_KEY`
- `REVENUECAT_WEBHOOK_SECRET`
- **Action**: Generate new keys in RevenueCat dashboard

### Resend (Email Service)
- `RESEND_API_KEY`
- **Action**: Generate new key in Resend dashboard

### Sentry (Error Tracking)
- `SENTRY_API_TOKEN`
- `SENTRY_WEBHOOK_SECRET`
- **Action**: Revoke and regenerate in Sentry settings

### Statsig (Feature Flags)
- `STATSIG_CONSOLE_API_KEY`
- `STATSIG_SERVER_SECRET`
- **Action**: Rotate in Statsig console

### Vercel (Deployment)
- `BLOB_READ_WRITE_TOKEN`
- `CRON_SECRET`
- `PREVIEW_SECRET`
- **Action**: Regenerate in Vercel project settings

---

## Priority 3: Rotate When Possible

### Analytics & Monitoring
- `MIXPANEL_API_SECRET`
- `NEXT_PUBLIC_RUDDERSTACK_WRITE_KEY`
- `NEXT_PUBLIC_FINGERPRINT_API_KEY`

### External APIs
- `APIFY_API_KEY`
- `GEMINI_API_KEY`
- `YOUTUBE_API_KEY`
- `PHOTOROOM_API_KEY`
- `GOOGLE_CLIENT_SECRET`

### Auth Providers
- `APPLE_KEY_ID` (may need Apple Developer account access)
- **Note**: Apple private key appears empty, verify in Apple Developer Console

---

## Steps to Complete Remediation

### 1. Update Vercel Environment Variables
After rotating each secret:
```bash
npx vercel env rm <VAR_NAME> production
npx vercel env add <VAR_NAME> production
```

Or use the Vercel Dashboard: Project Settings > Environment Variables

### 2. Update Local `.env.local`
Create a fresh `.env.local` with the new rotated secrets.

### 3. Verify Application Works
After updating all secrets, deploy and verify:
- Authentication flows work
- Payments process correctly
- Emails send successfully
- Database connections work
- Third-party integrations function

### 4. Optional: Clean Git History
To permanently remove secrets from git history (advanced):
```bash
# Using BFG Repo-Cleaner (recommended)
bfg --delete-files '.env*' --no-blob-protection

# Force push to all branches
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force --all
```

**Warning**: Force pushing rewrites history and affects all collaborators.

---

## Security Fixes Applied in This Audit

1. **Added admin authentication** to `/api/content-moderation` endpoint
2. **Added admin authentication** to `/api/user-analytics` endpoint
3. **Fixed IDOR vulnerability** in `/api/vote-submission` (removed overrideAccess, added status validation)
4. **Added Content-Security-Policy** header to prevent XSS attacks

---

## Additional Recommendations

### High Priority
- [ ] Add rate limiting to all public endpoints (currently in-memory only)
- [ ] Move OpenAI/Grok API calls to backend proxy in mobile app
- [ ] Implement Redis-based rate limiting for production
- [ ] Add URL validation to smart-scan.ts (SSRF risk)

### Medium Priority
- [ ] Reduce BrandUsers JWT expiration from 30 days to 7 days
- [ ] Add HttpOnly flag to Brand Portal auth cookies
- [ ] Implement certificate pinning in mobile app
- [ ] Fix 3 dependency vulnerabilities in Brand Portal (npm audit fix)

### Low Priority
- [ ] Review XSS via dangerouslySetInnerHTML in dashboard components
- [ ] Add deep link validation in mobile app

---

## Contact

If you believe any secrets have been used maliciously, immediately:
1. Rotate all affected secrets
2. Review audit logs in each service
3. Check for unauthorized access or transactions
4. Consider enabling additional security measures (2FA, IP restrictions)

**Generated**: 2026-01-07 by Security Audit
