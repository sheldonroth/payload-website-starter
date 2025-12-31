# Ralph Wiggum CMS Testing Prompt

## Mission
Systematically test all CMS functionality in the Product Report admin panel. Work through each test category, verifying features work correctly and logging any issues found.

## Environment
- URL: https://payload-website-starter-smoky-sigma.vercel.app/admin
- Login as admin user to access all features

---

## Test Categories

### 1. COLLECTION CRUD OPERATIONS

Test create, read, update operations for each collection:

**Catalog Collections:**
- [ ] **Products**: Create a test product with raw ingredients text. Verify auto-parsing links ingredients correctly. Check verdict auto-calculation. Test conflict detection by setting conflicting values.
- [ ] **Categories**: Create a category with a parent. Verify icon auto-selection works. Check harmful ingredient inheritance from parent.
- [ ] **Videos**: Create a video entry with a YouTube URL. Verify transcript extraction if triggered.
- [ ] **Articles**: Create an article with rich text content. Test image uploads.
- [ ] **Ingredients**: Create an ingredient, set verdict to "avoid". Verify cascade updates products using this ingredient.
- [ ] **Media**: Upload an image. Verify it appears in Vercel Blob storage.

**Research Collections:**
- [ ] **VerdictRules**: Create a rule with condition "contains_ingredient" and action "set_avoid". Verify rule evaluates on matching products.
- [ ] **Brands**: Create a brand with parent company. Check trust score calculation.
- [ ] **PriceHistory**: Add price data for an existing product.
- [ ] **RegulatoryChanges**: Create a regulatory change entry. Verify affected products are flagged.

**Community Collections:**
- [ ] **InvestigationPolls**: Create a poll with options. Test voting mechanism if available.
- [ ] **UserSubmissions**: Create a submission. Verify points are calculated.
- [ ] **SponsoredTestRequests**: Create a test request entry.

**System Collections:**
- [ ] **Users**: Verify user list displays. Check role-based field visibility.
- [ ] **AuditLog**: Verify audit entries are being created for AI/system actions (read-only).
- [ ] **Pages**: Edit homepage content if exists.

---

### 2. SMART AUTOMATION HOOKS

Test automated behaviors:

**Product Automation:**
- [ ] Enter raw ingredients text like "sugar, salt, red 40, aspartame" - verify ingredients are parsed and linked
- [ ] Set pending category names - verify categories auto-hydrate
- [ ] Create a product matching a verdict rule condition - verify rule fires and sets verdict
- [ ] Try to publish a product with conflicts - verify publish is blocked with clear message
- [ ] Check freshness status calculation on existing products

**Ingredient Cascade:**
- [ ] Change an ingredient verdict from "safe" to "avoid"
- [ ] Verify all products using that ingredient are marked for review
- [ ] Check if alert article was auto-generated (if 5+ products affected)

**Category Inheritance:**
- [ ] Create child category under parent with harmful ingredients
- [ ] Verify child inherits parent's harmful ingredient list

---

### 3. API ENDPOINTS

Navigate to or trigger these endpoints via admin actions:

**Content Analysis (if UI triggers exist):**
- [ ] `/api/video/analyze` - Test YouTube video analysis from Videos collection
- [ ] `/api/channel/analyze` - Test channel analysis if available in admin
- [ ] `/api/tiktok/analyze` - Test TikTok analysis if UI exists
- [ ] `/api/youtube/sync` - Test video sync functionality

**Product Management:**
- [ ] `/api/ingest` - Test unified ingestion if there's a URL input field
- [ ] `/api/product/enrich` - Test AI enrichment on a product
- [ ] `/api/batch/enrich` - Test batch operations view
- [ ] `/api/label/decode` - Test label image upload/decode

**Intelligence Features:**
- [ ] `/api/poll/generate` - Test AI poll generation
- [ ] `/api/seo/generate` - Test SEO metadata generation on content
- [ ] `/api/category/enrich` - Test category enrichment
- [ ] `/api/recall/check` - Test recall monitoring
- [ ] `/api/brand/trust` - Test brand trust calculation

---

### 4. CUSTOM ADMIN VIEWS

Navigate to each custom admin view:

- [ ] `/admin/ai-tools` - Test AI content generation interface
- [ ] `/admin/ai-suggestions` - Review AI product suggestions
- [ ] `/admin/suggested-categories` - Check category recommendations
- [ ] `/admin/analytics` - Verify analytics dashboard loads

---

### 5. ACCESS CONTROL

Test role-based restrictions:

- [ ] Verify admin can access all collections
- [ ] Check that premium fields (fullReview, purchaseLinks, pros/cons) display correctly
- [ ] Verify audit logs are read-only
- [ ] Test field-level visibility works as expected

---

### 6. UI/UX VERIFICATION

General admin panel checks:

- [ ] Dashboard loads without errors
- [ ] Custom navigation links appear in sidebar
- [ ] Icon preview component works in category editor
- [ ] Rich text editor functions properly
- [ ] Image uploads work
- [ ] Relationship fields load options correctly
- [ ] Search/filter works on list views
- [ ] Pagination works on large collections
- [ ] Bulk select/operations work if available

---

### 7. DATA INTEGRITY

Verify data relationships:

- [ ] Products properly link to Categories (many-to-many)
- [ ] Products properly link to Ingredients (many-to-many)
- [ ] Products link to Brand (many-to-one)
- [ ] Videos link to extracted Products
- [ ] Categories show parent/child hierarchy
- [ ] Audit logs reference correct documents

---

## Issue Tracking Format

When you find issues, log them as:

```
ISSUE: [Brief title]
Location: [Collection/View/Endpoint]
Steps: [How to reproduce]
Expected: [What should happen]
Actual: [What actually happened]
Severity: [Critical/High/Medium/Low]
```

---

## Test Execution Notes

1. Start with Collection CRUD to verify basic functionality
2. Move to Smart Automation to test hooks and cascades
3. Test API endpoints through any available UI triggers
4. Verify custom admin views load and function
5. Spot-check access control
6. Document all issues found

After each test category, summarize:
- Tests passed
- Tests failed
- Issues discovered
- Recommendations

---

## Success Criteria

- All collections support create/read/update operations
- Smart automation hooks fire correctly
- No JavaScript errors in console
- Data relationships maintain integrity
- Custom admin views are accessible and functional
- Access control restricts appropriately by role
