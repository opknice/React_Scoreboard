# 📤 Logo Upload Setup Guide

## ขั้นตอนการตั้งค่า Auto Logo Upload & Deploy

### 1. สร้าง GitHub Personal Access Token

1. ไปที่ https://github.com/settings/tokens
2. คลิก **Generate new token** → **Generate new token (classic)**
3. ตั้งชื่อ: `React Scoreboard Logo Upload`
4. เลือก expiration: **No expiration** (หรือตามที่ต้องการ)
5. เลือก scopes:
   - ✅ `repo` (Full control of private repositories)
6. คลิก **Generate token**
7. **คัดลอก token ทันที** (จะไม่สามารถดูอีกครั้ง)

### 2. เพิ่ม Environment Variables ใน Vercel

1. ไปที่ https://vercel.com/dashboard
2. เลือก project **React_Scoreboard**
3. ไปที่ **Settings** → **Environment Variables**
4. เพิ่ม 3 ตัวแปร:

#### ตัวแปรที่ 1: GITHUB_TOKEN
- **Key:** `GITHUB_TOKEN`
- **Value:** `ghp_xxxxxxxxxxxxxxxxxxxxx` (token ที่คัดลอกมา)
- **Environment:** Production, Preview, Development

#### ตัวแปรที่ 2: GITHUB_OWNER
- **Key:** `GITHUB_OWNER`
- **Value:** `opknice`
- **Environment:** Production, Preview, Development

#### ตัวแปรที่ 3: GITHUB_REPO
- **Key:** `GITHUB_REPO`
- **Value:** `React_Scoreboard`
- **Environment:** Production, Preview, Development

5. คลิก **Save**

### 3. Redeploy Project

1. ไปที่ **Deployments** tab
2. คลิก **...** ที่ deployment ล่าสุด
3. เลือก **Redeploy**
4. รอให้ deploy เสร็จ

### 4. วิธีใช้งาน

1. เปิดหน้า Controller: `https://react-scoreboard-two.vercel.app/`
2. เลื่อนลงไปที่ส่วน **"📤 อัปโหลดโลโก้"**
3. กด **Choose File** → เลือกรูปโลโก้
4. กด **🚀 อัปโหลดและ Deploy**
5. รอ 2-3 นาที ให้ Vercel deploy เสร็จ
6. รีเฟรชหน้า → โลโก้ใหม่จะปรากฏ!

## ⚠️ ข้อควรระวัง

- ไฟล์รูปต้องเป็น PNG, JPG, GIF, WebP เท่านั้น
- ขนาดไฟล์ไม่เกิน 5MB
- ชื่อไฟล์ควรเป็นภาษาไทยหรืออังกฤษที่มีความหมาย (เช่น "ทีมกาลาติกอส.png")
- การ deploy ใช้เวลา 2-3 นาที (รอดู status ใน Vercel dashboard)

## 🔒 ความปลอดภัย

- GitHub Token จะถูกเก็บใน Vercel Environment Variables (ปลอดภัย)
- ไม่มีใครสามารถเห็น token ได้ยกเว้นคุณ
- Vercel Serverless Function ทำงานในสภาพแวดล้อมที่แยกออกจากกัน

## 🐛 แก้ปัญหา

### ปัญหา: Upload แล้วขึ้น 500 Error
**วิธีแก้:**
- ตรวจสอบว่าตั้งค่า Environment Variables ครบ 3 ตัวแปร
- ตรวจสอบว่า GitHub Token ยังไม่หมดอายุ
- Redeploy project ใหม่

### ปัญหา: Upload สำเร็จแต่รูปไม่ขึ้น
**วิธีแก้:**
- รอ 2-3 นาที ให้ Vercel deploy เสร็จ
- ตรวจสอบ deployment status ที่ https://vercel.com/dashboard
- กด Ctrl+Shift+R เพื่อ hard refresh

### ปัญหา: 403 Forbidden
**วิธีแก้:**
- ตรวจสอบว่า GitHub Token มี permission `repo` ครบถ้วน
- สร้าง token ใหม่และอัปเดตใน Vercel
