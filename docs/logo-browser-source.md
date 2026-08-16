# Logo Browser Source

## หลักการทำงาน

Logo Browser Source ใช้ข้อมูล `logoA` และ `logoB` จาก `ScoreboardState` ที่ Controller resolve แล้วจาก Batch Team Logos Manager โดยไม่เปิด Firebase Listener ซ้ำใน OBS Browser Source

```text
Batch Team Logos Manager
  → Firebase teams/
  → Scoreboard Controller logo cache
  → ScoreboardState / BroadcastChannel
  → Logo Browser Source ใน OBS
```

## URL

```text
/goal-animation?template=team-logos&side=A
/goal-animation?template=team-logos&side=B
```

## Quick Setup

1. เชื่อมต่อ OBS WebSocket ที่ `ws://localhost:4455`
2. เปิด `Quick Setup` แล้วเลือก `Logo Browser Source`
3. กด `Quick Add Logo A/B to OBS` เพื่อสร้างหรืออัปเดต `Logo_Display_A` และ `Logo_Display_B`
4. ระบบจะซ่อน Image Source เดิม `logo_team_a` และ `logo_team_b` หลังสร้าง Browser Source สำเร็จ

ใช้ `Update Existing Logo Sources` เมื่อต้องการอัปเดต URL ของ Source ที่มีอยู่แล้วโดยไม่สร้าง Source ใหม่

## การอัปเดตแบบ Live

หลังบันทึกโลโก้จาก Batch Team Logos Manager ระบบจะอัปเดต Global Logo Cache และส่ง `ScoreboardState` ใหม่ ทำให้ Browser Source เปลี่ยนโลโก้โดยไม่ต้อง Refresh OBS

Browser Source ต้องเปิดจาก Origin เดียวกับ Controller เพื่อให้ `BroadcastChannel` สื่อสารกันได้
