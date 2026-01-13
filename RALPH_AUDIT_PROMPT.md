# CMS Browser Audit - Ralph Loop Prompt

## Mission

You are conducting a hands-on, browser-based audit of a Payload CMS admin interface. Your job is to actually USE the admin, click through every page, test every feature, and document what works and what doesn't from a real user's perspective.

**You have browser automation tools. USE THEM.** Don't just read code - actually navigate the admin, click buttons, fill forms, and observe behavior.

---

## Setup

First, get browser context and navigate to the admin:

1. Call `tabs_context_mcp` to get available tabs
2. Create a new tab with `tabs_create_mcp`
3. Navigate to `http://localhost:3000/admin` (or the deployed URL)
4. Take a screenshot to see the current state
5. If there's a login page, note it and ask for credentials if needed

---

## Audit Process

### Phase 1: Admin Dashboard Overview

1. **Navigate to admin home** - Take screenshot
2. **Document the sidebar navigation** - What collections are listed? What groups?
3. **Click each sidebar item** - Does it load? Any errors?
4. **Note the overall layout** - Is it intuitive? Cluttered?

For each page you visit:
- Take a screenshot
- Note what you see
- Try interacting with elements
- Document any errors or unexpected behavior

### Phase 2: Collection-by-Collection Testing

For EACH collection in the sidebar:

#### Step 1: List View
```
- Navigate to the collection
- Screenshot the list view
- Note: How many records exist? What columns show? Is it sortable?
- Try: Click column headers to sort
- Try: Use any filters available
- Try: Search if there's a search box
- Note any issues
```

#### Step 2: Create New Record
```
- Click "Create New" or equivalent button
- Screenshot the empty form
- Document ALL fields you see:
  - Field name
  - Field type (text, select, relationship, etc.)
  - Is it required? (look for asterisk or required indicator)
  - Does it have help text/description?
  - Is it in main area or sidebar?
- Try filling out the form with test data
- Try submitting - does it work? Any validation errors?
- Screenshot any errors
```

#### Step 3: Edit Existing Record
```
- Go back to list, click an existing record
- Screenshot the populated form
- Note: Are values displaying correctly?
- Try editing a field and saving
- Does it save? Any errors?
```

#### Step 4: Delete Test
```
- Find the delete option
- Note: Is it easy to find? Is there confirmation?
- DO NOT actually delete production data - just document the UX
```

### Phase 3: Specific Feature Testing

Test these specific workflows:

#### Products Collection
- [ ] Can you create a new product?
- [ ] Does the verdict dropdown work (AVOID/CAUTION/OKAY/GOOD)?
- [ ] Can you add GC/MS lab results?
- [ ] Is the "Sample Information" section visible?
- [ ] Do collapsible sections expand/collapse?
- [ ] Can you upload an image?

#### Device Fingerprints
- [ ] Can you view fingerprint records?
- [ ] Is the referral code field visible?
- [ ] Can you see behavior metrics?
- [ ] Is the fraud flags section usable?

#### Referrals
- [ ] Can you view referral records?
- [ ] Is the status dropdown working?
- [ ] Can you see commission tracking fields?

#### Product Requests (Voting)
- [ ] Can you view product requests?
- [ ] Is the vote count visible?
- [ ] Does the status workflow make sense?

#### Paywall Variants
- [ ] Can you create/edit paywall variants?
- [ ] Are all the content fields (headline, CTA, etc.) editable?
- [ ] Does the variant weight field work?

#### User Segments
- [ ] Can you create segment rules?
- [ ] Does the rule builder work?
- [ ] Can you test segment evaluation?

#### Notification Campaigns
- [ ] Can you view/create notification campaigns?
- [ ] Are trigger conditions configurable?
- [ ] Does the template editor work?

#### Audit Logs
- [ ] Can you view audit logs?
- [ ] Is the data meaningful?
- [ ] Can you filter/search logs?

### Phase 4: Global Settings

Check for any global settings pages:
- Site settings
- Paywall settings
- Feature flags
- Any other globals

### Phase 5: Edge Cases & Error States

Try to break things (safely):
- [ ] Submit a form with missing required fields - does validation work?
- [ ] Try invalid data in number fields
- [ ] Test very long text in text fields
- [ ] Try special characters
- [ ] Refresh mid-edit - is there unsaved changes warning?

---

## What to Document

For every page/feature, create a report entry:

```markdown
## [Collection/Feature Name]

**URL**: /admin/collections/[name]
**Screenshot**: [Describe what you see]

### What Works Well
- [Bullet points of good things]

### Issues Found
| Issue | Severity | What Happened | Expected Behavior |
|-------|----------|---------------|-------------------|
| [Description] | Critical/Major/Minor | [What you observed] | [What should happen] |

### UX Observations
- Is it intuitive?
- Are labels clear?
- Is the layout logical?
- Any confusing elements?

### Missing Features
- [What you expected but didn't find]
```

---

## Browser Commands Reference

Use these tools:

```
# Get tab context first
tabs_context_mcp

# Create new tab
tabs_create_mcp

# Navigate
navigate(url, tabId)

# Take screenshot to see current state
computer(action: "screenshot", tabId)

# Read page structure
read_page(tabId)

# Find elements
find(query, tabId)

# Click elements
computer(action: "left_click", coordinate: [x, y], tabId)

# Type text
computer(action: "type", text: "...", tabId)

# Scroll
computer(action: "scroll", scroll_direction: "down", tabId)
```

---

## Output Format

Structure your final report as:

### Executive Summary
- Overall admin UX score (1-10)
- Total collections audited
- Critical issues found
- Top 3 UX wins
- Top 3 UX problems

### Collection Reports
[One section per collection with the template above]

### Cross-Cutting Issues
- Navigation problems
- Inconsistent patterns
- Performance issues
- Accessibility concerns

### Prioritized Recommendations

#### Fix Immediately (Blocks work)
1. [Issue + suggested fix]

#### Fix Soon (Major friction)
1. [Issue + suggested fix]

#### Polish Later (Nice to have)
1. [Issue + suggested fix]

---

## Start Commands

Begin with:

1. `tabs_context_mcp` - Get browser context
2. `tabs_create_mcp` - Create new tab
3. `navigate` to `http://localhost:3000/admin`
4. `computer` with `action: "screenshot"` - See what's there
5. `read_page` - Get page structure

Then systematically work through each sidebar item.

**Take screenshots frequently. Document everything you see. Test everything you can click.**
