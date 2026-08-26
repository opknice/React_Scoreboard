# Requirements Document

## Introduction

ระบบตารางคะแนนรวม (Combined Score Table) บนหน้า All Score Combined Standalone ปัจจุบันแสดงตาราง League Standings ที่มี 10 คอลัมน์บนหน้าจอทุกขนาด การแสดงผลบนหน้าจอขนาดเล็ก (≤ 576px) ทำให้ผู้ใช้ต้องเลื่อนซ้าย-ขวาเพื่อดูข้อมูลทั้งหมด ซึ่งส่งผลต่อประสบการณ์การใช้งาน

ฟีเจอร์นี้มีวัตถุประสงค์เพื่อปรับปรุงการแสดงผลตารางคะแนนบนอุปกรณ์มือถือ โดยแสดงครบทั้ง 10 คอลัมน์ภายในหน้าจอโดยไม่ต้องเลื่อนในแนวนอน พร้อมรักษาความชัดเจนและอ่านง่ายของข้อมูล

## Glossary

- **Combined_Table**: ตารางคะแนนลีกที่แสดงอันดับทีม สถิติการแข่งขัน และคะแนนรวม ประกอบด้วย 10 คอลัมน์
- **Mobile_Viewport**: หน้าจอที่มีความกว้าง ≤ 576 พิกเซล (px) ตามมาตรฐาน CSS breakpoint
- **Desktop_Viewport**: หน้าจอที่มีความกว้าง > 576 พิกเซล (px)
- **Horizontal_Scroll**: การเลื่อนแนวนอน (ซ้าย-ขวา) เพื่อดูเนื้อหาที่อยู่นอกขอบหน้าจอ
- **Table_Column**: คอลัมน์ในตาราง ได้แก่ อันดับ, ทีม, แข่ง (P), ชนะ (W), เสมอ (D), แพ้ (L), ได้ (GF), เสีย (GA), ผลต่าง (GD), คะแนน (Pts)
- **Logo_Element**: รูปภาพโลโก้ทีมที่แสดงในคอลัมน์ "ทีม"
- **Abbreviation**: ตัวย่อของชื่อคอลัมน์ เช่น P (แข่ง), W (ชนะ), D (เสมอ), L (แพ้), GF (ได้), GA (เสีย), GD (ผลต่าง), Pts (คะแนน)
- **Responsive_Font_Size**: ขนาดฟอนต์ที่ปรับตามขนาดหน้าจอโดยอัตโนมัติ
- **Padding**: ระยะห่างภายในเซลล์ตาราง (ระหว่างขอบและเนื้อหา)

## Requirements

### Requirement 1: Mobile Table Visibility

**User Story:** ในฐานะผู้ใช้งานมือถือ ฉันต้องการเห็นตารางคะแนนครบทั้ง 10 คอลัมน์บนหน้าจอโดยไม่ต้องเลื่อนซ้าย-ขวา เพื่อให้สามารถดูข้อมูลทั้งหมดได้อย่างสะดวก

#### Acceptance Criteria

1. WHEN Mobile_Viewport is detected, THE Combined_Table SHALL display all 10 Table_Columns without requiring Horizontal_Scroll
2. THE Combined_Table SHALL fit within the viewport width of 320px to 576px without content overflow
3. WHEN Desktop_Viewport is detected, THE Combined_Table SHALL maintain original styling without any mobile optimizations applied

### Requirement 2: Mobile Typography Optimization

**User Story:** ในฐานะผู้ใช้งานมือถือ ฉันต้องการให้ข้อมูลในตารางมีขนาดที่อ่านง่ายและไม่แออัด เพื่อให้สามารถเข้าใจสถิติได้อย่างรวดเร็ว

#### Acceptance Criteria

1. WHEN Mobile_Viewport is detected, THE Combined_Table SHALL reduce header font size from 1.05rem to 0.75rem
2. WHEN Mobile_Viewport is detected, THE Combined_Table SHALL reduce cell font size from 1.15rem to 0.85rem
3. WHEN Mobile_Viewport is detected, THE Combined_Table SHALL reduce team name font size from 1.15rem to 0.9rem
4. THE Combined_Table SHALL maintain readable contrast ratio of at least 4.5:1 for all text content on Mobile_Viewport
5. WHEN Desktop_Viewport is detected, THE Combined_Table SHALL use original font sizes (header: 1.05rem, cell: 1.15rem, team: 1.15rem)

### Requirement 3: Mobile Spacing Optimization

**User Story:** ในฐานะผู้ใช้งานมือถือ ฉันต้องการให้ช่องว่างในตารางถูกปรับให้พอดีกับหน้าจอ เพื่อให้มีพื้นที่เพียงพอสำหรับแสดงข้อมูลทั้ง 10 คอลัมน์

#### Acceptance Criteria

1. WHEN Mobile_Viewport is detected, THE Combined_Table SHALL reduce cell Padding from "10px 14px" to "6px 4px"
2. WHEN Mobile_Viewport is detected, THE Combined_Table SHALL reduce gap between Logo_Element and team name from 10px to 6px
3. WHEN Desktop_Viewport is detected, THE Combined_Table SHALL use original Padding values ("10px 14px" for cells, 10px gap)

### Requirement 4: Mobile Logo Scaling

**User Story:** ในฐานะผู้ใช้งานมือถือ ฉันต้องการให้โลโก้ทีมมีขนาดเหมาะสมกับหน้าจอมือถือ เพื่อประหยัดพื้นที่และรักษาความสมดุลของตาราง

#### Acceptance Criteria

1. WHEN Mobile_Viewport is detected, THE Logo_Element SHALL reduce size from 32px × 32px to 20px × 20px
2. THE Logo_Element SHALL maintain aspect ratio and circular border-radius regardless of viewport size
3. WHEN Desktop_Viewport is detected, THE Logo_Element SHALL maintain original size of 32px × 32px

### Requirement 5: Mobile Header Abbreviation

**User Story:** ในฐานะผู้ใช้งานมือถือ ฉันต้องการให้หัวตารางแสดงเป็นตัวย่อที่เข้าใจง่าย เพื่อประหยัดพื้นที่ในแนวนอนโดยยังคงความหมายไว้

#### Acceptance Criteria

1. WHEN Mobile_Viewport is detected, THE Combined_Table SHALL display column headers using Abbreviation format
2. THE Combined_Table SHALL map column headers as follows on Mobile_Viewport: "อันดับ" → "#", "ทีม" → "ทีม", "แข่ง" → "P", "ชนะ" → "W", "เสมอ" → "D", "แพ้" → "L", "ได้" → "GF", "เสีย" → "GA", "ผลต่าง" → "GD", "คะแนน" → "Pts"
3. WHEN Desktop_Viewport is detected, THE Combined_Table SHALL display full column header names in Thai language

### Requirement 6: Mobile Team Name Display

**User Story:** ในฐานะผู้ใช้งานมือถือ ฉันต้องการให้ชื่อทีมยาวๆ แสดงอย่างเหมาะสมบนหน้าจอเล็ก เพื่อไม่ให้ชื่อทีมเบียดหรือขยายตารางเกินหน้าจอ

#### Acceptance Criteria

1. WHEN Mobile_Viewport is detected AND team name length exceeds 12 characters, THE Combined_Table SHALL truncate the team name with ellipsis (...)
2. WHEN Mobile_Viewport is detected, THE Combined_Table SHALL display full team name on hover or touch-hold for 500 milliseconds
3. THE Combined_Table SHALL preserve Logo_Element visibility regardless of team name length on Mobile_Viewport
4. WHEN Desktop_Viewport is detected, THE Combined_Table SHALL display full team names without truncation

### Requirement 7: Responsive Breakpoint Behavior

**User Story:** ในฐานะนักพัฒนา ฉันต้องการให้ระบบตรวจจับขนาดหน้าจอและปรับแต่งอัตโนมัติ เพื่อให้การแสดงผลเหมาะสมกับอุปกรณ์ที่หลากหลาย

#### Acceptance Criteria

1. THE Combined_Table SHALL apply mobile optimizations WHEN viewport width is less than or equal to 576px
2. THE Combined_Table SHALL apply desktop styling WHEN viewport width is greater than 576px
3. WHEN viewport width changes across the 576px breakpoint, THE Combined_Table SHALL update styling within 100 milliseconds
4. THE Combined_Table SHALL use CSS media queries to detect viewport changes and apply appropriate styles

### Requirement 8: Mobile Data Integrity

**User Story:** ในฐานะผู้ใช้งานมือถือ ฉันต้องการให้ข้อมูลตัวเลขในตารางแสดงครบถ้วนและถูกต้อง เพื่อให้สามารถวิเคราะห์สถิติได้อย่างแม่นยำ

#### Acceptance Criteria

1. THE Combined_Table SHALL display all statistical values (P, W, D, L, GF, GA, GD, Pts) without truncation on Mobile_Viewport
2. THE Combined_Table SHALL maintain correct alignment (center-aligned) for all numerical columns on Mobile_Viewport
3. THE Combined_Table SHALL preserve color coding for GD column (positive: green, negative: red, zero: neutral) on Mobile_Viewport
4. THE Combined_Table SHALL maintain correct ranking order (1st to last) on Mobile_Viewport

### Requirement 9: Mobile Table Structure Preservation

**User Story:** ในฐานะผู้ใช้งานมือถือ ฉันต้องการให้ตารางรักษาโครงสร้างและความสัมพันธ์ของข้อมูล เพื่อให้สามารถเข้าใจข้อมูลได้เหมือนกับบนหน้าจอใหญ่

#### Acceptance Criteria

1. THE Combined_Table SHALL maintain all 10 Table_Columns in the same order on Mobile_Viewport as Desktop_Viewport
2. THE Combined_Table SHALL preserve row background alternation pattern (odd/even) on Mobile_Viewport
3. THE Combined_Table SHALL preserve hover effect styling on Mobile_Viewport
4. THE Combined_Table SHALL maintain border and shadow styling on Mobile_Viewport

### Requirement 10: Mobile Performance Optimization

**User Story:** ในฐานะผู้ใช้งานมือถือ ฉันต้องการให้ตารางโหลดและแสดงผลได้รวดเร็ว เพื่อประหยัดข้อมูลและพลังงานของอุปกรณ์

#### Acceptance Criteria

1. THE Combined_Table SHALL render all 10 columns within 200 milliseconds after data load on Mobile_Viewport
2. THE Combined_Table SHALL apply mobile styles using CSS media queries without JavaScript viewport detection
3. WHEN Logo_Element fails to load, THE Combined_Table SHALL display fallback logo within 100 milliseconds on Mobile_Viewport
4. THE Combined_Table SHALL not trigger horizontal scrollbar on viewport widths between 320px and 576px

