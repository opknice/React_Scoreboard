# Implementation Plan

## Overview

การปรับปรุง Combined Score Table ให้แสดงผลได้ดีบนอุปกรณ์มือถือ (viewport ≤ 576px) โดยใช้ CSS media queries เท่านั้น ไม่ต้องแก้ไข component logic การเปลี่ยนแปลงหลักคือการเพิ่ม mobile-optimized styles ใน `src/index.css` และเพิ่ม title attribute ใน component เพื่อแสดง tooltip

## Tasks

- [ ] 1. Add mobile typography scaling rules to index.css
- [ ] 2. Add mobile spacing optimization rules to index.css
- [ ] 3. Add mobile logo scaling rules to index.css
- [ ] 4. Implement mobile header abbreviation using CSS pseudo-elements
- [ ] 5. Implement team name truncation with CSS and add title attribute to component
- [ ] 6. Prevent horizontal scroll on mobile by setting overflow-x hidden
- [ ] 7. Test mobile viewport responsiveness across different screen sizes
- [ ] 8. Verify data integrity and structure preservation on mobile
- [ ] 9. Perform performance testing for render time and style application
- [ ] 10. Test accessibility including contrast ratios and semantic structure
- [ ] 11. Conduct cross-browser mobile testing
- [ ] 12. Add documentation and code comments

## Notes

### Task 1: Add Mobile Typography Scaling

**Requirements Coverage:** Requirement 2 (Mobile Typography Optimization)

**Implementation:**
1. Open `src/index.css`
2. Locate existing `@media (max-width: 576px)` block (around line 1043)
3. Add or update font-size rules for:
   - `.combined-table th` → 0.75rem (desktop: 1.05rem)
   - `.combined-table td` → 0.85rem (desktop: 1.15rem)
   - `.combined-team-cell` → 0.9rem (desktop: 1.15rem)

**Verification:**
- Header font size is 0.75rem on mobile
- Cell font size is 0.85rem on mobile
- Team name font size is 0.9rem on mobile
- Font sizes remain unchanged on desktop (> 576px)
- Text contrast ratio maintains ≥ 4.5:1

**Files to Modify:** `src/index.css`

---

### Task 2: Add Mobile Spacing Optimization

**Requirements Coverage:** Requirement 3 (Mobile Spacing Optimization)

**Implementation:**
1. In `src/index.css` within `@media (max-width: 576px)` block
2. Update padding for `.combined-table th, .combined-table td`:
   - Change from "10px 14px" to "6px 4px"
3. Update gap for `.combined-team-cell`:
   - Change from 10px to 6px

**Verification:**
- Cell padding is "6px 4px" on mobile
- Team cell gap is 6px on mobile
- Spacing remains "10px 14px" and 10px gap on desktop
- Table content does not overflow viewport

**Files to Modify:** `src/index.css`

---

### Task 3: Add Mobile Logo Scaling

**Requirements Coverage:** Requirement 4 (Mobile Logo Scaling)

**Implementation:**
1. In `src/index.css` within `@media (max-width: 576px)` block
2. Update `.combined-logo` dimensions:
   - width: 20px (desktop: 32px)
   - height: 20px (desktop: 32px)
3. Ensure border-radius and aspect ratio are preserved

**Verification:**
- Logo dimensions are 20px × 20px on mobile
- Logo dimensions remain 32px × 32px on desktop
- Border-radius (circular) is maintained
- Aspect ratio is preserved
- Logo remains visible and recognizable

**Files to Modify:** `src/index.css`

---

### Task 4: Implement Mobile Header Abbreviation

**Requirements Coverage:** Requirement 5 (Mobile Header Abbreviation)

**Implementation:**
1. In `src/index.css` within `@media (max-width: 576px)` block
2. Set `.combined-table thead tr th` font-size to 0 (hide original text)
3. Add `.combined-table thead tr th::before` with font-size 0.75rem
4. Use `:nth-child()` selectors to add abbreviated content:
   - th:nth-child(1)::before → "#"
   - th:nth-child(2)::before → "ทีม"
   - th:nth-child(3)::before → "P"
   - th:nth-child(4)::before → "W"
   - th:nth-child(5)::before → "D"
   - th:nth-child(6)::before → "L"
   - th:nth-child(7)::before → "GF"
   - th:nth-child(8)::before → "GA"
   - th:nth-child(9)::before → "GD"
   - th:nth-child(10)::before → "Pts"

**Verification:**
- Headers show abbreviated labels on mobile (≤ 576px)
- Headers show full Thai labels on desktop (> 576px)
- Abbreviations match specification mapping
- Header alignment is maintained
- Headers remain readable and clear

**Files to Modify:** `src/index.css`

---

### Task 5: Implement Team Name Truncation

**Requirements Coverage:** Requirement 6 (Mobile Team Name Display)

**Implementation:**

**Part A: CSS Changes**
1. In `src/index.css` within `@media (max-width: 576px)` block
2. Add max-width to `.combined-team-cell`: 120px
3. Add truncation styles to `.combined-team-cell span`:
   - overflow: hidden
   - text-overflow: ellipsis
   - white-space: nowrap
   - max-width: 100px
   - display: inline-block

**Part B: Component Changes**
1. Open `src/components/AllScoreCombinedStandalone.tsx`
2. Locate the team name span in standings table:
   ```tsx
   <span>{row.team}</span>
   ```
3. Add title attribute:
   ```tsx
   <span title={row.team}>{row.team}</span>
   ```

**Verification:**
- Team names longer than ~12 characters are truncated with ellipsis on mobile
- Full team names display on desktop
- Tooltip shows full team name on hover (desktop) and long-press (mobile)
- Logo remains visible when team name is truncated
- Team cell max-width is 120px on mobile

**Files to Modify:** `src/index.css`, `src/components/AllScoreCombinedStandalone.tsx`

---

### Task 6: Prevent Horizontal Scroll on Mobile

**Requirements Coverage:** Requirement 1 (Mobile Table Visibility), Requirement 7 (Responsive Breakpoint Behavior)

**Implementation:**
1. In `src/index.css` within `@media (max-width: 576px)` block
2. Update `.combined-table-wrapper`:
   - Set overflow-x: hidden (desktop has overflow-x: auto)

**Verification:**
- No horizontal scroll on viewport 320px - 576px
- All 10 columns visible without scrolling
- Table fits within viewport width
- Horizontal scroll is restored on desktop (> 576px)

**Files to Modify:** `src/index.css`

---

### Task 7: Test Mobile Viewport Responsiveness

**Requirements Coverage:** Requirement 7 (Responsive Breakpoint Behavior), Requirement 1 (Mobile Table Visibility)

**Test Cases:**

**Mobile Viewport Tests (≤ 576px):**
- Test at 320px width (iPhone SE) - All 10 columns visible, no horizontal scroll, typography readable
- Test at 375px width (iPhone standard) - Layout correct, spacing appropriate
- Test at 576px width (breakpoint boundary) - Mobile styles applied, all optimizations active

**Desktop Viewport Tests (> 576px):**
- Test at 577px width - Desktop styles applied, full Thai headers visible, original spacing restored
- Test at 1024px width - Original desktop layout maintained, no mobile optimizations applied

**Breakpoint Transition Test:**
- Resize viewport from 600px down to 500px - Styles update within 100ms, no layout flash or jump
- Resize viewport from 500px up to 600px - Desktop styles restore smoothly

**Verification:**
- All mobile optimizations work on viewport ≤ 576px
- Desktop styles maintained on viewport > 576px
- Viewport resize triggers style update within 100ms
- No horizontal scroll between 320px and 576px

**Test Method:** Use Chrome DevTools responsive mode, manual viewport resizing, test on actual mobile devices if available

---

### Task 8: Verify Data Integrity on Mobile

**Requirements Coverage:** Requirement 8 (Mobile Data Integrity), Requirement 9 (Mobile Table Structure Preservation)

**Test Cases:**

**Data Display Tests:**
- All 10 columns display data correctly (Rank, Team, P, W, D, L, GF, GA, GD, Pts)
- No numerical truncation or rounding
- Team names truncate properly without data loss

**Alignment Tests:**
- Numerical columns (P, W, D, L, GF, GA, GD, Pts) are center-aligned
- Team column is left-aligned
- Rank column is center-aligned

**Color Coding Tests:**
- GD column color coding preserved (positive: green, negative: red, zero: neutral)

**Structure Tests:**
- Row alternation pattern maintained (odd/even backgrounds)
- Hover effects work on mobile (if touch device supports)
- Border and shadow styling preserved
- Ranking order correct (sorted by points, GD, GF)

**Verification:**
- All statistical values display without truncation
- Alignment correct for all columns
- GD color coding works correctly
- Ranking order maintained
- Row backgrounds alternate properly
- Table structure preserved

**Test Method:** Visual comparison between mobile and desktop views, verify against original data source, test with various team standings data

---

### Task 9: Performance Testing

**Requirements Coverage:** Requirement 10 (Mobile Performance Optimization), Requirement 7 (Responsive Breakpoint Behavior)

**Performance Tests:**

**Render Time Test:**
- Measure time from data load to table fully rendered (Target: < 200ms)
- Use Chrome DevTools Performance tab
- Test with 10-20 teams in standings

**Style Application Test:**
- Measure time for media query style update on viewport resize (Target: < 100ms)
- Resize viewport across 576px breakpoint
- Monitor paint and layout times

**Logo Fallback Test:**
- Test logo load failure scenario
- Verify fallback logo displays within 100ms
- Test with broken logo URL

**Scroll Performance Test:**
- Verify no horizontal scrollbar on mobile viewports
- Test at 320px, 375px, 576px
- Confirm overflow-x: hidden working

**Verification:**
- Table renders within 200ms after data load
- Style update occurs within 100ms on viewport resize
- Fallback logo displays within 100ms on error
- No horizontal scrollbar on 320px - 576px viewports
- No JavaScript viewport detection used (CSS only)

**Test Method:** Chrome DevTools Performance tab, Lighthouse mobile performance audit, network throttling (3G) for realistic mobile conditions

---

### Task 10: Accessibility and Contrast Testing

**Requirements Coverage:** Requirement 2 (Mobile Typography Optimization - AC4), Requirement 9 (Mobile Table Structure Preservation)

**Accessibility Tests:**

**Contrast Ratio Tests:**
- Test header text contrast (light text on dark background) - Target: ≥ 4.5:1 (WCAG AA)
- Test cell text contrast (all numerical data, team names)
- Test color-coded GD values (green positive, red negative)

**Semantic Structure Tests:**
- Table uses proper HTML5 semantic elements (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`)
- Headers properly associated with data cells
- Screen reader can navigate table structure

**Responsive Typography Tests:**
- Text remains readable at 0.75rem minimum
- Zoom functionality works (text scales with browser zoom)
- rem units used (not fixed px for text)

**Touch Target Tests:**
- Team name tooltip accessible on mobile (long-press shows full name via title attribute)
- Truncated names indicate there's more content (ellipsis visible)

**Verification:**
- All text maintains contrast ratio ≥ 4.5:1
- Table structure semantic and accessible
- Text scales with browser zoom
- Tooltips accessible on touch devices
- Screen reader can read table data correctly

**Test Method:** Chrome DevTools Lighthouse accessibility audit, manual contrast ratio checking, test with screen reader (VoiceOver on iOS, TalkBack on Android), manual zoom testing (browser zoom 150%, 200%)

---

### Task 11: Cross-Browser Mobile Testing

**Requirements Coverage:** All requirements (comprehensive validation)

**Browser Tests:**

**Mobile Browsers:**
- Chrome Android - Test responsive styles, verify media query behavior, test tooltip on long-press
- Safari iOS - Test on iPhone SE (320px), test on iPhone 12 (390px), verify font rendering
- Firefox Android - Test layout consistency, verify CSS compatibility

**Desktop Browsers (Mobile Mode):**
- Chrome DevTools responsive mode - Test all viewport sizes, verify DevTools accuracy
- Firefox responsive design mode
- Safari responsive design mode

**Device Tests (if available):**
- iPhone SE (320px width)
- iPhone 12/13 (390px width)
- Android phone (360px - 412px typical)
- Larger phones (428px - 576px)

**Verification:**
- Consistent layout across all tested browsers
- Media queries work in all browsers
- CSS pseudo-elements (::before) work correctly
- Tooltips work on touch devices
- No browser-specific rendering issues

**Test Method:** BrowserStack or similar service for real device testing, manual testing on available devices, screenshot comparison across browsers

---

### Task 12: Documentation and Code Comments

**Requirements Coverage:** Development best practices

**Implementation:**

1. In `src/index.css` at the beginning of mobile media query block, add header comment:
   ```css
   /* ========================================
      MOBILE OPTIMIZATION FOR COMBINED TABLE
      Feature: responsive-combined-table-mobile
      Spec: .kiro/specs/responsive-combined-table-mobile
      
      This block optimizes the Combined Score Table
      for mobile viewports (≤ 576px) by:
      - Reducing typography sizes
      - Optimizing spacing and padding
      - Scaling down logos
      - Abbreviating column headers
      - Truncating long team names
      - Preventing horizontal scroll
      
      All 10 columns remain visible without requiring
      horizontal scrolling on screens 320px - 576px.
      ======================================== */
   ```

2. Add inline comments for each optimization section:
   - Typography Scaling (Req 2)
   - Spacing Optimization (Req 3)
   - Logo Scaling (Req 4)
   - Header Abbreviation (Req 5)
   - Team Name Truncation (Req 6)
   - Scroll Prevention (Req 1)

3. In `AllScoreCombinedStandalone.tsx`, add comment above title attribute:
   ```tsx
   {/* Tooltip for truncated team names on mobile */}
   <span title={row.team}>{row.team}</span>
   ```

**Verification:**
- Header comment added to mobile media query block
- Inline comments explain each optimization
- Comments reference requirement numbers
- Component change has explanatory comment
- Comments are clear and concise

**Files to Modify:** `src/index.css`, `src/components/AllScoreCombinedStandalone.tsx`

## Task Dependency Graph

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12
```

Tasks 1-6 must be completed sequentially as they build the mobile optimization CSS.
Tasks 7-11 are testing tasks that depend on tasks 1-6 completion.
Task 12 (documentation) should be done last after all implementation and testing.
