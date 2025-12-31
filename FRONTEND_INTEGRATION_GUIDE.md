# Frontend Integration Guide

This document describes 5 new features that have been built and need to be integrated into the frontend pages.

---

## Feature 1: Find Safe Alternative

**Purpose**: Show users safer product alternatives when viewing a product with concerning ingredients.

### API Endpoint
```
GET /api/products/alternatives?productId={id}&limit=5
```

**Response**:
```json
{
  "alternatives": [
    {
      "id": "123",
      "name": "Product Name",
      "slug": "product-slug",
      "verdict": "recommend",
      "overallScore": 85,
      "priceRange": "mid-range",
      "brand": "Brand Name",
      "image": { "url": "...", "alt": "..." },
      "score": 78,
      "improvements": ["Better verdict: recommend", "3 fewer concerning ingredients"]
    }
  ],
  "sourceProduct": { "id": "...", "name": "...", "verdict": "...", "harmfulIngredientCount": 5 },
  "totalCandidates": 12
}
```

### Component Created
- `src/components/SafeAlternatives/index.tsx` - Client component

### Integration Required
Add to product detail page (`src/app/(frontend)/products/[slug]/page.tsx`):

```tsx
import { SafeAlternatives } from '@/components/SafeAlternatives'

// In the product page component, add:
<SafeAlternatives productId={product.id} productName={product.name} />
```

**Placement**: Below the main product info, especially for products with "caution" or "avoid" verdicts.

---

## Feature 2: Affiliate Links

**Purpose**: Display Amazon affiliate buy buttons on product pages for monetization.

### Admin Configuration
Go to **Admin Panel > Settings > Site Settings** to configure:
- Amazon Affiliate Tag (e.g., "yoursite-20")
- Affiliate Disclosure Text
- Enable/Disable Affiliate Links

### Schema Changes
- Products now have `amazonAsin` field (10-character Amazon ASIN)
- When ASIN is set, affiliate links are auto-generated in `purchaseLinks`

### Component Created
- `src/components/AffiliateButton/index.tsx` - Client component with:
  - "Buy on Amazon" button
  - Affiliate disclosure text
  - Click tracking (console log)

### Integration Required
Add to product detail page and/or product cards:

```tsx
import { AffiliateButton } from '@/components/AffiliateButton'

// Pass the product's purchaseLinks array
<AffiliateButton purchaseLinks={product.purchaseLinks} />
```

**Note**: The component automatically finds the Amazon link and displays it with proper disclosure.

---

## Feature 3: Personal Ingredient Watchlist

**Purpose**: Users can save ingredients they want to avoid. Products containing these ingredients show warnings.

### API Endpoints

**Get Watchlist**:
```
GET /api/users/me/watchlist
```
Response: `{ watchlist: [...], count: 5 }`

**Add to Watchlist**:
```
POST /api/users/me/watchlist
Body: { ingredientId: "123", ingredientName: "Red Dye 40", reason: "allergy" }
```

**Remove from Watchlist**:
```
DELETE /api/users/me/watchlist
Body: { ingredientId: "123" }
```

**Check Product Conflicts**:
```
POST /api/users/me/watchlist/check
Body: { productId: "456" }
```
Response: `{ hasConflicts: true, conflicts: [...] }`

### Components Created

1. **`src/components/WatchlistAlert/index.tsx`** - Warning badge for products
   - Shows when product contains watchlist ingredients
   - Has `compact` mode for product cards
   - Full mode shows expandable list of conflicting ingredients

2. **`src/components/WatchlistManager/index.tsx`** - Manage watchlist UI
   - Search and add ingredients
   - View and remove saved ingredients
   - Optional reason field

### Integration Required

**Product Detail Page** (`src/app/(frontend)/products/[slug]/page.tsx`):
```tsx
import { WatchlistAlert } from '@/components/WatchlistAlert'

// Near the top of product info
<WatchlistAlert productId={product.id} />
```

**Product Cards** (for grid/list views):
```tsx
import { WatchlistAlert } from '@/components/WatchlistAlert'

// In product card component
<WatchlistAlert productId={product.id} compact />
```

**User Settings/Profile Page** (create if doesn't exist):
```tsx
import { WatchlistManager } from '@/components/WatchlistManager'

// In user account/settings section
<WatchlistManager />
```

---

## Feature 4: Weekly Email Digest

**Purpose**: Send weekly curated emails to opted-in users.

### User Preference
- Field: `weeklyDigestEnabled` (checkbox, default: true)
- Also requires: `privacyConsent.marketingOptIn: true`

### Cron Schedule
- Runs every Tuesday at 10 AM UTC
- Route: `/api/cron/weekly-digest`
- Configured in `vercel.json`

### Integration Required

**User Settings Page** - Add toggle for digest preference:
```tsx
// Fetch current user and allow toggling weeklyDigestEnabled
const [digestEnabled, setDigestEnabled] = useState(user.weeklyDigestEnabled)

const toggleDigest = async () => {
  await fetch('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify({ weeklyDigestEnabled: !digestEnabled })
  })
  setDigestEnabled(!digestEnabled)
}

<label>
  <input type="checkbox" checked={digestEnabled} onChange={toggleDigest} />
  Receive weekly digest emails
</label>
```

**Note**: Users also need `marketingOptIn: true` to receive emails.

---

## Feature 5: Product Request Queue

**Purpose**: Users can request products to review and vote on existing requests.

### API Endpoints

**List Requests** (public):
```
GET /api/product-requests?sort=votes&status=pending&page=1&limit=20
```

**Create Request** (login required):
```
POST /api/product-requests
Body: { productName: "...", brand: "...", productUrl: "...", reason: "..." }
```

**Vote** (login required):
```
POST /api/product-requests/vote
Body: { requestId: "123", action: "add" } // or "remove"
```

### Page Created
- `src/app/(frontend)/request-product/page.tsx` - Server component
- `src/app/(frontend)/request-product/ProductRequestForm.tsx` - Form component
- `src/app/(frontend)/request-product/ProductRequestList.tsx` - List with voting

### Integration Required

**Navigation**: Add link to request page in header/footer:
```tsx
<Link href="/request-product">Request a Product</Link>
```

**Homepage or Products Page**: Consider adding a CTA:
```tsx
<div className="bg-blue-50 p-4 rounded-lg">
  <h3>Can't find what you're looking for?</h3>
  <p>Request a product and vote for what we review next!</p>
  <Link href="/request-product" className="btn">Submit Request</Link>
</div>
```

---

## Database Migrations

The following migrations will run automatically on Vercel deploy:

1. `20250101_000000_add_amazon_asin` - Adds `amazon_asin` to products
2. `20250101_000100_add_voting_to_user_submissions` - Adds voting fields
3. `20250101_000200_add_ingredient_watchlist` - Adds user watchlist fields

---

## Summary of Files Created

### Components
- `src/components/SafeAlternatives/index.tsx`
- `src/components/AffiliateButton/index.tsx`
- `src/components/WatchlistAlert/index.tsx`
- `src/components/WatchlistManager/index.tsx`

### Endpoints
- `src/endpoints/product-alternatives.ts`
- `src/endpoints/user-watchlist.ts`
- `src/endpoints/product-requests.ts`

### Pages
- `src/app/(frontend)/request-product/page.tsx`
- `src/app/(frontend)/request-product/ProductRequestForm.tsx`
- `src/app/(frontend)/request-product/ProductRequestList.tsx`

### Jobs
- `src/jobs/weekly-digest.ts`

### Globals
- `src/globals/SiteSettings.ts`

### Cron Routes
- `src/app/api/cron/weekly-digest/route.ts`

---

## Priority Integration Order

1. **Product Detail Page** - Add SafeAlternatives, WatchlistAlert, AffiliateButton
2. **Navigation** - Add link to /request-product
3. **Product Cards** - Add compact WatchlistAlert
4. **User Settings** - Add WatchlistManager and digest toggle
5. **Homepage** - Add product request CTA

---

## Environment Variables Needed

Ensure these are set in Vercel:
- `CRON_SECRET` - For authenticating cron jobs
- `RESEND_API_KEY` - For sending emails (already configured)

Optional for affiliate tracking:
- Configure Amazon Affiliate Tag in Admin > Site Settings
