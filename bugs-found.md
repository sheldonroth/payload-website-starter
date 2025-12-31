# Bugs Found During Testing

**Testing Date:** 2025-12-31
**Tester:** Claude (Ralph Wiggum Loop)

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 1 (FIXED) |
| 🟠 High | 0 |
| 🟡 Medium | 3 (1 FIXED) |
| 🔵 Low | 1 |

---

## Critical Bugs (Blocking)

### BUG-001: Vercel Deployment Server Error ✅ FIXED

**Severity:** 🔴 Critical
**Section:** Deployment / Infrastructure
**Status:** ✅ RESOLVED

**Root Cause:** Missing columns in `payload_locked_documents__rels` table
**Solution:** Added 20 FK columns via direct SQL in Neon Console
**Resolution Date:** 2025-12-31

**Notes:**
- Column `price_history_id` and other FK columns were missing
- Fixed via migration: `20251231_205500_emergency_column_fix`

---

## High Priority Bugs

*None found yet*

---

## Medium Priority Bugs

### BUG-002: Brands API Returns 500 Error

**Severity:** 🟡 Medium
**Section:** API Endpoints
**Endpoint:** `GET /api/brands`

**Steps to Reproduce:**
1. Call `curl https://payload-website-starter-smoky-sigma.vercel.app/api/brands`
2. Observe 500 error response

**Expected Behavior:**
Should return brands list or empty array with standard pagination

**Actual Behavior:**
Returns `{"errors":[{"message":"Something went wrong."}]}`

**Possible Cause:**
- Database schema mismatch for brands table
- Missing migration for brands collection
- Column type mismatch

**Notes:**
- Other collections (products, categories, videos) work fine
- Brands collection config looks correct in code
- Admin UI also shows blank page for this collection

---

### BUG-004: User Submissions Admin Page Blank

**Severity:** 🟡 Medium
**Section:** Admin UI / Collections
**URL:** `/admin/collections/user-submissions`

**Steps to Reproduce:**
1. Navigate to Admin → Community → User Submissions
2. Observe blank page (only header visible)

**Expected Behavior:**
Should show list view with search, columns, filters, and create button

**Actual Behavior:**
Page renders with only header - no content area loads

**Possible Cause:**
- Similar to Brands issue - likely database schema mismatch
- Missing columns in user_submissions table
- This explains why BUG-003 (Leaderboard API) fails

**Notes:**
- Related to BUG-003 - both involve user-submissions collection
- Collection is part of "Community" nav group

---

### BUG-005: Magic Input Fails on YouTube Channel URLs ✅ FIXED

**Severity:** 🟡 Medium
**Section:** AI Features / Magic Input
**Component:** `/src/endpoints/unified-ingest.ts`
**Status:** ✅ RESOLVED

**Steps to Reproduce:**
1. Navigate to Admin Dashboard
2. Locate the Magic Input field ("Paste any URL or barcode")
3. Enter a YouTube channel URL: `https://www.youtube.com/@MassSpecEverything`
4. Observe "Detected: YouTube Video" (incorrect detection)
5. Click "Ingest"
6. Error displays: "⚠️ Could not extract YouTube video ID"

**Expected Behavior:**
- Should detect as "YouTube Channel" (not Video)
- Should route to Channel Analyzer, OR
- Should display helpful error: "Channel URLs not supported in Magic Input. Use Channel Analyzer."

**Actual Behavior:**
- Incorrectly detects channel URL as "YouTube Video"
- Fails with generic error about video ID extraction

**Root Cause:**
The `extractYouTubeVideoId()` function in `unified-ingest.ts` only supports these patterns:
- `/watch?v=VIDEO_ID`
- `youtu.be/VIDEO_ID`
- `/embed/VIDEO_ID`
- `/shorts/VIDEO_ID`

Missing patterns for channel URLs:
- `/@username`
- `/channel/CHANNEL_ID`
- `/c/channel_name`

**Code Location:** `src/endpoints/unified-ingest.ts:65-77`

**Recommended Fix:**
1. Add channel URL detection to `detectInputType()` returning distinct type like 'youtube-channel'
2. Route 'youtube-channel' type to Channel Analyzer, OR
3. Return helpful error message explaining to use Channel Analyzer instead

**Resolution:**
- Added `youtube_channel` input type to backend (`unified-ingest.ts`)
- Added `isYouTubeChannelUrl()` helper function to detect channel URL patterns
- Updated `detectInputType()` to return `youtube_channel` for channel URLs
- Frontend now displays "YouTube Channel" badge for channel URLs
- Helpful error message guides users to Channel Analyzer tool
- **Resolution Date:** 2025-12-31

---

## Low Priority Bugs

### BUG-003: Leaderboard API Returns Error

**Severity:** 🔵 Low
**Section:** API Endpoints / Crowdsource
**Endpoint:** `GET /api/crowdsource/leaderboard`

**Steps to Reproduce:**
1. Call `curl https://payload-website-starter-smoky-sigma.vercel.app/api/crowdsource/leaderboard`
2. Observe error response

**Expected Behavior:**
Should return leaderboard data or empty array

**Actual Behavior:**
Returns `{"success":false,"error":"Failed to load leaderboard"}`

**Possible Cause:**
- Query on user-submissions collection failing
- Missing `status` field in user-submissions
- No verified submissions exist yet (edge case handling needed)

**Notes:**
- Low priority as feature is not yet in production use
- Error handling could be improved to return empty array instead of error

---

## Bug Template

```
### BUG-XXX: [Title]

**Severity:** 🔴 Critical / 🟠 High / 🟡 Medium / 🔵 Low
**Section:** [Test section]
**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**

**Actual Behavior:**

**Screenshot:** [if applicable]

**Notes:**
```
