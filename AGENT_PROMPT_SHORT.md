# Expert Code Review Prompt

## Your Task

Conduct a comprehensive code review of "The Product Report" - a consumer trust platform with:

1. **Backend/CMS** - `payload-website-starter/` (Payload CMS + Next.js)
2. **Mobile App** - `product-report-mobile/` (Expo React Native)

## Business Context

- **Product:** Consumer product safety platform with verdicts (RECOMMEND/CAUTION/AVOID)
- **Backend:** Payload CMS 3.x, Next.js 15, TypeScript, PostgreSQL, Vercel
- **Mobile:** React Native 0.81 + Expo 54, Zustand, RevenueCat
- **Revenue:** Premium subscriptions, affiliate links, B2B brand portal
- **Users:** Health-conscious consumers + brands wanting trust scores

---

## PART 1: Backend Review (payload-website-starter)

### Security
- Access control in `src/collections/*.ts`
- API authentication in `src/endpoints/*.ts`
- Input validation - injection vectors
- Webhook verification in `src/app/api/webhooks/`

### Data Integrity
- Hook logic - race conditions, side effects
- Transaction safety in payment flows
- Referral commission calculations

### Performance
- N+1 queries, unbounded queries
- Missing pagination, indexes
- Expensive operations in hot paths

### Key Files
```
src/collections/Products.ts      # Core entity, 1400+ lines
src/collections/Users.ts         # Auth, GDPR
src/endpoints/product-unlock.ts  # Paywall
src/endpoints/referral-enhanced.ts
src/app/api/webhooks/stripe/
src/app/api/webhooks/revenuecat/
```

---

## PART 2: Mobile Review (product-report-mobile)

### State Management
- Zustand store design in `src/state/`
- Selector memoization (useShallow)
- Hydration synchronization
- Memory leaks, stale state

### API Integration
- Error handling in `src/api/`
- Offline support
- Token refresh flow
- Retry logic

### Navigation & Screens
- Deep linking in `src/navigation/`
- Lazy loading patterns
- Auth flow routing

### Security
- Token storage (SecureStore)
- API key exposure
- Debug logging in production

### Key Files
```
src/App.tsx                      # Entry, initialization
src/navigation/RootNavigator.tsx # Deep linking
src/state/authStore.ts           # Authentication
src/state/subscriptionStore.ts   # RevenueCat
src/api/payload.ts               # Backend client
src/hooks/useAdaptivePaywall.ts  # Paywall logic
```

---

## PART 3: Cross-Platform

### Subscription Sync
- RevenueCat ↔ Stripe ↔ Payload sync
- Entitlement edge cases
- Restore purchases flow

### Auth Flow
- Token refresh across platforms
- OAuth (Apple, Google) consistency
- Session invalidation

### API Contract
- Response shape consistency
- Error handling alignment
- Version compatibility

---

## Output Format

For each issue:

| Severity | Location | Issue | Fix |
|----------|----------|-------|-----|
| 🔴 CRITICAL | file:line | description | recommendation |
| 🟠 HIGH | | | |
| 🟡 MEDIUM | | | |

## Deliverables

1. **Security Report** - All vulnerabilities ranked
2. **Performance Report** - Bottlenecks at scale
3. **Mobile Report** - State, navigation, offline issues
4. **Cross-Platform Audit** - Subscription/auth sync issues
5. **Top 10 Priorities** - What to fix first

Focus on: data breaches, financial loss, data corruption, performance degradation, poor UX.
