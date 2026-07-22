# 📤 Cloudinary Logo Upload Setup (ฟรี 25GB)

## ⚠️ สำคัญ: ก่อนใช้งานต้องสร้าง Upload Preset

### ขั้นตอนการตั้งค่า (5 นาที):

#### 1. ไปที่ Cloudinary Settings
```
https://console.cloudinary.com/settings/upload
```

#### 2. เลื่อนลงมาที่ "Upload presets"
- คลิกปุ่ม **"Add upload preset"**

#### 3. ตั้งค่า Upload Preset
ใส่ค่าต่อไปนี้:

| Field | Value |
|-------|-------|
| **Preset name** | `logo_upload` |
| **Signing Mode** | **Unsigned** ⚠️ (สำคัญ!) |
| **Folder** | `logos` |
| **Access Mode** | Public (default) |

#### 4. คลิก "Save"

✅ **เสร็จแล้ว!** ตอนนี้สามารถอัปโหลดได้แล้ว

---

## 🚀 วิธีใช้งาน

### 1. เปิดหน้า Controller
```
https://react-scoreboard-two.vercel.app/
```

### 2. คลิกปุ่ม "📤 อัปโหลดโลโก้"

### 3. เลือกไฟล์และอัปโหลด
- รองรับ: PNG, JPG, GIF, WebP
- ขนาดสูงสุด: 10MB
- อัปโหลดทันที (2-3 วินาที)

### 4. คัดลอก URL ที่ได้
```
https://res.cloudinary.com/vayh51zb/image/upload/v1234567890/logos/team.png
```

### 5. ใช้ URL ในฐานข้อมูล
ใส่ URL เต็มใน Firebase/Excel:
```json
{
  "logoA": "https://res.cloudinary.com/vayh51zb/image/upload/.../team.png",
  "logoB": "https://res.cloudinary.com/vayh51zb/image/upload/.../team2.png"
}
```

---

## ✅ ข้อดีของ Cloudinary

| Feature | Details |
|---------|---------|
| 💰 **ฟรี** | 25GB storage, 25GB bandwidth/month |
| ⚡ **เร็ว** | Global CDN, cache ทั่วโลก |
| 🎨 **Auto Optimize** | ลดขนาดรูปอัตโนมัติ |
| 🔒 **ปลอดภัย** | Unsigned upload (ไม่ต้อง API Secret) |
| 📱 **Responsive** | สร้าง responsive images ได้ |

---

## 🎯 Cloudinary Free Tier

### ขีดจำกัด:
- **Storage:** 25 GB
- **Bandwidth:** 25 GB/month
- **Transformations:** 25 credits/month
- **Images:** ไม่จำกัดจำนวน

### เพียงพอสำหรับ:
- โลโก้ 5,000-10,000 ทีม (5MB/ทีม)
- Pageviews 100,000-500,000/month
- **100% ฟรี ไม่มีค่าใช้จ่าย!**

---

## 🔧 Advanced Features (Optional)

### Auto Image Optimization
Cloudinary จะลดขนาดรูปอัตโนมัติ:
```
https://res.cloudinary.com/vayh51zb/image/upload/w_200,h_200,c_fill,q_auto,f_auto/logos/team.png
```

Parameters:
- `w_200,h_200` - ขนาด 200x200px
- `c_fill` - crop to fill
- `q_auto` - quality auto
- `f_auto` - format auto (WebP on supported browsers)

### Lazy Loading
```html
<img loading="lazy" src="..." alt="team logo">
```

---

## 🐛 แก้ปัญหา

### ปัญหา: Upload แล้วขึ้น "Invalid upload preset"
**สาเหตุ:** ยังไม่ได้สร้าง Upload Preset หรือชื่อไม่ตรง

**วิธีแก้:**
1. ตรวจสอบว่าสร้าง preset ชื่อ `logo_upload` แล้ว
2. ตรวจสอบว่าตั้ง Signing Mode เป็น **Unsigned**
3. Save preset และลองอัปโหลดใหม่

### ปัญหา: Upload ช้า
**วิธีแก้:**
- ลดขนาดรูปก่อนอัปโหลด (แนะนำ < 2MB)
- ใช้ image compression tools

### ปัญหา: รูปไม่แสดง
**วิธีแก้:**
- ตรวจสอบ URL ว่าถูกต้อง
- เปิด URL ในแท็บใหม่ดูว่าเข้าถึงได้ไหม
- ตรวจสอบ Access Mode เป็น Public

### ปัญหา: เกิน quota
**วิธีแก้:**
- ลบรูปเก่าที่ไม่ใช้แล้ว
- ใช้ image optimization เพื่อลด bandwidth
- พิจารณา upgrade plan (ถ้าจำเป็น)

---

## 💡 Tips & Best Practices

1. **ตั้งชื่อไฟล์ให้มีความหมาย**
   - ✅ ดี: `team-galacticos.png`
   - ❌ ไม่ดี: `IMG_1234.png`

2. **ลดขนาดรูปก่อนอัปโหลด**
   - แนะนำ: 500x500px, < 200KB
   - ใช้ tools: TinyPNG, Squoosh

3. **ใช้ PNG สำหรับโลโก้ที่มีพื้นหลังโปร่งใส**
   - PNG: มี transparency
   - JPG: ไม่มี transparency แต่ขนาดเล็กกว่า

4. **ตรวจสอบ usage**
   - Dashboard: https://console.cloudinary.com/console
   - ดู bandwidth และ storage ที่ใช้ไป

---

## 🔒 ความปลอดภัย

### Unsigned Upload ปลอดภัยไหม?
✅ **ปลอดภัย** เพราะ:
- อัปโหลดได้เฉพาะไปยัง preset ที่กำหนด
- จำกัดขนาดไฟล์และประเภทไฟล์
- ไม่สามารถลบหรือแก้ไขไฟล์เดิมได้
- ไม่เปิดเผย API Secret

### การป้องกัน Abuse:
- ตั้ง **Max file size** ใน preset
- ตั้ง **Allowed formats** เฉพาะรูปภาพ
- ใช้ **Rate limiting** (Cloudinary จัดการให้)

---

## 📊 Monitor Usage

### ดู Usage ได้ที่:
```
https://console.cloudinary.com/console/usage
```

จะเห็น:
- 📦 Storage used
- 📡 Bandwidth used
- 🔄 Transformations used
- 📈 กราฟการใช้งาน

---

**ตอนนี้พร้อมใช้งานแล้ว!** 🎉

ถ้ามีปัญหาหรือคำถาม สามารถดูเพิ่มเติมได้ที่:
- Cloudinary Docs: https://cloudinary.com/documentation
- Upload Presets Guide: https://cloudinary.com/documentation/upload_presets
