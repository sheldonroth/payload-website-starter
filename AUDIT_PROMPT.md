# CMS First-Principles Audit Prompt

## Mission

You are conducting a comprehensive first-principles audit of a Payload CMS backend for "The Product Report" - a mobile app that tests consumer products for harmful ingredients and provides safety verdicts. Your job is to examine every collection, field, hook, API route, and admin configuration with fresh eyes, questioning whether each element serves its purpose well.

**Do not assume anything is correct just because it exists.** Your goal is to identify:
1. What is working well and should be preserved
2. What is broken, incomplete, or misconfigured
3. What is over-engineered or unnecessary
4. What is missing but needed
5. What creates poor admin UX
6. What poses security, performance, or legal risks

---

## Context: What This App Does

**The Product Report** allows users to:
- Scan product barcodes to see safety reports
- Vote on products they want tested
- Refer friends for subscription rewards
- Access premium features via subscription (RevenueCat)

**Business Model:**
- Freemium with subscription paywall
- Referral program with tiered commissions
- One free product unlock per device ("One-Shot Engine")

**Legal Context:**
- App makes health/safety claims about products
- Needs litigation defense capabilities (N=1 defense, version snapshots)
- Must track exactly what users saw on specific dates

**Technical Stack:**
- Payload CMS 3.x on Next.js 15
- PostgreSQL database
- Vercel deployment
- Mobile app (React Native) consumes API

---

## Audit Framework

For each area, evaluate using these criteria:

### 1. Purpose Clarity
- Is it obvious what this collection/field/feature does?
- Are admin descriptions helpful or missing?
- Would a new team member understand this?

### 2. Data Model Correctness
- Are field types appropriate (text vs select vs relationship)?
- Are required fields actually required?
- Are indexes on frequently-queried fields?
- Are relationships pointing to the right collections?
- Is data normalized appropriately (not duplicated)?

### 3. Admin UX Quality
- Is the admin interface intuitive?
- Are fields in logical order?
- Are sidebar vs main content decisions sensible?
- Are collapsible sections used well?
- Are conditional fields configured correctly?
- Is the `useAsTitle` field meaningful?

### 4. Access Control Security
- Are read/create/update/delete permissions appropriate?
- Is API key validation implemented where needed?
- Can users access data they shouldn't?
- Are admin-only fields properly protected?

### 5. Hook Logic
- Do beforeChange hooks validate correctly?
- Do afterChange hooks have side effects that could fail silently?
- Are there race conditions or N+1 query patterns?
- Do hooks handle errors gracefully?

### 6. Mobile API Compatibility
- Does the API return what mobile expects?
- Are field names consistent with mobile client?
- Are there missing endpoints?
- Is the response format correct?

### 7. Performance
- Are there expensive operations in hooks?
- Are queries efficient?
- Is pagination implemented where needed?
- Are there unnecessary database calls?

### 8. Legal/Compliance
- Is audit logging comprehensive?
- Can we prove what a user saw on a specific date?
- Are version snapshots working?
- Is PII handled appropriately?

---

## Audit Checklist

### Phase 1: Collection Inventory

First, list ALL collections and their purposes:

```
Collection Name | Purpose | Admin Group | Estimated Complexity
----------------|---------|-------------|---------------------
```

For each collection, note:
- How many fields does it have?
- Does it have custom hooks?
- What access control pattern is used?
- Is it exposed to the mobile API?

### Phase 2: Deep Collection Review

For each collection, answer these questions:

#### Schema Review
1. **Fields Audit**: List every field and assess:
   - Is this field necessary?
   - Is the field type correct?
   - Is `required` set correctly?
   - Is `unique` set where needed?
   - Is `index` set for query performance?
   - Is `defaultValue` sensible?
   - Is the admin description helpful?

2. **Relationships Audit**:
   - Are relationships using correct `relationTo`?
   - Should any text fields be relationships instead?
   - Are there orphaned relationships possible?

3. **Field Organization**:
   - Are fields in logical groups?
   - Are collapsible sections used appropriately?
   - Is sidebar vs main content correct?
   - Are conditional fields (`admin.condition`) working?

#### Hooks Review
1. **beforeValidate**: Is validation logic correct?
2. **beforeChange**: Are transformations safe?
3. **afterChange**: Do side effects handle failures?
4. **beforeDelete**: Is cleanup happening?
5. **afterDelete**: Are cascading effects correct?

Look for:
- Silent failures (try/catch that swallows errors)
- Race conditions
- Infinite loops (hook triggers itself)
- N+1 queries (queries inside loops)
- Blocking operations in setTimeout (fire-and-forget that loses errors)

#### Access Control Review
1. Who can read? Is this correct?
2. Who can create? Is this correct?
3. Who can update? Is this correct?
4. Who can delete? Is this correct?
5. Is API key validation implemented correctly?

### Phase 3: Global Settings Review

Review all Payload globals:
- What settings exist?
- Are they being used?
- Is the admin UX good?

### Phase 4: API Routes Audit

List all custom API routes under `/src/app/api/`:

```
Route | Method | Purpose | Auth Required | Mobile Uses
------|--------|---------|---------------|------------
```

For each route:
1. Is input validation sufficient?
2. Is error handling comprehensive?
3. Is the response format consistent?
4. Are there security vulnerabilities?
5. Does it match what mobile expects?

### Phase 5: Cron Jobs Review

List all scheduled jobs:
- What do they do?
- How often do they run?
- Do they handle failures?
- Are they idempotent?

### Phase 6: Cross-Cutting Concerns

#### Audit Logging
- Is the audit log collection comprehensive?
- Are all mutations logged?
- Can we reconstruct history?

#### Error Handling
- Are errors logged consistently?
- Do users see helpful error messages?
- Are there unhandled promise rejections?

#### Type Safety
- Are TypeScript types generated and current?
- Are there `any` type assertions that hide bugs?
- Are API responses properly typed?

---

## Output Format

Structure your audit report as follows:

### Executive Summary
- Overall health score (1-10)
- Top 5 critical issues
- Top 5 strengths
- Recommended priority order for fixes

### Collection-by-Collection Findings

For each collection:

```markdown
## Collection: [Name]

**Purpose**: [What it does]
**Health Score**: [1-10]
**Admin Group**: [Group name]

### What's Working Well
- [Bullet points]

### Issues Found

#### Critical (Blocks functionality or poses security risk)
| Issue | Location | Impact | Suggested Fix |
|-------|----------|--------|---------------|

#### Major (Significant UX or data integrity problems)
| Issue | Location | Impact | Suggested Fix |
|-------|----------|--------|---------------|

#### Minor (Polish and improvements)
| Issue | Location | Impact | Suggested Fix |
|-------|----------|--------|---------------|

### Missing Features
- [What should exist but doesn't]

### Over-Engineering
- [What could be simplified]
```

### API Routes Findings
[Same format as collections]

### Cron Jobs Findings
[Same format as collections]

### Cross-System Issues
[Issues that span multiple areas]

### Recommended Fixes (Prioritized)

```markdown
## Priority 1: Critical (Fix immediately)
1. [Issue] - [Estimated effort] - [Why critical]

## Priority 2: High (Fix this week)
1. [Issue] - [Estimated effort] - [Impact if delayed]

## Priority 3: Medium (Fix this month)
1. [Issue] - [Estimated effort] - [Benefit]

## Priority 4: Low (Nice to have)
1. [Issue] - [Estimated effort] - [Benefit]
```

---

## Specific Areas to Investigate

Based on the codebase context, pay special attention to:

### Products Collection
- Is the verdict system (AVOID/CAUTION/OKAY/GOOD) well-implemented?
- Are GC/MS lab result fields properly structured?
- Is the version snapshot system for litigation defense working?
- Is the N=1 defense (sample tracking) properly implemented?
- Are category and badge systems well-designed?

### Device Fingerprints
- Is the One-Shot Engine (free unlock tracking) correctly implemented?
- Is referral code generation working?
- Are fraud prevention flags useful?
- Is behavior metrics tracking comprehensive?

### Referrals
- Does the tiered commission system make sense?
- Are self-referral and duplicate referral prevention working?
- Is the relationship between referrals and device-fingerprints correct?
- Are the API routes consistent with mobile expectations?

### Product Requests (Voting)
- Is the voting flow intuitive?
- Is the status workflow (collecting_votes → threshold_reached → etc.) logical?
- Are notifications triggered at appropriate times?

### Push Tokens & Notifications
- Is token registration working?
- Is the win-back campaign system properly implemented?
- Are notification sends being tracked?

### Paywall Configuration
- Is the dynamic paywall variant system working?
- Is Statsig integration correct?
- Can admins easily A/B test paywalls?

### User Segments
- Are segment rules evaluating correctly?
- Is sync to Statsig/RevenueCat working?

### Audit Logs
- Is every important action being logged?
- Can we reconstruct what happened when?

---

## How to Conduct This Audit

1. **Start with the Payload config** (`payload.config.ts`) to understand what's registered
2. **Read each collection file** in `/src/collections/`
3. **Check for globals** in `/src/globals/`
4. **Review API routes** in `/src/app/api/`
5. **Check cron jobs** in `/src/app/api/cron/`
6. **Review hooks** in `/src/hooks/`
7. **Check the admin** by actually using the Payload admin UI
8. **Cross-reference with mobile** code to verify API compatibility

For each file you read, take notes using the framework above. Don't rush - thoroughness is more valuable than speed.

---

## Questions to Answer

At the end of your audit, answer these meta-questions:

1. **If you were building this from scratch today, what would you do differently?**

2. **What's the biggest risk to the business if left unfixed?**

3. **What would make the admin experience significantly better for the team?**

4. **Are there any "time bombs" - code that will break under certain conditions?**

5. **Is the mobile API contract clear and well-documented?**

6. **Could a new developer onboard to this codebase easily?**

7. **Is the legal/litigation defense infrastructure actually reliable?**

---

## Start Here

Begin your audit by running these commands to understand the codebase structure:

```bash
# List all collections
ls -la src/collections/

# List all API routes
find src/app/api -name "route.ts" | head -50

# List all globals
ls -la src/globals/ 2>/dev/null || echo "No globals directory"

# Check payload config
head -100 src/payload.config.ts

# Find all hooks
find src -name "*hook*" -o -name "*Hook*"
```

Then read the Payload config to understand what's registered, and proceed collection by collection.

**Remember: Question everything. Assume nothing. Document thoroughly.**
