# Supabase Setup สำหรับ OBS Scoreboard

ไฟล์ migration ในโฟลเดอร์นี้เป็น foundation ระยะเริ่มต้นของการย้ายจาก Firebase ไป Supabase โดยในช่วงนี้ Firebase runtime เดิมยังทำงานอยู่ และยังไม่มีการย้ายข้อมูล production อัตโนมัติ

## 1. รัน database migration

1. เปิด Supabase Dashboard ของ project ใหม่
2. ไปที่ **SQL Editor**
3. รัน migration ตามลำดับ: `0001_initial_schema.sql` แล้ว `0002_auth_rpc.sql`
4. วาง SQL แต่ละไฟล์แล้วกด **Run**
5. ตรวจสอบใน **Table Editor** ว่ามีตาราง `leagues`, `profiles`, `user_access`, `user_roles`, `league_memberships`, `teams` และ `matches`

Migration นี้เปิด RLS และ policy สำหรับ anonymous overlay, ผู้ใช้ที่ login แล้ว และ super admin ให้ด้วย

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
- เพิ่ม schema, indexes, triggers, RPC, RLS และ Realtime publication แล้ว
- เพิ่ม `0002_auth_rpc.sql` สำหรับบันทึก login timestamp ผ่าน `SECURITY DEFINER RPC`
- Firebase ยังเป็น provider ที่ application ใช้งานจริงอยู่
- ยังไม่เริ่มตัด Firebase code และยังไม่ migrate ข้อมูลเดิม
- ห้ามนำข้อมูล production เข้า Supabase จนกว่าจะมี backup และแผน freeze/cutover ที่ตรวจสอบแล้ว
