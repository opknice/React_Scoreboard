# Supabase Setup สำหรับ OBS Scoreboard

ไฟล์ migration ในโฟลเดอร์นี้เป็น foundation ระยะเริ่มต้นของการย้ายจาก Firebase ไป Supabase โดยในช่วงนี้ Firebase runtime เดิมยังทำงานอยู่ และยังไม่มีการย้ายข้อมูล production อัตโนมัติ

## 1. รัน database migration

1. เปิด Supabase Dashboard ของ project ใหม่
2. ไปที่ **SQL Editor**
3. รัน migration ตามลำดับ: `0001_initial_schema.sql`, `0002_auth_rpc.sql`, `0003_private_league_ownership.sql`, `0004_legacy_match_identity.sql`, `0005_overlay_access_tokens.sql`, `0006_public_overlay.sql` และ `0007_permission_realtime.sql`
4. วาง SQL แต่ละไฟล์แล้วกด **Run**
5. ตรวจสอบใน **Table Editor** ว่ามีตาราง `leagues`, `profiles`, `user_access`, `user_roles`, `league_memberships`, `teams` และ `matches`

Migration นี้เปิด RLS และ policy สำหรับผู้ใช้ที่ login แล้วและ super admin โดยลีกปัจจุบันเป็น private owner-only ไม่มี anonymous access และยังไม่เปิดการแชร์ลีก

## 2. ตั้งค่า Auth redirect URLs

ใน **Authentication → URL Configuration** ให้ตรวจสอบ/เพิ่ม URL ต่อไปนี้ตาม environment ที่ใช้งานจริง:

```text
https://obs-scoreboard-blond.vercel.app/
https://obs-scoreboard-blond.vercel.app/**
http://localhost:5173/
http://localhost:5173/**
```

Google OAuth ต้องมี callback URL ของ Supabase ใน Google Cloud OAuth client ด้วย โดยใช้รูปแบบ:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

ห้ามใส่ service-role key ใน frontend หรือในตัวแปร `VITE_*`

## 3. ตั้งค่า environment

คัดลอกค่าจาก Supabase Dashboard ไปไว้ใน local `.env` และ Vercel Project Settings → Environment Variables:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key-or-anon-key>
VITE_DATA_PROVIDER=firebase
```

ใน repository มีเพียงตัวอย่างใน `.env.example` เท่านั้น ไม่ควร commit ค่าจริงลง Git

## 4. กำหนด super admin ครั้งแรก

หลังจาก login ด้วย Google สำเร็จอย่างน้อยหนึ่งครั้ง ให้แทนที่อีเมลใน SQL ด้านล่าง แล้วรันใน SQL Editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'super_admin'
from auth.users
where lower(email) = lower('your-admin@example.com')
on conflict (user_id, role) do nothing;

update public.user_access
set status = 'allowed'
where user_id = (
  select id
  from auth.users
  where lower(email) = lower('your-admin@example.com')
);
```

## สถานะปัจจุบัน

- เพิ่ม Supabase client และ Google OAuth adapter แล้ว
- เพิ่ม typed league/match/team repository และ Realtime adapter แล้ว
- เพิ่ม migration switch `VITE_DATA_PROVIDER` โดยค่าเริ่มต้นยังเป็น `firebase`
- เชื่อม Database Viewer และ match CRUD กับ Supabase แล้วเมื่อใช้ `VITE_DATA_PROVIDER=supabase`
- เพิ่ม schema, indexes, triggers, RPC, RLS และ Realtime publication แล้ว
- เพิ่ม `0002_auth_rpc.sql` สำหรับบันทึก login timestamp ผ่าน `SECURITY DEFINER RPC`
- เพิ่ม `0003_private_league_ownership.sql` และกำหนด `thanakrit_kas@hotmail.com` เป็นเจ้าของ `Alcohol League` และ `Var38 League`
- เพิ่ม `0004_legacy_match_identity.sql` เพื่อป้องกัน match ซ้ำเมื่อ import Firebase JSON ซ้ำ
- เพิ่ม `0005_overlay_access_tokens.sql` สำหรับสร้าง read-only token ของเจ้าของลีกให้ OBS Browser Source
- Supabase Overlay URL ใช้ token แบบหมดอายุและอ่าน snapshot ผ่าน RPC; จะไม่เปิด anonymous table access โดยตรง
- เพิ่ม `0006_public_overlay.sql` สำหรับเปิด Public Overlay แยกตามลีก โดยใช้ `leagues.is_public`
- เพิ่ม `0007_permission_realtime.sql` สำหรับรับการเปลี่ยนแปลง `user_access` และ `user_roles` แบบ Realtime
- พบข้อมูลต้นทางจาก JSON: Alcohol มี 24 matches/10 teams และ Var38 มี 18 matches/6 teams
- Firebase ยังเป็น provider ที่ application ใช้งานจริงอยู่
- ยังไม่เริ่มตัด Firebase code และยังไม่ migrate ข้อมูลเดิม
- ห้ามนำข้อมูล production เข้า Supabase จนกว่าจะมี backup และแผน freeze/cutover ที่ตรวจสอบแล้ว

## 6. เปิดใช้งาน Supabase Overlay

หลังรัน `0005_overlay_access_tokens.sql` แล้ว ให้เลือกลีกในหน้า Controller และกดคัดลอก Overlay URL ใหม่ทุกครั้ง URL จะมี token แบบ read-only ซึ่งหมดอายุภายใน 7 วันโดยค่าเริ่มต้น และหน้า Overlay จะดึงข้อมูลใหม่ทุก 5 วินาที

หาก URL ถูกเผยแพร่ ให้ถือว่า URL นั้นเป็น credential ของลีก และควรรัน RPC ด้านล่างเพื่อเพิกถอน token ของลีกนั้นก่อนสร้าง URL ใหม่:

```sql
select public.revoke_overlay_access_tokens('<league-uuid>');
```

## 7. เปิดใช้งาน Public Overlay รายลีก

หลังรัน `0006_public_overlay.sql` แล้ว ให้เลือกลีกใน Quick Setup และเปิดสวิตช์ **Public Overlay** จากนั้นกดคัดลอก URL ใหม่ ระบบจะสร้าง URL รูปแบบนี้:

```text
/overlay?provider=supabase&league=<league-uuid>&public=1&view=table
```

Public URL ไม่มีวันหมดอายุ แต่จะอ่านได้เฉพาะเมื่อ `leagues.is_public = true` เท่านั้น การเปิด Public ไม่ทำให้ผู้ชมแก้ไขหรือลบ matches/teams ได้ และระบบยังไม่เปิดสิทธิ์ anonymous ให้ query ตารางฐานข้อมูลโดยตรง

## 5. Import ข้อมูล 2 ลีกจาก Firebase JSON

ไฟล์ต้นทางที่ repository ตรวจสอบแล้ว:

```text
League/Alcohol_League.json
League/VAR38.json
```

สคริปต์จะตรวจ owner, จับคู่ลีกด้วย slug, เก็บ Firebase push ID ใน `legacy_firebase_id` และ import ซ้ำได้โดยไม่สร้าง match ซ้ำ

ต้องใช้ service-role key เฉพาะใน terminal สำหรับงาน migration เท่านั้น ห้ามใส่ใน `.env`, `VITE_*`, source code หรือ commit ลง Git:

```powershell
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
npm run migrate:firebase-json
```

คำสั่งข้างต้นเป็น `dry-run` และไม่เขียนข้อมูล หากผลตรวจสอบถูกต้องจึงค่อยใช้:

```powershell
npm run migrate:firebase-json -- --apply
```

ห้ามใช้ `--apply` จนกว่าจะตรวจสอบจำนวนข้อมูลและทำ Firebase backup แล้ว
