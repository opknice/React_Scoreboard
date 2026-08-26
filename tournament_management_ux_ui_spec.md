# 🏆 Tournament Management UX/UI Specification

## 1. เป้าหมายของระบบ

สร้างหน้า UX/UI สำหรับจัดการ Tournament ฟุตบอล โดยระบบต้องรองรับทั้ง:

- สร้าง Tournament ใหม่
- เพิ่ม/ลบ/แก้ไขทีม
- จัดคู่แข่งขันด้วยตัวเอง (Manual)
- จัดคู่แบบ Drag & Drop
- Auto Generate Fixture
- Auto Generate เฉพาะคู่ที่ยังว่าง
- แก้ไขคู่แข่งขันที่สร้างไว้แล้ว
- เปลี่ยนวัน/เวลา/สนาม
- รองรับ Tournament ที่เริ่มแข่งขันไปแล้ว
- บันทึกผลการแข่งขันภายหลัง
- ตรวจสอบความผิดปกติของ Fixture แต่ต้องไม่บังคับจนเกินไป

> หลักสำคัญ: Tournament สามารถถูกสร้างและจัดการ "กลางทาง" ได้ ไม่จำเป็นต้องเริ่มจากศูนย์

---

# 2. แนวคิดหลักของระบบ

## Tournament = Container

Tournament เป็นตัวเก็บข้อมูลการแข่งขันทั้งหมด เช่น:

- ชื่อรายการ
- Season
- Teams
- Fixtures
- Standings
- Rules
- Venue
- Settings

## Fixture = รายการแข่งขันแต่ละคู่

Fixture ต้องสามารถ:

- Create
- Edit
- Delete
- Reschedule
- Change Venue
- Change Teams
- Record Result
- Change Status

ได้ตลอดอายุของ Tournament

---

# 3. โครงสร้าง Navigation

```text
🏆 Tournament
│
├── Overview
├── Teams
├── Fixtures
├── Standings
└── Settings
```

หน้า Tournament List:

```text
🏆 TOURNAMENTS

[ + Create Tournament ]

Search...

[ All ] [ Draft ] [ Upcoming ] [ Live ] [ Finished ]

Tournament Card
├── Logo
├── Name
├── Season
├── Teams
├── Matches
├── Matchweeks
├── Start / End Date
├── Status
└── Manage
```

---

# 4. Tournament List

## เป้าหมาย

ใช้สำหรับเลือก Tournament ที่ต้องการจัดการ

## ข้อมูลบน Card

- Tournament Logo
- Tournament Name
- Season
- จำนวนทีม
- จำนวน Match
- จำนวน Matchweek
- วันที่เริ่ม/จบ
- Status
- Progress
- ปุ่ม Manage

## Status ที่แนะนำ

- Draft
- Upcoming
- Live
- Finished
- Archived

---

# 5. Create Tournament

ไม่ควรทำเป็น Form ยาวหน้าเดียว

ใช้ Stepper:

```text
01 Basic
   ↓
02 Format
   ↓
03 Teams
   ↓
04 Schedule
   ↓
05 Review
```

แต่ Schedule ต้องเป็น Optional เพราะผู้ใช้สามารถสร้าง Tournament แล้วค่อยจัด Fixture ภายหลังได้

---

# 6. Step 01 — Basic Information

Fields:

### Required

- Tournament Name
- Season
- Start Date
- End Date

### Optional

- Description
- Logo
- Organizer
- Default Venue

ตัวอย่าง:

```text
CREATE TOURNAMENT

Tournament Name *
[ Phetchaburi Football League ]

Season
[ 2026 ]

Description
[................................]

Logo
[ Upload Logo ]

Start Date *
[ 01/07/2026 ]

End Date *
[ 30/09/2026 ]

Default Venue
[ VAR วิวตาล อารีน่า ]
```

---

# 7. Step 02 — Competition Format

รองรับอย่างน้อย:

- Single Round Robin
- Double Round Robin
- Knockout
- Group Stage
- Custom

ตัวอย่าง:

```text
COMPETITION FORMAT

┌─────────────────────┐
│ ⚽ League            │
│ Single Round Robin   │
└─────────────────────┘

┌─────────────────────┐
│ 🏆 Knockout          │
└─────────────────────┘

┌─────────────────────┐
│ 🔀 Group Stage       │
└─────────────────────┘

┌─────────────────────┐
│ ⚙ Custom             │
└─────────────────────┘
```

ถ้าเลือก League:

```text
Round Robin
○ Single
○ Double

Teams
[ 10 ]

Win
[ 3 ]

Draw
[ 1 ]

Loss
[ 0 ]
```

ระบบควรคำนวณ Summary ให้อัตโนมัติ:

```text
10 Teams
9 Matches / Team
45 Total Matches
9 Matchweeks
```

---

# 8. Step 03 — Teams

ผู้ใช้สามารถ:

- เลือกทีมที่มีอยู่แล้ว
- เพิ่มทีมใหม่
- ลบทีม
- ค้นหาทีม

ตัวอย่าง:

```text
TEAMS

Selected: 10 / 10

[ + Add Team ]

Search Team...

☑ Team A
☑ Team B
☑ Team C
☑ Team D
☑ Team E
```

Summary:

```text
TOURNAMENT SUMMARY

Teams       10
Matches     45
Matchweeks   9
```

---

# 9. Step 04 — Schedule

สำคัญมาก:

> Schedule ไม่ควรเป็นสิ่งที่บังคับตอนสร้าง Tournament

ผู้ใช้สามารถกด:

```text
Create Tournament
```

โดยยังไม่มี Fixture ก็ได้

หรือจะ Generate บางส่วนก็ได้

ระบบต้องรองรับ Tournament ที่มี Fixture อยู่แล้ว

---

# 10. Step 05 — Review

ก่อน Create ให้ตรวจสอบ:

```text
REVIEW TOURNAMENT

Tournament
Phetchaburi Football League 2026

Teams
10

Format
Single Round Robin

Matches
45

Matchweeks
9

Start
01 Jul 2026

End
26 Aug 2026

✓ Teams configured
✓ Format configured
⚠ Fixtures not generated
```

ถ้ายังไม่มี Fixture ต้องอนุญาตให้สร้าง Tournament ได้

ข้อความควรสื่อว่า:

```text
You can create this tournament now.
Fixtures can be created manually later.
```

---

# 11. Tournament Dashboard

หลังสร้าง Tournament ให้เข้าหน้านี้ทันที

```text
🏆 Phetchaburi Football League

Season 2026
🟢 ACTIVE

[ Edit Tournament ]

Overview
Teams
Fixtures
Standings
Settings
```

Overview แสดง:

```text
10
Teams

45
Matches

9
Matchweeks

Next Match
19:00
Team A vs Team B
```

และ Recent Results

---

# 12. Fixtures — หน้าหลักที่สำคัญที่สุด

ต้องมี 2 Mode:

```text
[ 📋 Match List ] [ 🧩 Fixture Builder ]
```

## Match List

ใช้ดู Fixture ทั้งหมด

Filter:

- Matchweek
- Date
- Team
- Status
- Venue

ตัวอย่าง:

```text
MATCHWEEK 5

19:00
Team A  3 - 1  Team B
FT
[ Edit ]

19:40
Team C  2 - 2  Team D
LIVE
[ Edit ]

20:20
Team E  VS  Team F
UPCOMING
[ Edit ]
```

---

# 13. Fixture Builder

ต้องรองรับการจัดคู่ด้วยตัวเอง

## วิธีที่ 1 — Manual Create

ปุ่ม:

```text
[ + Create Match ]
```

Form:

```text
CREATE MATCH

Matchweek
[ 5 ]

Date
[ 12 Aug 2026 ]

Time
[ 20:20 ]

Home Team
[ Team A ▼ ]

Away Team
[ Team B ▼ ]

Venue
[ VAR Arena ▼ ]

Status
[ Scheduled ▼ ]

[ Cancel ] [ Create Match ]
```

---

# 14. วิธีที่ 2 — Drag & Drop

แนะนำให้เป็น UX หลักสำหรับ Fixture Builder

ด้านซ้าย:

```text
AVAILABLE TEAMS

┌────────────────┐
│ 🟢 Team A      │
├────────────────┤
│ 🔵 Team B      │
├────────────────┤
│ 🟡 Team C      │
├────────────────┤
│ 🔴 Team D      │
└────────────────┘
```

ด้านขวาเป็น Match Slots:

```text
19:00

┌──────────────┐
│ Drop Team    │
└──────────────┘

      VS

┌──────────────┐
│ Drop Team    │
└──────────────┘
```

เมื่อจับคู่แล้ว:

```text
19:00

Team A

  VS

Team B
```

เมื่อ Team ถูกใช้ใน Match Slot แล้ว ให้เอาออกจาก Available Teams

---

# 15. วิธีที่ 3 — Auto Generate

ต้องมีปุ่ม:

```text
[ ⚡ Auto Generate Remaining ]
```

สำคัญ:

> Auto Generate ต้องไม่สร้างทับ Fixture ที่มีอยู่แล้ว

ตัวอย่าง:

```text
Matchweek 5

✅ Match 1
✅ Match 2
✅ Match 3
⬜ Match 4
⬜ Match 5
```

เมื่อกด Auto Generate:

- รักษา Match 1-3
- สร้างเฉพาะ Match 4-5

---

# 16. Manual Override

Admin ต้องสามารถแก้คู่ที่ระบบคำนวณไว้แล้วได้

ตัวอย่าง:

```text
Existing:
Team A vs Team B

Admin เปลี่ยนเป็น:
Team A vs Team C
```

ต้องทำได้จาก:

```text
[ Edit Match ]
```

Form:

```text
Home Team
[ Team A ▼ ]

Away Team
[ Team C ▼ ]

Date
[ 19 Aug 2026 ]

Time
[ 20:20 ]

Venue
[ VAR Arena ▼ ]

[ Save Changes ]
```

---

# 17. Validation Rules

ระบบต้องตรวจสอบ Fixture แต่ไม่ควร Lock การทำงานมากเกินไป

## Error — ควร Block

### ทีมเดียวกันทั้งสองฝั่ง

```text
❌ Team A cannot play against Team A
```

### ไม่มีคู่แข่งครบสองทีม

```text
❌ Match must have 2 different teams
```

---

# 18. Warning — ไม่ควร Block

ถ้าพบข้อมูลที่น่าสงสัย ให้แจ้งเตือน แต่ให้ Admin Override ได้

## Warning: Duplicate Fixture

```text
⚠ Duplicate Fixture

Team A and Team B already played
in Matchweek 2.

[ Save Anyway ]
[ Change Teams ]
```

## Warning: Team Already Has Match

```text
⚠ Team Schedule Conflict

Team A already has a match
at 20:20 on this date.

[ Save Anyway ]
[ Change Time ]
```

## Warning: No Venue

```text
⚠ Venue not assigned

You can save this match and assign
a venue later.

[ Continue ]
```

---

# 19. Matchweek Summary

ด้านบนของ Fixture Builder ควรมี Summary

```text
MATCHWEEK 5

10 Teams

4 / 5 Matches Created

✅ 8 Teams Scheduled
⚠ 2 Teams Remaining

[ Assign Remaining Teams ]
```

ถ้ามีจำนวนทีมคี่:

```text
10 Teams
5 Matches
```

ถ้ามี 9 ทีม:

```text
9 Teams
4 Matches + 1 BYE
```

ระบบต้องรองรับ BYE

---

# 20. Fixture Status

ใช้ Status ชัดเจน:

- Scheduled
- Live
- Half Time
- Finished
- Postponed
- Cancelled
- TBD

ตัวอย่าง:

```text
🟢 LIVE
🔵 UPCOMING
⚪ FT
🟠 POSTPONED
🔴 CANCELLED
⚫ TBD
```

---

# 21. Edit Fixture

Admin ต้องสามารถ:

- เปลี่ยน Home Team
- เปลี่ยน Away Team
- เปลี่ยน Date
- เปลี่ยน Time
- เปลี่ยน Venue
- เปลี่ยน Matchweek
- เปลี่ยน Status
- ลบ Fixture

---

# 22. Reschedule

ควรมี Action:

```text
[ Reschedule ]
```

และ Dialog:

```text
RESCHEDULE MATCH

Old
12 Aug 2026
20:20

New Date
[ 19 Aug 2026 ]

New Time
[ 20:20 ]

New Venue
[ VAR Arena ]

Reason
[ Rain / Venue Conflict / Other ]

[ Save ]
```

---

# 23. Mid-Tournament Support

ต้องออกแบบรองรับสิ่งนี้เป็น Requirement หลัก

ตัวอย่าง:

```text
Tournament
เริ่มไปแล้ว

Matchweek 1 ✅
Matchweek 2 ✅
Matchweek 3 ✅
Matchweek 4 ✅
Matchweek 5 ⬅ กำลังจัด
Matchweek 6 ⬜
Matchweek 7 ⬜
```

Admin สามารถเข้ามา:

- เพิ่ม Fixture ใหม่
- จัดคู่เอง
- แก้คู่
- ย้ายเวลา
- ย้ายสนาม
- เพิ่มผลการแข่งขันย้อนหลัง

โดยไม่ต้องสร้าง Tournament ใหม่

---

# 24. Existing Tournament Import / Manual Entry

สำหรับกรณีเริ่มทำระบบกลางฤดูกาล:

ต้องสามารถสร้าง Fixture ย้อนหลังได้

ตัวอย่าง:

```text
[ + Create Match ]

Matchweek
[ 1 ]

Date
[ 01 Jul 2026 ]

Home
[ Team A ]

Away
[ Team B ]

Result
[ 3 ]

-
[ 1 ]

Status
[ Finished ]
```

ดังนั้นระบบไม่ควรสมมติว่า Fixture ต้องถูกสร้างก่อนการแข่งขันเสมอ

---

# 25. UX States

ทุกหน้าต้องรองรับ:

## Loading

```text
Generating fixtures...
████████░░
```

## Empty

```text
No fixtures created

Create a match manually or
generate remaining fixtures.

[ + Create Match ]
[ ⚡ Auto Generate ]
```

## Error

```text
⚠ Unable to create fixture

Please check the selected teams.
```

## Success

```text
✓ Match created successfully
```

## Unsaved Changes

```text
⚠ You have unsaved changes

[ Discard ]
[ Keep Editing ]
```

---

# 26. Components ที่ควรมี

```text
TournamentCard
TournamentHeader
TournamentStatus

TournamentStepper

TournamentBasicForm
TournamentFormatForm
TournamentTeamSelector
TournamentReview

TournamentOverview
TournamentStats

FixtureTabs
FixtureList
FixtureCard
FixtureBuilder
MatchSlot
TeamDraggableItem
TeamDropZone

CreateMatchDialog
EditMatchDialog
RescheduleDialog

StandingsTable

ConfirmationDialog
WarningDialog
Toast
```

Base UI:

```text
Button
Input
Select
Dropdown
Modal
Card
Tabs
Badge
Table
DatePicker
TimePicker
Toast
ConfirmDialog
```

---

# 27. Recommended Desktop Layout

```text
┌─────────────────────────────────────────────────────────┐
│ 🏆 Tournament Name                                      │
│ Season 2026                  [ Edit Tournament ]        │
├─────────────────────────────────────────────────────────┤
│ Overview | Teams | Fixtures | Standings | Settings      │
├──────────────────┬──────────────────────────────────────┤
│                  │                                      │
│ Matchweeks       │ MAIN CONTENT                         │
│                  │                                      │
│ MW 1 ✅          │ Match List / Fixture Builder         │
│ MW 2 ✅          │                                      │
│ MW 3 ✅          │                                      │
│ MW 4 ✅          │                                      │
│ MW 5 🟢          │                                      │
│ MW 6 ⬜          │                                      │
│                  │                                      │
└──────────────────┴──────────────────────────────────────┘
```

ใน Fixture Builder:

```text
┌───────────────────┬──────────────────────────────────────┐
│ AVAILABLE TEAMS   │ MATCH SLOTS                          │
│                   │                                      │
│ Team A            │ 19:00                               │
│ Team B            │ [ Team A ] VS [ Team B ]            │
│ Team C            │                                      │
│ Team D            │ 19:40                               │
│                   │ [ Team C ] VS [ Team D ]            │
│                   │                                      │
│                   │ 20:20                               │
│                   │ [ Drop Team ] VS [ Drop Team ]       │
└───────────────────┴──────────────────────────────────────┘
```

---

# 28. Mobile UX

ต้องรองรับ Mobile ด้วย

Desktop ใช้ Drag & Drop ได้

Mobile ควรมีทางเลือก:

```text
19:00

Home Team
[ Select Team ]

VS

Away Team
[ Select Team ]

[ Save Match ]
```

อย่าบังคับ Drag & Drop บน Mobile

---

# 29. Design Direction

Recommended style:

## Premium Football / Sports Dashboard

แนวทาง:

- Dark background
- White text
- Gold accent
- Green football accent
- Card-based layout
- Strong typography
- Clear Status Badge
- High contrast
- Minimal unnecessary decoration

แต่ต้องให้ Information Hierarchy มาก่อนความสวย

---

# 30. UX หลักที่ต้องยึด

## Rule 1
อย่าบังคับ Generate Fixture ตอนสร้าง Tournament

## Rule 2
Tournament ที่เริ่มแข่งแล้วต้องจัดการต่อได้

## Rule 3
Admin ต้องจับคู่เองได้

## Rule 4
รองรับ Drag & Drop

## Rule 5
Auto Generate ต้องสร้างเฉพาะคู่ที่ยังว่าง

## Rule 6
Existing Fixture ห้ามถูก Overwrite โดยไม่ตั้งใจ

## Rule 7
ระบบควร Warning แต่ไม่ Block ในกรณี Duplicate / Schedule Conflict

## Rule 8
Admin ต้อง Override ได้

## Rule 9
สร้าง Fixture ย้อนหลังได้

## Rule 10
สร้าง Fixture โดยไม่มี Result ได้

---

# 31. Recommended User Flow

```text
Tournament List
      ↓
Create Tournament
      ↓
Basic Information
      ↓
Competition Format
      ↓
Add Teams
      ↓
Create Tournament
      ↓
Tournament Dashboard
      ↓
Fixtures
      ↓
เลือก Matchweek
      ↓
┌────────────────────────────┐
│ Manual Create Match        │
│ Drag & Drop                │
│ Auto Generate Remaining    │
└────────────────────────────┘
      ↓
ตรวจ Validation
      ↓
Warning / Error
      ↓
Save Fixture
      ↓
Fixture List
      ↓
Edit / Reschedule / Result
```

---

# 32. MVP ที่ควรพัฒนาก่อน

ลำดับแนะนำ:

### Phase 1 — Tournament Core

- Tournament List
- Create Tournament
- Tournament Dashboard
- Teams

### Phase 2 — Fixture Management

- Fixture List
- Create Match
- Edit Match
- Delete Match
- Reschedule

### Phase 3 — Fixture Builder

- Drag & Drop Team
- Match Slots
- Manual Pairing
- Matchweek Management

### Phase 4 — Smart Scheduling

- Auto Generate
- Auto Generate Remaining
- Duplicate Detection
- Schedule Conflict Detection
- BYE Handling

### Phase 5 — Match Result

- Score
- Match Events
- Finished Status
- Standings Update

---

# 33. Final Requirement

ระบบ Tournament Management ที่พัฒนาต้องไม่ถูกออกแบบโดยสมมติว่า:

> "สร้าง Tournament → ระบบ Generate ตารางทั้งหมด → จบ"

แต่ต้องออกแบบโดยสมมติว่า:

> "Tournament อาจมีการแข่งขันเกิดขึ้นแล้ว, Fixture อาจมีอยู่บางส่วน, Admin อาจต้องเพิ่มคู่ย้อนหลัง, อาจต้องจัดคู่เอง, อาจต้องแก้คู่, และอาจใช้ Auto Generate เฉพาะส่วนที่เหลือ"

หัวใจของระบบจึงต้องเป็น:

```text
🏆 Tournament
        ↓
👥 Teams
        ↓
📅 Matchweeks
        ↓
🧩 Fixture Builder
        ├── Manual Create
        ├── Drag & Drop
        ├── Edit
        ├── Reschedule
        └── Auto Generate Remaining
        ↓
⚽ Match Results
        ↓
📊 Standings
```

นี่คือ UX/UI Architecture ที่ควรยึดเป็น Base ในการพัฒนา Tournament Management
