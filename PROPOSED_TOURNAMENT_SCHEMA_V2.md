# PROPOSED TOURNAMENT SCHEMA v2

สถานะ: **พร้อมสำหรับการ review และ approval เท่านั้น — ยังไม่อนุมัติให้ implementation**  
วันที่ review: 26 สิงหาคม 2026  
Source of truth: `SUPABASE_MIGRATION_PLAN.md`

เอกสารนี้เป็น schema design แบบ read-only ไม่มีการสร้าง migration จริง ไม่มีการแก้ source code และไม่มีการเปลี่ยนแปลงฐานข้อมูลจริง

---

## 0. ขอบเขตและข้อสรุป

P2 จะเพิ่มโครงสร้าง Tournament Foundation แบบ additive โดยต้องรักษา:

- Supabase-only runtime
- owner-only access ของแต่ละ League
- `leagues.is_public` เป็น Public Overlay switch เท่านั้น
- columns เดิมของ `matches` ได้แก่ `match_date`, `team_a`, `team_b`, `round_label`, `logo_a`, `logo_b` และ `legacy_firebase_id`
- contract ปัจจุบันของ Scoreboard, Overlay และ Database Viewer
- ข้อมูลเดิมของ Alcohol League และ Var38 League

ข้อเสนอหลัก:

1. ใช้ `venues` เป็น table แยก
2. ใช้ `timestamptz` สำหรับ `matches.scheduled_at`
3. เพิ่ม `leagues.timezone` ใน v2 เพื่อให้การแสดงเวลามีความหมายชัดเจน
4. คง `team_a`/`team_b` เป็น historical display snapshot และเพิ่ม `team_a_id`/`team_b_id` เป็น canonical identity
5. เตรียมรองรับ TBD ตั้งแต่ P2 แต่ยังไม่สร้าง BYE เป็นทีมปลอม
6. ใช้ stable UUID ของ Matchweek และอนุญาตให้แก้ `number` ได้เฉพาะก่อน lock
7. ใช้ archive/soft lifecycle แทนการลบ Matchweek, Venue และ Team ที่มีประวัติ
8. ใช้ `text` พร้อม `CHECK` แทน PostgreSQL native enum
9. `0008_tournament_foundation.sql` ต้องเป็น additive migration และต้องไม่เปลี่ยน public API contract

---

## A. Final ERD

```text
auth.users
    │ 1
    │
    └──────────────< leagues >──────────────┐
                       │ 1                   │
                       │                     │
          ┌────────────┼─────────────┬───────┼─────────────┐
          │            │             │       │             │
          │ 1          │ 1           │ 1     │ 1           │ 1
          ▼            ▼             ▼       ▼             ▼
      matchweeks    teams        venues   matches      (overlay/RPC)
          │            │             │       │
          │ 1          │ 1           │ 1     │
          │            │             │       │
          └────────────┴─────────────┴───────┘
                       │
                       └── matches.matchweek_id

teams.id ─────────────── matches.team_a_id
teams.id ─────────────── matches.team_b_id
venues.id ────────────── matches.venue_id
leagues.id ───────────── matches.league_id
```

ความสัมพันธ์ที่ต้องบังคับด้วย database:

- `leagues 1:N matchweeks`
- `leagues 1:N teams`
- `leagues 1:N venues`
- `leagues 1:N matches`
- `matchweeks 1:N matches`
- `teams 1:N matches` ผ่านทั้ง Team A และ Team B
- `venues 1:N matches`
- Foreign Key ที่อ้างอิง entity ใน League ต้องตรวจ `league_id` ของทั้งสองฝั่งด้วย composite FK

`matches.league_id` เป็น tenant boundary หลัก ไม่อนุญาตให้ row อ้างอิง Matchweek, Team หรือ Venue จาก League อื่น

---

## B. Final schema ทุก table

### B.1 `leagues`

คง columns เดิมจาก migration `0001–0007` และเพิ่ม Tournament metadata ดังนี้:

| Column | Type | Nullable | Default | FK | Constraint / Meaning |
|---|---|---:|---|---|---|
| `id` | `uuid` | No | `gen_random_uuid()` | — | PK |
| `owner_id` | `uuid` | No ในข้อมูลใช้งานจริง | — | `auth.users(id)` | Owner หลักของ League |
| `name` | `text` | No | — | — | ชื่อ Tournament |
| `slug` | `text` | No | — | — | UNIQUE |
| `is_public` | `boolean` | No | `false` | — | Public Overlay switch เท่านั้น |
| `is_active` | `boolean` | No | `true` | — | Compatibility/visibility gate เดิม |
| `season` | `text` | Yes | `null` | — | เช่น `2026/27` |
| `description` | `text` | Yes | `null` | — | รายละเอียด Tournament |
| `logo_url` | `text` | No | `''` | — | URL โลโก้ Tournament |
| `start_date` | `date` | Yes | `null` | — | วันเริ่มต้น |
| `end_date` | `date` | Yes | `null` | — | วันสิ้นสุด |
| `timezone` | `text` | No | `'Asia/Bangkok'` | — | IANA timezone สำหรับการแสดงผล |
| `status` | `text` | No | `'draft'` | — | `draft/upcoming/live/finished/archived` |
| `format_type` | `text` | No | `'custom'` | — | `round_robin/knockout/group_stage/custom` |
| `format_settings` | `jsonb` | No | `'{}'::jsonb` | — | ต้องเป็น JSON object และมี `version` เมื่อเริ่มใช้งาน |
| `created_at` | `timestamptz` | No | UTC now | — | คงเดิม |
| `updated_at` | `timestamptz` | No | UTC now | — | ใช้ trigger เดิม |

Constraints:

- `start_date IS NULL OR end_date IS NULL OR end_date >= start_date`
- `status` ต้องอยู่ใน Tournament status ที่กำหนด
- `format_type` ต้องอยู่ใน format type ที่กำหนด
- `jsonb_typeof(format_settings) = 'object'`
- `is_public` ห้ามถูกตีความเป็น Tournament status

เหตุผลที่เพิ่ม `timezone`: `scheduled_at` เป็นเวลา absolute แต่การ render ต้องรู้ timezone ของ Tournament การเก็บ timezone ระดับ League ป้องกันการพึ่ง browser timezone ซึ่งอาจทำให้ผู้ดูและผู้จัดเห็นเวลาไม่ตรงกัน

### B.2 `matchweeks`

| Column | Type | Nullable | Default | FK | Constraint / Meaning |
|---|---|---:|---|---|---|
| `id` | `uuid` | No | `gen_random_uuid()` | — | PK, stable identity |
| `league_id` | `uuid` | No | — | `leagues(id)` | Tenant boundary |
| `number` | `integer` | No | — | — | `> 0` |
| `label` | `text` | No | `''` | — | เช่น `Week 1` |
| `scheduled_date` | `date` | Yes | `null` | — | วันที่โดยประมาณ/วันที่หลัก |
| `status` | `text` | No | `'draft'` | — | Matchweek lifecycle |
| `created_at` | `timestamptz` | No | UTC now | — | — |
| `updated_at` | `timestamptz` | No | UTC now | — | trigger เดียวกับ table เดิม |

Constraints:

- `UNIQUE (league_id, number)`
- `number > 0`
- Matchweek ที่มี Match แล้วไม่ควรถูก hard delete
- `id` ห้ามเปลี่ยนเมื่อมี Match อ้างอิง

### B.3 `teams`

ใช้ table เดิม ไม่สร้าง `tournament_teams` ซ้ำ:

| Column | Type | Nullable | Default | FK | Constraint / Meaning |
|---|---|---:|---|---|---|
| `id` | `uuid` | No | `gen_random_uuid()` | — | Stable canonical identity |
| `league_id` | `uuid` | No | — | `leagues(id)` | Tenant boundary |
| `team_key` | `text` | No | — | — | Stable import/upsert key |
| `name` | `text` | No | — | — | ชื่อปัจจุบัน เปลี่ยนได้ |
| `logo_url` | `text` | No | `''` | — | คง behavior เดิม |
| `crop_metadata` | `jsonb` | Yes | `null` | — | คง behavior เดิม |
| `created_at` | `timestamptz` | No | UTC now | — | — |
| `updated_at` | `timestamptz` | No | UTC now | — | — |

เพิ่มความสามารถสำหรับ composite FK ด้วย `UNIQUE (league_id, id)`

หลักการ rename:

- เปลี่ยนชื่อทีมโดย update `name` เท่านั้น
- คง `id` และ `team_key`
- ไม่ rewrite `matches.team_a`/`matches.team_b` เดิมโดยอัตโนมัติ
- ถ้าเป็น entity ทีมใหม่จริง ให้สร้าง row ใหม่
- ทีมที่ถูกใช้ใน Match แล้วห้าม hard delete; ใช้ lifecycle archive ในขั้นต่อไป

### B.4 `venues`

| Column | Type | Nullable | Default | FK | Constraint / Meaning |
|---|---|---:|---|---|---|
| `id` | `uuid` | No | `gen_random_uuid()` | — | PK, stable identity |
| `league_id` | `uuid` | No | — | `leagues(id)` | Tenant boundary |
| `name` | `text` | No | — | — | ชื่อสนาม |
| `is_active` | `boolean` | No | `true` | — | ใช้ archive/retire |
| `created_at` | `timestamptz` | No | UTC now | — | — |
| `updated_at` | `timestamptz` | No | UTC now | — | — |

Constraints:

- ชื่อสนามต้องไม่ซ้ำภายใน League เดียวกันหลัง normalize
- `UNIQUE (league_id, id)` สำหรับ composite FK
- สนามที่ถูกใช้แล้วไม่ควรลบ ให้ตั้ง `is_active = false`

ยังไม่เพิ่ม address, capacity หรือ geo coordinates ใน v2 เพราะไม่ใช่ requirement ของ P2 และเพิ่ม migration surface โดยไม่จำเป็น

### B.5 `matches`

คง columns เดิม และเพิ่ม columns ใหม่:

| Column | Type | Nullable | Default | FK | Constraint / Meaning |
|---|---|---:|---|---|---|
| `id` | `uuid` | No | `gen_random_uuid()` | — | PK |
| `legacy_firebase_id` | `text` | Yes | `null` | — | คงไว้เพื่อ audit/idempotency |
| `league_id` | `uuid` | No | — | `leagues(id)` | Tenant boundary |
| `match_date` | `date` | Yes | `null` | — | Legacy compatibility |
| `team_a` | `text` | No | `''` | — | Historical/display snapshot เดิม |
| `team_b` | `text` | No | `''` | — | Historical/display snapshot เดิม |
| `team_a_id` | `uuid` | Yes | `null` | `teams(league_id,id)` | Canonical Team A |
| `team_b_id` | `uuid` | Yes | `null` | `teams(league_id,id)` | Canonical Team B |
| `score_a` | `integer` | No | `0` | — | `>= 0` |
| `score_b` | `integer` | No | `0` | — | `>= 0` |
| `round_label` | `text` | No | `''` | — | Legacy compatibility |
| `matchweek_id` | `uuid` | Yes | `null` | `matchweeks(league_id,id)` | Canonical Matchweek |
| `scheduled_at` | `timestamptz` | Yes | `null` | — | Canonical absolute start time |
| `venue_id` | `uuid` | Yes | `null` | `venues(league_id,id)` | Canonical Venue |
| `status` | `text` | No | `'tbd'` | — | Match lifecycle |
| `reschedule_reason` | `text` | Yes | `null` | — | — |
| `match_url` | `text` | No | `''` | — | คงเดิม |
| `logo_a` | `text` | No | `''` | — | คงเดิม |
| `logo_b` | `text` | No | `''` | — | คงเดิม |
| `created_at` | `timestamptz` | No | UTC now | — | คงเดิม |
| `updated_at` | `timestamptz` | No | UTC now | — | trigger เดิม |

Constraints:

- `team_a_id` และ `team_b_id` ต้องอยู่ League เดียวกับ Match
- `matchweek_id` ต้องอยู่ League เดียวกับ Match
- `venue_id` ต้องอยู่ League เดียวกับ Match
- `team_a_id <> team_b_id` เมื่อทั้งสองค่าไม่เป็น `null`
- ไม่บังคับ `team_a_id`/`team_b_id` เป็น `NOT NULL` ใน migration แรก
- ไม่สร้าง unique constraint บนคู่ทีม เพราะคู่เดิมอาจแข่งหลายครั้ง
- `legacy_firebase_id` และ unique partial index เดิมต้องคงอยู่

Delete behavior ที่แนะนำ:

- Matchweek → Match: `RESTRICT` หรือ archive-only
- Team → Match: `RESTRICT`
- Venue → Match: `RESTRICT` หรือ archive-only
- League deletion ควรถูกแทนที่ด้วย archive workflow; behavior cascade เดิมต้องทดสอบใน staging ก่อนอนุมัติ final DDL

---

## C. Final status definitions

ใช้ `text + CHECK constraint` แทน native enum เพื่อให้สอดคล้องกับ schema เดิมและเพิ่มสถานะในอนาคตได้โดยไม่ต้องเปลี่ยนชนิด column

### C.1 Tournament status

| Status | ความหมาย |
|---|---|
| `draft` | กำลังตั้งค่า ยังไม่พร้อมใช้งานจริง |
| `upcoming` | พร้อมแล้ว แต่ยังไม่เริ่มการแข่งขัน |
| `live` | Tournament กำลังดำเนินอยู่ |
| `finished` | การแข่งขันเสร็จสิ้น |
| `archived` | เก็บประวัติ ไม่อยู่ใน workflow ปกติ |

`is_active` ยังคงเป็น operational visibility flag เดิม ไม่ควร sync อัตโนมัติกับ `status` ใน `0008`

### C.2 Matchweek status

| Status | ความหมาย |
|---|---|
| `draft` | ยังจัด pairing หรือ schedule อยู่ |
| `scheduled` | มี Fixture และกำหนดการแล้ว |
| `locked` | ห้าม reorder/pairing โดยทั่วไป |
| `completed` | Matchweek จบแล้ว |
| `archived` | ซ่อนจาก workflow ปกติแต่เก็บข้อมูลไว้ |

### C.3 Match status

| Status | ความหมาย |
|---|---|
| `tbd` | ยังไม่กำหนดทีม หรือยังไม่พร้อม schedule |
| `scheduled` | กำหนดทีมและเวลาแล้ว |
| `live` | กำลังแข่ง |
| `half_time` | พักครึ่ง |
| `finished` | แข่งขันจบและมีผลลัพธ์ |
| `postponed` | เลื่อนออกไป ยังอาจมีการกำหนดเวลาใหม่ |
| `cancelled` | ยกเลิก ไม่ควรนำไปนับเป็น Match ปกติ |

Status ทั้งสามระดับเป็นคนละ lifecycle และไม่ควร derive จากกันโดยอัตโนมัติใน P2

### C.4 Format type

```text
round_robin
knockout
group_stage
custom
```

---

## D. Review decision points เชิงลึก

### D.1 `scheduled_at`: ใช้ `timestamptz`

แนะนำให้ใช้ `timestamptz` ไม่แยก `date` และ `time`

เหตุผล:

- เก็บจุดเวลาเดียวที่ชัดเจน
- เปรียบเทียบ, sort และตรวจ schedule conflict ได้ถูกต้อง
- รองรับ timezone ได้ดีกว่า `time` ที่ไม่มี timezone
- แสดงผลตาม `leagues.timezone` ได้

`match_date` เดิมยังคงอยู่เพื่อ compatibility และไม่ถูกแทนที่ทันที

### D.2 `leagues.timezone`: เพิ่มตั้งแต่ P2

แนะนำเพิ่ม `timezone text NOT NULL DEFAULT 'Asia/Bangkok'`

ผลกระทบ:

- Migration เพิ่ม column อีกหนึ่งตัว
- ต้อง validate เป็น IANA timezone ใน application หรือ RPC ภายหลัง
- ทำให้ Controller, Overlay และผู้ใช้งานเห็นเวลาใน timezone เดียวกัน

ห้ามใช้ browser timezone เป็น canonical timezone

### D.3 `team_a`/`team_b`: historical snapshot

ให้ถือเป็น snapshot ของชื่อที่แสดงใน Match เดิม ไม่ใช่ canonical identity

- `team_a_id`/`team_b_id` ใช้ระบุตัวทีม
- `team_a`/`team_b` ใช้รักษาข้อมูลเดิมและ contract ปัจจุบัน
- Team rename จะไม่ rewrite fixture เก่าโดยอัตโนมัติ
- Future Fixture UI ค่อยกำหนดว่าจะ render snapshot หรือชื่อปัจจุบัน

### D.4 TBD และ BYE

เตรียม schema รองรับ TBD ตั้งแต่ P2:

- `team_a_id`/`team_b_id` nullable
- `status = 'tbd'`
- `team_a`/`team_b` ใช้ `''` หรือข้อความที่ระบบปัจจุบันรองรับ

ยังไม่สร้าง BYE เป็น row ใน `teams` เพราะ BYE ไม่ใช่ทีมจริง การรองรับ BYE ควรเป็น domain rule ใน phase scheduling ภายหลัง

### D.5 Matchweek reorder

อนุญาตให้เปลี่ยน `number` ได้ แต่ต้องมี guardrail:

- `id` ไม่เปลี่ยน
- `UNIQUE (league_id, number)` ต้องไม่ชนกัน
- reorder ได้เฉพาะ `draft` หรือ `scheduled`
- `locked`, `completed` และ `archived` ห้าม reorder โดยทั่วไป
- การ reorder ต้องทำเป็น transaction
- `round_label` เดิมไม่ถูก rewrite ใน migration

### D.6 Archive strategy

Matchweek:

- ใช้ `status = 'archived'`
- ไม่ลบ Match ที่อยู่ข้างใน
- Match ยังคงอ้างอิง Matchweek เดิม

Venue:

- ใช้ `is_active = false`
- Match เดิมยังคง `venue_id` เดิมเพื่อรักษาประวัติ
- Venue ที่ถูกอ้างอิงห้าม hard delete

Team:

- v2 ยังไม่เพิ่ม `is_active` เพื่อจำกัด scope
- ทีมที่มี Fixture แล้วให้ห้าม delete ผ่าน policy/workflow
- Team archive field ควรเป็น migration/feature แยก

### D.7 Status แยกกัน

- Tournament status: lifecycle ของรายการทั้งหมด
- Matchweek status: lifecycle ของกลุ่ม Fixture
- Match status: lifecycle ของการแข่งขันแต่ละคู่

การแก้ status ต้องไม่ใช้ trigger ที่เดา status ระดับอื่นโดยอัตโนมัติใน P2

### D.8 `format_settings` ขั้นต่ำ

กำหนดขั้นต่ำดังนี้:

```json
{
  "version": 1
}
```

ตัวอย่างเมื่อใช้ `round_robin`:

```json
{
  "version": 1,
  "legs": 1,
  "allow_draw": true,
  "points": {
    "win": 3,
    "draw": 1,
    "loss": 0
  }
}
```

หลักการ:

- ต้องเป็น JSON object
- ต้องมี integer `version` เมื่อเริ่มใช้งานจริง
- keys ที่ไม่รู้จักต้องไม่ถูกนำไปใช้เงียบ ๆ
- validation เชิงธุรกิจทำใน service/domain layer ภายหลัง
- `0008` ยังไม่ validate format-specific keys แบบเข้มงวด
- ห้ามใส่ fixture rows หรือผลการแข่งขันลงใน `format_settings`

---

## E. RLS design

### E.1 Access model

ใช้ owner-only model เดิมจาก `0003_private_league_ownership.sql`:

- Owner อ่านและแก้ไขข้อมูลของ League ตัวเอง
- Super Admin จัดการได้ทุก League
- `league_memberships` ยังไม่เปิด sharing ใน P2
- Anonymous ห้ามอ่าน table โดยตรง

### E.2 Policy matrix

| Table | Anonymous | Owner | Super Admin |
|---|---|---|---|
| `leagues` | ห้ามอ่านโดยตรง | select/insert/update ตาม policy เดิม | จัดการทั้งหมด |
| `matchweeks` | ห้าม | select/insert/update ใน League ตัวเอง | จัดการทั้งหมด |
| `teams` | ห้าม | select/insert/update ตาม policy เดิม | จัดการทั้งหมด |
| `venues` | ห้าม | select/insert/update ใน League ตัวเอง | จัดการทั้งหมด |
| `matches` | ห้าม | select/insert/update/delete ตาม compatibility policy เดิม | จัดการทั้งหมด |

ข้อเสนอเพิ่มเติม:

- ไม่สร้าง DELETE policy สำหรับ Matchweek และ Venue ใน v2
- Team ที่ถูกใช้งานแล้วต้องถูกป้องกันจาก hard delete
- `league_id` ของ Match, Matchweek, Team และ Venue ต้อง immutable หลัง insert
- RLS ตรวจสิทธิ์ แต่ composite FK ตรวจความถูกต้องของความสัมพันธ์
- ห้ามพึ่ง `.eq('league_id', ...)` ใน frontend เป็น security boundary

### E.3 Public Overlay

คงแนวทางปัจจุบัน:

- `is_public` ใช้เปิด/ปิด Public Overlay
- anonymous อ่านผ่าน `read_public_overlay_snapshot()` เท่านั้น
- private Overlay อ่านผ่าน owner-issued token RPC
- table ใหม่ไม่ grant ให้ `anon`
- การเพิ่ม matchweek/status/venue เข้า snapshot ต้องทำใน RPC แยกและ whitelist fields อย่างชัดเจน
- `select *` ไม่อนุญาตใน public snapshot

---

## F. Realtime design

### F.1 Publication

คง publication เดิม:

- `matches`
- `teams`
- `user_access`
- `user_roles`

เพิ่ม:

- `matchweeks`
- `venues`

### F.2 Behavior

| Event | ผลที่คาดหวัง |
|---|---|
| Matchweek insert/update | Tournament management client refresh เฉพาะ League นั้น |
| Match insert/update/delete | Scoreboard/Database Viewer behavior เดิมยังทำงาน |
| Match status update | Client ที่ subscribe `matches` ได้ event เดิม |
| Team rename/logo update | Team subscriber refresh; ไม่ rewrite Match snapshot |
| Venue update/archive | Fixture client refresh |
| Permission update | ใช้ permission Realtime เดิม |

การ subscribe ทุก table ใหม่ต้อง filter ด้วย `league_id`

Public Overlay ยังใช้ RPC snapshot polling ตาม architecture ปัจจุบัน ไม่เปิด anonymous Realtime subscription

### F.3 StrictMode/cleanup

- subscription ต้องสร้างต่อ League ที่ active เท่านั้น
- cleanup เมื่อเปลี่ยน League และ unmount
- ห้ามสร้าง duplicate channel จาก StrictMode
- Realtime event ไม่ควร mutate legacy display fields โดยอัตโนมัติ

---

## G. Migration strategy: `0008_tournament_foundation.sql`

`0008` ต้องเป็น additive migration เท่านั้น

ลำดับเชิงตรรกะ:

1. ตรวจ schema version `0001–0007`, backup และข้อมูลปัจจุบัน
2. เพิ่ม Tournament metadata ใน `leagues`
3. สร้าง `matchweeks`
4. สร้าง `venues`
5. เพิ่ม columns ใหม่ใน `matches` แบบ nullable ยกเว้น `status` ที่มี safe default `tbd`
6. เพิ่ม composite unique keys สำหรับ FK ที่ต้องอ้างอิง `(league_id, id)`
7. เพิ่ม CHECK constraints
8. เพิ่ม composite FKs เพื่อป้องกัน cross-League references
9. เพิ่ม indexes สำหรับ query ตาม League, Matchweek, Team, Venue และ status
10. เปิด RLS/policies สำหรับ table ใหม่
11. เพิ่ม table ใหม่เข้า Realtime publication
12. ตรวจข้อมูลและ row counts โดยไม่แก้ legacy fields

สิ่งที่ `0008` ห้ามทำ:

- ห้าม drop หรือ rename columns เดิม
- ห้ามเปลี่ยน `matches.team_a`/`team_b`
- ห้ามลบ `legacy_firebase_id`
- ห้ามบังคับ `team_a_id`/`team_b_id` เป็น `NOT NULL`
- ห้ามเปลี่ยน output contract ของ Overlay RPC
- ห้ามย้าย Cloudinary หรือเปลี่ยน Storage strategy
- ห้ามสร้าง Fixture, Drag & Drop หรือ Auto Generate

ข้อควรระวังเรื่อง delete action: เนื่องจาก schema เดิมมี cascade จาก League ไปยังข้อมูลหลัก การกำหนด FK ใหม่ต้องทดสอบ hard-delete behavior ใน staging ก่อนใช้จริง และ operational policy ควรป้องกันการลบ League ที่มีประวัติ

---

## H. Backfill strategy

### H.1 League metadata

สำหรับ Alcohol League และ Var38 League:

- `season`, `description`, `start_date`, `end_date`: `null` จนกว่าจะมีข้อมูลยืนยัน
- `logo_url`: `''`
- `timezone`: `'Asia/Bangkok'` หลังได้รับ approval
- `format_type`: `'custom'` หากยังยืนยัน format ไม่ได้
- `format_settings`: `{ "version": 1 }` หรือ `{}` ตามผลการตัดสินใจ final
- `status`: ใช้ค่า default `draft` ใน migration และต้องมี manual decision ก่อนประกาศ status จริง

ไม่ควรเดา `live` หรือ `finished` จาก `is_active` หรือจาก score

### H.2 Matchweek

- สร้างจาก `round_label` เฉพาะค่าที่มี numeric meaning ชัดเจน
- ใช้ mapping report ชั่วคราวเพื่อ review ก่อน update
- label ที่กำกวม เช่น `Final`, `Semi Final` หรือค่าว่าง ให้ `matchweek_id = null`
- ไม่ rewrite `round_label`
- backfill ต้องรันซ้ำได้โดยไม่สร้าง Matchweek ซ้ำ

### H.3 Team IDs

จับคู่ภายใน `league_id` เท่านั้น:

1. normalize whitespace/case/punctuation
2. match กับ `teams.name` หรือ mapping ที่มนุษย์ยืนยันแล้ว
3. update เฉพาะ `team_a_id`/`team_b_id` ที่ยังเป็น `null`
4. ถ้ามี candidate เดียว ให้ backfill
5. ถ้าไม่พบหรือมีหลาย candidate ให้ปล่อย `null`
6. สร้าง unmatched/ambiguous report

ห้ามแก้ `team_a`/`team_b` ระหว่าง backfill

### H.4 Time and status

- `scheduled_at` ของข้อมูลเดิมเป็น `null` หากไม่มีเวลาและ timezone ที่เชื่อถือได้
- `match_date` คงค่าเดิม
- Match เดิมใช้ `status = 'tbd'` จนกว่าจะมีการยืนยัน
- ห้ามอนุมาน `finished` จาก score `0-0`

### H.5 Verification target

หลัง migration/backfill:

- Alcohol League: 24 matches, 10 teams
- Var38 League: 18 matches, 6 teams
- จำนวน rows เดิมต้องไม่ลดลง
- `legacy_firebase_id` ต้องตรงกับ backup
- ผล backfill ต้องแยกเป็น matched, unmatched และ ambiguous
- การรันซ้ำต้องไม่เปลี่ยนผลหรือเพิ่มข้อมูลซ้ำ

---

## I. Rollback strategy

### I.1 ก่อน migration

- ทำ database backup/snapshot
- export counts และ checksum ของ matches/teams
- เก็บ backup Firebase เดิมไว้
- ตรวจว่าไม่มี application code ที่ต้องใช้ columns ใหม่ก่อน migration เสร็จ

### I.2 Logical rollback

เนื่องจาก migration เป็น additive และ current application ไม่ select columns ใหม่:

1. หยุดการเขียนข้อมูลใหม่ที่ใช้ schema ใหม่
2. ถอดการใช้งาน Realtime ของ table ใหม่
3. คืนค่า metadata/backfill ที่เพิ่มใน columns ใหม่เป็น `null` หรือค่าเดิมที่ปลอดภัย
4. คง legacy columns และ RPC contract เดิมไว้
5. ตรวจ Scoreboard, Overlay และ Database Viewer

### I.3 Physical rollback

- ใช้ database snapshot restore หาก migration ทำให้ constraint หรือ policy กระทบระบบจริง
- ห้าม drop columns/table ใหม่โดยอัตโนมัติ
- การ drop ต้องทำเฉพาะเมื่อยืนยันว่าไม่มี data และไม่มี client dependency แล้ว
- หากมีข้อมูลใหม่หลัง migration ให้เลือก restore snapshot หรือทำ compensating migration อย่างมี audit

Rollback target ต้องไม่ทำให้ข้อมูลเดิม 24/10 และ 18/6 สูญหาย

---

## J. Edge cases ของ Tournament จริง

| Edge case | วิธีรองรับใน v2 |
|---|---|
| ทีมเดียวกันเจอกันหลายครั้ง | ไม่มี unique pair constraint; ใช้ Match UUID และ schedule เป็นตัวแยก |
| ทีมเปลี่ยนชื่อ | คง Team UUID; `team_a`/`team_b` เดิมเป็น snapshot ไม่ rewrite |
| Match ยังไม่มีทีม | nullable Team IDs + `status = 'tbd'` |
| Match ถูกเลื่อน | `status = 'postponed'`, อัปเดต `scheduled_at` เมื่อมีเวลาใหม่, เก็บ `reschedule_reason` |
| Match ถูกยกเลิก | `status = 'cancelled'`; ไม่ลบ row และไม่ใช้ใน standings ภายหลัง |
| Matchweek ถูกจัดใหม่ | เปลี่ยน `number` ได้ก่อน `locked`; `id` คงเดิม |
| สนามถูกเปลี่ยน | เปลี่ยน `venue_id` ของ Match; Venue เดิมไม่ลบและยังเก็บประวัติ |
| Fixture มีผลการแข่งขันแล้ว | ห้ามลบ; เปลี่ยน status หรือ archive ตาม workflow |
| สร้าง Fixture กลางทาง | สร้าง Matchweek/Match ใหม่โดยไม่แก้ rows เดิม; IDs nullable รองรับ TBD |
| เพิ่ม Match หลัง Tournament เริ่ม | อนุญาตถ้า Matchweek ยังไม่ locked และต้องใช้ status/metadata ที่ถูกต้อง |
| Round label ไม่ชัดเจน | ไม่ auto-map; ส่ง manual review |
| Venue ชื่อซ้ำ | normalize และ unique ภายใน League |
| ข้อมูลข้าม League | composite FK + RLS ป้องกัน |
| Team rename ไม่กระทบ current Scoreboard | current app อ่าน `team_a`/`team_b` เดิม จึงยังแสดง snapshot เดิม |
| Current Database Viewer สร้าง Match แบบเก่า | columns ใหม่มี default/nullable จึงยัง insert ได้ |

---

## K. Acceptance criteria

### Schema integrity

- [ ] มี Tournament metadata ใน `leagues` ครบ
- [ ] มี `leagues.timezone` และใช้ IANA timezone ที่กำหนด
- [ ] มี `matchweeks` และ `venues`
- [ ] `matches` มี Team IDs, Matchweek, scheduled time, Venue และ status
- [ ] มี composite FK ครบสำหรับ Team, Matchweek และ Venue
- [ ] ไม่สามารถอ้างอิง entity ข้าม League ได้
- [ ] มี check ห้าม Team A และ Team B เป็นทีมเดียวกัน
- [ ] `team_a_id`/`team_b_id` ยัง nullable

### Backward compatibility

- [ ] Alcohol League ยังมี 24 matches และ 10 teams
- [ ] Var38 League ยังมี 18 matches และ 6 teams
- [ ] `legacy_firebase_id` ไม่เปลี่ยน
- [ ] `team_a`, `team_b`, `match_date`, `round_label` ไม่เปลี่ยน
- [ ] Scoreboard อ่านข้อมูลเดิมได้
- [ ] Overlay URL และ RPC output เดิมไม่เสีย
- [ ] Database Viewer ยัง CRUD Match เดิมได้
- [ ] Team management เดิมยัง upsert ได้

### RLS/security

- [ ] Owner เห็นเฉพาะข้อมูล League ของตัวเอง
- [ ] User ของ League อื่นอ่าน/เขียนไม่ได้
- [ ] Anonymous อ่าน table ใหม่โดยตรงไม่ได้
- [ ] Public Overlay อ่านผ่าน RPC เท่านั้น
- [ ] Super Admin จัดการได้ตาม policy
- [ ] `league_id` ไม่สามารถถูกเปลี่ยนเพื่อย้าย row ข้าม League

### Realtime

- [ ] `matches`, `teams`, `user_access`, `user_roles` เดิมยังทำงาน
- [ ] `matchweeks` และ `venues` อยู่ใน publication
- [ ] subscription filter ด้วย `league_id`
- [ ] cleanup ทำงานเมื่อ unmount/เปลี่ยน League
- [ ] ไม่มี duplicate event จาก StrictMode

### Migration/backfill

- [ ] `0008` เป็น additive migration
- [ ] ไม่มีการ drop/rename legacy columns
- [ ] backfill idempotent
- [ ] มี unmatched/ambiguous report
- [ ] ไม่มีการสร้าง scheduled time เทียม
- [ ] rollback ผ่าน snapshot หรือ compensating procedure ได้

---

## L. Decision ที่ถูกล็อกแล้วในข้อเสนอ v2

รายการต่อไปนี้เป็น recommended decision สำหรับ approval:

| # | Decision point | Recommended decision | เหตุผล | ผลกระทบ |
|---:|---|---|---|---|
| 1 | สถานะ Alcohol/Var38 | เริ่มด้วย `draft`; ไม่เดาสถานะจริง | ข้อมูลเดิมไม่มี lifecycle ที่เชื่อถือได้ | ต้อง manual set status ภายหลัง |
| 2 | Timezone/date contract | เก็บ `scheduled_at` เป็น UTC `timestamptz`; render ตาม `leagues.timezone` | ป้องกันเวลาไม่ตรงกัน | เพิ่ม column และ validation |
| 3 | Firebase backup | คง backup read-only จนผ่าน observation window | มี rollback/audit | ใช้ storage เพิ่มเล็กน้อย |
| 4 | Naming convention | snake_case DB, UUID PK, stable IDs | สอดคล้อง schema เดิม | ไม่มีผลต่อ runtime เดิม |
| 5 | Round label mapping | auto-map เฉพาะ numeric ที่ไม่กำกวม | ลดการจับคู่ผิด | บาง Matchweek ต้อง manual review |
| 6 | Venue | สร้าง `venues` table แยก | รองรับหลายสนามและ archive | เพิ่ม table/policy/realtime |
| 7 | Team rename | คง IDs; ชื่อใน Match เป็น snapshot | ปกป้อง historical display | ชื่อเก่าอาจยังแสดงใน Match เดิม |
| 8 | TBD/BYE | รองรับ TBD ตอนนี้; ไม่สร้าง BYE team | TBD เป็นข้อมูลจริง ส่วน BYE เป็น algorithm rule | Team IDs ต้อง nullable |
| 9 | Matchweek reorder | เปลี่ยน `number` ได้ก่อน lock; คง UUID | รองรับการจัดใหม่โดยไม่ทำลาย references | ต้องมี state guard/transaction |
| 10 | Archive/delete | Matchweek/Venue archive-only; Team ที่ถูกใช้ห้าม delete | รักษาประวัติ | ต้องมี lifecycle สำหรับ Team ใน future |
| 11 | Status | แยก Tournament/Matchweek/Match status | lifecycle แต่ละระดับไม่เท่ากัน | เพิ่ม business rules ภายหลัง |
| 12 | `format_settings` | object มี `version`; format-specific validation ภายหลัง | ป้องกัน JSON ไร้ schema | ต้องมี domain validation ใน phase ต่อไป |

รายการที่ถือเป็น **locked design recommendation** ใน v2:

- `scheduled_at` = `timestamptz`
- เพิ่ม `leagues.timezone`
- `team_a`/`team_b` = historical snapshot
- Team IDs nullable เพื่อรองรับ TBD
- BYE ยังไม่เป็น Team row
- Matchweek UUID stable และ number reorder ได้ก่อน lock
- archive แทน hard delete
- `venues` เป็น table แยก
- composite FK + owner-only RLS

---

## สิ่งที่เปลี่ยนจาก v1

1. เพิ่ม `leagues.timezone` เพื่อให้ `scheduled_at` มี timezone contract ที่ชัดเจน
2. เปลี่ยนจากการ “เตรียมรองรับ” เป็นกำหนดชัดเจนว่า `scheduled_at` ใช้ `timestamptz`
3. กำหนด `team_a`/`team_b` เป็น historical snapshot อย่างเป็นทางการ
4. กำหนด TBD เป็น schema capability ของ P2 และไม่สร้าง BYE เป็นทีมปลอม
5. เพิ่มกติกา Matchweek reorder: ใช้ UUID เดิมและเปลี่ยน number ได้ก่อน lock
6. กำหนด archive/delete behavior แยกสำหรับ Matchweek, Venue และ Team
7. กำหนดขั้นต่ำของ `format_settings` ให้มี `version`
8. เพิ่ม guardrail เรื่อง immutable `league_id` และ cross-League composite FK
9. เพิ่ม decision matrix ทั้ง 12 ข้อพร้อมเหตุผลและผลกระทบ

## สิ่งที่ตัดสินใจแล้วในข้อเสนอ

- ใช้ table `venues` แยก
- ใช้ `timestamptz`
- เพิ่ม `leagues.timezone` โดย default `Asia/Bangkok`
- เก็บชื่อทีมใน Match เป็น snapshot
- รองรับ TBD แต่ยังไม่ model BYE เป็น Team
- ใช้ status แยกสามระดับ
- ใช้ archive แทนการลบข้อมูลที่มีประวัติ
- ใช้ text/check constraints
- ใช้ composite FK และ owner-only RLS
- migration แรกไม่บังคับ Team IDs เป็น `NOT NULL`

## สิ่งที่ยังเป็น optional/future

- Team lifecycle field เช่น `is_active` หรือ `archived_at`
- `team_name_history`
- Venue address/capacity/coordinates
- Historical `venue_name_snapshot`
- format-specific JSON schema ที่เข้มงวด
- BYE/slot/pairing metadata
- Standings, tie-breakers และ result model
- Duplicate/conflict validation
- Auto Generate และ Manual Pairing UI
- Supabase Storage แทน Cloudinary

## สิ่งที่อาจกระทบระบบเดิม

- การเพิ่ม `leagues.timezone` ไม่มีผลต่อ current service เพราะ service ปัจจุบัน select เฉพาะ columns เดิม
- การเพิ่ม FK แบบ `RESTRICT` อาจกระทบ hard delete ของ Team/Venue/League จึงต้องทดสอบใน staging
- Current Database Viewer จะสร้าง Match ที่มี Team IDs เป็น `null` ต่อไปจนกว่าจะมี application contract ใหม่
- Team rename จะไม่เปลี่ยนชื่อ snapshot ใน Match เดิม
- Match status เดิมจะเริ่มจาก `tbd` และอาจยังไม่สะท้อนสถานะจริงจนกว่าจะ manual review
- Realtime event ของ Team rename จะไม่ทำให้ Match row เปลี่ยน ซึ่งเป็นพฤติกรรมที่ตั้งใจเพื่อรักษา snapshot
- Overlay จะยังส่งข้อมูล contract เดิมจนกว่าจะมี migration/RPC แยกที่ได้รับ approval

## จุดที่ต้อง Approve ก่อนเริ่ม `0008`

ต้องได้รับ approval อย่างชัดเจนในประเด็นต่อไปนี้:

1. อนุมัติให้เพิ่ม `leagues.timezone` หรือไม่
2. ยืนยัน default timezone `Asia/Bangkok`
3. ยืนยัน `team_a`/`team_b` เป็น historical snapshot
4. ยืนยันการรองรับ TBD และการไม่สร้าง BYE เป็น Team
5. ยืนยัน Matchweek reorder ก่อน lock เท่านั้น
6. ยืนยัน archive-only policy สำหรับ Matchweek/Venue
7. ยืนยัน Team ที่มี Fixture แล้วห้าม hard delete
8. ยืนยัน status default ของ League เดิมเป็น `draft`
9. ยืนยัน Match เดิมใช้ status `tbd`
10. ยืนยัน `format_settings` ต้องมี `version`
11. อนุมัติ composite FK และ immutable `league_id`
12. อนุมัติ `0008` เป็น additive migration และ backfill แบบ idempotent

จนกว่าจะได้รับข้อความ `APPROVED` จะไม่เริ่มสร้าง migration, แก้ code, รัน SQL, สร้าง UX/UI, Drag & Drop หรือ Auto Generate
