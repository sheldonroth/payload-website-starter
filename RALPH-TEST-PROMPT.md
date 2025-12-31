# Ralph Wiggum Comprehensive Testing Prompt

## Mission

You are a meticulous QA engineer testing a Payload CMS application with 9 AI engines, 16 collections, and extensive custom admin UI. Your goal is to systematically verify that ALL features work correctly and the UI/UX is polished and professional.

## Testing Protocol

Work through each section below. For each test:
1. Navigate to the feature in the browser
2. Test the happy path (expected behavior)
3. Test edge cases (empty inputs, invalid data, boundary conditions)
4. Verify UI/UX (loading states, error messages, responsive design, accessibility)
5. Log results in `test-results.md` with PASS/FAIL and notes
6. Take screenshots of any issues found

## Test Sections

### SECTION 1: Authentication & Access Control

**1.1 Login Flow**
- [ ] Navigate to `/admin`
- [ ] Verify login form renders correctly
- [ ] Test login with valid admin credentials
- [ ] Test login with invalid credentials (should show error)
- [ ] Verify "Forgot Password" link works
- [ ] Check BeforeLogin custom component displays

**1.2 OAuth Authentication**
- [ ] Test Google Sign-In button (if configured)
- [ ] Test Apple Sign-In button (if configured)
- [ ] Verify OAuth state parameter CSRF protection works
- [ ] Test rate limiting on OAuth endpoints

**1.3 Role-Based Access**
- [ ] As admin: verify full access to all collections
- [ ] Test that product_editor cannot delete products
- [ ] Verify AuditLog is read-only for non-admins
- [ ] Check field-level access restrictions work

### SECTION 2: AI Features (Dream Phase Engines)

**2.1 Video-to-Draft Engine**
- [ ] Navigate to AI Tools → Video-to-Draft
- [ ] Paste a YouTube URL and submit
- [ ] Verify transcript extraction works
- [ ] Check product identification from transcript
- [ ] Verify sentiment analysis output
- [ ] Confirm category suggestions appear
- [ ] Check drafts are created with `ai_draft` status
- [ ] Verify `ai_confidence` and `ai_source_type` fields populate

**2.2 Channel Sync**
- [ ] Navigate to AI Tools → Channel Sync
- [ ] Enter a YouTube channel ID
- [ ] Test batch video analysis
- [ ] Verify progress indicators during processing
- [ ] Check error handling for invalid channels

**2.3 Product Enricher**
- [ ] Navigate to AI Tools → Product Enricher
- [ ] Select a product to enrich
- [ ] Verify Google Custom Search finds images
- [ ] Check price range suggestions
- [ ] Verify source attribution is saved
- [ ] Test with product that has no search results

**2.4 SEO Generator**
- [ ] Navigate to AI Tools → SEO Generator
- [ ] Select a product without SEO metadata
- [ ] Generate meta title, description, OG tags
- [ ] Verify generated content is appropriate length
- [ ] Check keywords are relevant

**2.5 Poll Generator**
- [ ] Navigate to AI Tools → Poll Generator
- [ ] Generate a poll for a product
- [ ] Verify question quality and relevance
- [ ] Test Category Poll Generator separately
- [ ] Check poll options are balanced

**2.6 TikTok Analyzer**
- [ ] Navigate to AI Tools → TikTok Sync
- [ ] Test TikTok URL analysis (if API configured)
- [ ] Verify transcript extraction
- [ ] Check product extraction from content

**2.7 Label Decode**
- [ ] Test `/api/label/decode` endpoint
- [ ] Upload/paste ingredient label text
- [ ] Verify ingredient parsing accuracy
- [ ] Check ingredient linking to Ingredients collection

**2.8 Content Amplify**
- [ ] Test content amplification feature
- [ ] Verify distribution options work

**2.9 AI Draft Inbox**
- [ ] Navigate to AI Draft Inbox
- [ ] Verify all AI-generated drafts appear
- [ ] Test approving a draft (changes status)
- [ ] Test rejecting/deleting a draft
- [ ] Check AI Product Suggestions view
- [ ] Verify Suggested Categories view

### SECTION 3: Collections CRUD Operations

**For each collection, test: Create, Read, Update, Delete, List, Search**

**3.1 Products Collection**
- [ ] Create new product with all required fields
- [ ] Verify 150+ fields render correctly
- [ ] Test auto-verdict calculation
- [ ] Check freshness status automation
- [ ] Verify ingredient text parsing hook
- [ ] Test category hydration (create on-the-fly)
- [ ] Check Verdict Rules engine evaluation
- [ ] Test ingredient conflict detection
- [ ] Verify published product lock works
- [ ] Test searchable fields (name, brand, UPC)

**3.2 Categories Collection**
- [ ] Create parent category
- [ ] Create child category with parent link
- [ ] Verify harmful ingredients inheritance
- [ ] Check nested docs plugin works
- [ ] Test category icon preview field

**3.3 Ingredients Collection**
- [ ] Create new ingredient
- [ ] Set verdict (recommend/caution/avoid)
- [ ] Verify cascade hook triggers on update
- [ ] Check affected products are marked for review
- [ ] Verify audit log entry created

**3.4 Brands Collection**
- [ ] Create brand with trust score
- [ ] Test parent company tracking
- [ ] Verify recall history fields
- [ ] Check brand sync functionality

**3.5 Posts Collection**
- [ ] Create new post with Lexical editor
- [ ] Test rich text formatting
- [ ] Add author relationship
- [ ] Configure SEO fields
- [ ] Test live preview (3 breakpoints)
- [ ] Verify search indexing

**3.6 Pages Collection**
- [ ] Create page with blocks
- [ ] Test each block type:
  - [ ] ArchiveBlock
  - [ ] Content block
  - [ ] MediaBlock
  - [ ] RelatedPosts
  - [ ] Form block
  - [ ] CallToAction
  - [ ] Code block
  - [ ] Banner
- [ ] Test redirects plugin
- [ ] Verify hero types (High/Medium/Low/Post)

**3.7 Articles Collection**
- [ ] Create investigation article
- [ ] Test auto-generation from polls
- [ ] Verify content validation
- [ ] Check product linking

**3.8 Media Collection**
- [ ] Upload image
- [ ] Verify Vercel Blob storage
- [ ] Check Sharp image processing
- [ ] Test thumbnail generation
- [ ] Verify lazy loading works

**3.9 Investigation Polls**
- [ ] Create new poll
- [ ] Add poll options
- [ ] Test voting mechanism
- [ ] Verify poll-to-article pipeline on close

**3.10 User Submissions**
- [ ] View submissions list
- [ ] Test product scan submission
- [ ] Verify points awarded (10-25)
- [ ] Check leaderboard updates
- [ ] Test email notifications

**3.11 Verdict Rules**
- [ ] Create contains ingredient rule
- [ ] Create missing ingredient rule
- [ ] Create verdict matching rule
- [ ] Verify rules apply to products

**3.12 Price History**
- [ ] Add price history entry
- [ ] Test shrinkflation detection
- [ ] Verify daily tracking

**3.13 Regulatory Changes**
- [ ] Create regulatory change
- [ ] Verify affected products auto-linked
- [ ] Check freshness status update cascade

**3.14 Sponsored Test Requests**
- [ ] View sponsored test list
- [ ] Check Stripe integration status
- [ ] Verify $149 test workflow

**3.15 Audit Log**
- [ ] Verify entries appear for all actions
- [ ] Check 13 action types logged
- [ ] Confirm immutability (cannot edit/delete)
- [ ] Test filtering and search

**3.16 Users Collection**
- [ ] Create user with each role
- [ ] Test privilege escalation prevention
- [ ] Verify password reset flow
- [ ] Check self-or-admin access pattern

### SECTION 4: API Endpoints

**4.1 Content Creation Endpoints**
- [ ] POST `/api/video/analyze` - single video
- [ ] POST `/api/channel/analyze` - channel batch
- [ ] POST `/api/poll/generate`
- [ ] POST `/api/poll/category`
- [ ] POST `/api/seo/generate`
- [ ] POST `/api/tiktok/analyze`

**4.2 Product Endpoints**
- [ ] POST `/api/product/enrich`
- [ ] POST `/api/category/enrich`
- [ ] POST `/api/batch/enrich`
- [ ] POST `/api/ingest`

**4.3 Admin Endpoints**
- [ ] POST `/api/admin/link-videos`
- [ ] POST `/api/admin/category-cleanup`
- [ ] GET `/api/backup/export` (test JSON/CSV)
- [ ] POST `/api/youtube/sync`
- [ ] POST `/api/admin/purge` (careful! test with minimal data)

**4.4 Intelligence Endpoints**
- [ ] POST `/api/recall/check`
- [ ] POST `/api/skimpflation/check`
- [ ] POST `/api/regulatory/monitor`
- [ ] POST `/api/brand/trust`
- [ ] POST `/api/brand/sync`

**4.5 Community Endpoints**
- [ ] POST `/api/crowdsource/submit`
- [ ] GET `/api/crowdsource/leaderboard`
- [ ] POST `/api/bulk/operations`

**4.6 Utility Endpoints**
- [ ] POST `/api/email/send`
- [ ] POST `/api/magic-url`
- [ ] POST `/api/cron/jobs`

### SECTION 5: Admin UI Components

**5.1 Dashboard Components**
- [ ] BeforeDashboard renders welcome message
- [ ] Seed button works (if applicable)
- [ ] AdminNavLinks display correctly
- [ ] PreFlightCheck runs without errors

**5.2 AI Tools Dashboard**
- [ ] All 9 AI tools accessible
- [ ] Navigation between tools works
- [ ] Each tool loads without errors
- [ ] Loading states display properly
- [ ] Error states are user-friendly

**5.3 Utility Components**
- [ ] ProductsToReview list works
- [ ] BatchImageReviewer loads images
- [ ] ImageReview provides feedback options
- [ ] BackupDownload exports correctly
- [ ] AnalyticsDashboard shows stats
- [ ] IconPreviewField renders icons
- [ ] InboxDashboard shows submissions

**5.4 Email Tester**
- [ ] EmailTester component loads
- [ ] Test email sends successfully
- [ ] Newsletter Export works

### SECTION 6: UI/UX Quality

**6.1 Visual Consistency**
- [ ] Consistent spacing throughout admin
- [ ] Colors match design system
- [ ] Typography is readable
- [ ] Icons are aligned and sized correctly
- [ ] No broken images or missing assets

**6.2 Loading States**
- [ ] All async operations show loading indicators
- [ ] Skeleton loaders where appropriate
- [ ] No jarring layout shifts
- [ ] Progress bars for long operations

**6.3 Error Handling**
- [ ] Form validation messages are clear
- [ ] API errors show user-friendly messages
- [ ] Network errors are handled gracefully
- [ ] No uncaught exceptions in console

**6.4 Responsive Design**
- [ ] Admin works on tablet (768px)
- [ ] Forms are usable on smaller screens
- [ ] Tables scroll horizontally if needed
- [ ] Mobile navigation works

**6.5 Accessibility**
- [ ] All interactive elements are keyboard accessible
- [ ] Focus states are visible
- [ ] Form labels are properly associated
- [ ] Color contrast is sufficient
- [ ] Screen reader landmarks exist

**6.6 Performance**
- [ ] Pages load in < 3 seconds
- [ ] No obvious memory leaks
- [ ] Lists paginate properly
- [ ] Large data sets don't freeze UI

### SECTION 7: Frontend Rendering

**7.1 Public Pages**
- [ ] Homepage renders correctly
- [ ] Blog/Posts archive works
- [ ] Individual post pages render
- [ ] Product pages display all data
- [ ] Category pages work

**7.2 Components**
- [ ] CollectionArchive pagination works
- [ ] RichText renders Lexical content
- [ ] Media component lazy loads
- [ ] Card components display correctly
- [ ] Pagination controls work

**7.3 Live Preview**
- [ ] Mobile breakpoint (375x667)
- [ ] Tablet breakpoint (768x1024)
- [ ] Desktop breakpoint (1440x900)
- [ ] Theme switching works
- [ ] Real-time updates sync

**7.4 Theme**
- [ ] ThemeSelector toggles dark/light
- [ ] Styles apply correctly in both themes
- [ ] No flash of wrong theme on load

### SECTION 8: Integrations

**8.1 External Services**
- [ ] Google Custom Search API responds
- [ ] YouTube API data fetches
- [ ] OpenAI API generates content
- [ ] Resend emails deliver
- [ ] Vercel Blob stores files
- [ ] Database queries work

**8.2 Payload Plugins**
- [ ] SEO Plugin generates metadata
- [ ] Nested Docs creates hierarchy
- [ ] Form Builder renders forms
- [ ] Redirects plugin redirects
- [ ] Search plugin indexes content

## Completion Criteria

Before outputting the completion promise, verify:
1. ALL test sections have been executed
2. `test-results.md` contains detailed results for every test
3. Critical bugs have been documented in `bugs-found.md`
4. Screenshots of issues are saved
5. No CRITICAL or BLOCKING issues remain untested

## Output

When ALL tests are complete and documented:

```
<promise>COMPREHENSIVE TESTING COMPLETE</promise>
```

## Files to Create/Update

- `test-results.md` - Detailed test results with PASS/FAIL
- `bugs-found.md` - List of bugs discovered with severity
- `ui-ux-recommendations.md` - UI/UX improvement suggestions
- `screenshots/` - Directory for issue screenshots

## Notes

- Use browser automation tools (mcp__claude-in-chrome__*) for UI testing
- Use API calls (fetch/curl via Bash) for endpoint testing
- Check browser console for JavaScript errors
- Monitor network tab for failed requests
- Test with realistic data, not just "test123"
