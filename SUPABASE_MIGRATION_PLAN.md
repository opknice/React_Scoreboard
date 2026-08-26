# แผนถอน Firebase และย้ายระบบไป Supabase

**สถานะ:** Firebase runtime ถูกถอนออกจาก application แล้ว — Supabase Auth, owner-only leagues, matches, teams, crop metadata, Private/Public Overlay, Permission Realtime และ Supabase-first Scoreboard ใช้งานอยู่เป็นหลัก เหลือเพียง migration history/offline import assets ที่เก็บไว้เป็นหลักฐานและ rollback reference
**อัปเดตล่าสุด:** 26 สิงหาคม 2026
**ขอบเขต:** ย้าย Firebase ออกจากระบบทั้งหมด โดยยังคง OBS, Replay, IndexedDB, localStorage, Excel และ Cloudinary ไว้ก่อน  
**สถาปัตยกรรมเป้าหมาย:** Supabase Project เดียว แยกข้อมูลแต่ละลีกด้วย `league_id`  
**ไฟล์อ้างอิง:** [`PROJECT_ANALYSIS.md`](PROJECT_ANALYSIS.md)

## สถานะปัจจุบันและสิ่งที่ทำแล้ว

### ฝั่ง Supabase project

- สร้าง Supabase Project และตั้งค่า Project URL กับ publishable/anon key แล้ว
- เปิด Google Auth provider แล้ว
- ตั้ง Site URL และ Redirect URLs สำหรับ production/local แล้ว
- รัน migration `0001` ถึง `0007` ใน Supabase SQL Editor แล้ว
- เพิ่ม `thanakrit_kas@hotmail.com` เป็น Super Admin และกำหนดเป็นเจ้าของ `Alcohol League` กับ `Var38 League`
- Import ข้อมูลจาก Firebase JSON สำเร็จแล้ว:
  - Alcohol League: 24 matches, 10 teams
  - Var38 League: 18 matches, 6 teams
- เปิดใช้ owner-only access: ผู้ใช้เห็นเฉพาะลีกที่ตนเองเป็นเจ้าของ และยังไม่เปิด sharing
- เปิดใช้ Overlay URL แบบ owner-issued read-only token ซึ่งหมดอายุได้
- เพิ่ม Public Overlay แยกตามลีกผ่าน `leagues.is_public` และ RPC แบบ read-only โดย URL ไม่มีวันหมดอายุ
- เปิด Realtime สำหรับ `user_access` และ `user_roles` เพื่อให้การเปลี่ยน Permission อัปเดตทันที

### ฝั่ง application

- ย้าย Google Login, session, logout, access status และ Super Admin check ไป Supabase Auth/RPC แล้ว
- ลบ provider switch หลัง cutover และให้ application ใช้ Supabase โดยตรง
- Controller โหลดลีกจาก Supabase และแสดงปุ่มบันทึก match ของแต่ละลีกแล้ว
- Database Viewer รองรับ list/create/update/delete matches ผ่าน Supabase
- เพิ่ม Supabase Realtime subscription สำหรับ matches และ teams
- ย้ายการจัดการ teams, logo URL และ crop metadata ไป Supabase
- Scoreboard โหลด matches และ teams ตามลีกที่เลือกจาก Supabase เป็นหลักแล้ว
- Match navigation (`matchIdInput` และปุ่มเลื่อน) เชื่อมกับ Supabase matches แล้ว
- Team Select Modal แสดงทีมจาก Supabase ได้แม้ไม่มี Excel Team Sheet
- Scoreboard ใช้ Supabase logo URL และ crop metadata ของลีกที่เลือก และป้องกันข้อมูลปะปนเมื่อสลับลีก
- ปรับ Auth lifecycle ให้ตรวจ Auth/Permission ตอน Initial Load, ไม่ตรวจ Permission ซ้ำเมื่อ `TOKEN_REFRESHED`, ตรวจเมื่อ Tab กลับมาและข้อมูลเก่า และมี fallback check ทุก 10 นาทีเฉพาะเมื่อจำเป็น
- เพิ่ม Permission Realtime listener สำหรับ `user_access` และ `user_roles`
- ย้าย Overlay, League Table, All Scores และ Combined Standalone ให้รองรับ Supabase snapshot ผ่าน token
- ยังคง Cloudinary สำหรับอัปโหลดรูปภาพตาม scope เดิม
- ตรวจสอบผ่านแล้ว: TypeScript, lint, tests 125 รายการ และ production build หลังถอน Firebase

### สถานะสำคัญที่ต้องเข้าใจ

ระบบ production เป็น Supabase-only แล้ว ส่วน Firebase ที่ยังปรากฏในเอกสาร migration, SQL history และสคริปต์ import offline เท่านั้น ไม่ถูก bundle หรือเรียกใช้โดย application runtime

## ลำดับความสำคัญหลัก

ลำดับนี้เป็นกติกาหลักสำหรับการพัฒนาต่อ ทุกงานต้องทำตามลำดับ เว้นแต่มีการอนุมัติเปลี่ยนแผนโดยชัดเจน

### P0 — ความปลอดภัยและความพร้อมของระบบปัจจุบัน **เสร็จแล้ว**

ต้องทำก่อนเพิ่ม UX/UI ขนาดใหญ่:

- [x] ทำ manual acceptance test กับ Alcohol League และ Var38 League ครบแล้ว
- [x] ทดสอบสลับลีก, Match navigation, Team Select, logo/crop และ Realtime แล้ว
- [x] ทดสอบ Private Overlay และ Public Overlay แล้ว
- [x] ทดสอบ RLS ด้วย user อื่นว่าไม่เห็นลีก, teams หรือ matches ของ `thanakrit_kas@hotmail.com` แล้ว
- [x] เติม Supabase environment variables ใน Vercel และทดสอบ production URL แล้ว

### P1 — Supabase cutover และถอน Firebase runtime **เสร็จแล้วใน codebase**

1. เก็บ JSON ต้นทางและข้อมูล Supabase ที่ import แล้วไว้เป็น rollback reference พร้อมกำหนด freeze point
2. ตรวจ Firebase references ที่ยังเหลือใน runtime — ไม่พบแล้ว
3. ยืนยัน Supabase เป็น provider หลักใน production จาก P0 และ source configuration
4. ถอน Firebase package, config, adapter, URL parser และ parser จาก Excel ที่ไม่จำเป็นแล้ว
5. รัน test, lint, build และตรวจ Firebase reference ให้ครบ — ผ่านแล้ว

### P2 — ออกแบบและขยาย Schema สำหรับ Tournament Management

ต้องทำก่อนสร้าง Tournament Dashboard หรือ Fixture Builder:

1. เพิ่มข้อมูล Season, Description, Logo, Date และ Tournament Status ให้ `leagues`
2. เพิ่ม Matchweek ที่เป็นโครงสร้างจริง ไม่ใช้ `round_label` เป็นข้อมูลหลักตลอดไป
3. เพิ่ม Team ID ใน matches เพื่อรองรับการเปลี่ยนชื่อทีมและตรวจสอบคู่แข่งอย่างถูกต้อง
4. เพิ่มเวลาแข่งขัน, Venue และ Match Status
5. รักษา field เดิมและ `legacy_firebase_id` ไว้จนกว่าจะตรวจสอบข้อมูลเก่าครบ
6. จัดทำ migration ใหม่ เช่น `0008_tournament_foundation.sql` แล้วทดสอบกับสองลีกปัจจุบัน

### P3 — Tournament Core UX/UI

1. Tournament List
2. Tournament Dashboard
3. Tournament Basic Information
4. Teams management
5. Tournament status และ summary

### P4 — Fixture Management

1. Fixture List
2. Filter ตาม Matchweek, Date, Team และ Status
3. Create Match
4. Edit Match
5. Reschedule
6. Venue และ Match Status
7. Cancelled/Archived แทนการลบข้อมูลสำคัญแบบถาวร

### P5 — Fixture Builder

1. Manual pairing
2. Match slots
3. Assign remaining teams
4. Drag & Drop สำหรับ Desktop
5. Select-based workflow สำหรับ Mobile

### P6 — Smart Scheduling และ Standings

1. Auto Generate
2. Auto Generate Remaining โดยห้ามเขียนทับ Fixture เดิม
3. Duplicate และ schedule conflict warnings
4. BYE handling
5. Match results และ standings

### งานที่ยังไม่ควรเริ่ม

- Drag & Drop ก่อนมี Manual Fixture workflow ที่เสถียร
- Auto Generate ก่อนมี Matchweek, Team ID และข้อมูล Fixture ที่ชัดเจน
- Standings ก่อนกำหนด rules และ tie-breaker อย่างเป็นทางการ
- Cloudinary → Supabase Storage จนกว่า Firebase migration และ Tournament foundation จะนิ่ง

## งานถัดไปที่ต้องทำจริง

ขณะนี้ P0 และ P1 เสร็จแล้ว งานถัดไปคือ **P2 — Tournament Schema Foundation** โดยต้อง review และอนุมัติ schema ก่อนเริ่มสร้าง UX/UI ใหม่ และยังไม่เริ่ม Drag & Drop หรือ Auto Generate

## บันทึกอัปเดตล่าสุด — 26 สิงหาคม 2026

- P0 และ P1 ผ่านการตรวจสอบและถือว่าเสร็จแล้วในระดับ application/codebase
- Application production ใช้ Supabase-only; ไม่พบ Firebase reference ใน runtime หรือ production build
- การตรวจสอบล่าสุดผ่าน: `npm run build`, `npm run lint` และ `npm test` — 16 test files, 125 tests
- `.env` local ยังต้องลบตัวแปรเก่า `VITE_FIREBASE_*`, `VITE_ALLOWED_EMAILS` และ `VITE_DATA_PROVIDER` ด้วยตนเอง โดยคงเฉพาะ Supabase variables
- Firebase project, migration history และ offline import assets ยังไม่ถูกลบ เพื่อใช้เป็น rollback reference
- งานถัดไปที่ได้รับอนุมัติตามลำดับคือ P2: ออกแบบและ review Tournament Schema Foundation ก่อนสร้าง UX/UI

## 1. เป้าหมาย

- ถอน Firebase SDK และ Firebase-specific implementation ออกจาก source code
- ย้าย Firebase Authentication ไป Supabase Auth โดยยังใช้ Google Login
- ย้าย Firebase Realtime Database ไป Supabase Postgres
- ย้าย realtime subscription จาก Firebase `onValue()` ไป Supabase Realtime
- ย้าย user access, whitelist, trial, quota, matches, teams และ crop metadata
- เลิกส่ง Firebase config ผ่าน URL และเปลี่ยนเป็น `league_id`
- รักษาพฤติกรรมของ Scoreboard, OBS Overlay, Replay, Macro และ Admin ให้เหมือนเดิม
- เพิ่ม security ด้วย Supabase RLS และ server-side authorization

## 2. สิ่งที่อยู่ในขอบเขตและนอกขอบเขต

### อยู่ในขอบเขต

- Firebase Auth
- Firebase Realtime Database
- Firebase app initialization และ dynamic league config
- Firebase URL config ใน overlay
- Firebase user permissions
- Firebase whitelist
- Firebase matches
- Firebase teams และ logos metadata
- Firebase crop metadata
- Firebase upload quota
- Firebase-related types, hooks, utilities, tests, docs และ environment variables

### ยังไม่ย้ายในรอบ Firebase migration

- OBS WebSocket ที่ `ws://localhost:4455`
- IndexedDB สำหรับ Replay folder handle
- localStorage settings/cache
- Excel/Google Sheets import
- `xlsx` และ `exceljs`
- Cloudinary image upload
- Browser `BroadcastChannel`
- File System Access API

> หากต้องการให้ Supabase เป็น backend สำหรับไฟล์ทั้งหมดในอนาคต ค่อยทำ Cloudinary → Supabase Storage เป็น phase แยกหลัง Firebase migration เสถียรแล้ว

## 3. หลักการออกแบบเป้าหมาย

1. ใช้ Supabase Project เดียวเป็นศูนย์กลาง
2. ใช้ `league_id` แยกข้อมูลของแต่ละลีกแทนการสร้าง Firebase App หลายตัว
3. ให้ React เรียกผ่าน repository/service layer ไม่เรียก Supabase ใน JSX โดยตรง
4. ใช้ `auth.users.id` เป็น user identity หลัก ไม่ใช้ email เป็น primary key
5. ใช้ RLS เป็น security boundary หลัก ไม่พึ่งการตรวจสิทธิ์ใน React เพียงอย่างเดียว
6. ไม่ใส่ Supabase service-role key ใน frontend หรือ `VITE_*`
7. ระหว่าง migration ต้องมี backup และ rollback path
8. คง `BroadcastChannel` ไว้ เพราะเป็นการสื่อสารระหว่าง browser contexts ไม่ใช่ Firebase

เอกสาร Supabase ระบุว่า Auth ใช้ JWT และทำงานร่วมกับ Postgres RLS ได้ จึงควรย้าย authorization มาอยู่ที่ database policy ด้วย ([Supabase Auth](https://supabase.com/docs/guides/auth))

## 4. ภาพรวมสถาปัตยกรรมใหม่

```text
React SPA
│
├─ Supabase Auth
│  └─ Google OAuth / session / sign out
│
├─ Supabase Postgres
│  ├─ leagues
│  ├─ profiles
│  ├─ user_access
│  ├─ user_roles
│  ├─ teams
│  ├─ matches
│  └─ usage_counters
│
├─ Supabase Realtime
│  ├─ matches changes
│  └─ teams changes
│
├─ Supabase Storage (optional future phase)
│
└─ Existing integrations
   ├─ OBS WebSocket
   ├─ BroadcastChannel
   ├─ IndexedDB
   ├─ localStorage
   ├─ Excel / Google Sheets
   └─ Cloudinary
```

## 5. Schema เป้าหมาย

### 5.1 `leagues`

แทนแนวคิด Firebase config target ของแต่ละลีก

| Column | Type | หมายเหตุ |
|---|---|---|
| `id` | `uuid` | primary key |
| `name` | `text` | ชื่อลีก |
| `slug` | `text` | unique |
| `is_active` | `boolean` | เปิด/ปิดการใช้งาน |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

### 5.2 `profiles`

ผูกกับ `auth.users`

| Column | Type | หมายเหตุ |
|---|---|---|
| `id` | `uuid` | FK ไป `auth.users.id`, primary key |
| `email` | `text` | unique, ใช้แสดงผลเท่านั้น |
| `display_name` | `text` | ชื่อจาก Google |
| `photo_url` | `text` | รูป profile |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

### 5.3 `user_access`

แทน Firebase path `user_permissions/{emailKey}`

| Column | Type | หมายเหตุ |
|---|---|---|
| `user_id` | `uuid` | FK ไป profiles, primary key |
| `status` | `text` | `allowed`, `pending`, `denied` |
| `trial_started_at` | `timestamptz` | ใช้คำนวณ free trial |
| `last_login_at` | `timestamptz` | เวลา login ล่าสุด |
| `uploaded_image_count` | `integer` | default 0 |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

### 5.4 `user_roles`

แทนการ hardcode Super Admin email ใน source

| Column | Type | หมายเหตุ |
|---|---|---|
| `user_id` | `uuid` | FK ไป profiles |
| `role` | `text` | `super_admin`, `operator`, `viewer` |
| `created_at` | `timestamptz` | default now |

ควรมี unique constraint ที่ `(user_id, role)`

### 5.5 `teams`

แทน Firebase path `teams/{teamKey}` และข้อมูล crop โลโก้

| Column | Type | หมายเหตุ |
|---|---|---|
| `id` | `uuid` | primary key |
| `league_id` | `uuid` | FK ไป leagues |
| `team_key` | `text` | key ที่ normalize แล้ว |
| `name` | `text` | ชื่อทีม |
| `logo_url` | `text` | URL จาก Cloudinary หรือ Storage |
| `crop_metadata` | `jsonb` | x/y/width/height/zoom/rotation ฯลฯ |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

ควรมี unique constraint ที่ `(league_id, team_key)`

### 5.6 `matches`

แทน Firebase path `matches/{pushId}`

| Column | Type | หมายเหตุ |
|---|---|---|
| `id` | `uuid` | primary key |
| `legacy_firebase_id` | `text` | nullable สำหรับตรวจสอบช่วง migration |
| `league_id` | `uuid` | FK ไป leagues |
| `match_date` | `date` หรือ `text` | ต้องกำหนด format เดียว |
| `team_a` | `text` | ชื่อทีม A ช่วงแรก |
| `team_b` | `text` | ชื่อทีม B ช่วงแรก |
| `score_a` | `integer` | default 0 |
| `score_b` | `integer` | default 0 |
| `round_label` | `text` | รอบการแข่งขัน |
| `match_url` | `text` | nullable |
| `logo_a` | `text` | nullable |
| `logo_b` | `text` | nullable |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

### 5.7 `usage_counters` — optional

ในระยะแรก `uploaded_image_count` อยู่ใน `user_access` ได้ แต่ถ้าต้องการ atomic counter และแยกประเภท quota ควรใช้ตารางนี้:

```text
user_id
metric             -- image_upload
count
updated_at
```

การเพิ่ม quota ควรใช้ SQL function/RPC แบบ atomic ป้องกันการนับผิดเมื่อเปิดหลาย tab

### 5.8 Tournament Management foundation — แผนขยายหลัง migration

ส่วนนี้ยังเป็นแผนออกแบบ ยังไม่มีการรัน migration เพิ่มใน Supabase จนกว่าจะทบทวนและอนุมัติ schema ร่วมกัน

#### ขยาย `leagues` ให้เป็น Tournament container

แนะนำ field เพิ่มเติม:

| Column | Type | หมายเหตุ |
|---|---|---|
| `season` | `text` | เช่น `2026` หรือ `2026/27`, optional |
| `description` | `text` | รายละเอียดรายการ |
| `logo_url` | `text` | โลโก้ Tournament |
| `start_date` | `date` | optional เพื่อรองรับรายการที่เริ่มไปแล้ว |
| `end_date` | `date` | optional |
| `status` | `text` | `draft`, `upcoming`, `live`, `finished`, `archived` |
| `format_type` | `text` | `round_robin`, `knockout`, `group_stage`, `custom` |
| `format_settings` | `jsonb` | rules และ settings ที่ยังเปลี่ยนแปลงได้ |

ห้ามใช้ `is_public` เป็น Tournament status เพราะ field นี้เป็น publish switch ของ Public Overlay โดยเฉพาะ

#### เพิ่ม `matchweeks`

ควรมีตารางแยกเพื่อรองรับการจัด Fixture กลางทาง:

```text
id
league_id
number
label
scheduled_date
status
created_at
updated_at
```

#### ขยาย `matches`

แนะนำ field เพิ่มเติม:

```text
matchweek_id       -- nullable ระหว่าง migration
team_a_id          -- nullable เพื่อรองรับข้อมูล legacy
team_b_id          -- nullable เพื่อรองรับข้อมูล legacy
scheduled_at       -- timestamptz หรือ date + time ที่กำหนด timezone ชัดเจน
venue_id           -- nullable
status             -- scheduled/live/half_time/finished/postponed/cancelled/tbd
reschedule_reason  -- nullable
```

`team_a` และ `team_b` ต้องคงไว้ชั่วคราวเพื่อรองรับข้อมูลที่ import แล้ว และใช้เป็น fallback จนกว่าจะ backfill Team ID ครบ

#### `venues` — optional ตามความต้องการจริง

ถ้าต้องรองรับหลายสนาม ให้สร้างตาราง `venues` แยก ถ้ายังมีสนามเดียวสามารถเริ่มด้วย `venue_name` ใน `matches` ได้ เพื่อลดความซับซ้อนของ migration แรก

#### หลักการสำคัญ

- Start/End Date ต้อง optional เพื่อรองรับ Tournament ที่เริ่มไปแล้ว
- เปลี่ยนชื่อทีมต้องไม่ทำให้ประวัติ Fixture เสีย
- Fixture ที่มีผลการแข่งขันแล้วไม่ควรถูกลบถาวรโดยง่าย
- Auto Generate ต้องรักษา Fixture ที่มีอยู่แล้วและสร้างเฉพาะส่วนที่ว่าง
- Warning เช่น duplicate หรือ schedule conflict ไม่ควร block Admin โดยอัตโนมัติ
- Standings จะทำหลังจาก Match Status, Result และ Format rules ชัดเจนแล้ว

## 6. Mapping จาก Firebase ไป Supabase

| Firebase | Supabase | วิธี migrate |
|---|---|---|
| `user_permissions/{emailKey}` | `profiles` + `user_access` | map ด้วย email ชั่วคราว แล้วผูก `auth.users.id` |
| `status` | `user_access.status` | copy ตรงและ validate enum |
| `trialStartedAt` | `user_access.trial_started_at` | แปลง server timestamp เป็น timestamptz |
| `lastLogin` | `user_access.last_login_at` | แปลง ISO string |
| `uploadedImageCount` | `user_access.uploaded_image_count` | default 0 หากไม่มีค่า |
| `whitelist` | `user_access.status = 'allowed'` | ไม่สร้าง array legacy ในระบบใหม่ |
| `matches/{pushId}` | `matches` | เก็บ push id ใน `legacy_firebase_id` |
| `teams/{teamKey}` | `teams` | เพิ่ม `league_id` ให้ทุก record |
| `teams/{teamKey}/logo/crop` | `teams.crop_metadata` | เก็บเป็น JSONB |
| Firebase config ใน Excel | `leagues` | ใช้เป็น league metadata แทน connection config |
| Firebase config ใน URL | `league_id` ใน URL | เลิกส่ง config ผ่าน query string |

## 7. Phase 0 — เตรียมระบบและกำหนด freeze point

### งาน

- [x] สร้าง Supabase Project
- [x] จด Project URL และ publishable/anon key
- [x] เปิด Google Auth provider
- [x] ตั้ง Site URL: `https://obs-scoreboard-blond.vercel.app/`
- [x] ตั้ง Redirect URLs สำหรับ production และ local (`http://localhost:5173/**`)
- [ ] กำหนดชื่อ schema/table และ naming convention
- [ ] กำหนด timezone และ date format ของ `matches`
- [ ] ทำ Firebase backup แบบ read-only
- [ ] ยืนยันว่า Firebase Rules ปัจจุบันอนุญาตให้ export ได้
- [ ] กำหนด freeze point สำหรับการแก้ข้อมูล production ระหว่าง migration

### Environment ใหม่

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

ห้ามใส่ service-role key ใน frontend

### เงื่อนไขผ่าน Phase 0

- [ ] Login Google บน Supabase Dashboard ทดสอบได้
- [ ] Redirect กลับมาที่ทุก deployment environment ได้
- [ ] Firebase backup ถูกเก็บแยกจาก source code
- [ ] มีรายชื่อข้อมูลที่จะ migrate และจำนวน record คร่าว ๆ

### ความคืบหน้าจากการเริ่มพัฒนา

- [x] เพิ่ม `@supabase/supabase-js`
- [x] เพิ่ม `src/config/supabaseClient.ts` แบบ lazy singleton
- [x] เพิ่ม `src/config/supabaseAuth.ts` สำหรับ Google OAuth, session และ logout
- [x] เพิ่ม `supabase/migrations/0001_initial_schema.sql`
- [x] เพิ่ม `supabase/README.md` สำหรับการรัน migration และตั้งค่า Auth
- [x] เพิ่ม `supabase/migrations/0002_auth_rpc.sql` และรันใน project จริง
- [x] เพิ่ม `supabase/migrations/0003_private_league_ownership.sql` สำหรับ owner-only league access
- [x] เพิ่ม `supabase/migrations/0004_legacy_match_identity.sql` สำหรับ import แบบ idempotent
- [x] รัน `supabase/migrations/0005_overlay_access_tokens.sql` ใน Supabase project จริง
- [x] เพิ่ม `supabase/migrations/0006_public_overlay.sql` สำหรับ Public Overlay แยกตามลีก
- [x] เพิ่ม `supabase/migrations/0007_permission_realtime.sql` สำหรับ Permission Realtime
- [x] รัน migration `0006` และ `0007` ใน Supabase project จริง
- [x] เติมค่า Supabase environment variables ใน local `.env`
- [ ] เติมค่า Supabase environment variables ใน Vercel
- [x] เชื่อม Auth provider ของ application เข้ากับ Supabase

รายการที่ทำเครื่องหมาย `[x]` เป็นงานใน repository แล้ว ส่วนรายการ setup ภายนอกต้องทำใน Supabase Dashboard/Vercel ตามคู่มือ `supabase/README.md`

## 8. Phase 1 — สร้าง database migrations และ RLS

### ไฟล์ที่จะเพิ่ม

```text
supabase/
├─ config.toml                 # ถ้าใช้ Supabase CLI/local development
└─ migrations/
   ├─ 0001_initial_schema.sql
   ├─ 0002_auth_rpc.sql
   ├─ 0003_private_league_ownership.sql
   ├─ 0004_legacy_match_identity.sql
   ├─ 0005_overlay_access_tokens.sql
   ├─ 0006_public_overlay.sql
   └─ 0007_permission_realtime.sql
```

Migration แรกถูกรวมเป็นไฟล์เดียวใน repository ปัจจุบัน เพื่อให้สร้าง schema, trigger, function, RLS และ Realtime ได้เป็นชุดเดียว ส่วน `0002_auth_rpc.sql` เป็น follow-up สำหรับบันทึก login timestamp ผ่าน RPC และ `0003_private_league_ownership.sql` เปลี่ยนเป็น private owner-only พร้อม seed สองลีกปัจจุบัน

### Ownership requirement ปัจจุบัน

- `owner_id` เป็นเจ้าของหลักของลีก
- เจ้าของเห็น/แก้ไขได้เฉพาะลีกของตัวเอง
- Super Admin เห็นและจัดการได้ทุกลีก
- `league_memberships` ยังไม่ถูกใช้เพื่อแชร์ลีกในช่วงพัฒนา
- anonymous ไม่สามารถอ่าน table ของลีก private โดยตรง; Overlay ใช้ RPC snapshot กับ owner-issued token แทน

### RLS policy ที่ต้องออกแบบ

| ตาราง | Anonymous | Authenticated | Super Admin |
|---|---|---|---|
| `leagues` | ห้ามอ่านโดยตรง | อ่านเฉพาะ owner | จัดการทั้งหมด |
| `matches` | ห้ามอ่านโดยตรง; อ่านผ่าน token RPC ได้เฉพาะ snapshot | อ่าน/เขียนเฉพาะ owner | จัดการทั้งหมด |
| `teams` | ห้ามอ่านโดยตรง; อยู่ใน token snapshot ตามลีก | อ่าน/เขียนเฉพาะ owner | จัดการทั้งหมด |
| `profiles` | ห้ามอ่าน | อ่านของตัวเอง | อ่านตาม policy |
| `user_access` | ห้ามอ่าน | อ่านของตัวเอง | จัดการทั้งหมด |
| `user_roles` | ห้ามอ่าน | อ่าน role ของตัวเอง | จัดการทั้งหมด |
| `league_memberships` | ห้ามอ่าน | อ่าน membership ของตัวเอง | จัดการทั้งหมด |

### Admin operations

การเปลี่ยน user status ไม่ควรใช้ client update row ของ user คนอื่นโดยตรง ให้เลือกอย่างใดอย่างหนึ่ง:

- SQL function แบบ `SECURITY DEFINER` พร้อมตรวจ role
- Supabase Edge Function ที่ตรวจ JWT และ role

### เงื่อนไขผ่าน Phase 1

- [x] Migration `0001` ถึง `0007` รันใน Supabase project จริงได้
- [ ] RLS ปิดการอ่าน `user_access` สำหรับ anonymous
- [ ] ผู้ใช้ทั่วไปแก้สถานะของ user คนอื่นไม่ได้
- [ ] ผู้ไม่มีสิทธิ์เขียน match ไม่สามารถ insert/update/delete ได้
- [ ] Anonymous overlay อ่านได้เฉพาะข้อมูลที่ตั้งใจเผยแพร่

## 9. Phase 2 — สร้าง Supabase client และ adapter

### ความคืบหน้าปัจจุบัน

- [x] Typed Supabase client contract ใน `src/types/database.ts`
- [x] เพิ่ม `VITE_DATA_PROVIDER` switch โดย default เป็น Firebase
- [x] League repository: list/find/create league
- [x] Match repository: list/create/update/delete
- [x] Team repository: list/upsert
- [x] Postgres Changes subscription สำหรับ matches และ teams
- [x] Permission Realtime subscription สำหรับ `user_access` และ `user_roles`
- [x] ผูก repository เข้ากับ Controller ด้วย provider switch
- [x] สร้าง/นำเข้า league records จาก Firebase เดิม

การ import ลีกปัจจุบันเสร็จแล้ว: `Alcohol League` และ `Var38 League` มี owner เป็น `thanakrit_kas@hotmail.com` และข้อมูล matches/teams ถูกนำเข้าแล้ว

### ไฟล์ใหม่

```text
src/config/supabaseClient.ts
src/config/supabaseAuth.ts
src/services/supabaseAccessService.ts
src/services/supabaseLeagueService.ts
src/services/supabaseTeamService.ts
src/services/supabaseQuotaService.ts
src/types/supabase.ts
src/types/database.ts              # generated types หากใช้ Supabase CLI
```

### Interface ที่ต้องมี

```ts
interface LeagueRepository {
  listMatches(leagueId: string): Promise<MatchRecord[]>;
  createMatch(input: CreateMatchInput): Promise<MatchRecord>;
  updateMatch(id: string, input: UpdateMatchInput): Promise<void>;
  deleteMatch(id: string): Promise<void>;
  subscribeMatches(
    leagueId: string,
    onChange: (event: MatchChangeEvent) => void,
  ): () => void;
}
```

### หลักการ

- Component รู้เฉพาะ interface ไม่รู้ว่า backend เป็น Firebase หรือ Supabase
- ใช้ `unknown` และ generated database types แทน `any`
- รวม error mapping ไว้ที่ adapter
- คืนค่า domain model ที่เหมือนกันทั้ง read และ write

## 10. Phase 3 — ย้าย Authentication

### ไฟล์ที่ต้องแก้

- `src/config/firebaseAuth.ts` → เปลี่ยนเป็น `src/config/supabaseAuth.ts`
- `src/components/AuthGuard.tsx`
- `src/components/AdminWhitelist.tsx`
- `src/context/AuthAccessProvider.tsx`
- `src/context/authAccessContext.ts`
- `src/hooks/useAuthAccess.ts`
- `src/hooks/useImageUploadQuota.ts`

### Mapping API

| Firebase | Supabase |
|---|---|
| `getAuth()` | shared Supabase client |
| `onAuthStateChanged()` | `supabase.auth.onAuthStateChange()` |
| `signInWithPopup()` | `supabase.auth.signInWithOAuth({ provider: 'google' })` |
| `signOut()` | `supabase.auth.signOut()` |
| `User` | `User` จาก Supabase Auth |
| email whitelist | `user_access` + RLS/role |

### User migration strategy

ผู้ใช้เดิมที่ login ด้วย Google ไม่ควรย้าย password หรือ token เอง:

1. ผู้ใช้ login Google ผ่าน Supabase ครั้งแรก
2. Supabase สร้าง `auth.users` ใหม่
3. ระบบหา legacy record ด้วย normalized email
4. copy status/trial/quota เข้า `user_access`
5. mark ว่า migration สำเร็จ

### เงื่อนไขผ่าน Phase 3

- [x] Google login ผ่าน Supabase สำเร็จ
- [x] session และ logout ใช้ Supabase Auth
- [x] Super Admin ถูกตรวจจาก `user_roles`
- [x] User access/trial/quota ใช้ Supabase access layer
- [x] ไม่มีการใช้ Firebase Auth ใน runtime หลัก

## 11. Phase 4 — ย้าย Matches, Teams และ Quota

### ความคืบหน้าปัจจุบัน

- [x] Supabase provider โหลดรายการลีก owner-only
- [x] Database Viewer อ่าน matches จาก Supabase
- [x] Realtime subscription สำหรับ matches
- [x] แก้ไข/ลบ matches ผ่าน Supabase
- [x] บันทึก match ใหม่ผ่าน Supabase
- [x] ย้าย teams/logo และ crop metadata
- [x] เปลี่ยน main scoreboard team source/cache เป็น Supabase ตามลีกที่เลือก

### ไฟล์ที่ต้องแก้

- `src/hooks/useScoreboardFirebase.ts`
- `src/hooks/useScoreboardDatabase.ts`
- `src/components/ScoreboardController.tsx`
- `src/utils/logoResolver.ts`
- `src/utils/logoCropMetadata.ts`
- `src/components/TeamLogosManagerModal.tsx`
- `src/components/LogoBrowserCropModal.tsx`
- `src/hooks/useImageUploadQuota.ts`

### Firebase API → Supabase API

```text
onValue()  → select() + Realtime subscription
push()     → insert()
update()   → update()
remove()   → delete()
get()      → select().maybeSingle()
set()      → upsert() หรือ update()
```

### ข้อมูลลีก

เปลี่ยนจาก:

```text
firebaseTargets[]
selectedTargetId
firebaseConfig
```

เป็น:

```text
leagues[]
selectedLeagueId
league_id
```

ไม่ต้องสร้าง Firebase app ต่อลีกอีกต่อไป

### เงื่อนไขผ่าน Phase 4

- [x] สร้าง match ได้ผ่าน Supabase
- [x] อ่าน match ได้ผ่าน Supabase
- [x] แก้ match ได้ผ่าน Supabase
- [x] ลบ match ได้ผ่าน Supabase
- [x] แยกข้อมูลคนละลีกได้ด้วย owner และ `league_id`
- [x] อ่าน/บันทึก teams ได้
- [x] crop metadata อ่าน/เขียนได้
- [x] quota อ่านและเพิ่มแบบ atomic ผ่าน RPC ได้

## 12. Phase 5 — Realtime

### ความคืบหน้าปัจจุบัน

- [x] matches ใช้ Supabase Postgres Changes subscription ใน Controller/Database Viewer
- [x] teams ใช้ Supabase Postgres Changes subscription และ refresh logo cache
- [x] Overlay ใช้ Supabase RPC snapshot polling ทุก 5 วินาที เพราะ OBS URL ใช้ anonymous read-only token
- [x] subscription มี cleanup เมื่อเปลี่ยนลีกหรือ unmount
- [x] Permission เปลี่ยนแล้วตรวจสิทธิ์ใหม่ทันทีผ่าน Realtime ของ `user_access` และ `user_roles`
- [x] `TOKEN_REFRESHED` ไม่ทำให้ตรวจ Permission ซ้ำหรือถอด Protected UI
- [x] Tab กลับมา Focus ตรวจเฉพาะเมื่อ Access Decision เก่ากว่า 5 นาที
- [x] Fallback check ทุก 10 นาที เฉพาะเมื่อข้อมูลเก่าและหน้าอยู่ในสถานะ visible
- [ ] ทดสอบการเปลี่ยนแปลงจาก client อื่นใน production จริง

### ระยะแรก: Postgres Changes

เริ่มด้วย `Postgres Changes` เพราะใกล้เคียง Firebase `onValue()` และย้ายง่าย:

```ts
const channel = supabase
  .channel(`league-matches:${leagueId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'matches',
      filter: `league_id=eq.${leagueId}`,
    },
    handleMatchChange,
  )
  .subscribe();
```

ต้องเปิด table ใน Realtime publication และทำ cleanup channel เมื่อ component unmount

Supabase ระบุว่า Postgres Changes ตั้งค่าง่ายกว่า แต่ Broadcast เหมาะกับการ scale มากกว่า ดังนั้นให้ใช้ Postgres Changes ใน migration แรก และประเมิน Broadcast ภายหลัง ([Supabase Realtime](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes))

### เงื่อนไขผ่าน Phase 5

- [ ] Controller เห็นการเปลี่ยน match จากอีก tab/client
- [ ] Overlay เห็นคะแนนใหม่โดยไม่ refresh
- [ ] Teams/logo update realtime
- [ ] unsubscribe ทำงานเมื่อปิด route
- [ ] ไม่มี duplicate event จาก StrictMode

## 13. Phase 6 — ย้าย Overlay และ URL contract

### ไฟล์ที่ต้องแก้

- `src/components/OverlayContainer.tsx`
- `src/components/AllScoresStandalone.tsx`
- `src/components/LeagueTableStandalone.tsx`
- `src/components/AllScoreCombinedStandalone.tsx`
- `src/components/ScoreboardController.tsx`
- `src/utils/firebaseUrlConfig.ts` → ลบหรือเปลี่ยนเป็น league URL utility
- `src/utils/excelParser.ts`
- `src/utils/excelParserCore.ts`

### URL ใหม่

จากเดิม:

```text
/overlay?fb=<base64-firebase-config>&view=ticker
```

เป็น (หลังรัน `0005_overlay_access_tokens.sql`):

```text
/overlay?provider=supabase&league=<league-id>&token=<owner-issued-token>&view=ticker
```

ตัวอย่าง:

```text
/league-table?provider=supabase&league=<league-id>&token=<owner-issued-token>
/all-scores?provider=supabase&league=<league-id>&token=<owner-issued-token>&date=today
/all-score-combined?provider=supabase&league=<league-id>&token=<owner-issued-token>
```

### Public data policy

Overlay ที่เปิดใน OBS ไม่ควรอ่าน table ภายในทั้งหมดโดยตรง หากต้องการความปลอดภัยสูง ให้สร้าง:

- public view
- RPC สำหรับ standings
- หรือ table/view ที่มีเฉพาะ field ที่อนุญาตให้ public อ่าน

### เงื่อนไขผ่าน Phase 6

- [x] ทุก overlay รองรับ `league_id` และ owner-issued token ในโหมด Supabase
- [x] ไม่มี Firebase config ใน Supabase URL ใหม่
- [x] ตารางลีก/ผลการแข่งขันแสดงผ่าน Supabase Overlay URL ใหม่
- [x] ticker/stadium/results ใช้ Supabase snapshot polling ในโหมด Supabase
- [x] OBS Browser Source ไม่ต้อง login เพราะใช้ read-only token
- [x] anonymous อ่านได้เฉพาะ snapshot ที่มี valid owner-issued token ผ่าน RPC
- [x] Public Overlay อ่านได้เฉพาะลีกที่ owner เปิด `is_public` ผ่าน RPC
- [ ] ทดสอบปิด `is_public` แล้ว Public URL เข้าถึงไม่ได้

## 14. Phase 7 — Logo strategy

### ทางเลือก A — แนะนำสำหรับ migration แรก

- ใช้ Cloudinary ต่อ
- บันทึก `logo_url` ใน Supabase `teams`
- บันทึก crop metadata ใน `teams.crop_metadata`
- ไม่เปลี่ยน upload flow มากเกินไป

### ทางเลือก B — ย้าย Cloudinary ไป Supabase Storage

- สร้าง bucket `team-logos`
- upload file ไป Supabase Storage
- เก็บ path/public URL ใน `teams.logo_url`
- ตั้ง Storage policies แยก read/upload/update/delete

ยังไม่เลือกทางเลือก B จนกว่า Firebase migration หลักจะเสถียร

## 15. Phase 8 — Data migration script

### ไฟล์ที่ควรเพิ่ม

```text
scripts/migrate-firebase-to-supabase.ts
scripts/verify-supabase-migration.ts
scripts/export-firebase-data.*       # ใช้ภายนอก frontend เท่านั้น
```

### ลำดับ migration

1. Export Firebase Realtime Database เป็น JSON
2. ตรวจจำนวน users, matches, teams และ crop records
3. สร้าง `leagues`
4. สร้าง/จับคู่ `profiles`
5. ย้าย `user_access`
6. ย้าย `user_roles`
7. ย้าย `teams`
8. ย้าย `matches`
9. ย้าย crop metadata
10. ย้าย quota
11. เก็บ `legacy_firebase_id`
12. ตรวจ count และ checksum
13. ตรวจข้อมูลสุ่มตามลีก
14. backup Supabase หลัง import

### ห้ามทำ

- ห้ามใช้ service-role key ใน `src/`
- ห้ามให้ browser เป็นตัว migrate production data
- ห้ามลบ Firebase data ก่อน verification เสร็จ
- ห้ามเปิด dual-write โดยไม่มี idempotency key

## 16. Phase 9 — Transitional dual provider

เพื่อ rollback ได้ ควรมี feature flag ชั่วคราว:

```env
VITE_DATA_PROVIDER=supabase
```

ช่วง transition อาจมี:

```text
FirebaseRepository
SupabaseRepository
```

แนวทางที่แนะนำ:

1. เริ่มจาก Supabase read-only verification
2. เปิด Supabase write ใน staging
3. เปิด production write ที่ Supabase
4. หากจำเป็น ให้ fallback ไป Firebase ชั่วคราว
5. หยุด dual-write หลังข้อมูลนิ่ง
6. ลบ Firebase adapter และ feature flag เมื่อผ่าน acceptance criteria

ไม่ควร dual-write เป็นเวลานาน เพราะเสี่ยงข้อมูลสองฐานไม่ตรงกัน

## 17. Phase 10 — ถอน Firebase ออกจาก codebase

### Package — เสร็จแล้ว

- [x] ลบ `firebase` จาก `package.json`
- [x] ใช้ `@supabase/supabase-js`
- [x] อัปเดต `package-lock.json`
- [x] ลบ dependency ที่ไม่ใช้จาก Firebase

### Source files ที่ลบหรือเปลี่ยนแล้ว

- [x] `src/config/firebaseAuth.ts`
- [x] `src/hooks/useScoreboardFirebase.ts`
- [x] `src/utils/firebaseUrlConfig.ts`
- [x] `src/utils/firebaseUrlConfig.test.ts`
- [x] Firebase imports ทุกไฟล์
- [x] `FirebaseSaveTarget` → `LeagueTarget`
- [x] `Database` types จาก Firebase → generated Supabase types

### Configuration/docs — runtime เสร็จแล้ว

- [x] ลบ `VITE_FIREBASE_*` จาก `.env.example`
- [ ] ลบตัวแปร Firebase และ `VITE_ALLOWED_EMAILS` ที่ obsolete ออกจาก `.env` local โดยคงไว้เฉพาะ Supabase variables
- [x] เปลี่ยนข้อความ Firebase ใน UI
- [x] ปรับ `PROJECT_ANALYSIS.md` ให้เป็นเอกสาร historical/current hybrid — ไม่กระทบ runtime
- [x] ปรับ `supabase/README.md` ให้สะท้อน Supabase-only runtime
- [x] ลบ Firebase config parser เพราะไม่มี backward compatibility ใน application แล้ว

### Verification command

```bash
rg -n -i "firebase|firestore|realtime database|VITE_FIREBASE" src package.json .env.example vite.config.ts
npm list firebase
```

ผลลัพธ์สุดท้ายไม่มี Firebase runtime reference; migration SQL และ offline import script ยังเก็บคำว่า Firebase ได้เพราะเป็นประวัติ/เครื่องมือย้ายข้อมูลที่ไม่ถูก bundle

## 18. Phase 11 — Tournament Management UX/UI

Phase นี้เริ่มได้เมื่อ P0 ผ่าน และ Schema Foundation ใน P2 ได้รับการอนุมัติแล้วเท่านั้น

### 18.1 Tournament Core

- [ ] Tournament List พร้อมค้นหาและ status filter
- [ ] Tournament Dashboard
- [ ] แก้ไข Basic Information
- [ ] จัดการ Teams ต่อ Tournament
- [ ] แสดงจำนวนทีม, Fixture และ Matchweek

### 18.2 Fixture Management

- [ ] Fixture List
- [ ] Filter ตาม Matchweek, Date, Team, Status และ Venue
- [ ] Create Match
- [ ] Edit Match
- [ ] Reschedule Match
- [ ] เปลี่ยน Status
- [ ] ยกเลิกหรือ Archive Fixture โดยไม่ลบประวัติสำคัญ

### 18.3 Fixture Builder

- [ ] Manual pairing
- [ ] Match slots
- [ ] Assign remaining teams
- [ ] Drag & Drop บน Desktop
- [ ] Select-based workflow บน Mobile
- [ ] Unsaved changes และ Undo/Discard

### 18.4 Smart Scheduling และ Standings

- [ ] Auto Generate แบบไม่เขียนทับ Fixture เดิม
- [ ] Auto Generate เฉพาะคู่ที่ยังว่าง
- [ ] Duplicate warning
- [ ] Schedule conflict warning
- [ ] BYE handling
- [ ] Match results
- [ ] Standings และ tie-breaker rules

### 18.5 ขอบเขตที่ต้องรักษา

- Quick Setup ยังคงเป็นหน้าควบคุมลีกและ Scoreboard
- Tournament Dashboard เป็นหน้าจัดการข้อมูลการแข่งขัน
- Database Viewer จะค่อย ๆ ถูกต่อยอดเป็น Fixture List ไม่สร้างระบบซ้ำซ้อน
- Team Logos Manager จะค่อย ๆ ถูกต่อยอดเป็น Teams management
- Overlay และ Standalone ต้องอ่านข้อมูลตามลีกเดิมและไม่รั่วข้ามลีก

## 19. Testing plan

### Unit tests

- [ ] `evaluateTrialAccess`
- [ ] access status mapping
- [ ] email normalization
- [ ] match mapping
- [ ] team mapping
- [ ] crop metadata validation
- [ ] Supabase error mapping
- [ ] league filtering
- [ ] quota increment logic

### Integration tests

- [ ] Supabase Auth session lifecycle
- [ ] RLS: anonymous read
- [ ] RLS: user read own access
- [ ] RLS: user cannot change another user
- [ ] RLS: admin status update
- [ ] matches CRUD
- [ ] teams CRUD
- [ ] realtime subscription cleanup

### End-to-end tests

- [ ] Google Login → Controller
- [ ] เลือก league
- [ ] แก้คะแนน
- [ ] บันทึก match
- [ ] เปิด overlay URL ในอีก tab
- [ ] ตรวจคะแนน realtime
- [ ] อัปเดต logo และ crop
- [ ] เปิด Replay/VAR ไม่ได้รับผลกระทบ
- [ ] logout และ route protection

## 20. Acceptance criteria

### Auth

- [ ] Google login ผ่าน Supabase
- [ ] session คงอยู่หลัง refresh
- [ ] logout ทำงาน
- [ ] trial และ access status แสดงถูกต้อง
- [ ] Super Admin ใช้งาน Admin page ได้

### Database

- [ ] matches CRUD ครบ
- [ ] teams CRUD ครบ
- [ ] crop metadata อ่าน/เขียนได้
- [ ] quota อ่าน/เพิ่มได้แบบ atomic
- [ ] แยกข้อมูลแต่ละ league ได้

### Realtime

- [ ] Controller เห็นการเปลี่ยนแปลงจาก client อื่น
- [ ] Overlay อัปเดตโดยไม่ refresh
- [ ] ไม่มี duplicate listener
- [ ] cleanup ทุก subscription

### Security

- [ ] RLS เปิดใช้งานทุก table ที่มีข้อมูลสำคัญ
- [ ] anonymous อ่าน user/admin data ไม่ได้
- [ ] user แก้สิทธิ์ตัวเองหรือ user อื่นไม่ได้
- [ ] service-role key ไม่อยู่ใน bundle
- [ ] public overlay เห็นเฉพาะข้อมูล public

### Removal

- [ ] ไม่มี Firebase import
- [ ] ไม่มี Firebase dependency
- [ ] ไม่มี `VITE_FIREBASE_*`
- [ ] ไม่มี Firebase config ใน URL ใหม่
- [ ] test/lint/build ผ่าน

## 21. Rollback plan

หาก migration มีปัญหา:

1. ปิด `VITE_DATA_PROVIDER=supabase`
2. เปิด provider เดิมชั่วคราวใน branch/backup ที่ยังเก็บไว้
3. หยุด Supabase writes เพื่อป้องกัน divergence
4. ตรวจ log และ failed records
5. restore จาก backup ถ้าจำเป็น
6. แก้ adapter/schema/RLS
7. ทำ staging migration ใหม่
8. ทำ production cutover รอบถัดไป

ห้ามลบ Firebase project หรือ Firebase backup จนกว่าจะผ่านช่วงเฝ้าระวังหลัง cutover

## 22. ไฟล์ที่คาดว่าจะเปลี่ยนตามลำดับ

### เพิ่มก่อน

```text
supabase/migrations/*.sql
src/config/supabaseClient.ts
src/config/supabaseAuth.ts
src/services/supabase*.ts
src/types/database.ts
```

### เปลี่ยนระหว่าง migration

```text
src/components/AuthGuard.tsx
src/components/AdminWhitelist.tsx
src/components/ScoreboardController.tsx
src/components/OverlayContainer.tsx
src/components/AllScoresStandalone.tsx
src/components/LeagueTableStandalone.tsx
src/components/AllScoreCombinedStandalone.tsx
src/components/TeamLogosManagerModal.tsx
src/components/LogoBrowserCropModal.tsx
src/hooks/useScoreboardDatabase.ts
src/hooks/useImageUploadQuota.ts
src/utils/logoResolver.ts
src/utils/logoCropMetadata.ts
src/utils/excelParser.ts
src/utils/excelParserCore.ts
```

### ลบเมื่อ migration เสร็จ

```text
src/config/firebaseAuth.ts
src/hooks/useScoreboardFirebase.ts
src/utils/firebaseUrlConfig.ts
src/utils/firebaseUrlConfig.test.ts
```

## 23. ลำดับการลงมือจริงแบบสั้น

```text
P0 1. ทดสอบ manual acceptance กับ Alcohol League และ Var38 League
P0 2. ทดสอบ owner-only RLS ด้วย user อื่น
P0 3. ตั้งค่า Supabase environment ใน Vercel และทดสอบ production
P1 4. ทำ Firebase backup และกำหนด freeze point
P1 5. ตรวจ Firebase runtime references และกำหนด rollback window
P1 6. Cutover ไป Supabase เป็น provider หลัก
P1 7. ถอน Firebase package/source/config หลังผ่าน rollback window
P1 8. รัน test/lint/build และตรวจ Firebase reference เป็นศูนย์
P2 9. ออกแบบและ review Tournament foundation schema
P2 10. เพิ่ม migration foundation เช่น 0008 และ backfill ข้อมูลเดิม
P2 11. ทดสอบ schema กับ Alcohol League และ Var38 League
P3 12. พัฒนา Tournament List และ Dashboard
P4 13. พัฒนา Fixture List, Create/Edit และ Reschedule
P5 14. พัฒนา Manual Fixture Builder, Drag & Drop และ Mobile workflow
P6 15. พัฒนา Auto Generate, conflict warnings, BYE และ Standings
```

## 24. Definition of Done

โปรเจกต์จะถือว่าย้ายสำเร็จเมื่อ:

- ผู้ใช้ login ผ่าน Supabase Google Auth ได้
- Controller ใช้ Supabase เป็น data provider
- Admin ใช้ Supabase RLS/RPC จัดการสิทธิ์
- matches/teams/quota/crop metadata ใช้งานครบ
- Overlay ใช้ `league_id` และไม่รับ Firebase config
- Realtime update ทำงานกับ OBS Browser Source
- Firebase data ถูก backup และตรวจสอบแล้ว
- ไม่มี Firebase package/import/config ในระบบ production
- `npm run test` ผ่าน
- `npm run lint` ผ่าน
- `npm run build` ผ่าน
- ทดสอบ manual flow ครบทุก route สำคัญ

## 25. เอกสาร Supabase ที่ใช้เป็นแนวทาง

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Google Social Login](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Realtime Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Standard Storage Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
