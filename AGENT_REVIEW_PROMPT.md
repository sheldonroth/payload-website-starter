# Agent Prompt: Business Overview & Expert Code Review

## Context

You are reviewing "The Product Report" - a consumer trust platform that provides lab-grade product testing, ingredient analysis, and brand trust scoring. The platform consists of:

1. **Backend/CMS** - Payload CMS + Next.js (`payload-website-starter/`)
2. **Mobile App** - Expo React Native (`product-report-mobile/`)

---

## Business Overview

### What This Product Does

**Core Value Proposition:** Help consumers avoid harmful products by providing independent lab testing, AI-powered ingredient analysis, and transparent brand trust scores.

**How It Works:**
1. **Community Voting** - Users scan/search products they want tested. Weighted voting (Scan=5x, Member=20x) determines lab testing priority
2. **Lab Testing** - Top-voted products get professionally tested
3. **Verdict System** - Products receive RECOMMEND, CAUTION, or AVOID ratings based on ingredient analysis and lab results
4. **Brand Trust Index** - Brands scored 0-100 based on ingredient quality, recall history, transparency, consistency, and responsiveness

**Monetization:**
- Premium subscriptions (tiered access to lab data, especially for AVOID products)
- Affiliate links (Amazon product links)
- B2B Brand Intelligence Portal (brands pay for analytics)
- Referral program ($25/year per active referred subscriber)

### Target Users
- Health-conscious consumers researching products
- Parents checking product safety
- People with allergies/sensitivities needing ingredient transparency
- Brands wanting to improve their trust scores

### Key Differentiators
- Independent lab testing (not sponsored reviews)
- Community-driven testing queue (democratic prioritization)
- AI-powered ingredient analysis with human expert oversight
- Brand accountability tracking (parent company relationships, recall history)

---

## Tech Stack

### Backend/CMS (payload-website-starter)

| Layer | Technology |
|-------|------------|
| CMS | Payload CMS v3.63.0 |
| Framework | Next.js 15.4.9 (App Router) |
| Language | TypeScript 5.7.3 |
| Database | PostgreSQL (Vercel Postgres) |
| Storage | Vercel Blob |
| AI | Google Generative AI, OpenAI |
| Payments | Stripe, RevenueCat |
| Email | Resend |
| Auth | Payload Auth + OAuth (Google, Apple) |
| Hosting | Vercel |

### Mobile App (product-report-mobile)

| Layer | Technology |
|-------|------------|
| Framework | React Native 0.81.5 + Expo 54 |
| Language | TypeScript 5.9.2 |
| State | Zustand 5.0.4 (persisted) |
| Navigation | React Navigation 7.x |
| UI | NativeWind (Tailwind), Reanimated |
| Subscriptions | RevenueCat 9.6.7 |
| Analytics | Mixpanel, RudderStack, PostHog, Statsig |
| Auth | Expo Auth Session (Apple, Google) |
| Device ID | FingerprintJS Pro |

---

## Repository Structures

### Backend (payload-website-starter)

```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── (frontend)/         # Public website pages
│   ├── (payload)/          # Payload admin + API
│   └── api/                # Custom API endpoints, webhooks, crons
├── collections/            # Payload CMS collections (data models)
├── endpoints/              # Custom API endpoint handlers
├── globals/                # Payload global configs (site settings)
├── components/             # React components
├── hooks/                  # Payload lifecycle hooks
├── utilities/              # Shared utilities
├── migrations/             # Database migrations
└── lib/                    # External service integrations
```

### Mobile App (product-report-mobile)

```
src/
├── api/                    # Backend API clients
│   ├── payload.ts          # CMS integration (auth, data)
│   ├── product-report.ts   # Product analysis API
│   └── product-vote.ts     # Community voting
├── state/                  # Zustand stores
│   ├── authStore.ts        # Authentication
│   ├── subscriptionStore.ts # RevenueCat + Stripe sync
│   ├── store.ts            # Products, articles, videos
│   ├── historyStore.ts     # Scan history
│   ├── streakStore.ts      # Engagement streaks
│   └── badgeStore.ts       # Gamification
├── navigation/             # React Navigation setup
├── screens/                # 27 screen components
├── components/             # 50+ reusable components
├── hooks/                  # Custom hooks (paywall, notifications, etc.)
├── context/                # React Context providers
├── lib/                    # Analytics, notifications, fingerprint
├── theme/                  # Design system tokens
└── types/                  # TypeScript definitions
```

---

## Code Review Scope

### PART 1: Backend/CMS Review

#### 1.1 Collections (`src/collections/`)

**Data Modeling:**
- Field types appropriate for data
- Required vs optional fields
- Indexing strategy for query performance
- Relationship cardinality (hasMany, polymorphic)

**Access Control:**
- Role-based access (admin, product_editor, member, public)
- Field-level access restrictions
- API key authentication patterns
- Potential data leakage

**Hooks:**
- beforeChange/afterChange logic
- Side effects and potential race conditions
- Error handling in hooks
- Performance implications

**Key Collections:**
- `Products.ts` - Core entity, complex hooks, verdict system
- `Brands.ts` - Trust scoring logic
- `ProductVotes.ts` - Voting/weighting system
- `Users.ts` - Auth, subscriptions, GDPR compliance
- `DeviceFingerprints.ts` - Fraud detection
- `Referrals.ts` & `ReferralPayouts.ts` - Commission tracking

#### 1.2 API Endpoints (`src/endpoints/` + `src/app/api/`)

**Security:**
- Authentication requirements
- Input validation and sanitization
- Rate limiting
- IDOR vulnerabilities
- SQL/NoSQL injection vectors

**Key Endpoints:**
- `product-unlock.ts` - Paywall logic
- `referral-enhanced.ts` - Commission calculations
- `brand-auth.ts` - Brand portal authentication
- `crowdsource-submit.ts` - User submissions
- Webhook handlers (Stripe, RevenueCat, Apple)

#### 1.3 Frontend (`src/app/(frontend)/`)

- Client vs server components
- Data fetching patterns
- Image optimization
- Loading states and error boundaries

---

### PART 2: Mobile App Review

#### 2.1 State Management (`src/state/`)

**Zustand Stores:**
- Proper selector memoization (useShallow)
- Persistence strategy (AsyncStorage)
- Hydration synchronization
- State shape and normalization

**Key Stores:**
- `authStore.ts` - Login/logout, token management, OAuth
- `subscriptionStore.ts` - RevenueCat sync, entitlement checks
- `store.ts` - CMS data fetching, caching
- `historyStore.ts` - User activity tracking

#### 2.2 API Integration (`src/api/`)

**Backend Communication:**
- Error handling patterns
- Retry logic
- Offline support
- Token refresh flow

**Key Files:**
- `payload.ts` - Main CMS client
- `product-report.ts` - Product analysis
- `product-vote.ts` - Voting system

#### 2.3 Navigation & Screens (`src/navigation/`, `src/screens/`)

**Navigation:**
- Deep linking configuration
- Screen lazy loading
- Navigation state persistence
- Auth flow routing

**Key Screens:**
- `HomeScreen.tsx` - Main feed
- `ProductReportScreen.tsx` - Product analysis view
- `ScannerScreen.tsx` - Barcode scanning
- `PaywallScreen.tsx` - Subscription UI

#### 2.4 Hooks (`src/hooks/`)

**Custom Hooks:**
- `useAdaptivePaywall.ts` - Paywall trigger logic
- `useRevenueCatSync.ts` - Subscription synchronization
- `useHydrationGate.ts` - Store initialization
- `usePushNotifications.ts` - Notification handling

#### 2.5 Security

**Auth Security:**
- Token storage (SecureStore)
- OAuth implementation
- Session management

**Data Security:**
- Sensitive data handling
- API key exposure
- Debug logging in production

---

## Review Output Format

For each area reviewed, provide:

### [Area Name]

**Severity Levels:**
- 🔴 CRITICAL - Security vulnerability or data loss risk
- 🟠 HIGH - Significant bug or performance issue
- 🟡 MEDIUM - Code quality or minor bug
- 🟢 LOW - Improvement suggestion

**Findings:**

| Severity | File:Line | Issue | Recommendation |
|----------|-----------|-------|----------------|
| 🔴 | `file.ts:123` | Description | Fix suggestion |

**Summary:**
- X critical, Y high, Z medium, W low issues found
- Top 3 priorities to address

---

## Specific Questions to Answer

### Backend Questions
1. **Security Posture:** What are the top 5 security risks?
2. **Performance Bottlenecks:** What queries will slow at scale?
3. **Data Integrity:** Any race conditions or edge cases?
4. **GDPR/Privacy:** Is user data properly protected and deletable?

### Mobile Questions
5. **State Management:** Are there memory leaks or stale state issues?
6. **Offline Behavior:** How does the app handle poor connectivity?
7. **Subscription Logic:** Any edge cases in paywall/entitlement checks?
8. **Performance:** Any jank, slow renders, or memory issues?

### Cross-Platform Questions
9. **API Contract:** Do mobile and backend stay in sync?
10. **Auth Flow:** Any gaps in the auth/token refresh flow?
11. **Subscription Sync:** Does RevenueCat ↔ Stripe ↔ Payload sync correctly?

---

## Priority Files to Review

### Backend (payload-website-starter)

```
src/collections/Products.ts          # Core entity, 1400+ lines
src/collections/Users.ts             # Auth, subscriptions, GDPR
src/endpoints/product-unlock.ts      # Paywall logic
src/endpoints/referral-enhanced.ts   # Commission system
src/app/api/webhooks/stripe/route.ts # Payment webhooks
src/app/api/webhooks/revenuecat/route.ts
```

### Mobile (product-report-mobile)

```
src/App.tsx                          # Entry point, initialization
src/navigation/RootNavigator.tsx     # Navigation, deep linking
src/state/authStore.ts               # Authentication logic
src/state/subscriptionStore.ts       # RevenueCat integration
src/api/payload.ts                   # Backend API client
src/hooks/useAdaptivePaywall.ts      # Paywall trigger logic
src/screens/ProductReportScreen.tsx  # Core product view
```

---

## What Success Looks Like

After this review, we should have:

1. **Prioritized issue list** - Ranked by severity and effort
2. **Security hardening plan** - All vulnerabilities documented with fixes
3. **Performance optimization roadmap** - Bottlenecks identified with solutions
4. **Architecture recommendations** - Patterns to adopt/avoid
5. **Mobile-specific fixes** - State, navigation, and offline issues
6. **Cross-platform sync audit** - Subscription and auth flow verification

---

## Additional Context

- Recent security fixes applied to backend (commit `07d64f9`)
- Mobile app uses "Solution Gating" paywall (adaptive, behavior-triggered)
- Gamification system: badges, streaks, achievements
- Both platforms share RevenueCat for subscription management
- Backend deployed on Vercel with PostgreSQL
- Mobile supports iOS and Android via Expo
