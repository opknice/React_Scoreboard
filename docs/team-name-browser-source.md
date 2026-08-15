# Team Name Browser Source

## ใช้งานผ่าน Quick Setup

1. เชื่อมต่อ OBS WebSocket ที่ `ws://localhost:4455` ก่อน
2. เปิด `Quick Setup` แล้วไปที่ `Team Name Browser Source`
3. เลือก Font และเลือกขนาด `Auto ตามความยาวชื่อ` หรือ `กำหนดเอง`
4. หากเลือกแบบกำหนดเอง ให้ระบุขนาด px ของ Team A และ Team B แยกกัน
5. กด `Quick Add to OBS` เพื่อสร้างหรืออัปเดต `Team_Name_A` และ `Team_Name_B`

ระบบจะซ่อน `name_team_a` และ `name_team_b` เดิมไว้ แต่ไม่ลบออก หากต้องการแก้ URL หรือค่าที่มีอยู่แล้ว ให้กด `Update Team Name Sources` อีกครั้ง

## URL แยกทีม

รูปแบบเดิมที่ไม่มีพารามิเตอร์ยังใช้ได้และจะทำงานแบบ Auto:

```text
/goal-animation?template=team-names&side=A
/goal-animation?template=team-names&side=B
```

Quick Setup จะสร้าง URL ที่มีค่าการแสดงผลเพิ่ม เช่น:

```text
/goal-animation?template=team-names&side=A&font=Kanit&fontWeight=700&fontMode=manual&fontSize=64
```

พารามิเตอร์ที่รองรับคือ `font`, `fontWeight`, `fontMode=auto|manual` และ `fontSize` โดยค่าที่ไม่ถูกต้องจะถูกปรับกลับเป็นค่าปลอดภัยอัตโนมัติ

`Update Team Name Sources` จะอัปเดตเฉพาะ Source ที่มีอยู่แล้วเท่านั้น หากไม่พบ Source ระบบจะข้ามและไม่สร้างรายการใหม่ ใช้ `Quick Add to OBS` เมื่อต้องการสร้าง Source ใหม่

## ลำดับการทำงานร่วมกับ Score

เมื่อมีการทำประตู ฝั่งที่ได้ประตูจะแสดง `GOAL!!!` ประมาณ 4 วินาที จากนั้นชื่อทีมจะกลับมาแสดงตามปกติก่อน แล้วจึงส่ง `TeamNameAnimationCompletedEvent` ให้ Score Browser Source เริ่มแสดง Score ใหม่
