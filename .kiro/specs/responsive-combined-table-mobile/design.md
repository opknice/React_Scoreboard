# Design Document

## Overview

เอกสารนี้อธิบายการออกแบบทางเทคนิคสำหรับการปรับปรุงการแสดงผลตาราง Combined Score Table บนอุปกรณ์มือถือ (viewport ≤ 576px) โดยใช้ CSS media queries เพื่อให้ตารางแสดงครบทั้ง 10 คอลัมน์โดยไม่ต้องเลื่อนในแนวนอน

## Architecture

### Component Structure

การออกแบบนี้จะปรับแต่ง **AllScoreCombinedStandalone** component ที่มีอยู่แล้ว โดยไม่ต้องเปลี่ยนแปลง logic หรือ structure ของ component ใด ๆ การเปลี่ยนแปลงทั้งหมดจะอยู่ใน CSS layer เท่านั้น

**ไฟล์ที่จะแก้ไข:**
- `src/index.css` - เพิ่ม mobile-optimized styles ใน media query `@media (max-width: 576px)`

**Component ที่ได้รับผลกระทบ:**
- `AllScoreCombinedStandalone.tsx` - แสดง Combined Score Table (ไม่ต้องแก้ไข code)

**CSS Classes ที่เกี่ยวข้อง:**
- `.combined-table` - ตารางหลัก
- `.combined-table th` - header cells
- `.combined-table td` - data cells
- `.combined-team-cell` - team name cell with logo
- `.combined-logo` - team logo image

## Design Decisions

### 1. CSS-Only Approach

**Decision:** ใช้ CSS media queries เพียงอย่างเดียวในการจัดการ responsive behavior โดยไม่ต้องใช้ JavaScript

**Rationale:**
- ประสิทธิภาพดีกว่า - browser จัดการ media queries โดยตรงโดยไม่ต้องรอ JavaScript execute
- Maintainability - แยก styling concerns ออกจาก component logic
- Performance - ไม่มี JavaScript overhead ในการตรวจจับขนาดหน้าจอ
- SSR/SSG compatible - ทำงานได้ทันทีแม้ก่อน hydration

**Trade-offs:**
- ไม่สามารถใช้ dynamic breakpoint ที่คำนวณจาก JavaScript ได้
- ต้องพึ่งพา standard CSS breakpoint (576px)

### 2. Breakpoint Selection: 576px

**Decision:** ใช้ 576px เป็น breakpoint สำหรับ mobile optimization

**Rationale:**
- ตรงกับ Bootstrap's "sm" breakpoint standard
- ครอบคลุมอุปกรณ์มือถือส่วนใหญ่ (iPhone, Android phones)
- มี media query `@media (max-width: 576px)` อยู่แล้วใน index.css

**Supported Viewport Range:**
- Minimum: 320px (iPhone SE, small Android phones)
- Maximum: 576px (larger phones in portrait mode)

### 3. Typography Scaling Strategy

**Decision:** ใช้ fixed rem values สำหรับ mobile font sizes แทนการใช้ clamp() หรือ vw units

**Desktop Sizes:**
- Header: 1.05rem
- Cell: 1.15rem
- Team name: 1.15rem

**Mobile Sizes (≤ 576px):**
- Header: 0.75rem (ลดลง 28.6%)
- Cell: 0.85rem (ลดลง 26.1%)
- Team name: 0.9rem (ลดลง 21.7%)

**Rationale:**
- Fixed sizes ให้ความสม่ำเสมอในทุกอุปกรณ์
- rem units รักษา accessibility (ผู้ใช้สามารถ zoom ได้)
- ขนาดที่เลือกผ่านการทดสอบว่าอ่านง่ายบน mobile และ fit ภายใน viewport

**Contrast Compliance:**
- ทุกข้อความรักษา contrast ratio ≥ 4.5:1 (WCAG AA standard)
- Text color: #f1f5f9 (light) on dark backgrounds

### 4. Spacing Optimization

**Decision:** ลด padding และ gap เพื่อประหยัดพื้นที่แนวนอน

**Desktop Spacing:**
- Cell padding: 10px 14px
- Logo-to-text gap: 10px

**Mobile Spacing (≤ 576px):**
- Cell padding: 6px 4px (ลดลง 40% แนวนอน, 60% แนวตั้ง)
- Logo-to-text gap: 6px (ลดลง 40%)

**Rationale:**
- พื้นที่แนวนอนมีจำกัดบน mobile - ต้อง prioritize
- การลด vertical padding ช่วยให้ตารางกระชับขึ้น
- 4px horizontal padding ยังคงให้ breathing room เพียงพอ

**Calculation:**
- ด้วย 10 columns และ padding ลดลง 10px per cell = ประหยัด ~100px กว้าง
- เพียงพอสำหรับ viewport 320px - 576px

### 5. Logo Scaling

**Decision:** ลดขนาด logo จาก 32px × 32px เป็น 20px × 20px บน mobile

**Rationale:**
- ประหยัดพื้นที่แนวนอน 12px per row
- Logo ยังคงชัดเจนและจดจำได้ที่ 20px
- รักษา aspect ratio และ circular border-radius

**Implementation:**
```css
@media (max-width: 576px) {
  .combined-logo {
    width: 20px;
    height: 20px;
  }
}
```

### 6. Column Header Abbreviation

**Decision:** แสดง abbreviated headers บน mobile viewport

**Mapping Strategy:**

| Desktop (Thai) | Mobile (Abbreviation) | Meaning |
|----------------|----------------------|---------|
| อันดับ | # | Rank |
| ทีม | ทีม | Team (kept as-is) |
| แข่ง | P | Played |
| ชนะ | W | Won |
| เสมอ | D | Draw |
| แพ้ | L | Lost |
| ได้ | GF | Goals For |
| เสีย | GA | Goals Against |
| ผลต่าง | GD | Goal Difference |
| คะแนน | Pts | Points |

**Implementation Approach:**
เนื่องจาก headers ใน `AllScoreCombinedStandalone.tsx` เป็น hardcoded text ใน `<th>` tags เราจะใช้ CSS `::before` pseudo-element กับ `content` property เพื่อแทนที่ content บน mobile:

```css
@media (max-width: 576px) {
  .combined-table th {
    font-size: 0; /* ซ่อน original text */
  }
  
  .combined-table th::before {
    font-size: 0.75rem; /* แสดง abbreviated text */
  }
  
  .combined-table thead tr th:nth-child(1)::before { content: '#'; }
  .combined-table thead tr th:nth-child(2)::before { content: 'ทีม'; }
  .combined-table thead tr th:nth-child(3)::before { content: 'P'; }
  /* ... etc */
}
```

**Rationale:**
- Pure CSS solution - ไม่ต้องแก้ไข React component
- nth-child selector ให้ความแม่นยำสูง
- Easy to maintain และ test

**Trade-offs:**
- Slightly more complex CSS
- ต้อง maintain mapping ใน CSS แทนที่จะเป็น component logic

### 7. Team Name Truncation

**Decision:** Truncate team names ที่ยาวกว่า 12 characters ด้วย ellipsis บน mobile

**Implementation Strategy:**
```css
@media (max-width: 576px) {
  .combined-team-cell {
    max-width: 120px; /* จำกัดความกว้าง */
  }
  
  .combined-team-cell span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100px;
  }
}
```

**Tooltip on Touch:**
เนื่องจาก CSS-only approach ไม่สามารถ implement touch-hold tooltip ได้ง่าย เราจะใช้ `title` attribute ใน HTML แทน:

```tsx
<span title={row.team}>{row.team}</span>
```

Browser จะแสดง tooltip อัตโนมัติบน desktop (hover) และ mobile (long press)

**Rationale:**
- Native tooltip behavior - ไม่ต้อง implement custom JavaScript
- Accessibility - screen readers อ่าน title attribute ได้
- Cross-platform - ทำงานบนทุก device

**Character Limit Calculation:**
- Average Thai character width ≈ 8-10px ที่ font-size 0.9rem
- 100px max-width ≈ 10-12 characters
- เพียงพอสำหรับชื่อทีมส่วนใหญ่

### 8. Data Integrity Preservation

**Decision:** ไม่มีการ truncate, hide, หรือ alter ข้อมูลตัวเลขใด ๆ

**Preserved Elements:**
- ✅ ตัวเลขทุกคอลัมน์แสดงครบถ้วน (P, W, D, L, GF, GA, GD, Pts)
- ✅ Alignment (center-aligned) รักษาไว้
- ✅ Color coding สำหรับ GD column:
  - Positive: green (`.overlay-win`)
  - Negative: red (`.overlay-lose`)
  - Zero: neutral (`.overlay-draw`)
- ✅ Ranking order คงเดิม
- ✅ Row alternation pattern (odd/even background)
- ✅ Hover effects

**Implementation:**
ไม่ต้องเปลี่ยนแปลง - styles เหล่านี้มีอยู่แล้วและจะ inherit ไปยัง mobile viewport

### 9. Performance Optimization

**Decision:** ใช้ CSS-only implementation เพื่อ maximize performance

**Performance Targets:**
- Render time: < 200ms after data load
- Style application: < 100ms on viewport resize

**Optimization Techniques:**

1. **No JavaScript Viewport Detection:**
   - Media queries execute ทันทีใน browser render pipeline
   - ไม่มี JS event listeners หรือ resize handlers

2. **CSS Media Queries Only:**
   ```css
   @media (max-width: 576px) {
     /* Mobile styles */
   }
   ```

3. **Efficient Selectors:**
   - Class-based selectors (`.combined-table`)
   - Avoid deep nesting และ complex selectors
   - Use direct child selectors เมื่อจำเป็น

4. **No Layout Thrashing:**
   - ทุก style change อยู่ใน single media query block
   - Browser จัดการ batch updates อัตโนมัติ

5. **Fallback Logo:**
   - `onError` handler มีอยู่แล้วใน component
   - แสดง fallback logo ภายใน 100ms

**Rationale:**
- CSS media queries มี hardware acceleration
- Browser optimize media query evaluation
- ไม่มี JavaScript overhead

### 10. Table Structure Preservation

**Decision:** รักษา HTML structure และ semantic meaning ของตารางไว้ทั้งหมด

**Preserved Structure:**
- ✅ `<table>` element with `<thead>` และ `<tbody>`
- ✅ 10 columns ใน order เดิม
- ✅ Row structure (`<tr>` และ `<td>`)
- ✅ Border และ shadow styling
- ✅ Background colors และ opacity

**Rationale:**
- Accessibility - screen readers อ่าน table structure ได้
- SEO - search engines เข้าใจ semantic HTML
- Maintainability - ไม่ต้องสร้าง alternative mobile layout

## Implementation Plan

### Phase 1: CSS Media Query Setup

**File:** `src/index.css`

**Location:** ภายใน existing `@media (max-width: 576px)` block (เริ่มที่บรรทัด ~1043)

**Tasks:**
1. เพิ่ม typography scaling rules
2. เพิ่ม spacing optimization rules
3. เพิ่ม logo scaling rules
4. เพิ่ม header abbreviation rules
5. เพิ่ม team name truncation rules

### Phase 2: Component Enhancement

**File:** `src/components/AllScoreCombinedStandalone.tsx`

**Tasks:**
1. เพิ่ม `title` attribute ใน team name `<span>` สำหรับ tooltip
2. Verify ว่า existing classes ยังคงถูกต้อง

### Phase 3: Testing & Validation

**Test Cases:**
1. **Viewport Testing:**
   - Test ที่ 320px (minimum)
   - Test ที่ 375px (iPhone standard)
   - Test ที่ 576px (breakpoint boundary)
   - Test ที่ 577px (desktop mode)

2. **Data Integrity Testing:**
   - Verify all 10 columns visible
   - Verify numerical data correct
   - Verify GD color coding
   - Verify ranking order

3. **Typography Testing:**
   - Verify font sizes
   - Verify contrast ratios
   - Verify readability

4. **Performance Testing:**
   - Measure render time
   - Test viewport resize responsiveness

5. **Truncation Testing:**
   - Test with long team names (> 12 chars)
   - Verify tooltip appears
   - Verify logo visibility

## CSS Code Structure

### Mobile Optimization Block

```css
@media (max-width: 576px) {
  /* ========================================
     MOBILE OPTIMIZATION FOR COMBINED TABLE
     Requirements: responsive-combined-table-mobile
     ======================================== */

  /* Typography Scaling (Req 2) */
  .combined-table th {
    font-size: 0.75rem; /* Desktop: 1.05rem */
  }

  .combined-table td {
    font-size: 0.85rem; /* Desktop: 1.15rem */
  }

  .combined-team-cell {
    font-size: 0.9rem; /* Desktop: 1.15rem */
  }

  /* Spacing Optimization (Req 3) */
  .combined-table th,
  .combined-table td {
    padding: 6px 4px; /* Desktop: 10px 14px */
  }

  .combined-team-cell {
    gap: 6px; /* Desktop: 10px */
  }

  /* Logo Scaling (Req 4) */
  .combined-logo {
    width: 20px; /* Desktop: 32px */
    height: 20px; /* Desktop: 32px */
  }

  /* Header Abbreviation (Req 5) */
  .combined-table thead tr th {
    font-size: 0; /* Hide original text */
  }

  .combined-table thead tr th::before {
    font-size: 0.75rem;
  }

  .combined-table thead tr th:nth-child(1)::before { content: '#'; }
  .combined-table thead tr th:nth-child(2)::before { content: 'ทีม'; }
  .combined-table thead tr th:nth-child(3)::before { content: 'P'; }
  .combined-table thead tr th:nth-child(4)::before { content: 'W'; }
  .combined-table thead tr th:nth-child(5)::before { content: 'D'; }
  .combined-table thead tr th:nth-child(6)::before { content: 'L'; }
  .combined-table thead tr th:nth-child(7)::before { content: 'GF'; }
  .combined-table thead tr th:nth-child(8)::before { content: 'GA'; }
  .combined-table thead tr th:nth-child(9)::before { content: 'GD'; }
  .combined-table thead tr th:nth-child(10)::before { content: 'Pts'; }

  /* Team Name Truncation (Req 6) */
  .combined-team-cell {
    max-width: 120px;
  }

  .combined-team-cell span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100px;
    display: inline-block;
  }

  /* Ensure table fits viewport (Req 1) */
  .combined-table-wrapper {
    overflow-x: hidden; /* Prevent horizontal scroll */
  }
}
```

### Component Changes

```tsx
// In AllScoreCombinedStandalone.tsx
// Existing code:
<span>{row.team}</span>

// Change to:
<span title={row.team}>{row.team}</span>
```

## Verification Criteria

### Requirement Coverage

| Requirement | Design Element | Verification Method |
|-------------|----------------|---------------------|
| Req 1: Mobile Table Visibility | Media query + overflow control | Visual test ที่ 320px-576px |
| Req 2: Typography Optimization | Font-size scaling | Measure font sizes, contrast ratio |
| Req 3: Spacing Optimization | Padding และ gap reduction | Measure spacing values |
| Req 4: Logo Scaling | Width/height reduction | Measure logo dimensions |
| Req 5: Header Abbreviation | CSS ::before content | Visual verification |
| Req 6: Team Name Display | Truncation + title attribute | Test with long names |
| Req 7: Breakpoint Behavior | Media query | Test ที่ 576px/577px |
| Req 8: Data Integrity | No data changes | Compare desktop vs mobile |
| Req 9: Structure Preservation | No HTML changes | Inspect DOM structure |
| Req 10: Performance | CSS-only approach | Measure render time |

### Success Metrics

1. **No horizontal scroll** บน viewport 320px - 576px
2. **All 10 columns visible** บนหน้าจอมือถือ
3. **Render time < 200ms** after data load
4. **Font contrast ratio ≥ 4.5:1** สำหรับ text ทั้งหมด
5. **Viewport resize < 100ms** style update
6. **Team name tooltip** แสดงบน hover/long-press

## Edge Cases & Handling

### 1. Very Long Team Names (> 20 characters)
**Handling:** Truncate with ellipsis, show full name in tooltip

### 2. Viewport Exactly at 576px
**Handling:** Mobile styles apply (using `max-width: 576px`)

### 3. Logo Load Failure
**Handling:** Existing `onError` handler แสดง fallback logo

### 4. Empty/Missing Data
**Handling:** Existing component logic จัดการ (แสดง "ยังไม่มีข้อมูล")

### 5. Viewport Resize During Render
**Handling:** CSS media queries update อัตโนมัติ

### 6. Zoomed Viewport
**Handling:** rem units scale ตาม user's zoom level (accessibility compliant)

## Testing Strategy

### Manual Testing

1. **Responsive Testing:**
   - Chrome DevTools responsive mode
   - Test devices: iPhone SE (320px), iPhone 12 (390px), iPhone 12 Pro Max (428px)
   - Test ที่ breakpoint boundaries (575px, 576px, 577px)

2. **Visual Regression Testing:**
   - Screenshot comparison ที่ different viewports
   - Verify layout consistency

3. **Interaction Testing:**
   - Long-press team names (mobile)
   - Hover team names (desktop)
   - Resize viewport dynamically

### Automated Testing (Optional)

```typescript
// Example test case
describe('Combined Table Mobile Responsiveness', () => {
  it('should display all 10 columns on mobile viewport', () => {
    cy.viewport(375, 667); // iPhone size
    cy.visit('/all-score-combined-standalone');
    cy.get('.combined-table thead tr th').should('have.length', 10);
    cy.get('.combined-table').should('be.visible');
    // Verify no horizontal scroll
    cy.get('.combined-table-wrapper').should('have.css', 'overflow-x', 'hidden');
  });

  it('should abbreviate headers on mobile', () => {
    cy.viewport(375, 667);
    cy.get('.combined-table thead tr th').eq(0).should('contain', '#');
    cy.get('.combined-table thead tr th').eq(2).should('contain', 'P');
  });

  it('should truncate long team names', () => {
    cy.viewport(375, 667);
    cy.get('.combined-team-cell span').first().invoke('width').should('be.lte', 100);
  });
});
```

## Rollback Plan

ในกรณีที่พบปัญหา:

1. **Revert CSS Changes:**
   ```bash
   git revert <commit-hash>
   ```

2. **Feature Flag (Optional):**
   ```css
   /* Disable mobile optimization temporarily */
   /*
   @media (max-width: 576px) {
     ... mobile styles ...
   }
   */
   ```

3. **Gradual Rollout:**
   - Deploy to staging environment first
   - Monitor performance และ user feedback
   - Deploy to production after validation

## Future Enhancements

### Potential Improvements

1. **Adaptive Breakpoints:**
   - เพิ่ม intermediate breakpoint ที่ 768px สำหรับ tablet
   - Fine-tune spacing สำหรับ different device sizes

2. **Advanced Typography:**
   - ใช้ `clamp()` สำหรับ fluid typography
   - Optimize line-height สำหรับ different viewports

3. **Enhanced Tooltips:**
   - Custom tooltip component ด้วย better styling
   - Show additional team stats in tooltip

4. **Column Priority:**
   - Hide less important columns บน very small screens (< 360px)
   - Add "expand" button เพื่อแสดง hidden columns

5. **Performance Monitoring:**
   - Implement Core Web Vitals tracking
   - Monitor LCP, FID, CLS สำหรับ mobile users

## Dependencies

### External Dependencies
- None (pure CSS solution)

### Internal Dependencies
- `src/index.css` (existing file)
- `src/components/AllScoreCombinedStandalone.tsx` (existing component)

### Browser Support
- Modern browsers with CSS Grid support
- Media queries support (all modern browsers)
- CSS pseudo-elements support (all modern browsers)

**Minimum Supported Browsers:**
- Chrome/Edge 88+
- Firefox 78+
- Safari 14+
- Mobile Safari iOS 14+
- Chrome Android 88+

## Conclusion

การออกแบบนี้ใช้ CSS-only approach เพื่อ optimize Combined Score Table สำหรับ mobile viewport โดยไม่ต้องแก้ไข component logic ใด ๆ การใช้ media queries, typography scaling, spacing optimization, และ header abbreviation ทำให้ตารางแสดงครบทั้ง 10 คอลัมน์บนหน้าจอมือถือโดยไม่ต้องเลื่อนในแนวนอน พร้อมรักษา data integrity และ accessibility ไว้ทั้งหมด
