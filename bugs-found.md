# Bugs Found During Testing

**Testing Date:** 2025-12-31
**Tester:** Claude (Ralph Wiggum Loop)

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 1 (FIXED) |
| 🟠 High | 0 |
| 🟡 Medium | 3 (ALL FIXED) |
| 🔵 Low | 1 (FIXED) |

**ALL BUGS FIXED** - Migration `20251231_210000_create_brands_user_submissions` creates the missing tables.

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

### BUG-002: Brands API Returns 500 Error ✅ FIXED

**Severity:** 🟡 Medium
**Section:** API Endpoints
**Endpoint:** `GET /api/brands`
**Status:** ✅ RESOLVED

**Root Cause:** Missing `brands` database table - collection was defined but never had a migration created.

**Solution:** Created migration `20251231_210000_create_brands_user_submissions` that creates:
- `brands` table with all fields
- `brands_aliases` array table
- `brands_recalls` array table
- `brands_rels` relationship table
- Required enum types and foreign key constraints

**Resolution Date:** 2025-12-31

---

### BUG-004: User Submissions Admin Page Blank ✅ FIXED

**Severity:** 🟡 Medium
**Section:** Admin UI / Collections
**URL:** `/admin/collections/user-submissions`
**Status:** ✅ RESOLVED

**Root Cause:** Missing `user_submissions` database table - collection was defined but never had a migration created.

**Solution:** Created migration `20251231_210000_create_brands_user_submissions` that creates:
- `user_submissions` table with all fields
- `user_submissions_images` array table
- `user_submissions_reaction_details_symptoms` array table
- Required enum types and foreign key constraints

**Resolution Date:** 2025-12-31

**Notes:**
- This also fixes BUG-003 (Leaderboard API) which queries the user-submissions collection

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

### BUG-003: Leaderboard API Returns Error ✅ FIXED

**Severity:** 🔵 Low
**Section:** API Endpoints / Crowdsource
**Endpoint:** `GET /api/crowdsource/leaderboard`
**Status:** ✅ RESOLVED

**Root Cause:** Missing `user_submissions` database table - the leaderboard API queries this collection.

**Solution:** Fixed by migration `20251231_210000_create_brands_user_submissions` which creates the user_submissions table.

**Resolution Date:** 2025-12-31

**Notes:**
- Fixed as part of BUG-004 fix (both require user_submissions table)

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
