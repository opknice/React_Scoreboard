# 📤 Logo Upload Setup Guide (Firebase Storage - 100% FREE)

## ขั้นตอนการตั้งค่า Firebase Storage

### 1. เปิดใช้งาน Firebase Storage

#### 1.1 ไปที่ Firebase Console
```
https://console.firebase.google.com/
```

#### 1.2 เลือก Project ของคุณ
- คลิกที่ project ที่คุณใช้อยู่

#### 1.3 เปิดใช้ Storage
1. ไปที่เมนู **Build** → **Storage**
2. คลิก **Get Started**
3. เลือก **Production mode** (หรือ Test mode ก็ได้)
4. เลือก Region: **asia-southeast1** (Singapore - ใกล้ที่สุด)
5. คลิก **Done**

### 2. ตั้งค่า Storage Rules (สำคัญ!)

ไปที่ **Storage** → **Rules** tab และใช้ rules นี้:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /logos/{fileName} {
      // อนุญาตให้อ่านได้ทุกคน (public)
      allow read: if true;
      
      // อนุญาตให้เขียนได้เฉพาะไฟล์รูปภาพ ขนาดไม่เกิน 5MB
      allow write: if request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

คลิก **Publish**

### 3. วิธีใช้งาน

1. เปิดหน้า Controller: `https://react-scoreboard-two.vercel.app/`
2. คลิกปุ่ม **⚙️ Logo Path Settings**
3. เลื่อนลงไปที่ส่วน **"📤 อัปโหลดโลโก้ (Firebase Storage)"**
4. กด **Choose File** → เลือกรูปโลโก้
5. กด **🚀 อัปโหลดทันที**
6. **คัดลอก URL** ที่ปรากฏขึ้นมา
7. **ใช้ URL นั้นในฐานข้อมูล** แทนชื่อไฟล์

## ✅ ข้อดีของ Firebase Storage

- ✅ **ฟรี 100%** - 5GB storage, 1GB/day download
- ✅ **อัปโหลดทันที** - ไม่ต้องรอ deploy
- ✅ **ใช้งานได้ทันที** - URL พร้อมใช้ทันที
- ✅ **Fast CDN** - มี cache ทั่วโลก
- ✅ **ไม่ต้องตั้งค่า GitHub** - ไม่ต้องใช้ token

## 📝 วิธีใช้ URL ที่อัปโหลดแล้ว

### ตัวอย่าง URL ที่ได้:
```
https://firebasestorage.googleapis.com/v0/b/your-project.appspot.com/o/logos%2Fteam.png?alt=media&token=xxx
```

### วิธีใช้:

#### Option 1: ใช้ URL เต็ม (แนะนำ)
ใส่ URL เต็มในฐานข้อมูล:
```json
{
  "logoA": "https://firebasestorage.googleapis.com/v0/b/.../team.png?alt=media&token=xxx",
  "logoB": "https://firebasestorage.googleapis.com/v0/b/.../team2.png?alt=media&token=xxx"
}
```

#### Option 2: ใช้ชื่อไฟล์ + fallback
ถ้าต้องการใช้ร่วมกับ local logos:
- ใส่ชื่อไฟล์ธรรมดา: `"logoA": "ทีมกาลาติกอส.png"`
- ระบบจะหารูปจาก `/public/logos/` ก่อน
- ถ้าไม่มี จะแสดง initials

## ⚠️ ข้อควรระวัง

- ไฟล์รูปต้องเป็น PNG, JPG, GIF, WebP เท่านั้น
- ขนาดไฟล์ไม่เกิน 5MB
- ชื่อไฟล์ควรไม่ซ้ำกัน (จะ overwrite ไฟล์เดิม)
- Firebase Free Plan: 5GB storage, 1GB/day download
- ถ้าเกิน quota ให้ลบไฟล์เก่าออก

## 🔒 ความปลอดภัย

Firebase Storage Rules ที่แนะนำ:
- ✅ อนุญาตให้**อ่านได้ทุกคน** (public read) - เพื่อให้แสดงโลโก้ได้
- ✅ อนุญาตให้**เขียนได้เฉพาะไฟล์รูป** ขนาดไม่เกิน 5MB
- ✅ ป้องกันไฟล์ขนาดใหญ่และไฟล์ที่ไม่ใช่รูป

## 🐛 แก้ปัญหา

### ปัญหา: Upload แล้วขึ้น "unauthorized"
**วิธีแก้:**
- ตรวจสอบ Storage Rules ว่าตั้งค่าถูกต้อง
- ตรวจสอบว่าเปิดใช้งาน Firebase Storage แล้ว
- ลอง Publish rules ใหม่

### ปัญหา: อัปโหลดช้า
**วิธีแก้:**
- ตรวจสอบขนาดไฟล์ (ควรไม่เกิน 1MB)
- ลดขนาดรูปก่อนอัปโหลด
- เปลี่ยน region ให้ใกล้ที่สุด

### ปัญหา: รูปไม่แสดง
**วิธีแก้:**
- ตรวจสอบว่า URL ถูกต้อง
- เปิด URL ในแท็บใหม่ดูว่าเข้าถึงได้ไหม
- ตรวจสอบ Storage Rules ว่าอนุญาต read: true

## 💰 ค่าใช้จ่าย

### Firebase Free Plan (Spark)
- **Storage:** 5 GB
- **Download:** 1 GB/day
- **Upload:** 20,000/day

### เพียงพอสำหรับ:
- โลโก้ประมาณ 1,000-5,000 ทีม (ขนาด 50KB-1MB/ทีม)
- Pageviews ประมาณ 10,000-50,000/day

**100% ฟรี ไม่มีค่าใช้จ่าย!** 🎉
