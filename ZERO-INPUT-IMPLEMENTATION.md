# Zero-Input CMS Implementation Tracker

## Overview
Implementing 6 high-impact automation features to achieve 90%+ Zero-Input capability.

**Start Date**: 2026-01-03
**Target**: Reduce manual product entry to near-zero

---

## Implementation Status

| # | Feature | Priority | Status | Files Modified |
|---|---------|----------|--------|----------------|
| 1 | Fuzzy Ingredient Matching | HIGH | COMPLETE | smart-automation.ts, fuzzy-match.ts |
| 2 | Centralized Error Logging | HIGH | COMPLETE | error-logger.ts (new), AuditLog.ts |
| 3 | AI Category Classification | MEDIUM | COMPLETE | ai-category.ts (new), Products.ts |
| 4 | Auto-Suggest Safe Alternatives | MEDIUM | COMPLETE | safe-alternatives.ts (new), Products.ts |
| 5 | Configurable Thresholds | MEDIUM | COMPLETE | SiteSettings.ts, get-thresholds.ts (new) |
| 6 | Auto-Extract from Product Images (OCR) | HIGH | COMPLETE | image-extraction.ts (new), image-extract.ts (new), Products.ts, payload.config.ts |

---

## Feature Details

### 1. Fuzzy Ingredient Matching
**Goal**: Reduce unmatched ingredients by ~40% using Levenshtein distance

**Implementation**:
- Add `fastest-levenshtein` package
- Modify `parseAndLinkIngredients()` to try fuzzy match after exact match fails
- Threshold: 2 characters difference max
- Log fuzzy matches to audit for review

**Test Cases**:
- "Sodium Benzoat" → "Sodium Benzoate"
- "Aspartme" → "Aspartame"
- "Red 40" → exact match (no fuzzy needed)

---

### 2. Centralized Error Logging
**Goal**: Make all automation errors visible in admin panel

**Implementation**:
- Create `/src/utilities/error-logger.ts`
- Export `logError()` function that writes to AuditLog
- Inject into all Products hooks (9 locations)
- Inject into Ingredients cascade hook
- Add error type filtering in AuditLog queries

**Error Categories**:
- `ingredient_parse_error`
- `category_hydration_error`
- `verdict_calculation_error`
- `conflict_detection_error`
- `enrichment_error`
- `image_processing_error`

---

### 3. AI Category Classification
**Goal**: Auto-assign category based on product name + ingredients

**Implementation**:
- Create `classifyCategory()` in smart-automation.ts
- Use Gemini AI with category list context
- Add `pendingCategoryAI` field or use existing `pendingCategoryName`
- Trigger on product create when category is empty
- Confidence threshold: only auto-assign if AI is confident

**Fallback**: If AI unsure, leave for manual selection

---

### 4. Auto-Suggest Safe Alternatives
**Goal**: Auto-populate `comparedWith` for AVOID products

**Implementation**:
- Add afterChange hook on Products
- Trigger when: verdict=avoid AND status=published
- Find: same category + verdict=recommend + published
- Sort by: overallScore descending
- Limit: top 3 alternatives
- Skip if: comparedWith already has items (manual override)

---

### 5. Configurable Thresholds
**Goal**: Move hard-coded values to SiteSettings

**Settings to Add**:
- `freshnessThresholdDays` (default: 180)
- `fuzzyMatchThreshold` (default: 2)
- `featuredProductWeights` (JSON with scoring weights)
- `autoAlternativesLimit` (default: 3)

**Files to Update**:
- SiteSettings.ts - add fields
- smart-automation.ts - read freshnessThresholdDays, fuzzyMatchThreshold
- featured-product.ts - read featuredProductWeights

---

### 6. Auto-Extract from Product Images (OCR)
**Goal**: Extract name, brand, ingredients from uploaded product images

**Implementation**:
- Reuse `extractProductFromImage()` from crowdsource-submit.ts
- Create `/src/utilities/image-extraction.ts` (shared utility)
- Add UI trigger in Products admin (button or auto on image upload)
- Create `/api/products/extract-from-image` endpoint
- Populate: name, brand, ingredientsRaw, upc (if visible)

**Integration Points**:
- Products beforeChange hook (if image uploaded and name empty)
- Manual trigger button in admin UI

---

## Testing Checklist

- [ ] Fuzzy matching: Test with 10 common misspellings
- [ ] Error logging: Trigger intentional errors, verify in AuditLog
- [ ] Category AI: Test with 5 products across different categories
- [ ] Alternatives: Create AVOID product, verify alternatives populated
- [ ] Thresholds: Change settings, verify behavior changes
- [ ] OCR: Upload product label image, verify extraction

---

## Rollback Plan

Each feature is implemented as an independent hook/utility. To rollback:
1. Comment out the specific hook in Products.ts
2. Revert utility file changes
3. No database migrations required (additive changes only)

---

## Notes

- All features use existing patterns (hooks, audit logging)
- No breaking changes to existing functionality
- Each feature can be disabled independently
- Performance: All heavy operations run in background (setTimeout)
