# Payload CMS Codebase Audit Report

**Project:** payload-website-starter (TPR)
**Date:** 2026-01-28
**Scope:** Static review of server/app code, Payload collections/endpoints, and configuration. No runtime testing or external CVE database access.

## Executive Summary
This audit found several high-impact security issues centered around access control and request routing, plus multiple medium-risk abuse vectors and performance bottlenecks in batch/admin tooling. The most critical findings are:
- An SSRF/credential-leak risk in unified ingest via untrusted `Origin` header.
- An unauthenticated `/youtube/sync` endpoint that can burn API quota.
- Admin-only endpoints that only check “authenticated user” instead of “admin role.”
- A public API secret embedded in client code.

## 1) Security Vulnerabilities

### Critical
1) **SSRF + cookie exfiltration via `Origin` header in unified ingest**
   - **Where:** `src/endpoints/unified-ingest.ts`
   - **What:** The endpoint builds internal fetch URLs using `req.headers.get('origin')` and forwards the request’s `Cookie` header. If an attacker can control `Origin`, the server will POST cookies to an arbitrary host.
   - **Risk:** SSRF to attacker-controlled hosts and leakage of session cookies/JWT.
   - **Fix:** Do not trust `Origin`. Use a fixed internal base URL or call handlers directly. If a URL is required, derive from a trusted config value and **never** forward cookies to untrusted origins.

2) **Unauthenticated `/youtube/sync` endpoint**
   - **Where:** `src/endpoints/youtube-sync.ts` (wired in `src/payload.config.ts`)
   - **What:** No auth or rate limiting. Uses API key from global settings to call YouTube API.
   - **Risk:** Anyone can trigger syncs, burn quota, and cause data churn.
   - **Fix:** Require admin role (or signed server-to-server token) and add rate limiting.

### High
3) **Admin-only endpoints not enforcing admin role**
   - **Where (examples):**
     - `src/endpoints/generate-affiliate-links.ts` (bulk updates)
     - `src/endpoints/email-template-seed.ts` (seeds content)
     - `src/endpoints/api-status.ts` (reveals config state)
   - **What:** These endpoints check only `req.user`, not admin role, despite comments stating admin-only.
   - **Risk:** Any authenticated user can perform privileged operations or access internal config state.
   - **Fix:** Enforce role checks (admin or explicit capability) consistently. Audit all endpoints for this pattern.

4) **Public API secret embedded in client bundle**
   - **Where:** `src/components/CronJobsDashboard/index.tsx` uses `process.env.NEXT_PUBLIC_PAYLOAD_API_SECRET`.
   - **What:** Any `NEXT_PUBLIC_*` is exposed to the browser. This exposes your API secret to any admin UI user and potentially to the public build.
   - **Risk:** If `PAYLOAD_API_SECRET` is used for authorization, it becomes effectively public.
   - **Fix:** Remove secrets from client code. Use server-side session auth or short-lived signed tokens issued per user/session.

### Medium
5) **Unrestricted public create access (spam/abuse vectors)**
   - **Where (examples):**
     - `src/collections/Feedback.ts` (create: true)
     - `src/collections/UserSubmissions.ts` (create: true)
     - `src/collections/ManufacturerDisputes.ts` (create: true)
     - `src/collections/ProductVotes.ts` (create: true)
     - `src/collections/SearchQueries.ts` (create: true)
   - **Risk:** Automated spam, DB bloat, noisy analytics, and potential DoS.
   - **Fix:** Add rate limiting and bot protection (captcha, per-IP/device throttle), and validate payload size.

6) **SSRF risk in URL-based enrichment**
   - **Where:** `src/endpoints/magic-url.ts` (fetches arbitrary URL)
   - **Risk:** Authenticated users can force the server to fetch internal or attacker-controlled URLs.
   - **Fix:** Restrict allowed domains or implement a safe fetch proxy with allowlists + IP blocks.

### Low
7) **Swagger UI loads from unpinned CDN**
   - **Where:** `src/app/api/docs/route.ts` loads assets from `unpkg.com` without SRI.
   - **Risk:** Supply-chain compromise of client assets.
   - **Fix:** Self-host or use Subresource Integrity.

## 2) Code Quality / Tech Debt

- **Temporarily disabled hooks**: `src/collections/Products.ts` has an afterRead hook commented out due to timeouts. This indicates unresolved performance debt and incomplete behavior.
- **Deprecated behavior still live**: `src/endpoints/fingerprint.ts` keeps a deprecated GET endpoint (hash in URL). This should be fully removed or hard-disabled.
- **Unimplemented TODOs**: `src/endpoints/year-in-clean-cron.ts` and `src/endpoints/amazon-validate.ts` include TODOs for incomplete features.
- **Monolithic endpoints**: Large, multi-responsibility endpoints (e.g., `brand-auth`, `unified-ingest`) are difficult to test and reason about. Consider splitting into smaller handlers and shared utilities.

## 3) Performance / Scalability

- **Unbounded/big batch operations**:
  - `src/endpoints/backup-export.ts` loads up to 500k docs per collection in one request → memory/timeout risk.
  - `src/endpoints/generate-affiliate-links.ts` loops sequential updates for large datasets.
  - `src/endpoints/admin-purge.ts` iterates deletes one-by-one up to 1,000 items per action.
  - Recommendation: Use pagination, streaming exports, and batched updates/deletes.

- **Expensive analytics queries**:
  - `src/endpoints/admin-analytics.ts` runs many counts in parallel on large collections every request.
  - `src/endpoints/user-analytics.ts` fetches up to 10,000 user records on every cache miss.
  - Recommendation: Add indexes on frequently filtered fields and consider pre-aggregated tables or scheduled rollups.

- **Leaderboard query inefficiency**:
  - `src/app/api/referrals/leaderboard/route.ts` loads 10,000 docs and slices in memory.
  - Recommendation: Use DB-level sorting + limit to return only required rows.

## 4) Dependencies (Outdated Packages / Known CVEs)

**Status:** Unable to run `pnpm audit` or `pnpm outdated` in this environment and cannot query CVE databases.

**Action Required:**
1) Run `pnpm audit` and `pnpm outdated` in CI.
2) Pay close attention to security-sensitive packages: `next`, `payload`, `jsonwebtoken`, `jose`, `jwks-rsa`, `sharp`, `stripe`, and `@sentry/nextjs`.
3) Ensure Node.js runtime stays within the supported security patch window.

## Recommended Remediation Plan (Prioritized)

1) **Fix SSRF/Origin misuse** in `unified-ingest` and block cookie forwarding to untrusted URLs.
2) **Lock down `/youtube/sync`** with admin auth + rate limiting.
3) **Audit all endpoints** for admin-role enforcement (start with `generate-affiliate-links`, `email-template-seed`, `api-status`).
4) **Remove client-exposed secrets** (`NEXT_PUBLIC_PAYLOAD_API_SECRET`) and replace with session-based auth.
5) **Add rate limiting/bot mitigation** to public-create collections and public endpoints.
6) **Introduce pagination/streaming for exports** and batch operations to avoid timeouts.

---

### Notes
This report is based on static code review only. A complete security assessment should include: runtime testing, auth/ACL verification in production, and a dependency CVE scan.
