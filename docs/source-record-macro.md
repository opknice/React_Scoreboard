# บันทึกย้อนหลังจาก Source Record ผ่าน Macro

Macro/Automation เลือก Filter Source Record แล้วสั่งบันทึก Replay Buffer ของ Filter นั้นโดยตรง
ระยะเวลาย้อนหลัง โฟลเดอร์ ชื่อไฟล์ รูปแบบไฟล์ และคุณภาพ ใช้การตั้งค่าปัจจุบันใน Filter

## เตรียม OBS

1. ติดตั้ง Source Record รุ่นที่เพิ่ม vendor API `SourceRecord` protocolVersion 1 แล้วเปิด OBS ใหม่
2. เพิ่ม Filter **Source Record** ให้ Source หรือ Scene ที่ต้องการ
3. เปิด Replay Buffer ใน Filter แล้วตั้งระยะเวลาและโฟลเดอร์บันทึก
4. ให้ Buffer เก็บภาพล่วงหน้าก่อนเรียก Macro และเชื่อมต่อ Scoreboard กับ OBS WebSocket ตามปกติ

ไม่จำเป็นต้องเปิด Replay Buffer หลักของ OBS สำหรับ Action นี้
ปลั๊กอินเดิมที่ไม่มี API ใหม่นี้ต้องอัปเดต แม้เลขเวอร์ชันปลั๊กอินจะแสดงเหมือนเดิม

DLL ที่ build สำหรับเครื่องนี้: `D:\obs-source-record-master\build\source-record.dll`
ตำแหน่งติดตั้งปกติของ OBS แบบ 64 บิตบนเครื่องนี้:
`C:\Program Files\obs-studio\obs-plugins\64bit\source-record.dll`
ต้องปิด OBS ก่อนแทน DLL และเก็บสำเนา DLL เดิมไว้ก่อน การ build อย่างเดียวไม่เปลี่ยนปลั๊กอินที่ OBS โหลดอยู่

บนเครื่องนี้การเขียน `Program Files` ต้องใช้สิทธิ Administrator การติดตั้งอัตโนมัติจากแชตถูก Windows ปฏิเสธ
ให้ปิด OBS แล้วเปิด PowerShell แบบ **Run as administrator** และรัน:

```powershell
& 'D:\obs-source-record-master\install-source-record-macro.ps1'
```

สคริปต์จะสำรอง DLL เดิม ตรวจว่าปิด OBS แล้ว และเทียบ hash หลังคัดลอก โดยไม่เปลี่ยนการตั้งค่า OBS

## ตั้ง Macro หรือ Automation

1. เปิดตัวแก้ไข Macro/Automation และเลือกเหตุการณ์เริ่มทำงานตามต้องการ
2. เพิ่มขั้นตอน **Source Record: บันทึกย้อนหลัง**
3. เลือก Source หรือ Scene แล้วเลือก Filter Source Record ของเป้าหมายนั้น
4. ตรวจระยะเวลาและสถานะที่อ่านจาก Filter แล้วบันทึก Macro
5. เรียก Macro จากปุ่ม Hotkey หรือเหตุการณ์ Automation ที่ตั้งไว้

หนึ่ง Action เลือกหนึ่ง Filter เพิ่มหลาย Action เพื่อบันทึกหลาย Filter ตามลำดับ
หากเปลี่ยนชื่อ Source/Filter ระบบยังอ้างอิง UUID เดิม หากลบแล้วสร้างใหม่ให้เลือกเป้าหมายใหม่
ปุ่มรีเฟรชใช้โหลดรายการและข้อมูลปัจจุบันจาก OBS

Macro จะรอจน Source Record ยืนยันการบันทึกเสร็จแล้วแสดง path ของไฟล์ใน Log
จากนั้นจึงทำขั้นตอนถัดไป หากผิดพลาดจะหยุด Macro และแสดงเหตุผล
ไฟล์อยู่บนเครื่องที่รัน OBS และไม่ได้ถูกนำเข้า Replay player ของเว็บอัตโนมัติ

## ระยะเวลาคลิป

ระยะเวลาที่ตั้งเป็นพฤติกรรม Replay Buffer ของ Source Record เดิม
คลิปอาจสั้นกว่าค่าที่ตั้ง หากเพิ่งเปิด Buffer หรือเนื่องจากขอบเขต keyframe/encoder/container
Action นี้ไม่สร้าง Buffer ใหม่ตอนกดบันทึกและไม่ส่งค่าทับการตั้งค่าของ Filter

## เมื่อบันทึกไม่ได้

- **ไม่พบปลั๊กอิน/API:** ตรวจว่าติดตั้ง DLL ที่มี API ใหม่และเปิด OBS ใหม่แล้ว
- **Filter ปิดหรือ Buffer ไม่พร้อม:** เปิด Filter/Replay Buffer และรอให้เริ่มเก็บภาพก่อน
- **เป้าหมายหาย:** เลือก Source/Scene และ Filter ใหม่ ห้ามอาศัยชื่อที่เหมือนกันแทน UUID
- **กำลังบันทึก:** Filter เดียวกันรับงานได้ครั้งละหนึ่งงาน รอให้ครั้งก่อนเสร็จก่อน
- **ยังยืนยันผลไม่ได้:** หลังรอ 60 วินาทีหรือการเชื่อมต่อหลุด OBS อาจยังเขียนไฟล์ต่อ ตรวจไฟล์ก่อนสั่งใหม่

หาก Buffer ค้างและไม่รายงานผล ให้ปิดแล้วเปิด Replay Buffer ของ Filter นั้นใหม่
การทำเช่นนี้ล้างภาพย้อนหลังที่อยู่ใน Buffer ต้องรอสะสมภาพใหม่
ระบบไม่ restart Buffer หรือ retry SaveReplay ด้วย requestId ใหม่ให้อัตโนมัติ

Action **บันทึก Replay Buffer** เดิมยังเป็นคำสั่งของ OBS หลัก ส่วน Action ใหม่นี้เลือก Filter โดยตรง

## เอกสารสำหรับผู้พัฒนา

API อยู่ใน `D:\obs-source-record-master\README.md`
แบบและแผนอยู่ใน `docs/superpowers/` และผลตรวจรับอยู่ใน
`docs/verification/2026-11-07-source-record-macro.md`
