# Score Browser Source

## URL ที่รองรับ

URL เดิมยังใช้งานได้และจะใช้ Auto Font Size:

```text
/goal-animation?template=score-only&mode=number&side=both
/goal-animation?template=score-only&mode=number&side=A
/goal-animation?template=score-only&mode=number&side=B
```

URL แบบกำหนดเองต่อทีม:

```text
/goal-animation?template=score-only&mode=number&side=A&font=Kanit&fontWeight=700&fontMode=manual&fontSize=72
```

## ใช้งานผ่าน Quick Setup

1. เชื่อมต่อ OBS WebSocket
2. เปิด `Quick Setup`
3. ไปที่ `Score Browser Source`
4. เลือก Font และขนาดของ Score A/B
5. กด `Quick Add Score A/B to OBS`

ระบบจะสร้างหรืออัปเดต Source ต่อไปนี้:

```text
Score_Display_A
Score_Display_B
```

Source เดิม `Score_Display` แบบ Both จะไม่ถูกลบ แต่จะถูกซ่อนไว้เพื่อป้องกันตัวเลขซ้ำบนหน้าจอ

`Update Score Sources` จะอัปเดตเฉพาะ `Score_Display_A` และ `Score_Display_B` ที่มีอยู่แล้วเท่านั้น หากไม่พบ Source ระบบจะข้ามและไม่สร้างรายการใหม่ ใช้ `Quick Add Score A/B to OBS` เมื่อต้องการสร้าง Source ใหม่

## ลำดับ Animation เมื่อมีการเปลี่ยน Score

```text
Score เปลี่ยน
↓
ส่ง GoalScoredEvent และ ScoreboardStateEvent
↓
Score เดิม Fade-out ซ่อนชั่วคราว
↓
ฝั่งที่ได้ประตูแสดง GOAL!!! ประมาณ 4 วินาที
↓
Team Name Animation จบ
↓
ชื่อทีมกลับมาแสดงตามปกติ
↓
ส่ง TeamNameAnimationCompletedEvent
↓
Score ฝั่งที่ได้ประตู Fade-in
↓
Score อีกฝั่ง Fade-in กลับมาพร้อมกัน
↓
เลขเก่าเลื่อนออก
↓
เลขใหม่ตกลงมาและเด้ง 2 ครั้ง
↓
ใช้เวลารวมประมาณ 2 วินาที
↓
รอให้ Score Handoff จบ
↓
Score ทั้งสองฝั่งแสดงค้างไว้
```
