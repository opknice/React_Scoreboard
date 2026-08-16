# วิเคราะห์โครงสร้างโปรเจกต์

> ช่วยวิเคราะห์โปรเจกต์ที่อยู่ในโฟลเดอร์นี้ให้ผมอย่างละเอียด โดยขอให้ครอบคลุมหัวข้อเหล่านี้:
>
>    1. ภาษาและเทคโนโลยีหลัก: โปรเจกต์นี้พัฒนาด้วยภาษาโปรแกรมมิ่งอะไร, ใช้ Framework, Library หรือเครื่องมืออะไรบ้าง (ดูจากไฟล์ Config เช่น package.json, requirements.txt, pom.xml หรือโครงสร้างโฟลเดอร์)
>    2. โครงสร้างโปรเจกต์: โครงสร้างโฟลเดอร์หลักมีอะไรบ้าง และแต่ละโฟลเดอร์ทำหน้าที่เกี่ยวกับอะไร
>    3. ฟังก์ชันและการทำงานหลัก (Core Functions/Features): โปรเจกต์นี้ทำอะไรได้บ้าง มีฟังก์ชันหลักหรือโมดูลสำคัญอะไรบ้าง อธิบายการทำงานคร่าวๆ ของแต่ละส่วน
>    4. จุดเริ่มต้นของโปรแกรม (Entry Point): ไฟล์ไหนคือจุดเริ่มต้นหลัก (Main file) ที่ควรเปิดดูหรือรันก่อนเป็นอันดับแรก
> 5. วิธีรันโปรเจกต์ (Quick Start): ขอคำแนะนำเบื้องต้นหรือคำสั่ง (Command) ในการติดตั้งและรันโปรเจกต์นี้ขึ้นมาใช้งานในเครื่อง

<details><summary>4 previous messages</summary>

> ผมจะสำรวจไฟล์กำหนดค่า โครงสร้างโฟลเดอร์ และโค้ดส่วนสำคัญก่อน จากนั้นจะสรุปภาพรวมการทำงาน จุดเริ่มต้น และคำสั่งรันให้เป็นภาษาไทย โดยไม่แก้ไขไฟล์ใด ๆ ครับ
>
> เบื้องต้นพบว่าเป็นแอป React + TypeScript ที่สร้างด้วย Vite สำหรับควบคุมสกอร์บอร์ดฟุตบอลและเชื่อมต่อ OBS โดยมี Firebase, Excel และระบบ Instant Replay เป็นส่วนสำคัญ ต่อไปผมกำลังไล่เส้นทางการทำงานจาก `main.tsx`/`App.tsx` ไปยัง hooks, components และ services เพื่อแยกหน้าที่ของแต่ละโมดูลให้ชัดเจนครับ
>
> ภาพรวมสถาปัตยกรรมเริ่มชัดเจนแล้ว: `App.tsx` เป็นตัวจัด routing, `ScoreboardController.tsx` เป็นศูนย์กลางสถานะการแข่งขัน/เวลา/OBS/Excel/Firebase และหน้าจอ OBS หลายแบบรับข้อมูลผ่าน `BroadcastChannel` กับ `localStorage` เพื่อแยก “หน้าควบคุม” ออกจาก “Browser Source” ครับ ตอนนี้ผมกำลังตรวจรายละเอียดเส้นทางข้อมูลและความสามารถเฉพาะ เช่น Macro, Replay, VAR และระบบสิทธิ์ผู้ใช้ให้ครบถ้วนก่อนสรุปสุดท้าย】【。
>
> ตรวจสอบเสร็จแล้วครับ: ชุดทดสอบผ่านทั้งหมด 13 ไฟล์ / 110 tests และ `oxlint` ผ่านโดยไม่มี error จากสภาพโค้ดปัจจุบัน ผมจะสรุปเป็นรายงานพร้อมลิงก์ไปยังไฟล์สำคัญ และจะแจ้งสถานะการแก้ไขที่มีอยู่ก่อนแล้วใน Git แยกไว้ด้วยครับ
</details>

## สรุปภาพรวม

โปรเจกต์นี้คือเว็บแอปสำหรับควบคุมสกอร์บอร์ดฟุตบอลแบบ Live โดยเชื่อมต่อกับ OBS Studio ผ่าน WebSocket ใช้ Firebase เป็นฐานข้อมูล/ระบบสิทธิ์ และสามารถแสดงผลผ่าน OBS Browser Source เช่น คะแนน ทีม โลโก้ ตารางคะแนน Goal Animation และ Instant Replay

สถาปัตยกรรมหลักเป็น Frontend SPA ไม่มี Backend Server แยกในโปรเจกต์นี้

## 1. ภาษาและเทคโนโลยีหลัก

ดูรายละเอียดได้จาก [package.json](/D:/React_Scoreboard/package.json), [vite.config.ts](/D:/React_Scoreboard/vite.config.ts) และไฟล์ TypeScript configuration

### ภาษา

- TypeScript
- TSX สำหรับ React Components
- CSS
- JavaScript/ES Modules สำหรับ Vite configuration และ build script

### Framework และ Library สำคัญ

- React 19
- React DOM
- React Router DOM 7
- Vite 8
- Firebase 12
  - Google Authentication
  - Firebase Realtime Database
- `obs-websocket-js`
  - เชื่อมต่อ OBS WebSocket
  - ควบคุม Scene, Source, Text, Image และ Replay Buffer
- `xlsx`
  - อ่านไฟล์ Excel
  - โหลดข้อมูลจาก URL หรือ Google Sheets
- `exceljs`
  - อ่านสีของเซลล์จากไฟล์ Excel
- Vitest และ Testing Library
  - Unit test และ Component test
- Oxlint
  - ตรวจสอบคุณภาพโค้ด
- `gh-pages`
  - Deploy ไปยัง GitHub Pages

### Browser API ที่ใช้

- `BroadcastChannel`
  - สื่อสารระหว่างหน้าควบคุมกับ Browser Source
- `localStorage`
  - เก็บค่าตั้งค่าและสถานะบางส่วน
- `IndexedDB`
  - จดจำสิทธิ์และ Handle ของโฟลเดอร์วิดีโอ
- File System Access API
  - เลือกและอ่านโฟลเดอร์ Replay Buffer
- WebSocket
  - ติดต่อ OBS Studio

### ระบบ Styling และ Asset

- CSS แบบเขียนเอง ไม่มี Tailwind หรือ Material UI
- FontAwesome ผ่าน CDN
- Google Fonts เช่น Inter และ Kanit
- ฟอนต์ภาษาไทยในเครื่อง `Srinakharinwirot`

## 2. โครงสร้างโปรเจกต์

### โฟลเดอร์ระดับบนสุด

- `.github/` — Configuration สำหรับ GitHub
- `.kiro/` — ไฟล์หรือ metadata จากเครื่องมือพัฒนา
- `.vscode/` — ค่าตั้งค่า VS Code
- `src/` — Source code หลักของแอป
- `public/` — ไฟล์ static ที่ถูกเสิร์ฟตรง เช่น favicon, logo และ OBS Scene Collection
- `images/` — Background และโลโก้สำหรับการแสดงผล
- `logos/` — โลโก้ทีมสำหรับโหมดพัฒนา/local
- `fonts/` — ฟอนต์ที่เก็บในโปรเจกต์
- `excel/` — ไฟล์ Excel ตัวอย่างและข้อมูลการแข่งขัน
- `plugin/` — ไฟล์เสริมสำหรับ OBS เช่น Lua Hotkey Script และ Installer
- `scripts/` — Script สำหรับขั้นตอน Build
- `docs/` — เอกสารประกอบ แต่ใน working tree ปัจจุบันมีสถานะถูกลบใน Git
- `dist/` — ผลลัพธ์จากการ Build
- `node_modules/` — Dependencies ที่ติดตั้งแล้ว

### โครงสร้างภายใน `src`

- `src/main.tsx`
  - จุดเริ่มต้นของ React Application
- `src/App.tsx`
  - กำหนด Routing และ Provider หลัก
- `src/components/`
  - หน้าจอและ UI Components ทั้งหมด
- `src/hooks/`
  - React Hooks สำหรับจัดการ State, OBS, Timer, Firebase, Replay และ Folder
- `src/services/`
  - Service ที่มี Logic เชิงระบบ เช่น OBS Setup
- `src/config/`
  - Firebase และ OBS Configuration
- `src/context/`
  - React Context เช่น Authentication และ Video Folder
- `src/macros/`
  - ระบบ Custom Macro และการสั่งงานอัตโนมัติ
- `src/types/`
  - TypeScript Types, Event Schema และ Type Guards
- `src/utils/`
  - Parser, URL Builder, Logo Resolver, Formatter และ Helper Functions
- `src/constants/`
  - ข้อความแปลและค่าคงที่
- `src/styles/`
  - CSS สำหรับฟอนต์ในเครื่อง
- `src/assets/`
  - Asset ที่มากับ Vite/React และรูปภาพบางส่วน

ปัจจุบันมี Source TypeScript/TSX ประมาณ 100 ไฟล์ และ Test file 13 ไฟล์

## 3. ฟังก์ชันและการทำงานหลัก

### 3.1 หน้าควบคุมสกอร์บอร์ด

ไฟล์หลักคือ [ScoreboardController.tsx](/D:/React_Scoreboard/src/components/ScoreboardController.tsx)

รองรับการทำงานหลัก เช่น

- ตั้งชื่อทีม A/B
- เพิ่มและลดคะแนน
- สลับทีม
- ตั้งค่าสีทีม
- ตั้งค่าโลโก้ทีม
- แสดง Label เช่น รอบการแข่งขัน สนาม หรือรายละเอียด
- ควบคุมเวลาแข่งขัน
- เลือก Half และสถานะการแข่งขัน
- ส่งข้อมูลไปยัง OBS แบบ Real-time
- เปิดหน้าตั้งค่าและหน้าจอประกอบต่าง ๆ

สถานะการแข่งขันถูกแยกไปจัดการใน Hook เช่น

- [useScoreboardMatchState.ts](/D:/React_Scoreboard/src/hooks/useScoreboardMatchState.ts)
- [useTimer.ts](/D:/React_Scoreboard/src/hooks/useTimer.ts)
- [useScoreboardObsSync.ts](/D:/React_Scoreboard/src/hooks/useScoreboardObsSync.ts)

### 3.2 การเชื่อมต่อ OBS

ไฟล์สำคัญคือ

- [useOBSWebSocket.ts](/D:/React_Scoreboard/src/hooks/useOBSWebSocket.ts)
- [obsSetupService.ts](/D:/React_Scoreboard/src/services/obsSetupService.ts)
- [obsSetupConfig.ts](/D:/React_Scoreboard/src/config/obsSetupConfig.ts)

ระบบสามารถ

- เชื่อมต่อ OBS ที่ `ws://localhost:4455`
- Reconnect อัตโนมัติเมื่อหลุด
- รับ Custom Event และ Hotkey จาก OBS
- เปลี่ยนข้อความใน Text Source
- เปลี่ยนโลโก้ใน Image Source
- เปลี่ยนสี Source
- เปิด/ปิด Source
- เปลี่ยน Scene
- บันทึก Replay Buffer
- สร้าง Scene และ Source อัตโนมัติผ่าน Quick Setup

ตัวอย่าง Source ที่ระบบสร้างหรือควบคุม:

- `score_team_a`
- `score_team_b`
- `time_counter`
- `half_text`
- `name_team_a`
- `name_team_b`
- `Goal_Alert`
- `Score_Display`
- `Team_Name_A`
- `Team_Name_B`
- `Main_events`
- `Standings`
- `Penalty`

### 3.3 การนำเข้าข้อมูล Excel

ใช้ [excelParser.ts](/D:/React_Scoreboard/src/utils/excelParser.ts) และ `exceljs`

รองรับ

- อัปโหลดไฟล์ `.xlsx` และ `.xls`
- โหลด Excel จาก URL
- โหลด Google Sheets ผ่าน Export URL
- ตรวจจับชื่อคอลัมน์อัตโนมัติ
- อ่านข้อมูลทีม A/B
- อ่านโลโก้
- อ่านสีทีม
- อ่าน Label
- อ่าน Firebase Configuration จาก Sheet
- รองรับหลาย Firebase League/Database

ข้อมูลการแข่งขันสามารถเลือกด้วย Match ID แล้วนำมาใช้เป็น Match ปัจจุบันได้

### 3.4 Firebase และฐานข้อมูล

ระบบใช้ Firebase Realtime Database สำหรับ

- เก็บข้อมูลการแข่งขันที่บันทึก
- เก็บข้อมูลทีมและโลโก้
- Sync ข้อมูลระหว่างผู้ใช้
- จัดการ Whitelist
- เก็บข้อมูลสิทธิ์ผู้ใช้
- เก็บวันเริ่มต้นทดลองใช้งาน

Hook สำคัญ:

- [useScoreboardFirebase.ts](/D:/React_Scoreboard/src/hooks/useScoreboardFirebase.ts)
- [useScoreboardDatabase.ts](/D:/React_Scoreboard/src/hooks/useScoreboardDatabase.ts)
- [firebaseAuth.ts](/D:/React_Scoreboard/src/config/firebaseAuth.ts)

ระบบสิทธิ์รองรับ

- Super Admin
- Whitelisted User
- Free Trial 7 วัน
- Pending
- Denied
- Trial Expired

กฎฐานข้อมูลอยู่ใน [database.rules.json](/D:/React_Scoreboard/database.rules.json)

### 3.5 Authentication และ Admin Whitelist

หน้า Root ถูกป้องกันด้วย [AuthGuard.tsx](/D:/React_Scoreboard/src/components/AuthGuard.tsx)

การทำงาน:

1. Login ด้วย Google
2. ตรวจสอบข้อมูลผู้ใช้ใน Firebase
3. ตรวจสอบ Whitelist
4. ตรวจสอบ Free Trial
5. อนุญาตหรือปฏิเสธการเข้าหน้าควบคุม

หน้าจัดการ Admin อยู่ที่

- `/admin/whitelist`
- `/whitelist`

### 3.6 OBS Browser Source และ Overlay

ระบบแยกหน้าควบคุมออกจากหน้าสำหรับ OBS Browser Source โดยใช้ Routing และ `BroadcastChannel`

เส้นทางสำคัญ:

- `/overlay`
  - Overlay หลักสำหรับข้อมูลการแข่งขัน
  - รองรับ ticker, table, results และ stadium view
- `/all-scores`
  - แสดงผลการแข่งขันทั้งหมด
- `/league-table`
  - คำนวณและแสดงตารางคะแนน
- `/all-score-combined`
  - รวมผลการแข่งขันและตารางคะแนน

หน้าจอเหล่านี้จะรับ Firebase Configuration ผ่าน URL Parameter เช่น `fb`

### 3.7 Goal Animation

ไฟล์หลัก:

- [GoalAnimationOverlay.tsx](/D:/React_Scoreboard/src/components/GoalAnimationOverlay.tsx)
- [TeamNamesAnimation.tsx](/D:/React_Scoreboard/src/components/TeamNamesAnimation.tsx)
- [ScoreOnlyAnimation.tsx](/D:/React_Scoreboard/src/components/ScoreOnlyAnimation.tsx)
- [scoreboardEvent.ts](/D:/React_Scoreboard/src/types/scoreboardEvent.ts)

เมื่อมีการยิงประตู ระบบจะส่ง Event ชนิด `GoalScored` ผ่าน Channel `scoreboard-events`

รองรับ

- Animation ชื่อทีม
- Animation คะแนน
- แสดงคะแนนทีม A/B
- แสดงเฉพาะทีมที่ยิง
- โหมดแสดงตัวเลขจริง
- โหมดแสดงเฉพาะ Effect
- เก็บ Scoreboard State ล่าสุดใน `localStorage`

ตัวอย่าง URL:

```text
/goal-animation
/goal-animation?template=score-only&mode=number
/goal-animation?template=score-only&side=A&mode=number
/goal-animation?template=team-names&side=B
```

### 3.8 Penalty Shootout

ไฟล์หลัก:

- [PenaltyShootoutController.tsx](/D:/React_Scoreboard/src/components/PenaltyShootoutController.tsx)
- [PenaltyDotsOverlay.tsx](/D:/React_Scoreboard/src/components/PenaltyDotsOverlay.tsx)

รองรับ

- บันทึกผลยิงจุดโทษของทีม A/B
- แสดงจุดยิงเข้า/ไม่เข้า
- เปลี่ยน Layout
- ตั้งค่าขนาดและระยะห่างของจุด
- ควบคุมการเปิด/ปิด Source ใน OBS
- สื่อสารระหว่างหน้าควบคุมกับ Overlay ผ่าน `penalty_channel`

### 3.9 Instant Replay

ไฟล์หลัก:

- [InstantReplayControl.tsx](/D:/React_Scoreboard/src/components/InstantReplayControl.tsx)
- [InstantReplayScreen.tsx](/D:/React_Scoreboard/src/components/InstantReplayScreen.tsx)
- [useReplayChannel.ts](/D:/React_Scoreboard/src/hooks/useReplayChannel.ts)

การทำงานแบ่งเป็น 2 ส่วน:

- Control Panel
  - เลือกโฟลเดอร์วิดีโอ
  - Scan ไฟล์ Replay
  - โหลดคลิปล่าสุด
  - ตั้งความยาว Replay
  - ตั้ง Speed
  - กำหนดจุดเริ่ม/จุดจบ Loop
- Screen Mode
  - แสดงวิดีโอใน OBS Browser Source
  - รับไฟล์ผ่าน `BroadcastChannel`
  - ควบคุม Play, Pause, Seek และ Loop

ช่องทาง:

- `/replay`
- `/replay/screen`

### 3.10 VAR Replay V2

อยู่ใน `src/components/var-replay-v2/`

รองรับความสามารถที่ละเอียดกว่า Instant Replay เช่น

- Preview Video
- Timeline
- Marker A/B
- Playback Speed
- Loop
- Zoom
- Pan
- Transform
- แยก Control Mode และ Screen Mode

ช่องทาง:

- `/var-replay-v2`
- `/var-replay-v2/screen`
- `/var-replay`
- `/var-replay/screen`

### 3.11 Custom Macro และ Auto Macro

อยู่ใน `src/macros/` และ `src/components/AutoMacrosPanel.tsx`

ระบบ Macro รองรับ Event เช่น

- ปุ่มใน Scoreboard
- Keyboard
- OBS Hotkey
- Replay Buffer Saved
- Replay Video Ended
- Scene Changed
- Stream State Changed
- Record State Changed
- Custom Event

Action ที่ทำได้ เช่น

- รอเวลา
- เปลี่ยน Scene
- แสดง/ซ่อน Source
- เปิด/ปิด Replay Control
- เปิด/ปิด VAR Replay
- Save Replay Buffer
- โหลด Replay ล่าสุด

Macro ถูกเก็บใน `localStorage` และสามารถสร้างจาก Preset ได้

## 4. จุดเริ่มต้นของโปรแกรม

ลำดับการเริ่มต้นคือ

```text
index.html
  └── src/main.tsx
        └── src/App.tsx
              └── AuthGuard
                    └── ScoreboardController
```

### ไฟล์ที่ควรเปิดดูเป็นอันดับแรก

1. [package.json](/D:/React_Scoreboard/package.json)
   - ดู Scripts และ Dependencies
2. [src/main.tsx](/D:/React_Scoreboard/src/main.tsx)
   - จุด Mount React
3. [src/App.tsx](/D:/React_Scoreboard/src/App.tsx)
   - ดู Routing ทั้งหมด
4. [src/components/ScoreboardController.tsx](/D:/React_Scoreboard/src/components/ScoreboardController.tsx)
   - ศูนย์กลางการทำงานของระบบ
5. [src/hooks/useOBSWebSocket.ts](/D:/React_Scoreboard/src/hooks/useOBSWebSocket.ts)
   - ดูการเชื่อมต่อ OBS
6. [src/config/firebaseAuth.ts](/D:/React_Scoreboard/src/config/firebaseAuth.ts)
   - ดู Authentication และระบบสิทธิ์

## 5. วิธีรันโปรเจกต์

### สิ่งที่ต้องเตรียม

- Node.js และ npm
- OBS Studio
- เปิด OBS WebSocket Server ที่ Port `4455`
- Browser ที่รองรับ File System Access API เช่น Chrome หรือ Edge
- Firebase Project และ Realtime Database

### ตั้งค่า Firebase

สร้างหรือแก้ไขไฟล์ `.env` โดยอ้างอิงจาก [.env.example](/D:/React_Scoreboard/.env.example)

ตัวแปรหลักคือ

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_DATABASE_URL=...
VITE_ALLOWED_EMAILS=admin@example.com,user@example.com
```

จากนั้นควรนำกฎจาก [database.rules.json](/D:/React_Scoreboard/database.rules.json) ไป Publish ใน Firebase Realtime Database

### ติดตั้งและรันโหมด Development

```bash
npm install
npm run dev
```

เปิด:

```text
http://localhost:5173/React_Scoreboard/
```

ถ้าต้องการเปิด OBS Browser Source โดยตรง ตัวอย่างเช่น

```text
http://localhost:5173/React_Scoreboard/goal-animation
```

### คำสั่งอื่น ๆ

```bash
npm run build
```

Build TypeScript, Vite และสร้าง `dist/404.html` สำหรับ Client-side Routing

```bash
npm run preview
```

เปิดดูผล Build ในเครื่อง

```bash
npm test
```

รัน Unit และ Component Tests

```bash
npm run lint
```

ตรวจสอบโค้ดด้วย Oxlint

```bash
npm run deploy
```

Build และ Deploy ไป GitHub Pages ผ่าน `gh-pages`

### ลำดับการใช้งานครั้งแรก

1. รัน `npm run dev`
2. Login ด้วย Google
3. เชื่อมต่อ OBS WebSocket
4. เปิด Quick Setup เพื่อสร้าง Scene และ Sources
5. เลือกโฟลเดอร์ OBS Replay Buffer
6. นำเข้าไฟล์ Excel หรือ Google Sheets
7. เลือก Match ID
8. ตรวจสอบชื่อทีม โลโก้ สี และเวลา
9. เปิด Browser Source URL ใน OBS
10. ทดสอบปุ่มเพิ่มคะแนนและ Goal Animation

## ผลการตรวจสอบจากสภาพปัจจุบัน

- Test files ผ่านทั้งหมด: 13 ไฟล์
- Tests ผ่านทั้งหมด: 110 tests
- `npm run lint` ผ่านโดยไม่มี Error

หมายเหตุ: ก่อนเริ่มวิเคราะห์ Git working tree มีการเปลี่ยนแปลงอยู่แล้ว ได้แก่เอกสารใน `docs/` ถูกลบ 2 ไฟล์ และ `src/components/TeamNamesAnimation.tsx` ถูกแก้ไข ผมไม่ได้แก้ไขไฟล์เหล่านี้ระหว่างการวิเคราะห์ครับ

> คุณคือ Principal Software Architect และ Senior Full-Stack Engineer ผู้มีความเชี่ยวชาญระดับโลก มีประสบการณ์สูงในการออกแบบระบบ (System Design) การเขียน Clean Code, Design Patterns, Security, Performance Optimization และ Best Practices ทุกประการ
>
> เป้าหมายของคุณคือช่วยผมพัฒนา ออกแบบ เขียนโค้ด รีวิว และแก้ไขข้อผิดพลาด (Debugging) ของโปรแกรมอย่างมีประสิทธิภาพสูงสุด
>
> กรุณายึดถือแนวทางปฏิบัตินี้ในการทำงานทุกครั้ง:
> 1. คิดวิเคราะห์อย่างลึกซึ้งเป็นระบบ (Step-by-step reasoning) ก่อนเขียนโค้ดทุกครั้ง
> 2. เขียนโค้ดที่สะอาด อ่านง่าย มีคอมเมนต์อธิบายส่วนที่ซับซ้อน และรองรับการขยายตัวในอนาคต (Scalability)
> 3. ป้องกันช่องโหว่ด้านความปลอดภัย (Security vulnerabilities) และคำนึงถึงประสิทธิภาพความเร็ว (Performance)
> 4. หากโค้ดมีจุดที่ต้องปรับปรุง หรือมีแนวทางที่ดีกว่า ให้แนะนำเพิ่มเติมทันทีโดยไม่ต้องรอถาม
> 5. ให้โค้ดที่สมบูรณ์ สามารถนำไปใช้งานได้จริง ไม่ตัดทอนหรือละเว้นส่วนสำคัญ เว้นแต่จะยาวเกินไป
>
> หากเข้าใจบทบาทนี้แล้ว ให้ตอบรับด้วยความมั่นใจ พร้อมระบุว่าคุณพร้อมรับโจทย์แรกจากผมแล้ว

เข้าใจบทบาทและแนวทางการทำงานทั้งหมดแล้วครับ ผมพร้อมช่วยวิเคราะห์ ออกแบบ เขียนโค้ด รีวิว และแก้ไขปัญหาโดยคำนึงถึง Clean Code, Security, Performance, Scalability และความถูกต้องของระบบ

พร้อมรับโจทย์แรกจากคุณแล้วครับ

> ผมอยากพัฒนาในส่วนของ Control Replay ครับ.
> ผมอยากให้มี playlist สำหรับให้เล่น Video hilight ในช่วงเวลาพักครึ่งเวลา หรือ ในช่วงเวลาๆว่างๆ. โดย User สามารถ add video เข้าสู่ playlist เพื่อทำการเล่นทุก video ภายใต้การกดปุ่ม play all ในช่วงเวลาพักครึ่งได้. แต่ต้องแยกออกมาใส่ส่วน control replay นะครับ.
> ช่วงวางแผนให้หน่อยครับ.

<details><summary>2 previous messages</summary>

> ได้ครับ ผมจะวางแผนโดยอิงกับโครงสร้าง Replay ปัจจุบันก่อน เพื่อให้ Playlist ทำงานร่วมกับ Control Replay เดิมได้โดยไม่กระทบโหมด Instant Replay/OBS Screen และจะแยกขอบเขตงานเป็น Data Model, UI, การสื่อสารระหว่าง Control/Screen, Playback Engine, Persistence และการทดสอบครับ
>
> จากโค้ดปัจจุบันพบว่า Control Replay มีระบบโหลดไฟล์เดี่ยวผ่าน `BroadcastChannel` อยู่แล้ว และ Screen Replay มี Event `ReplayVideoEnded` ส่งกลับมาเมื่อวิดีโอจบ ดังนั้น Playlist สามารถต่อยอดจากช่องทางเดิมได้ โดยไม่ต้องสร้างระบบส่งวิดีโอชุดใหม่ทั้งหมดครับ จุดสำคัญคือไม่ควรเก็บ `File` ลง `localStorage` แต่เก็บเฉพาะ metadata แล้ว resolve ไฟล์กลับจากโฟลเดอร์ที่เชื่อมต่อเมื่อใช้งานจริงครับ
</details>

ได้ครับ แนวทางที่เหมาะสมคือเพิ่ม Playlist เข้าไปภายใน `InstantReplayControl` โดยแยกเป็น Component และ Hook ของตัวเอง ไม่ปะปนกับ Logic สกอร์บอร์ดหลักหรือ Instant Replay แบบคลิปเดี่ยว

## แนวทางที่เสนอ

### ขอบเขต MVP

ผู้ใช้สามารถ:

- เห็นรายการวิดีโอจากโฟลเดอร์ที่เชื่อมต่อ
- กด “เพิ่มเข้า Playlist”
- ดูรายการ Playlist แยกจากคลังวิดีโอ
- ลบวิดีโอออกจาก Playlist
- จัดลำดับวิดีโอด้วยปุ่มขึ้น/ลง
- กด “เล่นทั้งหมด”
- ระบบเล่นวิดีโอต่อกันอัตโนมัติจนจบ Playlist
- แสดงสถานะ เช่น `กำลังเล่น 2/5`
- กด Stop เพื่อหยุด Playlist
- หากไฟล์หาย ระบบแจ้งเตือนและข้ามไฟล์นั้น
- Playlist ยังคงอยู่หลัง Refresh Browser

การเล่น Playlist จะใช้วิดีโอเต็มคลิป และใช้ความเร็วปกติ `1.0x` แยกจาก Instant Replay ที่ปัจจุบันใช้ Auto Trim

## สถาปัตยกรรมปัจจุบันที่สามารถนำมาต่อยอด

ปัจจุบันระบบมีอยู่แล้ว:

- Control: [InstantReplayControl.tsx](/D:/React_Scoreboard/src/components/InstantReplayControl.tsx)
- Screen สำหรับ OBS: [InstantReplayScreen.tsx](/D:/React_Scoreboard/src/components/InstantReplayScreen.tsx)
- การสื่อสารระหว่างหน้าผ่าน [useReplayChannel.ts](/D:/React_Scoreboard/src/hooks/useReplayChannel.ts)
- Event เมื่อวิดีโอจบผ่าน Channel `replay-events`
- ระบบอ่านโฟลเดอร์วิดีโอผ่าน [useObsVideoFolder.ts](/D:/React_Scoreboard/src/hooks/useObsVideoFolder.ts)

ดังนั้นไม่จำเป็นต้องสร้างระบบเล่นวิดีโอใหม่ทั้งหมด

## Data Flow ที่แนะนำ

```text
User กด Play All
        ↓
ReplayPlaylistController
        ↓
ค้นหา File จาก Playlist
        ↓
ส่ง FileMessage ผ่าน BroadcastChannel
        ↓
InstantReplayScreen โหลดและเล่นวิดีโอ
        ↓
วิดีโอจบ → ส่ง ReplayVideoEnded
        ↓
Control รับ Event
        ↓
เลือกวิดีโอถัดไป
        ↓
ส่ง FileMessage ใหม่
```

ระบบจะส่งวิดีโอทีละไฟล์เท่านั้น ไม่โหลดทั้ง Playlist เข้า Memory พร้อมกัน เพื่อป้องกันการใช้ RAM สูงเกินไป

## Data Model ที่เสนอ

ไม่ควรเก็บ `File` object ลง `localStorage` เพราะไม่สามารถ Serialize ได้โดยตรง ควรเก็บเฉพาะ Metadata เช่น:

```ts
export interface ReplayPlaylistItem {
  id: string;
  fileName: string;
  fileSize: number;
  lastModified: number;
  addedAt: number;
}

export interface ReplayPlaylistState {
  version: 1;
  items: ReplayPlaylistItem[];
}
```

เมื่อผู้ใช้กด Play ระบบจะค้นหาไฟล์จริงจาก `videoFolder.videoFiles` ด้วย:

- `fileName`
- `fileSize`
- `lastModified`

หากพบจึงโหลดไฟล์จริงและส่งไปยัง Screen

## โครงสร้างไฟล์ที่ควรเพิ่ม/แก้ไข

### เพิ่มไฟล์

```text
src/hooks/useReplayPlaylist.ts
src/components/ReplayPlaylistPanel.tsx
src/components/ReplayPlaylistPanel.css
```

หน้าที่:

- `useReplayPlaylist.ts`
  - จัดการรายการ Playlist
  - บันทึก/โหลดจาก `localStorage`
  - เพิ่ม ลบ สลับลำดับ
  - Resolve Metadata กลับเป็น `File`
  - จัดการสถานะ `idle`, `playing`, `paused`, `completed`, `stopped`

- `ReplayPlaylistPanel.tsx`
  - UI สำหรับแสดง Playlist
  - ปุ่ม Add, Remove, Move Up, Move Down
  - ปุ่ม Play All, Stop, Clear
  - แสดง Progress และไฟล์ที่กำลังเล่น

### แก้ไขไฟล์เดิม

- `src/components/InstantReplayControl.tsx`
  - เพิ่ม `ReplayPlaylistPanel`
  - แยก Single Replay กับ Playlist Mode
  - เมื่อผู้ใช้กดเล่นไฟล์เดี่ยว ให้หยุด Playlist อัตโนมัติ
  - รับ Event `ReplayVideoEnded`
  - ส่งวิดีโอถัดไปเมื่อ Playlist กำลังทำงาน

- `src/components/InstantReplayScreen.tsx`
  - เพิ่มข้อมูลระบุไฟล์ปัจจุบันใน `ReplayVideoEnded`
  - ป้องกัน Event เก่าหรือ Event จาก Session ก่อนหน้า
  - คงการจัดการ Blob URL และการคืน Memory เดิมไว้

- `src/types/instantReplay.ts`
  - เพิ่ม Type สำหรับ Playlist
  - เพิ่ม Type สำหรับ Replay Event
  - เพิ่ม `playlistItemId` หรือ `playbackId` ใน Message เพื่อป้องกัน Race Condition

## การป้องกันปัญหาสำคัญ

### 1. ป้องกันการกด Play All ซ้ำ

ใช้ `runId` หรือ `sessionId` ต่อการเริ่ม Playlist แต่ละครั้ง

```text
Play All ครั้งที่ 1 → session A
Play All ครั้งที่ 2 → session B
```

Event ที่มาจาก Session A จะถูกละเว้นเมื่อ Session B กำลังทำงานอยู่

### 2. ป้องกันการเล่นซ้ำจาก Event ซ้ำ

เก็บ `lastCompletedPlaybackId` เพื่อไม่ให้ไฟล์ถัดไปถูกโหลดซ้ำจาก Event เดิม

### 3. เปลี่ยนไปเล่นไฟล์เดี่ยวระหว่าง Playlist

เมื่อผู้ใช้กด Play บนไฟล์ใดไฟล์หนึ่ง:

- หยุด Playlist
- ยกเลิก Queue เดิม
- เล่นไฟล์เดี่ยวตามปกติ

### 4. ไฟล์หายหรือถูกย้าย

เมื่อกด Play All:

- ตรวจสอบไฟล์ทุกตัว
- ถ้าไม่พบ ให้แสดงสถานะ `ไม่พบไฟล์`
- ข้ามไฟล์นั้น
- เล่นไฟล์ถัดไปต่อ

### 5. Memory Management

`InstantReplayScreen` ต้อง:

- `URL.revokeObjectURL()` ก่อนเปลี่ยนวิดีโอใหม่
- โหลดทีละไฟล์
- ไม่เก็บ ArrayBuffer ของทุกวิดีโอไว้พร้อมกัน

## รูปแบบ UI ที่แนะนำ

ภายใน Control Replay แบ่งเป็น 2 Section:

```text
Replay Controller

[คลิกเดียว โหลดและเล่นรีเพลย์ล่าสุด]

คลังวิดีโอ
- clip-001.mp4     [เล่น] [เพิ่ม]
- clip-002.mp4     [เล่น] [เพิ่ม]
- clip-003.mp4     [เล่น] [เพิ่ม]

Playlist ไฮไลต์                         3 รายการ
1. intro.mp4                            [↑] [↓] [ลบ]
2. match-highlights.mp4                 [↑] [↓] [ลบ]
3. final-goal.mp4                       [↑] [↓] [ลบ]

[▶ เล่นทั้งหมด] [■ หยุด] [ล้าง Playlist]

กำลังเล่น 2/3
match-highlights.mp4
```

ควรป้องกันการเพิ่มไฟล์ซ้ำโดยใช้ Metadata เป็นตัวตรวจสอบ

## ลำดับการพัฒนา

### Phase 1: Data และ Persistence

- สร้าง `ReplayPlaylistItem`
- สร้าง Hook `useReplayPlaylist`
- เพิ่มการบันทึก `localStorage`
- เพิ่ม Add, Remove, Reorder, Clear
- เขียน Unit Test สำหรับ Logic เหล่านี้

### Phase 2: UI

- สร้าง `ReplayPlaylistPanel`
- เพิ่มรายการ Playlist ใน Control Replay
- เพิ่มสถานะ Empty, Loading, Missing File
- เพิ่มปุ่ม Play All และ Stop

### Phase 3: Playback Engine

- เพิ่ม Playlist State Machine
- เชื่อมกับ `loadAndPlayFile`
- แยก Single Replay Mode กับ Playlist Mode
- รับ `ReplayVideoEnded`
- เล่นวิดีโอถัดไปอัตโนมัติ

### Phase 4: Protocol Hardening

- เพิ่ม `playbackId`
- เพิ่ม `playlistSessionId`
- ป้องกัน Event ซ้ำและ Event เก่า
- ปรับ Type ของ `BroadcastChannel Message`

### Phase 5: ทดสอบและ QA

ทดสอบกรณี:

- Playlist ว่าง
- Playlist มี 1 ไฟล์
- Playlist มีหลายไฟล์
- เพิ่มไฟล์ซ้ำ
- ลบไฟล์ระหว่าง Playlist กำลังเล่น
- ไฟล์หาย
- กด Stop
- กด Play ไฟล์เดี่ยวระหว่าง Play All
- Refresh แล้ว Playlist ยังอยู่
- เปิด/ปิด OBS Browser Source
- วิดีโอจบแล้วเล่นไฟล์ถัดไป
- Instant Replay เดิมยังทำงานเหมือนเดิม

## ข้อควรระวัง

1. `localStorage` จะเก็บได้เฉพาะข้อมูลอ้างอิงไฟล์ ไม่ใช่ตัวไฟล์จริง
2. หากโฟลเดอร์ถูกเปลี่ยน Playlist เดิมอาจหาไฟล์ไม่พบ
3. Browser ต้องมีสิทธิ์เข้าถึงโฟลเดอร์
4. การส่งวิดีโอผ่าน `ArrayBuffer` อาจใช้ Memory สูง จึงควรส่งทีละไฟล์
5. Browser Autoplay อาจมีข้อจำกัด จึงควรเริ่ม Play All จากการคลิกของผู้ใช้
6. ไม่ควรผูก Playlist เข้ากับ `ScoreboardController` โดยตรง ควรอยู่ใน Replay Control ตามที่คุณต้องการ

แนวทางนี้จะทำให้ Playlist เป็นระบบแยกอิสระภายใน Control Replay และยังใช้ Screen Replay กับช่องทางสื่อสารเดิมได้ครับ.

> OK ครับ. เริ่มการพัฒนาระบบตามแผนการที่ออกแบบมาได้เลย.

<details><summary>8 previous messages</summary>

> รับทราบครับ ผมจะเริ่มจากการทำ MVP ตามแผน โดยเพิ่ม Playlist แยกใน Control Replay, เก็บเฉพาะ metadata, เล่นต่อเนื่องผ่าน `ReplayVideoEnded` และรักษา Single Replay เดิมไว้ จากนั้นจะรัน test/lint/build เพื่อตรวจ regression ครับ ผมจะไม่แตะการแก้ไขที่มีอยู่ก่อนแล้วในไฟล์อื่นนอกขอบเขตงานนี้】【。
>
> ผมจะเริ่มแก้จาก Protocol และ Data Model ก่อน เพื่อให้การเล่นต่อเนื่องมี `playbackId/sessionId` ป้องกัน Event เก่าหรือ Event ซ้ำ จากนั้นค่อยต่อ Hook และ UI ครับ ขั้นแรกนี้ยังคงใช้ Channel เดิม (`scoreboard_replay_v1` และ `replay-events`) เพื่อไม่ทำลายการทำงานของ OBS Screen ที่มีอยู่แล้ว
>
> <details><summary>Created 2 files, edited 5 files</summary>
>
> - Wrote `./src/types/instantReplay.ts` (+54 -0)
> - Wrote `./src/hooks/useReplayPlaylist.ts` (+128 -0)
> - Wrote `./src/components/ReplayPlaylistPanel.tsx` (+160 -0)
> - Wrote `./src/components/InstantReplayControl.css` (+122 -0)
> - Wrote `./src/hooks/useReplayPlaylist.ts` (+4 -10)
> - Wrote `./src/components/InstantReplayControl.tsx` (+71 -7)
> - Wrote `./src/components/InstantReplayControl.tsx` (+77 -0)
> - Wrote `./src/components/InstantReplayControl.tsx` (+8 -1)
> - Wrote `./src/components/InstantReplayControl.tsx` (+35 -0)
> - Wrote `./src/components/InstantReplayControl.tsx` (+43 -9)
> - Wrote `./src/components/InstantReplayControl.css` (+8 -0)
> - Wrote `./src/components/InstantReplayScreen.tsx` (+12 -0)
>
> </details>
>
> ส่วน Data Model, Playlist Hook, UI และการส่งข้อมูลระบุ Playback/Session ถูกเพิ่มแล้วครับ ตอนนี้ผมกำลังตรวจ TypeScript และแก้จุดเชื่อมต่อที่อาจกระทบระบบเดิม เช่น Auto Trim ของ Instant Replay ต้องไม่ทำงานกับ Playlist และการกดเล่นคลิปเดี่ยวต้องยกเลิก Queue เดิมอัตโนมัติครับ
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./src/components/InstantReplayControl.tsx` (+8 -4)
> - Wrote `./src/components/InstantReplayControl.tsx` (+5 -6)
>
> </details>
>
> TypeScript, lint และชุดทดสอบเดิมผ่านแล้วครับ ต่อไปผมกำลังเพิ่ม Unit Tests สำหรับ Playlist โดยเฉพาะ เพื่อยืนยันว่า metadata persistence, duplicate prevention, reorder, remove และการ resolve ไฟล์กลับจากโฟลเดอร์ทำงานถูกต้อง ก่อนตรวจ Build จริงอีกครั้งครับ
>
> <details><summary>Created a file, edited 5 files</summary>
>
> - Wrote `./src/hooks/useReplayPlaylist.test.ts` (+76 -0)
> - Wrote `./src/hooks/useReplayPlaylist.test.ts` (+3 -5)
> - Wrote `./src/components/InstantReplayControl.tsx` (+1 -0)
> - Wrote `./src/components/InstantReplayScreen.tsx` (+1 -0)
> - Wrote `./src/components/ReplayPlaylistPanel.tsx` (+1 -1)
> - Wrote `./src/types/instantReplay.ts` (+1 -0)
> - Wrote `./src/components/ReplayPlaylistPanel.tsx` (+12 -1)
>
> </details>
>
> ฟีเจอร์หลักทำงานครบตามแผนแล้ว และ Test/Lint/TypeScript ผ่านครับ ผมพบและแก้รายละเอียด UX เพิ่มเติมให้รายการที่เล่นไปแล้วไม่แสดงสถานะ “กำลังเล่น” ทุกแถว ตอนนี้เหลือการ Build production รอบสุดท้ายเพื่อยืนยันว่า bundle และ SPA fallback ยังสร้างได้ปกติครับ
</details>

พัฒนา Playlist สำหรับ Control Replay เสร็จแล้วครับ

สิ่งที่เพิ่ม:

- เพิ่ม Playlist แยกภายใน Control Replay
- เพิ่มปุ่ม `เพิ่ม` จากคลังวิดีโอ
- ป้องกันการเพิ่มวิดีโอซ้ำ
- ลบวิดีโอจาก Playlist
- เลื่อนลำดับขึ้น/ลง
- ปุ่ม `เล่นทั้งหมด`
- ปุ่ม `หยุด`
- ปุ่ม `ล้าง Playlist`
- เล่นวิดีโอต่อเนื่องอัตโนมัติเมื่อคลิปก่อนหน้าจบ
- แสดงสถานะ `กำลังเล่น`, `เล่นแล้ว`, `รอเล่น`
- ข้ามไฟล์ที่ถูกลบหรือไม่พบในโฟลเดอร์
- บันทึก Playlist ลง `localStorage`
- เล่น Playlist แบบเต็มคลิปที่ความเร็ว `1.0x`
- การเล่นไฟล์เดี่ยวจะยกเลิก Playlist ปัจจุบัน
- เพิ่ม `playbackId` และ `playlistSessionId` ป้องกัน Event ซ้ำหรือ Event จาก Session เก่า

ไฟล์สำคัญที่เพิ่ม/แก้ไข:

- [ReplayPlaylistPanel.tsx](/D:/React_Scoreboard/src/components/ReplayPlaylistPanel.tsx)
- [useReplayPlaylist.ts](/D:/React_Scoreboard/src/hooks/useReplayPlaylist.ts)
- [useReplayPlaylist.test.ts](/D:/React_Scoreboard/src/hooks/useReplayPlaylist.test.ts)
- [InstantReplayControl.tsx](/D:/React_Scoreboard/src/components/InstantReplayControl.tsx)
- [InstantReplayScreen.tsx](/D:/React_Scoreboard/src/components/InstantReplayScreen.tsx)
- [instantReplay.ts](/D:/React_Scoreboard/src/types/instantReplay.ts)
- [InstantReplayControl.css](/D:/React_Scoreboard/src/components/InstantReplayControl.css)

วิธีใช้งาน:

1. เชื่อมต่อโฟลเดอร์วิดีโอจากหน้าหลัก
2. เปิด Control Replay
3. กด `เพิ่ม` ที่วิดีโอที่ต้องการ
4. จัดลำดับ Playlist
5. กด `เล่นทั้งหมด` ในช่วงพักครึ่งหรือช่วงว่าง

ผลการตรวจสอบ:

- Tests: 14 ไฟล์ / 113 tests ผ่านทั้งหมด
- Lint ผ่าน
- TypeScript ผ่าน
- Production Build ผ่าน
- Build มีเพียงคำเตือนเรื่อง bundle ของ `xlsx` และ `exceljs` ขนาดใหญ่กว่า 500 KB ไม่ใช่ Build Error

หมายเหตุ: เวอร์ชันนี้เป็นการกด `เล่นทั้งหมด` ด้วยตัวเอง ยังไม่ได้ผูกให้เริ่มอัตโนมัติตามสถานะพักครึ่งของ Timer หรือ Macro ครับ

> ย้ายตำแหน่ง ในส่วนของ "Playlist ไฮไลต์" ที่พัฒนามา.
> ให้ลงไปอยู่ด้านล่างสุดของ modal นั้น.

<details><summary>2 previous messages</summary>

> ได้ครับ ผมจะย้ายเฉพาะตำแหน่งการ render ของ `ReplayPlaylistPanel` ไปไว้ท้ายสุดของเนื้อหาใน Replay Control Modal โดยไม่เปลี่ยน Logic, State หรือการเล่นวิดีโอของ Playlist ครับ
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./src/components/InstantReplayControl.tsx` (+20 -19)
>
> </details>
</details>

ย้ายส่วน **“Playlist ไฮไลต์”** ไปไว้ด้านล่างสุดของ Replay Control Modal เรียบร้อยแล้วครับ

ไฟล์ที่แก้ไข:

- [InstantReplayControl.tsx](/D:/React_Scoreboard/src/components/InstantReplayControl.tsx)

การทำงานและ Logic ของ Playlist ไม่ได้เปลี่ยนแปลง

ตรวจสอบแล้ว:

- `npm run lint` ผ่าน
- TypeScript ผ่าน

> ในส่วนของ "Playlist ไฮไลต์" ให้เช็ค Css ให้หน่อย บางปุ่มมันเป็นสีขาว.

<details><summary>3 previous messages</summary>

> ผมจะตรวจ CSS ของปุ่มใน Playlist เทียบกับสไตล์ปุ่ม Replay เดิมก่อน เพื่อหาว่า selector ใดทำให้ background หรือ text color ถูก override แล้วจะแก้เฉพาะส่วน Playlist พร้อมตรวจ lint/typecheck ครับ
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./src/components/InstantReplayControl.css` (+3 -2)
>
> </details>
>
> พบสาเหตุแล้วครับ: `.replay-button` เดิมกำหนดสีตัวอักษรและ Border แต่ไม่ได้กำหนด `background` ทำให้ Browser ใช้สีพื้นฐานของปุ่มเป็นสีขาว โดยเฉพาะปุ่ม Stop และปุ่มไอคอนใน Playlist ผมแก้ Base Style ให้เป็นพื้นหลัง Dark Theme และเพิ่ม Hover ให้แล้วครับ
</details>

ตรวจพบสาเหตุแล้วครับ ปุ่มบางปุ่มไม่มีการกำหนด `background` จึงใช้สีพื้นฐานของ Browser เป็นสีขาว

แก้ไขใน:

- [InstantReplayControl.css](/D:/React_Scoreboard/src/components/InstantReplayControl.css)

การแก้ไข:

- กำหนดพื้นหลังปุ่มเป็น `#1a2834`
- กำหนด Border ให้เข้ากับ Dark Theme
- เพิ่มสี Hover เป็น `#223544`
- ปุ่ม Stop และปุ่มไอคอนใน Playlist จะไม่เป็นสีขาวแล้ว

ตรวจสอบแล้ว:

- Lint ผ่าน
- TypeScript ผ่าน

> ด้านล่างสุดของ modal ข้อมูลแสดงไม่ตรบ ตรวจเช็คหน่อย.

<details><summary>3 previous messages</summary>

> ผมจะตรวจโครงสร้าง Modal และ CSS ที่ควบคุม `height`, `max-height`, `overflow` และการเลื่อนหน้าจอของ Replay Control ก่อนครับ น่าจะเกิดจากเนื้อหา Playlist ถูกวางท้าย Modal แต่ container ยังจำกัดความสูงหรือซ่อน overflow อยู่ เดี๋ยวผมจะแก้ให้ส่วนล่างเลื่อนได้ครบโดยไม่กระทบหน้าจอ OBS Replay ครับ
>
> พบสาเหตุครับ: Modal หลักมี `max-height: 85vh` แต่ Replay Control ด้านในกำหนด `max-height: 90vh` และ Modal หลักใช้ `overflow: hidden` ทำให้ส่วนล่างของ Playlist ถูกตัดก่อนถึงพื้นที่ Scroll ของด้านใน ผมจะแก้ให้ Modal Replay ใช้พื้นที่สูงสุดสอดคล้องกันที่ `94vh` และให้ตัว Replay เป็นพื้นที่ Scroll หลักครับ
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./src/index.css` (+2 -1)
>
> </details>
</details>

ตรวจพบสาเหตุแล้วครับ ตัว Modal มี `max-height: 85vh` แต่ Replay Control ด้านในสูงได้ถึง `90vh` จึงทำให้ข้อมูล Playlist ด้านล่างถูกตัด

แก้ไขใน:

- [index.css](/D:/React_Scoreboard/src/index.css)

การแก้ไข:

- เพิ่มความสูงสูงสุดของ Replay Modal เป็น `94vh`
- ปรับพื้นที่ Scroll ของ Replay Control ให้สอดคล้องกับ Modal
- ส่วน Playlist ด้านล่างสามารถเลื่อนดูข้อมูลได้ครบแล้ว

ตรวจสอบแล้ว:

- Lint ผ่าน
- TypeScript ผ่าน

> ตรวจงานผ่านแล้วครับในส่วน replay control หรือ hilight

รับทราบครับ ดีมากครับที่ Replay Control และ Playlist ไฮไลต์ผ่านการตรวจสอบเรียบร้อยแล้ว

พร้อมรับงานส่วนถัดไปครับ

> ดูในส่วนของ var controller ต่อครับ

<details><summary>2 previous messages</summary>

> ได้ครับ ผมจะเริ่มตรวจ VAR Controller V2 ก่อน โดยดูโครงสร้าง Control/Screen, การสื่อสารระหว่างหน้ากับ OBS, การจัดการไฟล์วิดีโอ, Marker/Loop/Zoom และจุดที่ควรพัฒนาต่อ โดยรอบนี้จะยังไม่แก้โค้ดจนกว่าจะเห็นเป้าหมายที่ต้องการปรับชัดเจนครับ
>
> ตรวจ VAR Controller V2 แล้วครับ ภาพรวมเป็นระบบแยก Control กับ OBS Screen ชัดเจน และมี Protocol ของตัวเอง ไม่ใช้ Channel เดียวกับ Instant Replay ผมกำลังสรุปจุดที่มีอยู่และข้อควรระวังให้ก่อน เพื่อให้เลือกฟีเจอร์ที่จะพัฒนาต่อได้ตรงจุดครับ
</details>

ตรวจสอบส่วน VAR Controller V2 แล้วครับ

## โครงสร้างปัจจุบัน

ไฟล์หลัก:

- [VarReplayV2Page.tsx](/D:/React_Scoreboard/src/components/var-replay-v2/VarReplayV2Page.tsx)
- [varReplayV2Protocol.ts](/D:/React_Scoreboard/src/components/var-replay-v2/varReplayV2Protocol.ts)
- [useVarReplayV2Channel.ts](/D:/React_Scoreboard/src/components/var-replay-v2/useVarReplayV2Channel.ts)
- [VarReplayV2.module.css](/D:/React_Scoreboard/src/components/var-replay-v2/VarReplayV2.module.css)

Routing:

```text
/var-replay-v2              Control
/var-replay-v2/screen       OBS Screen
/var-replay                 Legacy Control URL
/var-replay/screen          Legacy Screen URL
```

## ฟังก์ชันที่มีอยู่

- เลือกวิดีโอจากโฟลเดอร์ Replay
- ค้นหาวิดีโอ
- Preview วิดีโอใน Control
- เปิด Screen สำหรับ OBS
- คัดลอก URL OBS
- Play/Pause
- Seek Timeline
- ตั้ง Marker A/B
- Loop ระหว่าง Marker
- ปรับความเร็ว 0.01–2.00x
- Zoom วิดีโอสูงสุด 10 เท่า
- Pan ภาพเมื่อ Zoom
- Reset Transform
- รองรับ Keyboard Shortcut:
  - `Space` — Play/Pause
  - `A` — ตั้ง Marker A
  - `B` — ตั้ง Marker B
  - `R` — ล้าง Marker
  - `L` — เปิด/ปิด Loop
  - `←/→` — เลื่อนเวลา 0.5 วินาที

## การสื่อสารกับ OBS Screen

ใช้ `BroadcastChannel` แยกเฉพาะ VAR:

```text
scoreboard_var_replay_studio_v3
```

Control ส่ง:

- File
- Play/Pause
- Seek
- Marker
- Speed
- Loop
- Transform
- Request Sync

Screen ส่งกลับ:

- Ready Status
- Duration
- Current Time
- Marker
- Playing Status
- Loop Status

## จุดที่ควรพัฒนาต่อ

จากโค้ดปัจจุบัน จุดที่น่าสนใจมีดังนี้:

1. เพิ่ม Playlist สำหรับ VAR โดยเฉพาะ
2. เพิ่มปุ่ม Next/Previous Clip
3. เพิ่มการเล่นต่อเนื่องแบบ VAR Playlist
4. เพิ่มปุ่ม Save Marker เป็น Preset
5. เพิ่มการตั้งชื่อเหตุการณ์ เช่น Goal, Foul, Offside
6. เพิ่ม Frame-by-Frame Forward/Backward
7. เพิ่มปุ่ม Replay 5/10/15 วินาที
8. เพิ่มการบันทึก Clip ที่เลือกเป็น Highlight
9. เพิ่ม Annotation เช่น ลูกศร วงกลม หรือเส้นบนภาพ
10. เพิ่มการส่งคำสั่งเปิด/ปิด Source ใน OBS
11. เพิ่ม Keyboard Shortcut แบบกำหนดเอง
12. แยก Logic Control และ Screen ออกจากไฟล์ `VarReplayV2Page.tsx` ที่ปัจจุบันมีขนาดค่อนข้างใหญ่

ตอนนี้ยังไม่ได้แก้ไขโค้ดในส่วน VAR Controller ครับ พร้อมรับฟีเจอร์ที่ต้องการพัฒนาต่อได้เลยครับ

> ถ้าแยก Logic Control และ Screen ออกจากไฟล์ VarReplayV2Page.tsx ที่ปัจจุบันมีขนาดค่อนข้างใหญ่ ระบบจะทำงานไวขึ้น ไหม.

สรุปคือ **แยกไฟล์อย่างเดียวไม่ได้ทำให้ระบบเร็วขึ้นอย่างมีนัยสำคัญ** ครับ

ปัจจุบัน [App.tsx](/D:/React_Scoreboard/src/App.tsx) ใช้ `lazy()` โหลด `VarReplayV2Page` อยู่แล้ว ดังนั้น VAR Controller จะถูกโหลดเมื่อเปิดหน้านี้เท่านั้น

ผลลัพธ์มี 2 กรณี:

### แยกไฟล์ แต่ Import แบบปกติ

```tsx
import VarReplayV2Control from './VarReplayV2Control';
import VarReplayV2Screen from './VarReplayV2Screen';
```

ผลคือ:

- Runtime แทบไม่เร็วขึ้น
- Bundle อาจยังถูกรวมเป็น Chunk เดียว
- แต่โค้ดอ่านง่ายและดูแลรักษาง่ายขึ้นมาก
- ลดความเสี่ยงจาก State และ Event Handler ปะปนกัน

### แยกไฟล์และใช้ Dynamic Import

```tsx
const Control = lazy(() => import('./VarReplayV2Control'));
const Screen = lazy(() => import('./VarReplayV2Screen'));
```

กรณีนี้มีโอกาสเร็วขึ้นจริง เพราะ:

- หน้า Control ไม่ต้องโหลด Logic ของ Screen ทั้งหมด
- หน้า OBS Screen ไม่ต้องโหลด Library, Search, Preview และ Control UI
- JavaScript ที่ต้อง Parse และ Execute ลดลง
- เหมาะกับแอปที่มีหลาย Route และใช้งาน Control กับ Screen แยกกัน

## จุดที่มีผลต่อความเร็วมากกว่า

ใน VAR Controller ตัวที่น่าจะมีผลมากกว่าการแยกไฟล์คือ:

- การส่ง `ArrayBuffer` ของวิดีโอผ่าน `BroadcastChannel`
- การสร้างและจัดการ Blob URL
- การอัปเดต State จาก `timeupdate`
- การส่งคำสั่ง Seek/Marker ถี่เกินไป
- การโหลดไฟล์วิดีโอขนาดใหญ่
- การ Render Preview และ Screen พร้อมกัน

## คำแนะนำ

ควรแยกโครงสร้างเป็น:

```text
var-replay-v2/
├── VarReplayV2Page.tsx
├── VarReplayV2Control.tsx
├── VarReplayV2Screen.tsx
├── varReplayV2Protocol.ts
├── useVarReplayV2Channel.ts
└── VarReplayV2.module.css
```

จากนั้นให้ `VarReplayV2Page.tsx` ทำหน้าที่เลือก Mode เท่านั้น และใช้ `lazy()` แยก Control/Screen อีกชั้นหนึ่ง

แนวทางนี้จะช่วยเรื่อง Performance ได้ระดับหนึ่ง และช่วยเรื่อง Clean Architecture, Maintainability และการแก้ Bug ได้ชัดเจนขึ้นมาก โดยเฉพาะเมื่อจะเพิ่ม Playlist, Annotation หรือ Frame-by-Frame ในอนาคตครับ

> งั้นยังไม่ทำการแยกครับ

รับทราบครับ จะยังคงโครงสร้าง `VarReplayV2Page.tsx` เดิมไว้ก่อน และยังไม่มีการแก้ไขส่วนนี้ครับ

> งั้นมาเช็คในระบบ control ครับ.
> เช่นพวกระบบ zoom in-out ในจังหวะ mouse เข้าอยู่ในกรอบ video preview.

<details><summary>1 previous message</summary>

> ได้ครับ ผมจะตรวจพฤติกรรม Zoom In/Out ของ VAR Control ในกรอบ Preview โดยเฉพาะ `wheel`, จุดอ้างอิงของเมาส์, การจำกัด Pan และการป้องกันไม่ให้ Scroll หลุดไปยัง Modal/หน้าเว็บก่อน แล้วจะสรุปว่าปัจจุบันทำงานอย่างไรและมีจุดใดควรแก้ครับ
</details>

ตรวจสอบระบบ Zoom ใน VAR Controller แล้วครับ

## พฤติกรรมปัจจุบัน

ในกรอบ Preview:

- Mouse Wheel ขึ้น/ลง ใช้ Zoom In/Out
- Zoom อยู่ระหว่าง `1x–10x`
- Zoom ตามตำแหน่งเมาส์ เพื่อให้จุดที่เมาส์ชี้อยู่ใกล้ตำแหน่งเดิม
- เมื่อ Zoom มากกว่า `1x` สามารถคลิกซ้ายค้างแล้วลากเพื่อ Pan
- จำกัดระยะ Pan ไม่ให้ภาพหลุดกรอบ
- Scroll ในหน้าเว็บจะถูกป้องกันขณะ Wheel อยู่ใน Preview
- Transform ถูกส่งไปยัง OBS Screen ผ่าน `BroadcastChannel`
- มี Animation ตอน Zoom เพื่อให้การเปลี่ยนภาพนุ่มนวล

ไฟล์ที่เกี่ยวข้อง:

- [VarReplayV2Page.tsx](/D:/React_Scoreboard/src/components/var-replay-v2/VarReplayV2Page.tsx)
- [usePreviewScrollLock.ts](/D:/React_Scoreboard/src/components/var-replay-v2/usePreviewScrollLock.ts)
- [VarReplayV2.module.css](/D:/React_Scoreboard/src/components/var-replay-v2/VarReplayV2.module.css)

## จุดที่พบว่าน่าปรับปรุง

1. ระบบล็อก Scroll ตั้งแต่ Mouse เข้า Preview แม้ยังไม่ได้หมุน Wheel

```tsx
onMouseEnter={() => setIsPointerInside(true)}
```

จึงทำให้การเลื่อน Modal อาจถูกล็อกทันทีเมื่อเอาเมาส์ไปวางบน Preview

2. Mouse Wheel ทุกครั้งจะทำ Zoom ทันที

บน Trackpad อาจเกิด Zoom โดยไม่ตั้งใจ เนื่องจากไม่ได้กำหนดให้ต้องกด `Ctrl` หรือ `Alt` ร่วมด้วย

3. ทุก Wheel Event ส่ง Transform ไปยัง OBS ทันที

ถ้าใช้ Trackpad ที่ส่ง Event ถี่มาก อาจทำให้มีคำสั่งจำนวนมากผ่าน `BroadcastChannel`

4. ยังไม่ได้แยกสถานะ Zoom ของ Preview และ Screen อย่างอิสระ

ปัจจุบัน Control เป็นตัวส่ง Transform ไปยัง Screen ซึ่งถูกต้องสำหรับการควบคุม OBS แต่ควรมีการตรวจสอบ State ให้แน่ใจว่า Screen พร้อมรับคำสั่งแล้ว

## ข้อเสนอแนะ

ระบบปัจจุบันทำงานได้ถูกทิศทางแล้วครับ แต่ผมแนะนำให้ปรับต่อดังนี้:

- ล็อก Scroll เฉพาะตอนเกิด `wheel` บน Preview
- ใช้ `event.preventDefault()` เฉพาะเมื่อ Zoom มากกว่า 1 หรือกำลังจะ Zoom
- เพิ่มปุ่มหรือ Modifier Key สำหรับเปิด/ปิดโหมด Zoom
- จำกัดความถี่การส่ง Transform ด้วย `requestAnimationFrame`
- เพิ่ม Keyboard Shortcut เช่น `+`, `-`, `0`
- แสดงข้อความช่วยเหลือว่า `Scroll = Zoom`, `ลาก = Pan`
- รีเซ็ต Zoom/Pan เมื่อโหลดวิดีโอใหม่

โดยเฉพาะข้อแรกควรแก้ก่อน เพราะเป็นพฤติกรรมที่อาจทำให้ผู้ใช้รู้สึกว่า Modal เลื่อนไม่ได้เมื่อเมาส์อยู่เหนือ Preview ครับ

> ก่อนอื่นวางแผนแก้ไขตามข้อเสนอแนะ.

<details><summary>1 previous message</summary>

> ได้ครับ ผมจะจัดแผนแก้ระบบ Zoom/Pan เป็นลำดับ โดยเน้นไม่กระทบการควบคุม VAR Screen, Timeline, Marker และการ Scroll ของ Modal เดิม พร้อมกำหนด Acceptance Criteria สำหรับตรวจงานหลังพัฒนาเสร็จครับ
</details>

## แผนแก้ไขระบบ Zoom/Pan ของ VAR Controller

### Phase 1: กำหนดพฤติกรรมใหม่

คงพฤติกรรมหลักเดิมไว้:

- Mouse Wheel ภายในกรอบ Preview = Zoom In/Out
- Zoom ช่วง `1x–10x`
- Zoom ตามตำแหน่งเมาส์
- คลิกซ้ายลากเมื่อ Zoom มากกว่า `1x` = Pan
- จำกัด Pan ไม่ให้ภาพหลุดกรอบ
- ส่ง Transform ไปยัง OBS Screen

ปรับปรุงเพิ่มเติม:

- Mouse เข้า Preview จะไม่ล็อก Scroll ทันที
- ล็อก Scroll เฉพาะขณะเกิด Wheel Event ใน Preview
- Scroll บริเวณอื่นของ Modal ยังใช้งานได้ตามปกติ
- ไม่บังคับให้กด `Ctrl` หรือ `Alt` ร่วมกับ Wheel ในระยะแรก เพื่อรักษาพฤติกรรมเดิม

### Phase 2: แก้ Mouse Wheel และ Scroll Lock

ไฟล์ที่เกี่ยวข้อง:

- [VarReplayV2Page.tsx](/D:/React_Scoreboard/src/components/var-replay-v2/VarReplayV2Page.tsx)
- [usePreviewScrollLock.ts](/D:/React_Scoreboard/src/components/var-replay-v2/usePreviewScrollLock.ts)
- [VarReplayV2.module.css](/D:/React_Scoreboard/src/components/var-replay-v2/VarReplayV2.module.css)

แนวทาง:

- ยกเลิกการล็อก Scroll จาก `onMouseEnter`
- ใช้ `preventDefault()` เฉพาะ Wheel ที่เกิดใน Preview
- ปล่อยให้ Modal Scroll ได้เมื่อเมาส์อยู่นอก Preview
- คง `overscroll-behavior: contain`
- ตรวจสอบกรณีไม่มีวิดีโอหรือ Zoom อยู่ที่ `1x`

### Phase 3: ปรับ Performance การส่ง Transform

ปัจจุบันทุก Wheel Event ส่ง Transform ไป OBS ทันที

จะปรับเป็น:

- อัปเดต Preview ในเครื่องทันที
- รวมคำสั่ง Transform ด้วย `requestAnimationFrame`
- ส่งเฉพาะค่าล่าสุดต่อหนึ่ง Frame
- ยกเลิก Frame ที่ค้างเมื่อ Component ถูกถอด
- รับประกันว่าค่า Transform ล่าสุดถูกส่งครบ

ผลที่ต้องการ:

- ลดจำนวน Message ใน `BroadcastChannel`
- ลดอาการกระตุกเมื่อใช้ Trackpad
- ลดภาระการ Render ของ OBS Browser Source

### Phase 4: ปรับ UX ของ Zoom/Pan

เพิ่มหรือปรับปรุง:

- ข้อความช่วยเหลือ:

```text
Mouse Wheel: Zoom
คลิกซ้ายค้างแล้วลาก: Pan
```

- Keyboard Shortcut:

```text
+ หรือ =  Zoom In
-         Zoom Out
0         Reset Zoom/Pan
```

- Reset Zoom/Pan เมื่อโหลดวิดีโอใหม่
- ป้องกัน Shortcut ทำงานขณะพิมพ์ใน Input หรือ Search
- แสดงสถานะ Zoom ปัจจุบันให้ชัดเจน

### Phase 5: ตรวจสอบความถูกต้องของ Transform

ตรวจสอบกรณี:

- Zoom ต่ำกว่า `1x`
- Zoom สูงกว่า `10x`
- Pan ไปสุดขอบ
- Zoom Out กลับมาที่ `1x`
- Zoom บริเวณมุมและขอบของวิดีโอ
- เปลี่ยน Zoom ด้วย Slider
- เปลี่ยน Zoom ด้วย Mouse Wheel
- Reset ขณะกำลัง Pan
- Control และ OBS Screen มี Transform ตรงกัน

### Phase 6: ทดสอบ Regression

ทดสอบว่าฟังก์ชันเดิมยังทำงานได้:

- โหลดวิดีโอ
- Play/Pause
- Timeline Seek
- Marker A/B
- Loop
- Speed Control
- เปิด VAR Screen
- ส่งไฟล์ผ่าน BroadcastChannel
- Scroll ใน Modal
- เปิด VAR จากหน้า Scoreboard
- ปิด Modal และคืน Scroll ของหน้าเว็บ

คำสั่งตรวจสอบ:

```bash
npm test
npm run lint
npx tsc -b
npm run build
```

## Acceptance Criteria

ถือว่างานผ่านเมื่อ:

1. Mouse Wheel ใน Preview สามารถ Zoom ได้
2. Mouse เข้า Preview เฉย ๆ ไม่ทำให้ Modal Scroll ถูกล็อก
3. Scroll นอก Preview ยังเลื่อน Modal ได้
4. Zoom ตามตำแหน่งเมาส์ได้ถูกต้อง
5. Pan ได้เฉพาะตอน Zoom มากกว่า `1x`
6. ภาพไม่หลุดกรอบ
7. Trackpad ไม่ทำให้ระบบกระตุกมากเกินไป
8. OBS Screen ได้รับ Transform ล่าสุดครบถ้วน
9. ปุ่ม Reset และ Keyboard Shortcut ทำงานถูกต้อง
10. ระบบ Marker, Loop, Speed และ Timeline ไม่ได้รับผลกระทบ

แนะนำให้เริ่มจาก Phase 2 และ Phase 3 ก่อน เพราะเป็นจุดที่ส่งผลโดยตรงต่อปัญหา Scroll และความลื่นไหลของระบบครับ

> เริ่มพัฒนาตามแผนเลยครับ.

<details><summary>10 previous messages</summary>

> เริ่มพัฒนาแล้วครับ รอบนี้ผมจะทำตามลำดับที่วางไว้ โดยแก้ 3 ส่วนหลักก่อน: เอา Scroll Lock ออกจากการ Hover, ทำให้การส่ง Transform ไป OBS ผ่าน `requestAnimationFrame` เพื่อลด Message ถี่เกินไป และเพิ่ม Keyboard Shortcut/ข้อความช่วยเหลือสำหรับ Zoom โดยจะคงโครงสร้าง `VarReplayV2Page.tsx` เดิมไว้ครับ
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+3 -7)
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+32 -3)
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+17 -1)
>
> </details>
>
> ส่วนแก้ไขหลักเสร็จแล้วครับ: ตอนนี้การเลื่อนเมาส์บน Preview จะถูกจัดการเฉพาะในกรอบวิดีโอ ไม่ล็อก Scroll ตั้งแต่ Hover และการส่ง Transform ถูกลดความถี่ด้วย `requestAnimationFrame` ส่วนถัดไปผมกำลังตรวจ Hook dependency, TypeScript และพฤติกรรม Shortcut เพื่อป้องกัน Regression ครับ
>
> Context compaction
>
> Source: automatic
> Status: completed
>
> ผมตรวจ diff และ build type แล้วไม่พบปัญหา ตอนนี้กำลังเก็บกรณี race condition เพิ่มเติม: ถ้าโหลดไฟล์ใหม่ขณะมีคำสั่ง Transform ค้างอยู่ จะยกเลิกคำสั่งเก่าก่อน เพื่อไม่ให้ไฟล์ใหม่ถูกซูม/แพนด้วยค่าเดิมโดยไม่ตั้งใจ จากนั้นจะรันชุดทดสอบเต็มครับ
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+6 -2)
>
> </details>
>
> คำสั่งตรวจสอบรอบแรกสะดุดจากการส่ง option ซ้ำ (`npm test -- --run` ทำให้ script ที่มี `vitest --run` อยู่แล้วกลายเป็น `--run --run`) ไม่ใช่ปัญหาจากโค้ด ผมจะรัน `npm test` ตรง ๆ พร้อมตรวจ lint, typecheck และ production build ใหม่ครับ
>
> การตรวจสอบเต็มผ่านแล้ว: test 113/113, lint, typecheck และ production build สำเร็จทั้งหมด โดย build มีเพียงคำเตือนเดิมเรื่อง bundle บางไฟล์ใหญ่กว่า 500 kB ซึ่งไม่เกี่ยวกับการแก้ Zoom/Pan รอบนี้
>
> ผมจะตรวจหน้าจอจริงใน local browser เพิ่มอีกหนึ่งรอบ เพื่อยืนยันว่า Preview รับ wheel เฉพาะภายในกรอบ และ hint/ปุ่ม Reset ยังแสดงถูกต้องครับ】【。
>
> <details><summary>Called 3 tools</summary>
>
> MCP tool call
>
> node_repl.js
>
> ```json
> {
>   "title": "เชื่อมต่อหน้าจอ local สำหรับตรวจสอบ UI",
>   "code": "if (globalThis.agent?.browsers == null) {\n  const { setupBrowserRuntime } = await import(\"C:/Users/User/.codex/plugins/cache/openai-bundled/browser/26.707.31428/scripts/browser-client.mjs\");\n  await setupBrowserRuntime({ globals: globalThis });\n}\nif (globalThis.browser == null) {\n  globalThis.browser = await agent.browsers.getDefault();\n  nodeRepl.write(await browser.documentation());\n}"
> }
> ```
>
> ```text
> No browser is available
> ```
>
> MCP tool call
>
> node_repl.js
>
> ```json
> {
>   "title": "ตรวจสอบการเชื่อมต่อหน้าจอ local",
>   "code": "nodeRepl.write(await agent.documentation.get(\"bootstrap-troubleshooting\"));"
> }
> ```
>
> ```text
> # Browser Runtime Troubleshooting
>
> - If browser setup completed but discovery or selection fails, reuse the existing `agent`; do not reset the JavaScript session or import another browser runtime.
> - Inspect `await agent.browsers.list()` once to see which browser types are available. Do not assume that a missing requested browser can be replaced with another backend when the user explicitly named it.
> - If a requested backend has specific troubleshooting documentation in the skill's setup catalog, read it before retrying.
> - If the requested browser remains unavailable, report that plainly instead of controlling it through an unrelated browser tool or source-code workaround.
> ```
>
> MCP tool call
>
> node_repl.js
>
> ```json
> {
>   "title": "ตรวจสอบ browser ที่พร้อมใช้งาน",
>   "code": "nodeRepl.write(await agent.browsers.list());"
> }
> ```
>
> ```text
> []
> ```
>
> </details>
>
> local browser ไม่มี session/instance ให้เชื่อมต่อในสภาพแวดล้อมนี้ (รายการ browser ว่าง) จึงตรวจ interaction จริงผ่านหน้าจอไม่ได้ แต่การตรวจ static, typecheck, test และ build ผ่านครบแล้ว ผมกำลังสรุป diff และสถานะไฟล์ให้เรียบร้อยครับ
</details>

พัฒนาตามแผนเสร็จแล้วครับ โดยแก้ใน [VarReplayV2Page.tsx](./src/components/var-replay-v2/VarReplayV2Page.tsx)

สิ่งที่เพิ่ม/ปรับปรุง:

- Mouse Wheel ภายในกรอบ Video Preview ใช้ Zoom ได้โดยตรง
- ป้องกันไม่ให้หน้าเว็บเลื่อนเมื่อกำลัง Zoom ใน Preview
- คงการ Zoom ตามตำแหน่ง Pointer และ Pan ด้วยการคลิกซ้ายลาก
- ลดจำนวนคำสั่ง Transform ที่ส่งไปยัง Screen ด้วย `requestAnimationFrame`
- ยกเลิก Transform ที่ค้างก่อนโหลดวิดีโอใหม่ ป้องกัน state เก่าถูกนำไปใช้
- เพิ่ม Keyboard Shortcut:
  - `+` / `=` เพิ่ม Zoom
  - `-` ลด Zoom
  - `0` Reset Zoom และตำแหน่ง
- เพิ่มคำแนะนำการควบคุมบน Preview

ผลการตรวจสอบ:

- Tests: 113 ผ่าน
- Lint: ผ่าน
- TypeScript: ผ่าน
- Production Build: ผ่าน
- `git diff --check`: ผ่าน

หมายเหตุ: ไม่สามารถตรวจผ่าน Browser จริงได้ เนื่องจากไม่มี browser session ในสภาพแวดล้อมนี้ แต่ระบบผ่านการตรวจสอบทางโค้ดและ build ครบแล้วครับ

> - / = เพิ่ม Zoom
> - ลด Zoom
>
> ให้ +/- ทีละ 0.1 หรือ ให้มัน Ultra smooth มากที่สุด

<details><summary>3 previous messages</summary>

> รับทราบครับ ผมจะปรับเฉพาะ Keyboard Zoom ให้ `+ / =` และ `-` เปลี่ยนทีละ `0.1` พร้อมทำให้การเปลี่ยนค่าใช้ transition ที่นุ่มขึ้น โดยยังคงขอบเขต Zoom และการ Pan เดิมไว้ จากนั้นจะรัน test/typecheck/build ตรวจสอบอีกครั้งครับ
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+3 -2)
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+2 -1)
>
> </details>
>
> ปรับเรียบร้อยครับ ตอนนี้แต่ละการกดเปลี่ยน Zoom ทีละ `0.1x` และมีการปัดทศนิยม 1 ตำแหน่งเพื่อป้องกันค่าลอย เช่น `1.200000x` จากการกดซ้ำ ส่วน transition เดิมแบบ cubic-bezier และการส่งคำสั่งผ่าน animation frame ยังคงทำให้การเปลี่ยนแปลงนุ่มต่อเนื่องอยู่ครับ ตรวจ test/lint/typecheck ผ่านแล้ว เหลือ production build รอบสุดท้ายครับ
</details>

ปรับเรียบร้อยครับใน [VarReplayV2Page.tsx](./src/components/var-replay-v2/VarReplayV2Page.tsx:23)

- `+ / =` เพิ่ม Zoom ทีละ `0.1x`
- `-` ลด Zoom ทีละ `0.1x`
- ปัดค่าเหลือทศนิยม 1 ตำแหน่ง ป้องกันค่าเพี้ยนจาก Floating Point
- คง Transition แบบ Smooth เดิมไว้ทั้ง Preview และ Screen
- รองรับการกดค้างเพื่อปรับ Zoom ต่อเนื่อง

ตรวจสอบแล้ว:

- Tests 113/113 ผ่าน
- Lint ผ่าน
- TypeScript ผ่าน
- Production Build ผ่าน

หมายเหตุ: Build ยังมีคำเตือนเดิมเรื่อง bundle ขนาดใหญ่กว่า 500 kB แต่ไม่เกี่ยวข้องกับการแก้ไข Zoom ครับ

> เก่งมากครับ

ขอบคุณครับ 😊 พร้อมช่วยพัฒนาส่วนถัดไปต่อได้เลยครับ

> ผมอยากให้ user สามารถตั้งปุ่มเองได้โดยไม่ใช่ hard set เช่นการเล่น ตั้งจุด หรือ loop หรือ หยุด
> วางแผนให้หน่อย.

<details><summary>1 previous message</summary>

> ได้ครับ ผมจะตรวจโครงสร้าง Control ปัจจุบันก่อน เพื่อวางแผนระบบกำหนดปุ่มที่เข้ากับสถาปัตยกรรมเดิม โดยเน้นไม่ให้ shortcut เดิมชนกับ input และสามารถขยายไปตั้งปุ่มสำหรับ Play, Pause/Stop, Set A/B, Loop และ Reset ได้ครับ
</details>

ได้ครับ แนะนำทำเป็นระบบ **Custom Keyboard Shortcuts** สำหรับ VAR Replay โดยไม่ต้องแยกไฟล์ `Control/Screen` ทั้งชุด เพียงแยกเฉพาะโครงสร้างข้อมูลและ Utility ขนาดเล็กเพื่อให้ดูแลรักษาง่าย

ปัจจุบัน Shortcut ยังถูกกำหนดแบบ Hard-code อยู่ใน [VarReplayV2Page.tsx](./src/components/var-replay-v2/VarReplayV2Page.tsx:752) เช่น `Space`, `A`, `B`, `R`, `L`, `+/-`, `0`

## แผนการพัฒนา

### 1. กำหนด Action ที่รองรับ

ค่าเริ่มต้นที่เสนอ:

| Action | ค่าเริ่มต้น |
|---|---|
| เล่น / หยุดชั่วคราว | `Space` |
| หยุดและกลับต้นคลิป | `S` |
| ตั้งจุด A | `A` |
| ตั้งจุด B | `B` |
| เปิด/ปิด Loop | `L` |
| ล้างจุด A/B | `R` |
| เพิ่ม Zoom | `+` หรือ `=` |
| ลด Zoom | `-` |
| Reset Zoom/Pan | `0` |

สำหรับคำว่า “หยุด” ผมแนะนำให้หมายถึง:

- Pause วิดีโอ
- Seek กลับไปเวลา `0`
- ปิดสถานะ Loop ชั่วคราวตามพฤติกรรมที่กำหนด

ส่วน `Space` จะยังคงเป็น Play/Pause แบบ Toggle

### 2. สร้างโครงสร้าง Key Binding

สร้างโมเดลกลาง เช่น:

```ts
type ReplayShortcutAction =
  | 'playPause'
  | 'stop'
  | 'setMarkerA'
  | 'setMarkerB'
  | 'toggleLoop'
  | 'clearMarkers'
  | 'zoomIn'
  | 'zoomOut'
  | 'resetTransform';

type ReplayKeyBinding = {
  action: ReplayShortcutAction;
  code: string;
  label: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};
```

ข้อดีคือในอนาคตสามารถรองรับ `Ctrl`, `Shift`, `Alt` หรือปุ่ม Function Key ได้

### 3. เพิ่ม UI สำหรับตั้งค่าปุ่ม

เพิ่มปุ่ม `ตั้งค่าปุ่มลัด` ในหน้า VAR Replay Control

ภายในหน้าต่างตั้งค่าให้มี:

- รายการ Action ทั้งหมด
- ปุ่มปัจจุบันของแต่ละ Action
- ปุ่ม `กดปุ่มเพื่อกำหนด`
- ปุ่มล้าง Binding
- ปุ่มรีเซ็ตค่าเริ่มต้น
- แจ้งเตือนเมื่อใช้ปุ่มซ้ำกัน

พฤติกรรมตอนกำหนดปุ่ม:

- คลิก `กำหนดปุ่ม`
- ระบบแสดงข้อความ `กรุณากดปุ่ม...`
- กดปุ่มที่ต้องการ
- กด `Escape` เพื่อยกเลิก
- ตรวจสอบปุ่มซ้ำก่อนบันทึก
- ไม่อนุญาตให้ Shortcut ทำงานขณะกำลังพิมพ์ใน Input หรือ Textarea

### 4. เปลี่ยนจาก Hard-coded เป็น Action Dispatcher

ปัจจุบันปุ่มบนหน้าจอและ Keyboard Handler เรียก Logic แยกกัน

แผนใหม่คือรวมคำสั่งไว้ที่ Dispatcher เดียว เช่น:

```ts
executeReplayAction('playPause');
executeReplayAction('setMarkerA');
executeReplayAction('toggleLoop');
```

ทั้งการคลิกปุ่มและการกด Keyboard จะเรียกผ่านชุดคำสั่งเดียวกัน ทำให้:

- ลด Logic ซ้ำ
- ป้องกันปุ่มบน UI กับ Shortcut ทำงานไม่เหมือนกัน
- เพิ่ม Action ใหม่ได้ง่าย
- ทดสอบง่ายขึ้น

### 5. บันทึกค่าที่ผู้ใช้ตั้งเอง

เก็บค่าไว้ใน `localStorage` เช่น:

```text
var-replay-v2-keybindings:v1
```

เมื่อเปิดหน้าใหม่:

1. โหลดค่าที่ผู้ใช้เคยบันทึก
2. ตรวจสอบรูปแบบข้อมูล
3. ถ้าข้อมูลเสียหาย ให้ใช้ค่าเริ่มต้น
4. รองรับ Version เผื่อเปลี่ยนโครงสร้างในอนาคต

ในระยะแรกจะเก็บเฉพาะเครื่องและ Browser นั้นก่อน ซึ่งเหมาะกับระบบ Control ที่ใช้งานบนเครื่องควบคุมโดยตรง

### 6. ป้องกันปัญหา Shortcut ชนกัน

ระบบจะป้องกันกรณี:

- ปุ่มเดียวถูกผูกกับหลาย Action
- Shortcut ทำงานขณะพิมพ์ข้อความ
- `Space` ทำให้หน้าเว็บเลื่อน
- `Escape` ชนกับการปิด Modal
- `Ctrl+C`, `Ctrl+V`, `Ctrl+W` ถูก Override โดยไม่ตั้งใจ
- ปุ่มที่ Browser ใช้งานอยู่ถูกดักโดยไม่ได้ตั้งใจ

### 7. การทดสอบ

จะเพิ่มการทดสอบสำหรับ:

- โหลดค่าเริ่มต้น
- บันทึกและโหลดค่าจาก `localStorage`
- ตรวจจับปุ่มซ้ำ
- รีเซ็ตค่าเริ่มต้น
- Keyboard Event เรียก Action ถูกต้อง
- Shortcut ไม่ทำงานใน Input/Textarea
- Play, Stop, Marker, Loop ทำงานเหมือนการกดปุ่มบน UI
- ปุ่ม Zoom ยังคงปรับทีละ `0.1x`

## ผลลัพธ์ที่คาดหวัง

ผู้ใช้จะสามารถเข้าเมนูตั้งค่าปุ่ม แล้วกำหนดปุ่มเองได้ เช่น:

- ใช้ `F1` สำหรับ Play
- ใช้ `F2` สำหรับ Stop
- ใช้ `Q` / `W` สำหรับ Marker A/B
- ใช้ `E` สำหรับ Loop
- ใช้ปุ่ม Numpad สำหรับควบคุม Replay

โครงสร้างหลักของหน้า Control/Screen จะยังอยู่เหมือนเดิม แต่ Logic Shortcut จะเป็นระบบกลางที่ขยายต่อได้ง่ายและไม่ผูกติดกับปุ่มแบบ Hard-code ครับ

> พัฒนาตามแผนการที่ตั้งไว้เลย.

<details><summary>5 previous messages</summary>

> ผมจะเริ่มพัฒนาระบบปุ่มลัดตามแผน โดยแบ่งเป็น 3 ส่วนหลัก: โมเดล/การบันทึก Key Binding, UI สำหรับตั้งค่าปุ่ม และเปลี่ยน Handler ให้เรียก Action กลาง จากนั้นจะเพิ่มการทดสอบและตรวจ build ครับ โดยจะคงโครงสร้าง Control/Screen เดิมไว้ ไม่แยกหน้าใหญ่ทั้งไฟล์ครับ
>
> <details><summary>Created 2 files, edited 2 files</summary>
>
> - Wrote `./src/components/var-replay-v2/varReplayKeybindings.ts` (+211 -0)
> - Wrote `./src/components/var-replay-v2/ReplayShortcutSettings.tsx` (+110 -0)
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+7 -0)
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+12 -5)
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+1 -0)
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+11 -0)
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+54 -23)
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+15 -4)
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+13 -1)
> - Wrote `./src/components/var-replay-v2/VarReplayV2.module.css` (+20 -1)
>
> </details>
>
> โครงสร้างหลักเริ่มเสร็จแล้วครับ: เพิ่มระบบจัดเก็บ Binding แบบ versioned ใน `localStorage`, เพิ่มแผงตั้งค่าปุ่มลัดแบบเปิด/ปิดได้, เพิ่มการตรวจปุ่มซ้ำ และเปลี่ยน Keyboard Handler ให้ทำงานผ่าน Action กลาง ตอนนี้กำลังตรวจ TypeScript/Lint เพื่อเก็บปัญหาจากการเชื่อม component และปรับรายละเอียดที่พบครับ
>
> <details><summary>Created a file</summary>
>
> - Wrote `./src/components/var-replay-v2/varReplayKeybindings.test.ts` (+66 -0)
>
> </details>
>
> ระบบใช้งานได้ทางโค้ดและการทดสอบแล้วครับ ตอนนี้มี Action ใหม่ `หยุดและกลับต้นคลิป` พร้อมปุ่มบน UI และ Shortcut ที่ปรับเองได้ ส่วนปุ่มลูกศรซ้าย/ขวาสำหรับเลื่อน Timeline เดิมยังคงทำงานอยู่ หากผู้ใช้ไม่ได้ผูกปุ่มนั้นไปใช้กับ Action อื่น ตอนนี้กำลังรัน production build และตรวจ diff รอบสุดท้ายครับ
</details>

พัฒนาระบบ Custom Keyboard Shortcuts เสร็จแล้วครับ

สิ่งที่เพิ่ม:

- เพิ่มเมนู `ตั้งค่าปุ่มลัด Keyboard` ใต้ Quick Actions
- User สามารถกำหนดปุ่มเองสำหรับ:
  - เล่น / หยุดชั่วคราว
  - หยุดและกลับต้นคลิป
  - ตั้งจุด A/B
  - เปิด/ปิด Loop
  - ล้างจุด A/B
  - Zoom In/Out
  - Reset Zoom/Pan
- ตรวจสอบปุ่มซ้ำอัตโนมัติ
- กด `Escape` เพื่อยกเลิกการตั้งปุ่ม
- กด `Delete` หรือ `Backspace` เพื่อล้างปุ่ม
- ปุ่มลัดถูกบันทึกใน `localStorage` และโหลดกลับมาอัตโนมัติ
- ป้องกัน Shortcut ทำงานขณะพิมพ์ใน Input/Textarea
- ปุ่มบน UI จะแสดง Shortcut ล่าสุดที่ User ตั้งไว้
- ปุ่มลูกศรซ้าย/ขวาสำหรับเลื่อน Timeline เดิมยังทำงานตามปกติ
- เพิ่มปุ่ม `หยุด` ซึ่งจะ Pause, กลับไปต้นคลิป และปิด Loop

ไฟล์หลักที่เพิ่ม:

- [ReplayShortcutSettings.tsx](./src/components/var-replay-v2/ReplayShortcutSettings.tsx)
- [varReplayKeybindings.ts](./src/components/var-replay-v2/varReplayKeybindings.ts)
- [varReplayKeybindings.test.ts](./src/components/var-replay-v2/varReplayKeybindings.test.ts)

ไฟล์ที่เชื่อมระบบ:

- [VarReplayV2Page.tsx](./src/components/var-replay-v2/VarReplayV2Page.tsx:777)
- [VarReplayV2.module.css](./src/components/var-replay-v2/VarReplayV2.module.css:166)

ผลการตรวจสอบ:

- Tests: 15 ไฟล์ ผ่านทั้งหมด 117 Tests
- Lint: ผ่าน
- TypeScript: ผ่าน
- Production Build: ผ่าน
- `git diff --check`: ผ่าน

วิธีใช้งานคือเปิดส่วน `ตั้งค่าปุ่มลัด Keyboard` แล้วกด `กำหนดปุ่ม` ใน Action ที่ต้องการ จากนั้นกดปุ่มบน Keyboard ได้เลยครับ

> ก่อนปิด การพัฒนารอบนี้.
> ให้ทำการตรวจเช็คบัคก่อน.

<details><summary>4 previous messages</summary>

> ผมจะตรวจรอบปิดงานแบบ regression audit ครับ: ตรวจเส้นทาง Shortcut/ปุ่ม UI, การบันทึก `localStorage`, การชนกับ Input และปุ่มเดิม, รวมถึงรัน test, lint, typecheck และ production build โดยจะไม่เปลี่ยนโค้ดจนกว่าจะพบปัญหาที่มีหลักฐานชัดเจนครับ
>
> พบจุดเสี่ยงจากการตรวจโค้ด 2 เรื่องที่ควรแก้ก่อนปิดงาน:
>
> 1. ถ้าโฟกัสอยู่บนปุ่ม UI แล้วกด Shortcut เดียวกัน อาจถูกมองเป็นการกดปุ่มซ้ำหรือไม่ทำงานผ่าน Global Handler
> 2. การกดปุ่มค้าง เช่น `Space`, `L` หรือ `A` อาจยิงคำสั่งซ้ำจาก `event.repeat`
>
> ผมจะปรับให้ปุ่มลัดทำงานได้สม่ำเสมอเมื่อโฟกัสอยู่บนปุ่ม และให้เฉพาะ Zoom เท่านั้นที่รองรับการกดค้างต่อเนื่องครับ
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+4 -1)
>
> </details>
>
> แก้จุดเสี่ยงทั้งสองรายการแล้ว และตรวจซ้ำผ่านครบครับ ตอนนี้ Shortcut ปรับเองยังทำงานได้แม้โฟกัสอยู่บนปุ่ม UI และ Action ที่ไม่ใช่ Zoom จะไม่ทำงานซ้ำจากการกดค้าง ส่วน Zoom ยังคงกดค้างเพื่อปรับต่อเนื่องได้ ผมกำลังสรุปผลตรวจและข้อสังเกตที่ไม่ใช่บัคให้ครับ
</details>

ตรวจเช็คและแก้บัคก่อนปิดรอบนี้เรียบร้อยครับ

จุดที่พบและแก้ไข:

- ปุ่มลัดทำงานได้แม้โฟกัสอยู่บนปุ่ม UI
- ป้องกัน `Space`, `A`, `B`, `L` และ Action อื่น ๆ ทำงานซ้ำจากการกดค้าง
- ยกเว้น Zoom In/Out ที่ยังรองรับการกดค้างเพื่อปรับต่อเนื่อง
- ยังคงป้องกัน Shortcut ทำงานใน Input, Textarea และ Select
- ตรวจสอบการชนกันของปุ่มลัดและการบันทึก `localStorage`

ผลการตรวจสอบ:

- Tests: 15 ไฟล์ / 117 Tests ผ่านทั้งหมด
- Lint: ผ่าน
- TypeScript: ผ่าน
- Production Build: ผ่าน
- `git diff --check`: ผ่าน

จุดที่เกี่ยวข้อง:

- [Keyboard Handler](./src/components/var-replay-v2/VarReplayV2Page.tsx:815)
- [Shortcut Matching](./src/components/var-replay-v2/varReplayKeybindings.ts:181)
- [Shortcut Settings](./src/components/var-replay-v2/ReplayShortcutSettings.tsx)

หมายเหตุ: Build ยังแสดงคำเตือนเดิมเรื่อง bundle บางไฟล์ใหญ่กว่า 500 kB แต่ไม่ใช่บัคการทำงานของระบบครับ.

> โอเครครับ ผมจะพัฒนาระบบอื่นต่อ.

ได้ครับ ระบบรอบนี้ตรวจสอบและปิดงานเรียบร้อยแล้ว พร้อมพัฒนาระบบส่วนถัดไปต่อได้เลยครับ

> ตอนนี้การเชื่อมต่อ project กับ obs เชื่อมต่อกันด้วยวิธีใด.

<details><summary>1 previous message</summary>

> ผมจะตรวจโค้ดส่วน OBS โดยตรง เพื่อระบุให้ชัดว่าการเชื่อมต่อใช้ Protocol/Library ใด, ตั้งค่า URL/Port จากที่ไหน และมีโมดูลใดเป็นจุดเริ่มต้นของการเชื่อมต่อครับ
</details>

ตรวจเช็คบัคก่อนปิดงานเรียบร้อยครับ

สิ่งที่ตรวจสอบ:

- ระบบ Custom Keyboard Shortcut
- การตรวจปุ่มซ้ำ
- การบันทึก/โหลดค่าจาก `localStorage`
- การชนกับ Input และ Select
- การกดปุ่มค้าง
- การทำงานของ Zoom, Play/Pause, Stop, Marker และ Loop
- Regression ของระบบ Replay เดิม

ผลลัพธ์:

- พบจุดเสี่ยง 2 รายการและแก้ไขแล้ว
  - Shortcut ทำงานไม่สม่ำเสมอเมื่อโฟกัสอยู่บนปุ่ม
  - Action บางตัวทำงานซ้ำเมื่อกดปุ่มค้าง
- Tests: 15 ไฟล์ / 117 Tests ผ่าน
- Lint: ผ่าน
- TypeScript: ผ่าน
- Production Build: ผ่าน
- `git diff --check`: ผ่าน

ไม่พบปัญหาการทำงานเพิ่มเติมจากการตรวจสอบอัตโนมัติและ Static Code Review ครับ

มีเพียงคำเตือนเดิมจาก Vite เรื่อง Bundle ขนาดใหญ่กว่า 500 kB ซึ่งไม่ใช่บัคของระบบครับ

> ตอนนี้การเชื่อมต่อ project กับ obs เชื่อมต่อกันด้วยวิธีใด.

<details><summary>1 previous message</summary>

> ผมจะตรวจโมดูลเชื่อมต่อ OBS และจุดที่เรียกใช้งานจริงอีกครั้ง เพื่อสรุปให้ตรงกับโค้ดปัจจุบัน ทั้ง Library, Protocol, ค่า Port/Password และทิศทางการสื่อสารระหว่าง Project กับ OBS ครับ
</details>

ปัจจุบัน Project เชื่อมต่อกับ OBS ผ่าน **OBS WebSocket 5.x** ครับ

รายละเอียดหลัก:

- Library: [`obs-websocket-js` v5.0.8](./package.json:18)
- Protocol: WebSocket
- URL เริ่มต้น: `ws://localhost:4455`
- จุดเชื่อมต่อหลัก: [useOBSWebSocket.ts](./src/hooks/useOBSWebSocket.ts)
- Controller เรียกเชื่อมต่อผ่าน [useScoreboardObsConnection.ts](./src/hooks/useScoreboardObsConnection.ts:29)
- OBS ต้องเปิด WebSocket Server ที่:
  - OBS → Tools
  - WebSocket Server Settings
  - Port `4455`

การสื่อสารหลักคือ:

```text
React Project
    ↓ WebSocket ws://localhost:4455
OBS WebSocket Server
```

Project สามารถส่งคำสั่งไปยัง OBS เช่น:

- `SetInputSettings` แก้ข้อความ/รูปภาพ/สี
- `CreateInput` สร้าง Source
- `GetSceneList` อ่าน Scene
- `GetSceneItemId` อ่าน Source ใน Scene
- `SetSceneItemEnabled` แสดง/ซ่อน Source
- `CreateSceneItem` เพิ่ม Source เข้า Scene

นอกจากนี้ยังรับ Event จาก OBS เช่น:

- Replay Buffer บันทึกไฟล์สำเร็จ
- เปลี่ยน Scene
- กด Hotkey ใน OBS ผ่าน `CustomEvent`
- สถานะการบันทึก/Streaming
- การเชื่อมต่อถูกปิด

ระบบมีการจัดการ Connection เพิ่มเติม:

- ลองเชื่อมต่อสูงสุด 3 ครั้ง
- เชื่อมต่อใหม่อัตโนมัติหลังหลุดประมาณ 1.5 วินาที
- ป้องกันการสร้าง WebSocket ซ้ำจาก React Strict Mode
- ถอด Listener และปิด Connection อย่างถูกต้องตอน Component ถูกทำลาย

เรื่อง Password: ตัว Hook รองรับ Password แต่จุดเชื่อมต่อปัจจุบันเรียกใช้เพียง:

```ts
obs.connect('ws://localhost:4455')
```

ดังนั้นตอนนี้ระบบคาดว่า OBS WebSocket ไม่ได้ตั้ง Password ไว้ หาก OBS เปิด Password authentication อยู่ ต้องเพิ่มการส่ง Password ในส่วนนี้ครับ

อีกส่วนหนึ่งคือ OBS ใช้ **Browser Source** โหลดหน้าจอจาก Project เช่น `/overlay`, `/goal-animation` และ `/var-replay-v2/screen` โดย Browser Source เป็นการโหลดหน้าเว็บผ่าน HTTP แยกจาก WebSocket ส่วนการส่งข้อมูลระหว่าง Control กับ Screen ของ Replay ใช้ `BroadcastChannel` ภายใน Browser ไม่ได้ส่ง Video ผ่าน OBS WebSocket โดยตรงครับ

> ตอนนี้ให้เครียทุกเรื่องเลยครับ ผมจะพัฒนา feture อื่นแล้ว

ได้ครับ ผมจะถือว่าปิดงานส่วน OBS และ Replay/Shortcut ทั้งหมดไว้ก่อน และพร้อมเริ่มพัฒนา Feature ใหม่ครับ.

> การเชื่อมต่อ OBS กับ Project React ตอนนี้.
> ผมเปิดโดยใช้ Custom browser docks ใน OBS.
> ถ้าผมจะให้ เปิดจาก google chrome จากภายนอกด้วย จะได้ไหม.

ได้ครับ แต่มีข้อจำกัดตามโครงสร้างปัจจุบัน

การเปิด Project จาก Google Chrome ภายนอกทำได้ เช่น:

```text
http://localhost:5173/React_Scoreboard/
```

หรือ Production URL ของ Project เช่น:

```text
https://your-domain.com/React_Scoreboard/
```

Chrome จะเชื่อมต่อ OBS ผ่าน:

```text
ws://localhost:4455
```

ดังนั้นกรณีนี้จะทำงานได้:

```text
Google Chrome
    ↓ OBS WebSocket
OBS Studio
```

สิ่งที่ต้องเตรียม:

- OBS เปิด WebSocket Server
- Port `4455`
- Chrome และ OBS อยู่เครื่องเดียวกัน
- ถ้าใช้ HTTPS ต้องเปลี่ยนเป็น `wss://` หรือใช้ HTTP ภายในเครื่อง เพราะ Browser อาจบล็อก `https → ws`

ข้อจำกัดสำคัญของระบบปัจจุบัน:

- `localStorage` ของ Chrome กับ Custom Browser Dock ไม่เหมือนกัน
- Playlist, Shortcut และค่าบางอย่างจะไม่แชร์กัน
- ระบบ `BroadcastChannel` เช่น Replay Control → Replay Screen และ Goal Animation อาจไม่สื่อสารข้าม Chrome กับ OBS Browser Dock เพราะอยู่คนละ Browser Context
- หากเปิด Control ใน Chrome แต่ให้ Screen อยู่ใน OBS Dock การส่งข้อมูลบาง Feature อาจไม่ถึงกัน

สรุป:

- ใช้ Chrome ควบคุม OBS โดยตรง: ได้
- ใช้ Chrome แทน OBS Custom Dock ทั้งหมด: ได้บางส่วน
- ใช้ Chrome เป็น Control และ OBS Dock เป็น Screen/Overlay แบบครบทุก Feature: ควรปรับระบบสื่อสารจาก `BroadcastChannel` เป็น WebSocket/Network Channel กลางเพิ่มเติมครับ

> โอเครงั้นไม่ทำละ.

ได้ครับ งดการเปลี่ยนแปลงส่วนนี้ไว้ตามเดิมครับ.

> แล้วถ้าเปิดหน้าเว็ปพร้อมกัน ทั้งใน obs docks และ เปิดใน google chrome.
> โปรแกรมจะมีปัญหาไหม.

ถ้าเปิดหน้าเว็บเดียวกันพร้อมกันทั้งใน OBS Custom Dock และ Google Chrome ระบบมีโอกาสเกิดปัญหาครับ โดยเฉพาะถ้าเปิดหน้า **Scoreboard Control** ทั้งสองที่

สาเหตุคือแต่ละหน้า React จะ:

- สร้าง OBS WebSocket Connection ของตัวเอง
- รับ Event จาก OBS พร้อมกัน
- ประมวลผล Hotkey หรือคำสั่งเดียวกันซ้ำ
- มี State ของตัวเอง ทำให้ข้อมูลอาจไม่ตรงกัน
- คำสั่งที่ส่งไป OBS อาจเกิดการส่งซ้ำ หรือคำสั่งจากหน้าหนึ่งเขียนทับอีกหน้าหนึ่ง

จุดที่เกี่ยวข้องคือ [useOBSWebSocket.ts](./src/hooks/useOBSWebSocket.ts) และ [useScoreboardObsConnection.ts](./src/hooks/useScoreboardObsConnection.ts)

ตัวอย่างปัญหาที่อาจเกิด:

```text
กด Hotkey เพิ่มคะแนน 1 ครั้ง
→ OBS ส่ง CustomEvent ไปยังทั้ง 2 หน้า
→ ทั้ง 2 หน้าเพิ่มคะแนน
→ คะแนนอาจเพิ่มเป็น 2
```

รูปแบบที่ปลอดภัย:

- เปิด **Scoreboard Control เพียงที่เดียว**
- ใช้ OBS Dock เป็น Control หลัก
- เปิด Google Chrome เป็นหน้า Monitor หรือหน้า Screen/Overlay เท่านั้น
- หลีกเลี่ยงการเปิด Control หน้าเดียวกัน 2 Instance พร้อมกัน

หากเปิด Chrome เป็นหน้า `/overlay`, `/goal-animation` หรือหน้า Screen โดยไม่ได้ทำหน้าที่เป็น Controller หลัก โดยทั่วไปจะไม่กระทบการเชื่อมต่อ OBS ครับ

สรุป: เปิดเว็บพร้อมกันได้ แต่ไม่ควรเปิดหน้า Control ที่ควบคุม OBS ซ้ำสองที่พร้อมกันครับ

> ตอนนี้คุณสวมบทบาทอะไรอยู่

ตอนนี้ผมสวมบทบาทเป็น **Principal Software Architect และ Senior Full-Stack Engineer** ครับ

หน้าที่หลักคือช่วยคุณ:

- วิเคราะห์และออกแบบระบบ
- พัฒนาโค้ดและ Feature ใหม่
- ตรวจหาและแก้ไขบัค
- รีวิว Clean Code และ Architecture
- คำนึงถึง Security, Performance และ Scalability
- ตรวจสอบผลลัพธ์ด้วย Tests, Lint, Typecheck และ Build ครับ

> งั้นหาวิธีแก้ไขปัญหา.
> ถ้าเปิดหน้าเว็บเดียวกันพร้อมกันทั้งใน OBS Custom Dock และ Google Chrome. โดยให้ active แค่ที่ใดที่หนึ่ง พร้อมมีปุ่มสถานะบอก.

วิธีที่ถูกต้องคือทำระบบ **Controller Lease / Active Controller Lock** โดยมีตัวกลางร่วมกันระหว่าง OBS Dock และ Google Chrome

`localStorage` หรือ `BroadcastChannel` อย่างเดียวไม่เพียงพอ เพราะ OBS Custom Dock กับ Chrome อาจอยู่คนละ Browser Context และไม่เห็นข้อมูลร่วมกัน

## แนวทางที่แนะนำ

ใช้ Firebase Realtime Database ที่ Project มีอยู่แล้วเป็นตัวกลางเก็บสถานะ Controller:

```text
Firebase Realtime Database
        │
        ├── OBS Custom Dock
        └── Google Chrome
```

จะมี Controller ที่เป็น Active ได้เพียงหนึ่ง Instance เท่านั้น

## การทำงาน

เมื่อเปิดหน้า Control:

1. หน้าเว็บสร้าง `instanceId` เฉพาะหน้าต่าง
2. เริ่มต้นเป็นสถานะ `Standby`
3. ตรวจสอบว่าใครเป็น Active Controller
4. ยังไม่เชื่อมต่อ OBS WebSocket จนกว่าจะได้สิทธิ์ Active

เมื่อกดปุ่ม `เปิดใช้งาน Controller`:

1. ขอสิทธิ์ผ่าน Firebase Transaction
2. ถ้ายังไม่มี Active Controller → ได้สิทธิ์
3. ถ้ามี Controller อื่นใช้งานอยู่ → ไม่อนุญาต
4. เมื่อได้สิทธิ์แล้วจึงเชื่อมต่อ `ws://localhost:4455`
5. เริ่มส่งคำสั่งและรับ Hotkey จาก OBS

## Heartbeat และ Lease

Active Controller จะส่ง Heartbeat ทุกประมาณ 2 วินาที

- Lease อายุประมาณ 6–10 วินาที
- หากปิดหน้าเว็บ, Browser ล่ม หรือ Connection หาย
- สิทธิ์จะหมดอายุอัตโนมัติ
- อีกหน้าสามารถขอสิทธิ์ใหม่ได้

เมื่อเสียสิทธิ์ Active:

- ตัดการเชื่อมต่อ OBS WebSocket ทันที
- ปิดการกดปุ่มควบคุม
- หยุดประมวลผล OBS Hotkey
- เปลี่ยนกลับเป็น `Standby`

## สถานะที่ควรแสดงบน UI

ตัวอย่าง:

- สีเขียว: `Active – หน้านี้กำลังควบคุม OBS`
- สีเทา: `Standby – Chrome กำลังควบคุมอยู่`
- สีเหลือง: `กำลังขอสิทธิ์ควบคุม`
- สีแดง: `การเชื่อมต่อขาดหาย`
- ปุ่ม `เปิดใช้งาน Controller`
- ปุ่ม `ปล่อยสิทธิ์ควบคุม`

เช่น:

```text
สถานะ: Standby
กำลังควบคุมโดย: OBS Custom Dock
[ขอสิทธิ์ควบคุม]
```

## จุดที่ต้องแก้ในโค้ด

ปัจจุบัน [useScoreboardObsConnection.ts](./src/hooks/useScoreboardObsConnection.ts:29) เชื่อมต่อ OBS ทันทีเมื่อ Component ถูก Mount

ต้องปรับเป็น:

```ts
useScoreboardObsConnection({
  enabled: controllerLease.isActive,
  obs,
  onConnected,
  onError,
});
```

และใน [useOBSWebSocket.ts](./src/hooks/useOBSWebSocket.ts) ต้องให้:

- Active เท่านั้นที่ `connect()`
- Standby ต้อง `disconnect()`
- เมื่อ Lease หมดอายุ ต้องหยุดรับคำสั่งทันที

## ผลลัพธ์

จะสามารถเปิดพร้อมกันได้แบบนี้:

```text
OBS Custom Dock  → Standby
Google Chrome    → Active
```

หรือสลับกัน:

```text
OBS Custom Dock  → Active
Google Chrome    → Standby
```

โดยจะไม่มีการส่งคำสั่งซ้ำ และไม่เกิดปัญหาคะแนนเพิ่มสองครั้งจาก OBS Event

แนวทางนี้เหมาะกับโปรเจกต์ปัจจุบันที่สุด เพราะใช้ Firebase Authentication และ Realtime Database อยู่แล้ว พร้อมควบคุมสิทธิ์เฉพาะผู้ใช้ที่ Login ได้ครับ.

> วางแผนการพัฒนาให้ละเอียด และ ครอบคลุมกว่านี้.

<details><summary>1 previous message</summary>

> ได้ครับ ผมจะวางแผนในระดับ System Design ให้ครบทั้ง Lifecycle ของสิทธิ์ Active, การเชื่อมต่อ OBS, UI สถานะ, การป้องกัน Race Condition, Firebase Security Rules, การกู้คืนเมื่อหลุด และ Test Plan โดยยึดโครงสร้าง Project ปัจจุบันเป็นฐาน ไม่เริ่มแก้โค้ดในขั้นนี้ครับ】【。
</details>

ได้ครับ ผมวางแผนในระดับ System Design โดยเลือกใช้ **Firebase Realtime Database เป็นตัวกลางควบคุมสิทธิ์ Active Controller** เพราะ Project มี Firebase Authentication และ Realtime Database อยู่แล้ว

แนวคิดหลักคือ:

```text
OBS Custom Dock ─┐
                 ├── Firebase Controller Lease ── OBS WebSocket
Google Chrome ───┘
```

จะมี Controller ที่เป็น Active ได้เพียงหนึ่ง Instance เท่านั้น ส่วนหน้าอื่นจะอยู่ในสถานะ Standby และจะไม่เชื่อมต่อหรือส่งคำสั่งไปยัง OBS

## 1. กำหนดขอบเขตของหน้าเว็บ

ต้องแยกประเภทหน้าเว็บออกเป็น 2 กลุ่ม

### Control Page

หน้าที่ต้องเข้าร่วมระบบ Lock:

- Scoreboard Controller
- Replay Control
- VAR Replay Control
- หน้าใด ๆ ที่ส่งคำสั่งไปยัง OBS

### Display / Browser Source Page

ไม่ต้องเข้าร่วมระบบ Lock:

- `/overlay`
- `/goal-animation`
- `/var-replay-v2/screen`
- `/replay/screen`
- Browser Source ที่ OBS ใช้แสดงผล

เหตุผลคือ Display Page มีหน้าที่แสดงผล ไม่ควรแย่งสิทธิ์ควบคุม OBS

## 2. โครงสร้างข้อมูล Controller Lease

เสนอให้เพิ่ม Node ใน Firebase Realtime Database:

```text
runtime/
└── controllerLease/
    └── scoreboard/
        ├── instanceId
        ├── sessionToken
        ├── ownerUid
        ├── ownerEmail
        ├── clientType
        ├── clientLabel
        ├── acquiredAt
        ├── heartbeatAt
        ├── expiresAt
        └── appVersion
```

ตัวอย่างข้อมูล:

```json
{
  "instanceId": "chrome-7b2c...",
  "sessionToken": "session-token...",
  "ownerUid": "firebase-user-uid",
  "ownerEmail": "user@example.com",
  "clientType": "chrome",
  "clientLabel": "Google Chrome",
  "acquiredAt": 1710000000000,
  "heartbeatAt": 1710000004000,
  "expiresAt": 1710000010000,
  "appVersion": "2.5.0"
}
```

`sessionToken` ต้องสร้างใหม่ทุกครั้งที่เปิดหน้าเว็บ เพื่อป้องกัน Instance เก่าที่หมดสิทธิ์ไปแล้วมาปล่อย Lock ของ Instance ใหม่

## 3. การระบุว่าเป็น OBS Dock หรือ Chrome

ระบบสามารถตรวจสอบเบื้องต้นจาก:

- `navigator.userAgent`
- `window.obsstudio` ถ้ามี
- ลักษณะของ Browser Runtime

ผลลัพธ์ที่ใช้แสดงบน UI:

```text
OBS Custom Dock
Google Chrome
Unknown Browser
```

ควรใช้เป็นข้อมูลเพื่อแสดงสถานะเท่านั้น ไม่ควรใช้เป็น Security Credential

## 4. Lifecycle ของ Controller

### เมื่อเปิดหน้าเว็บ

1. สร้าง `instanceId` จาก `crypto.randomUUID()`
2. สร้าง `sessionToken`
3. ตรวจสอบ Firebase Authentication
4. อ่านสถานะ Controller ปัจจุบัน
5. เริ่มต้นเป็น `Standby`
6. ยังไม่เชื่อมต่อ OBS WebSocket

จุดสำคัญคือปัจจุบัน [useScoreboardObsConnection.ts](./src/hooks/useScoreboardObsConnection.ts:29) เชื่อมต่อ OBS ทันทีเมื่อ Component Mount ต้องเปลี่ยนเป็นให้เชื่อมต่อเฉพาะตอนเป็น Active เท่านั้น

### เมื่อกด “เปิดใช้งาน Controller”

1. เปลี่ยน UI เป็น `กำลังขอสิทธิ์`
2. เรียก Firebase Transaction
3. ตรวจสอบว่า:
   - ไม่มีเจ้าของปัจจุบัน หรือ
   - Lease เดิมหมดอายุแล้ว
4. บันทึกตัวเองเป็น Owner
5. เริ่ม Heartbeat
6. เชื่อมต่อ OBS WebSocket
7. หากเชื่อมต่อสำเร็จ → สถานะ `Active`
8. หากเชื่อมต่อไม่สำเร็จ → ปล่อย Lease และแสดง Error

### เมื่อกด “ปล่อยสิทธิ์”

1. ตรวจสอบ `instanceId` และ `sessionToken`
2. ลบ Lease เฉพาะกรณีที่เป็น Owner จริง
3. หยุด Heartbeat
4. Disconnect OBS WebSocket
5. เปลี่ยนเป็น `Standby`

## 5. Heartbeat และ Lease Timeout

แนะนำค่าตั้งต้น:

- Heartbeat ทุก 2–3 วินาที
- Lease timeout 8–10 วินาที
- OBS reconnect ใช้ระบบเดิมที่มีอยู่
- หาก Firebase Connection หลุด ให้เข้าสู่ Safe Standby

ตัวอย่าง:

```text
Heartbeat interval: 3000 ms
Lease duration: 10000 ms
```

การตรวจสอบสิทธิ์ต้องใช้ `expiresAt` ไม่ใช่ดูเพียงว่า Record ยังมีอยู่หรือไม่

## 6. ป้องกัน Race Condition

กรณี Chrome และ OBS Dock กดเปิดใช้งานพร้อมกัน ต้องใช้ Firebase Transaction ไม่ใช่การอ่านแล้วเขียนแยกกัน

ไม่ควรทำแบบนี้:

```text
อ่าน Lock
ถ้าว่าง
เขียน Lock
```

เพราะทั้งสองหน้าอาจอ่านว่างพร้อมกัน

ควรทำเป็น Atomic Transaction:

```text
ถ้าไม่มี Lock หรือ Lock หมดอายุ
    ให้เขียน Owner ใหม่
ไม่เช่นนั้น
    ปฏิเสธการยึดสิทธิ์
```

กรณี Instance เก่าพยายาม Release หลังจากหมดสิทธิ์แล้ว ต้องไม่สามารถลบ Owner ใหม่ได้ โดยตรวจสอบ:

```text
instanceId ต้องตรง
sessionToken ต้องตรง
ownerUid ต้องตรง
```

## 7. ผูกกับ OBS WebSocket Lifecycle

`useOBSWebSocket` ต้องรองรับสถานะ `enabled` หรือให้ Hook ด้านบนเป็นผู้ควบคุมการ Connect/Disconnect

แนวทาง:

```ts
useScoreboardObsConnection({
  enabled: lease.isActive,
  obs,
  onConnected,
  onError,
});
```

กฎสำคัญ:

- `lease.isActive === false` → ห้าม Connect OBS
- Lease หมดอายุ → Disconnect OBS ทันที
- Lease เปลี่ยน Owner → Disconnect OBS
- Firebase Offline → เข้าสู่ Safe Standby
- OBS หลุดแต่ Lease ยังไม่หมด → Retry ได้
- OBS ปิดและส่ง `ExitStarted` → หยุด Reconnect ตาม Logic เดิม

## 8. ป้องกันคำสั่งจาก Standby

ทุกคำสั่งที่ควบคุม OBS ต้องตรวจสอบสองชั้น:

```text
isActive === true
และ
obs.isConnected === true
```

จุดที่ต้องตรวจสอบทั้งหมด:

- ปุ่มเพิ่ม/ลดคะแนน
- Timer
- Team Name
- Logo
- Color
- Scene/Source Setup
- Replay Buffer
- Macro
- OBS Hotkey
- VAR Replay
- Instant Replay

ปัจจุบัน `useScoreboardObsSync` และ `useAutoMacros` ทำงานตาม Component Lifecycle จึงต้องตรวจสอบไม่ให้ส่งคำสั่งขณะหน้าเป็น Standby

วิธีที่ปลอดภัยคือมี Guard กลาง:

```ts
if (!controllerLease.isActive) return;
if (!obs.isConnected) return;
```

หรือสร้าง API กลาง:

```ts
activeObs.setText(...)
activeObs.call(...)
```

เพื่อป้องกันไม่ให้แต่ละ Component ลืมตรวจสอบสิทธิ์เอง

## 9. UI สถานะ Controller

ควรวาง Status Bar ไว้ใกล้สถานะ OBS WebSocket

### สถานะ Active

```text
● Controller Active
กำลังควบคุมโดย: Google Chrome
OBS: Connected
[ปล่อยสิทธิ์]
```

สีเขียว

### สถานะ Standby

```text
○ Controller Standby
กำลังควบคุมโดย: OBS Custom Dock
[ขอสิทธิ์ควบคุม]
```

สีเทา

### สถานะกำลังขอสิทธิ์

```text
◌ กำลังขอสิทธิ์ควบคุม...
```

สีเหลือง

### สถานะ OBS หลุด

```text
! Active แต่ OBS ไม่เชื่อมต่อ
กำลังเชื่อมต่อใหม่...
```

สีส้ม

### สถานะ Firebase หลุด

```text
! ไม่สามารถตรวจสอบสิทธิ์ Controller
ระบบเข้าสู่ Safe Standby
```

สีแดง

เมื่อเป็น Standby:

- Disable ปุ่มควบคุม OBS
- Disable Shortcut
- Disable Macro ที่ส่ง OBS
- ยังคงอ่านสถานะได้ถ้าเหมาะสม
- แสดงว่าใครเป็น Active อยู่

## 10. การจัดการกรณีผิดปกติ

### Active ปิด Browser

- ใช้ Firebase `onDisconnect` สำหรับ Presence
- Lease หลักยังไม่ควรถูกลบแบบไม่มีเงื่อนไข
- รอให้ `expiresAt` หมดอายุ
- ป้องกันไม่ให้ Instance เก่าลบ Owner ใหม่

### เครื่อง Sleep หรือ Browser Freeze

- Heartbeat หยุด
- Lease หมดอายุ
- Controller อื่นสามารถยึดสิทธิ์ได้

### Firebase Offline

- ไม่อนุญาตให้ขอสิทธิ์ใหม่
- Active ปัจจุบันควร Disconnect OBS หากไม่สามารถยืนยัน Lease ได้
- ป้องกัน Split-Brain

### OBS ปิด แต่ Firebase ยังทำงาน

- คงสถานะ Lease ไว้ชั่วคราว
- ปิดปุ่มคำสั่ง
- Retry OBS ตามระบบเดิม
- หาก Retry ล้มเหลวต่อเนื่อง ให้แสดง Error

### เปิดหน้าเดิมหลาย Tab ใน Chrome

- ทุก Tab ได้ `instanceId` ต่างกัน
- มีเพียง Tab เดียวเป็น Active
- Tab อื่นเป็น Standby

### เปิด OBS Dock และ Chrome ด้วยผู้ใช้คนละบัญชี

- ยังคงใช้ Global Controller Lock เดียวกัน
- ผู้ที่ได้ Lease ก่อนเป็น Active
- ผู้ใช้คนอื่นต้องรอหรือขอสิทธิ์หลัง Lease หมดอายุ

## 11. Firebase Security Rules

ต้องเพิ่ม Rules สำหรับ Controller Lease โดยหลักการ:

- อ่านสถานะได้เฉพาะผู้ใช้ที่ Login
- เขียนได้เฉพาะ User ที่มีสิทธิ์ใช้งาน
- Owner แก้ไข Heartbeat ของตัวเองได้
- Owner คนอื่นแก้ไขไม่ได้
- การยึด Lease ใหม่ทำได้เมื่อ:
  - ไม่มีข้อมูลเดิม หรือ
  - Lease หมดอายุแล้ว
- ห้ามแก้ `ownerUid` เป็น User อื่นโดยไม่มี Transaction ที่ถูกต้อง
- ตรวจสอบชนิดข้อมูลและความยาวของ String
- ไม่เก็บ OBS Password ใน Firebase

ควรปรับ [database.rules.json](./database.rules.json) ให้มี Node ใหม่โดยไม่กระทบ Rules เดิมของ `user_permissions` และ `whitelist`

## 12. Hook และ Component ที่ควรเพิ่ม

แนะนำสร้าง:

```text
src/hooks/useControllerLease.ts
src/types/controllerLease.ts
src/components/ControllerLeaseStatus.tsx
src/utils/controllerLease.ts
src/hooks/useControllerLease.test.ts
```

หน้าที่:

### `useControllerLease`

- สร้าง Instance ID
- อ่าน Auth User
- โหลดสถานะ Lease
- Acquire
- Release
- Heartbeat
- Detect expired
- Detect Firebase Offline
- Expose `isActive`, `isStandby`, `ownerInfo`

### `ControllerLeaseStatus`

- แสดงสถานะ
- แสดง Owner
- ปุ่ม Acquire/Release
- แสดง Error และ Retry
- รองรับ Responsive Layout

### `controllerLease.ts`

เก็บ Pure Functions:

- ตรวจ Lease หมดอายุ
- ตรวจ Owner
- สร้าง Session
- Normalize Data
- ตรวจ Client Type
- Format Status

## 13. ลำดับการพัฒนา

### Phase 1: Pure Model

- สร้าง Type และ Constants
- สร้าง Status Model
- สร้าง Lease Validation
- สร้าง Instance/Session Generator
- เพิ่ม Unit Tests

### Phase 2: Firebase Adapter

- อ่าน/เขียน Lease
- Transaction Acquire
- Heartbeat
- Release
- Presence
- Server Time Offset
- Firebase Offline Detection

### Phase 3: React Hook

- สร้าง `useControllerLease`
- จัดการ Lifecycle
- ป้องกัน Strict Mode
- ป้องกัน Double Acquire
- Cleanup ตอน Unmount

### Phase 4: OBS Integration

- เพิ่ม `enabled` ใน Connection Lifecycle
- Connect OBS หลัง Acquire สำเร็จ
- Disconnect เมื่อเสีย Lease
- ป้องกัน Auto Macro และ Sync ขณะ Standby
- ตรวจสอบทุกจุดที่เรียก `obs.call`

### Phase 5: UI

- เพิ่ม Status Bar
- เพิ่มปุ่ม Activate/Release
- Disable Control เมื่อ Standby
- แสดงชื่อ Browser และ Owner
- แสดง Error/Retry

### Phase 6: Security และ Recovery

- เพิ่ม Firebase Rules
- ตรวจสิทธิ์ User
- ป้องกัน Stale Owner
- ป้องกัน Session เก่า Release Owner ใหม่
- ทดสอบ Browser Close, Sleep, Offline และ OBS Restart

### Phase 7: Regression Test

- Test หนึ่ง Controller
- Test สอง Controller
- Test Acquire พร้อมกัน
- Test Heartbeat
- Test Lease Expiry
- Test Release
- Test OBS Disconnect
- Test Firebase Offline
- Test Hotkey ไม่ยิงซ้ำ
- Test Macro ไม่ทำงานใน Standby
- Test Replay และ Scoreboard ไม่ได้รับผลกระทบ

## 14. Acceptance Criteria

ถือว่าระบบสมบูรณ์เมื่อ:

- เปิด Control พร้อมกันใน OBS Dock และ Chrome ได้
- มี Active Controller เพียงหนึ่งตัว
- Standby ไม่เชื่อมต่อ OBS WebSocket
- Standby ไม่ส่งคำสั่งหรือรับ Hotkey ไปประมวลผล
- สถานะแสดง Owner และ Client Type ถูกต้อง
- ปิด Active แล้วอีกหน้าขอสิทธิ์ได้หลัง Lease หมดอายุ
- ไม่มีคะแนนเพิ่มสองครั้งจาก OBS CustomEvent
- การกด Acquire พร้อมกันไม่ทำให้เกิด Active สองตัว
- OBS หลุดแล้วระบบ Reconnect ได้เฉพาะ Active
- Firebase หลุดแล้วระบบเข้าสู่ Safe Standby
- ผู้ใช้ที่ไม่มีสิทธิ์ไม่สามารถเขียน Lease ได้
- Tests, Lint, Typecheck และ Build ผ่านทั้งหมด

แนวทางนี้จะทำให้ระบบรองรับการเปิดหน้าเว็บซ้ำจากหลายสภาพแวดล้อมได้อย่างปลอดภัย และแก้ปัญหา Duplicate OBS Connection ได้ที่ระดับ Architecture ไม่ใช่เพียงปิดปุ่มบน UI ครับ

ตอนนี้ยังไม่ได้แก้ไขโค้ดตามแผนนี้ครับ

> พัฒนาระบบ ตามแผนการที่ตั้งไว้ได้เลย.

<details><summary>5 previous messages</summary>

> รับทราบครับ ผมจะเริ่มพัฒนาระบบ Active Controller Lock ตามแผน โดยเริ่มจาก Lease Model/Hook และ Firebase Rules ก่อน แล้วค่อยผูกเข้ากับ OBS WebSocket Lifecycle และ UI สถานะ เพื่อให้หน้า Standby ไม่เชื่อมต่อหรือส่งคำสั่ง OBS ครับ
>
> <details><summary>Created 3 files, edited 4 files</summary>
>
> - Wrote `./src/types/controllerLease.ts` (+65 -0)
> - Wrote `./src/hooks/useControllerLease.ts` (+273 -0)
> - Wrote `./src/components/ControllerLeaseStatus.tsx` (+64 -0)
> - Wrote `./src/index.css` (+37 -0)
> - Wrote `./src/hooks/useScoreboardObsConnection.ts` (+8 -1)
> - Wrote `./src/components/ScoreboardController.tsx` (+3 -1)
> - Wrote `./src/components/ScoreboardController.tsx` (+11 -9)
> - Wrote `./src/components/ScoreboardController.tsx` (+17 -7)
> - Wrote `./database.rules.json` (+16 -0)
> - Wrote `./database.rules.json` (+2 -2)
>
> </details>
>
> ตอนนี้เชื่อมระบบหลักครบแล้วครับ: Lease/Heartbeat, Firebase presence, การยึดสิทธิ์แบบ Transaction, การตัด OBS เมื่อเป็น Standby และ Status UI ใน Header เหลือกำลังตรวจ TypeScript กับ Firebase Rules และจะเพิ่ม test สำหรับ logic ของ Lease ก่อนตรวจ build ครับ
>
> <details><summary>Created a file, edited 5 files</summary>
>
> - Wrote `./src/types/controllerLease.ts` (+2 -2)
> - Wrote `./src/types/controllerLease.test.ts` (+50 -0)
> - Wrote `./src/components/ScoreboardController.tsx` (+2 -2)
> - Wrote `./src/index.css` (+9 -0)
> - Wrote `./src/hooks/useControllerLease.ts` (+1 -0)
> - Wrote `./src/components/ControllerLeaseStatus.tsx` (+1 -1)
> - Wrote `./src/components/ControllerLeaseStatus.tsx` (+6 -2)
> - Wrote `./src/components/ScoreboardController.tsx` (+1 -0)
> - Wrote `./src/index.css` (+2 -0)
> - Wrote `./src/components/ScoreboardController.tsx` (+1 -1)
> - Wrote `./src/types/controllerLease.ts` (+2 -1)
>
> </details>
>
> ตรวจรอบกลางผ่านแล้วครับ: TypeScript, lint, JSON Rules และ test ผ่านทั้งหมด 120 tests ตอนนี้เพิ่มการป้องกันเชิง UX อีกจุดให้หน้า Standby ไม่รับการคลิกส่วนควบคุม และแสดงสถานะ OBS แยกจาก Firebase เพื่อเห็นกรณี Lease ยังอยู่แต่ OBS หลุดได้ชัดเจน กำลังรัน production build รอบสุดท้ายครับ
</details>

พัฒนาระบบ Active Controller Lock ตามแผนเสร็จแล้วครับ

สิ่งที่เพิ่ม:

- รองรับการเปิดหน้า Control พร้อมกันใน OBS Custom Dock และ Google Chrome
- มี Active Controller ได้เพียงหนึ่ง Instance
- หน้าอื่นจะอยู่ในสถานะ Standby
- หน้า Standby จะไม่เชื่อมต่อ OBS WebSocket
- หน้า Standby จะไม่รับคำสั่ง OBS หรือ Hotkey
- ใช้ Firebase Realtime Database เป็นตัวกลาง Lease
- ใช้ Firebase Transaction ป้องกันการยึดสิทธิ์พร้อมกัน
- มี Heartbeat ทุก 3 วินาที
- Lease หมดอายุอัตโนมัติภายในประมาณ 10 วินาที
- ป้องกัน Session เก่าปล่อยสิทธิ์ของ Session ใหม่
- ตรวจจับ Firebase Offline
- ตรวจจับ OBS Disconnected
- เมื่อ OBS หลุดจะแสดงสถานะแยกจาก Firebase
- ปิดการคลิกพื้นที่ Control เมื่อยังไม่ได้ Active
- รองรับการปล่อยสิทธิ์ด้วยปุ่ม
- ตรวจสอบ Client Type เช่น OBS Custom Dock และ Google Chrome

ไฟล์หลักที่เพิ่ม:

- [useControllerLease.ts](./src/hooks/useControllerLease.ts)
- [controllerLease.ts](./src/types/controllerLease.ts)
- [ControllerLeaseStatus.tsx](./src/components/ControllerLeaseStatus.tsx)
- [controllerLease.test.ts](./src/types/controllerLease.test.ts)

ไฟล์ที่แก้ไข:

- [ScoreboardController.tsx](./src/components/ScoreboardController.tsx)
- [useScoreboardObsConnection.ts](./src/hooks/useScoreboardObsConnection.ts)
- [index.css](./src/index.css)
- [database.rules.json](./database.rules.json)

วิธีใช้งาน:

1. เปิด Project ใน OBS Custom Dock และ Google Chrome
2. หน้าแรกที่กด `เปิดใช้งาน Controller` จะได้สถานะ Active
3. อีกหน้าจะเปลี่ยนเป็น Standby
4. หากต้องการสลับเครื่อง ให้กด `ปล่อยสิทธิ์` จากหน้าเดิมก่อน
5. จากนั้นกด `เปิดใช้งาน Controller` ที่อีกหน้า

ผลการตรวจสอบ:

- Tests: 16 ไฟล์ / 120 Tests ผ่าน
- Lint: ผ่าน
- TypeScript: ผ่าน
- Production Build: ผ่าน
- Firebase Rules JSON: ถูกต้อง
- `git diff --check`: ผ่าน

ข้อควรทำก่อนใช้งานจริง:

ต้อง Deploy [database.rules.json](./database.rules.json) ไปยัง Firebase Realtime Database ด้วย เพราะ Rules ในเครื่องจะยังไม่ถูกใช้งานบน Firebase จนกว่าจะ Deploy ครับ.

หมายเหตุ: Production Build ยังมีคำเตือนเดิมเรื่อง Bundle ขนาดใหญ่กว่า 500 kB แต่ไม่เกี่ยวข้องกับระบบ Controller Lock ครับ

> ผมไม่เอาระบบ Active Controller Lock ล่าสุดแล้ว นำออกให้หน่อย

<details><summary>6 previous messages</summary>

> รับทราบครับ ผมจะนำเฉพาะระบบ Active Controller Lock ที่เพิ่งเพิ่มล่าสุดออกทั้งหมด โดยคงระบบ Replay, Shortcut และการแก้ไขเดิมส่วนอื่นไว้เหมือนเดิม รวมถึงจะลบเฉพาะไฟล์ใหม่ของระบบ Lock และย้อนเฉพาะบรรทัดที่เกี่ยวข้องในไฟล์เดิมครับ
>
> Context compaction
>
> Source: automatic
> Status: completed
>
> กำลังถอดระบบ Active Controller Lock เฉพาะส่วนล่าสุดออกให้ครับ โดยจะย้อนการเชื่อมต่อใน Controller/OBS, UI สถานะ, Firebase rules และลบไฟล์เฉพาะของระบบนี้ พร้อมคงฟีเจอร์ Replay และ Shortcut เดิมไว้ทั้งหมด จากนั้นจะตรวจ typecheck, lint, test และ build ครับ
>
> <details><summary>Edited 4 files, deleted 4 files</summary>
>
> - Wrote `./database.rules.json` (+0 -16)
> - Deleted `./src/components/ControllerLeaseStatus.tsx` (+0 -68)
> - Wrote `./src/components/ScoreboardController.tsx` (+4 -19)
> - Deleted `./src/hooks/useControllerLease.ts` (+0 -274)
> - Wrote `./src/hooks/useScoreboardObsConnection.ts` (+1 -8)
> - Wrote `./src/index.css` (+0 -48)
> - Deleted `./src/types/controllerLease.test.ts` (+0 -50)
> - Deleted `./src/types/controllerLease.ts` (+0 -65)
>
> </details>
>
> ระบบ Lock ถูกถอดออกจากโค้ดแล้ว และตรวจไม่พบ reference ของ `ControllerLease` หรือ CSS/status ที่เกี่ยวข้อง เหลือเฉพาะไฟล์และการแก้ไขเดิมของโปรเจกต์ ตอนนี้กำลังรันชุดตรวจสอบความถูกต้องทั้งหมดครับ
>
> ผลตรวจสอบผ่านทั้งหมดครับ: TypeScript, lint, test 117/117 และ production build ผ่านเรียบร้อยแล้ว เหลือเพียงคำเตือนเดิมจาก bundle ของ `exceljs` ที่มีขนาดใหญ่ ไม่เกี่ยวกับการถอดระบบ Lock ตอนนี้กำลังเช็กสถานะไฟล์รอบสุดท้ายเพื่อยืนยันว่าไม่มีไฟล์ Lock ค้างอยู่ครับ
</details>

ถอดระบบ Active Controller Lock ล่าสุดออกเรียบร้อยแล้วครับ

สิ่งที่นำออก:

- ลบ UI สถานะ Controller Lock
- ลบ Hook และ Types ของระบบ Lock
- ลบกฎ Firebase `controllerLease` และ `controllerPresence`
- ยกเลิกการบังคับ Active/Standby ใน `ScoreboardController`
- คืนการเชื่อมต่อ OBS ให้ทำงานตามเดิม
- ลบ CSS ที่เกี่ยวข้องกับ Controller Lock

ระบบ Replay, Playlist, Shortcut และฟีเจอร์เดิมอื่น ๆ ยังคงอยู่ครบ

ตรวจสอบแล้ว:

- TypeScript ผ่าน
- Lint ผ่าน
- Tests: 15 ไฟล์ / 117 tests ผ่านทั้งหมด
- Production build ผ่าน
- ไม่พบไฟล์หรือ reference ของ Controller Lock ค้างอยู่แล้วครับ

> โอเคร ก่อนปิด ให้เช็คอีกรอบ ว่าในส่วนของระบบ active controller ลบออกหมดยัง.

<details><summary>1 previous message</summary>

> ได้ครับ ผมจะตรวจสอบซ้ำแบบ read-only ทั้งโปรเจกต์ โดยค้นหาชื่อไฟล์, Hook, Type, CSS class, Firebase path และ logic ที่เกี่ยวข้องกับ Active Controller Lock รวมถึงตรวจสถานะไฟล์ที่ถูกแก้ไขด้วยครับ
</details>

ตรวจสอบซ้ำเรียบร้อยครับ ระบบ Active Controller Lock ถูกลบออกหมดแล้ว

ผลตรวจสอบ:

- ไม่พบคำว่า `ControllerLease`, `controllerLease`, `controllerPresence` หรือ CSS ที่เกี่ยวข้อง
- ไฟล์ Lock ทั้งหมดไม่มีอยู่แล้ว
- การเชื่อมต่อ OBS ไม่มีเงื่อนไข `enabled` จากระบบ Lock
- `database.rules.json` ไม่มี Runtime Lock และ JSON ถูกต้อง
- `git diff --check` ไม่พบปัญหาโค้ด
- ไฟล์ที่ยังเปลี่ยนแปลงเป็นของระบบ Replay/Shortcut และงานเดิมเท่านั้น

สรุปคือสามารถปิดรอบงานนี้ได้อย่างปลอดภัยครับ

> กลับไปส่วนของ "VAR Controller" ครับ

รับทราบครับ เราจะกลับมาพัฒนาส่วน **VAR Controller** ต่อ โดยโฟกัสหลักที่:

- `src/components/var-replay-v2/VarReplayV2Page.tsx`
- ระบบควบคุม Video Preview
- Zoom / Pan / Playback
- Keyboard Shortcut
- Replay Playlist ที่เชื่อมกับ VAR

ระบบ Active Controller Lock ยังคงถูกนำออกแล้วครับ พร้อมรับโจทย์ถัดไปในส่วน VAR Controller ได้เลย

> ผมอยากลบ function เมื่อเมาส์อยู่ใน video preview ให้ เลื่อน scroll mouse สำหรับ zoom+/- ออกจากระบบ.
> ทำการวางแผน ลบออกจากระบบก่อน.

<details><summary>1 previous message</summary>

> รับทราบครับ รอบนี้จะวางแผนอย่างเดียวก่อน ยังไม่แก้โค้ด โดยจะตรวจเส้นทางการทำงานของ `wheel/mouseenter/mouseleave` ใน VAR Controller ว่าผูกกับ Zoom ตรงไหนบ้าง เพื่อถอดเฉพาะการ Zoom ด้วย Mouse Wheel และคงปุ่ม `+/-`, keyboard shortcut และการควบคุมอื่นไว้ครบครับ
</details>

วางแผนการลบ Mouse Wheel Zoom ใน VAR Controller เรียบร้อยแล้วครับ โดยรอบนี้ยังไม่ได้แก้โค้ด

จุดที่จะปรับใน `VarReplayV2Page.tsx`:

1. ลบ `onWheel={handlePreviewWheel}` ออกจากกรอบ Video Preview
2. ลบฟังก์ชัน `handlePreviewWheel`
3. ลบ helper `zoomAroundPointer` ที่ใช้เฉพาะ Mouse Wheel
4. ลบ `ReactWheelEvent` import ที่ไม่ใช้งานแล้ว
5. ปรับ comment ของระบบส่ง Transform ไม่ให้กล่าวถึง Wheel Zoom
6. คงระบบเหล่านี้ไว้เหมือนเดิม:
   - Zoom ด้วยปุ่ม `+ / -`
   - Zoom ด้วย Keyboard Shortcut
   - Zoom ด้วย Slider
   - Reset Zoom / Pan
   - Pan ด้วยการลากเมาส์
   - การส่ง Transform ไปยัง VAR Screen
7. ไม่แตะ `useDisableZoom` เพราะเป็นระบบป้องกัน Browser Zoom จาก `Ctrl + Wheel` ซึ่งเป็นคนละส่วนกัน

ผลลัพธ์หลังพัฒนา:

- เมาส์อยู่ใน Video Preview แล้ว Scroll จะไม่เพิ่มหรือลด Zoom อีกต่อไป
- Scroll จะไม่ถูก `preventDefault()` จาก Preview
- การ Zoom จะควบคุมผ่านปุ่ม, Slider และ Keyboard เท่านั้น
- ตรวจสอบด้วย TypeScript, Lint, Tests และ Build หลังแก้ไข

พร้อมเริ่มแก้ไขตามแผนเมื่อคุณอนุมัติครับ

> ทำการพัฒนาตามแผนเลย

<details><summary>5 previous messages</summary>

> เริ่มพัฒนาตามแผนครับ ผมจะถอดเฉพาะ Mouse Wheel Zoom ใน `VarReplayV2Page.tsx` โดยคง Zoom จากปุ่ม, Slider, Keyboard และระบบ Pan ไว้เหมือนเดิม หลังแก้จะตรวจสอบการใช้งานที่เหลือและรันชุดทดสอบทั้งหมดครับ
>
> <details><summary>Edited a file</summary>
>
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+2 -34)
>
> </details>
>
> ถอดโค้ด Mouse Wheel Zoom แล้วครับ และตรวจพบว่า Preview เหลือเฉพาะ Pointer Events สำหรับ Pan ส่วน Zoom ยังเชื่อมผ่าน Slider, Keyboard และ `+/-` ตามเดิม ตอนนี้กำลังตรวจคุณภาพและทดสอบ build ครับ
>
> พบอีก 2 จุดที่เป็นส่วนตกค้างของฟีเจอร์เดิมครับ: ข้อความช่วยใช้งานยังระบุว่า “ล้อเมาส์: Zoom” และมี `usePreviewScrollLock.ts` ที่ไม่ถูกเรียกใช้งานแล้ว แต่เกี่ยวข้องกับการล็อก Scroll ของ Preview ผมจะลบ/ปรับสองจุดนี้ด้วย เพื่อไม่ให้ระบบเหลือพฤติกรรมหรือข้อความที่ทำให้เข้าใจผิดครับ
>
> <details><summary>Edited a file, deleted a file</summary>
>
> - Wrote `./src/components/var-replay-v2/VarReplayV2Page.tsx` (+1 -1)
> - Deleted `./src/components/var-replay-v2/usePreviewScrollLock.ts` (+0 -28)
>
> </details>
</details>

พัฒนาตามแผนเสร็จเรียบร้อยครับ

ปรับแก้แล้ว:

- ลบ `onWheel` จาก Video Preview
- ลบ `handlePreviewWheel`
- ลบ `zoomAroundPointer`
- ลบ `usePreviewScrollLock.ts`
- แก้ข้อความช่วยใช้งาน ไม่ให้ระบุว่า Scroll เพื่อ Zoom
- คง Zoom ผ่านปุ่ม, Slider, Keyboard และ Pan ไว้ครบ

ตรวจสอบแล้ว:

- ไม่พบ Mouse Wheel Zoom reference ใน VAR Controller
- TypeScript ผ่าน
- Lint ผ่าน
- Tests: 15 ไฟล์ / 117 tests ผ่าน
- Build ผ่าน

มีเพียงคำเตือนเดิมเรื่อง bundle `exceljs` ขนาดใหญ่ครับ

> ดูในส่วนของ teamname browser source และ score browser source หน่อยครับ ว่ามีหลักการอย่างไร

<details><summary>1 previous message</summary>

> ได้ครับ ผมจะตรวจทั้งเอกสารอ้างอิงและโค้ดจริงของ `team name browser source` กับ `score browser source` เพื่ออธิบายหลักการตั้งแต่จุดเริ่มต้น, การสร้าง URL, การรับข้อมูล, การแสดงผล และการเชื่อมต่อกับ OBS โดยไม่แก้ไขไฟล์ครับ
</details>

หลักการของทั้ง `Team Name Browser Source` และ `Score Browser Source` คือการใช้หน้า React เป็นภาพ Overlay โปร่งใส แล้วให้ OBS เปิดหน้านั้นผ่าน Browser Source

ภาพรวมการทำงาน:

```text
Scoreboard Controller
        │
        ├─ OBS WebSocket → สร้าง/อัปเดต Browser Source
        │
        └─ BroadcastChannel → ส่งชื่อทีม/คะแนน/เหตุการณ์ Goal
                                      │
                              OBS Browser Source
                              แสดงผล Overlay
```

## 1. Team Name Browser Source

ไฟล์หลัก:

- `src/components/TeamNamesAnimation.tsx`
- `src/utils/teamNameBrowserUrl.ts`
- `src/types/teamNameBrowserSettings.ts`
- `src/services/obsSetupService.ts`

### URL ที่ใช้

```text
/goal-animation?template=team-names&side=A
/goal-animation?template=team-names&side=B
```

โดย `side` แบ่งเป็น:

- `A` แสดงชื่อทีม A
- `B` แสดงชื่อทีม B
- `both` รองรับในระบบทั่วไป แต่ OBS จะสร้างแยกเป็น A/B

สามารถส่งค่าการแสดงผลผ่าน Query String เช่น:

```text
/goal-animation?template=team-names&side=A&font=Kanit&fontWeight=700&fontMode=manual&fontSize=64
```

รองรับ:

- `font`
- `fontWeight`
- `fontMode=auto|manual`
- `fontSize`

### การรับข้อมูลชื่อทีม

เมื่อเปิด Browser Source ระบบจะ:

1. อ่านชื่อทีมล่าสุดจาก `localStorage`
2. เปิด `BroadcastChannel` ชื่อ `scoreboard-events`
3. ขอข้อมูลล่าสุดจาก Controller ด้วย `ScoreboardStateRequest`
4. รับข้อมูล `ScoreboardState`
5. อัปเดตชื่อทีมแบบ real-time

ข้อมูลที่ส่งมาจาก Controller มีลักษณะดังนี้:

```ts
{
  type: 'ScoreboardState',
  scoreA,
  scoreB,
  nameA,
  nameB,
  logoA,
  logoB,
  ...
}
```

### เมื่อมีการยิงประตู

Controller ส่ง `GoalScoredEvent` ไปยัง Browser Source

Team Name Source จะ:

1. เปลี่ยนชื่อทีมฝั่งที่ยิงประตู
2. แสดงคำว่า `GOAL!!!`
3. แสดง Animation ประมาณ 4 วินาที
4. กลับมาแสดงชื่อทีมตามปกติ
5. ส่ง `TeamNameAnimationCompletedEvent` เพื่อแจ้ง Score Source

### การปรับขนาด Font

มี 2 โหมด:

- `auto`: ปรับขนาดตามความยาวชื่อทีม
- `manual`: ใช้ขนาด px ที่กำหนดเอง

ค่าจะถูกตรวจสอบก่อนใช้งาน เช่น:

- จำกัดขนาด Font ระหว่าง 16–120 px
- จำกัดน้ำหนัก Font ตามค่าที่รองรับ
- ป้องกัน CSS Injection จากค่า Font ที่ไม่ปลอดภัย

## 2. Score Browser Source

ไฟล์หลัก:

- `src/components/ScoreOnlyAnimation.tsx`
- `src/components/goalAnimationTemplates.ts`
- `src/utils/scoreBrowserUrl.ts`
- `src/types/scoreBrowserSettings.ts`

### URL ที่ใช้

แบบแสดงคะแนนทั้งสองฝั่ง:

```text
/goal-animation?template=score-only&mode=number&side=both
```

แบบแยกทีม:

```text
/goal-animation?template=score-only&mode=number&side=A
/goal-animation?template=score-only&mode=number&side=B
```

ค่าที่รองรับ:

- `template=score-only`
- `mode=number|effect`
- `side=A|B|both`
- `font`
- `fontWeight`
- `fontMode`
- `fontSize`

### โหมดการแสดงผล

`mode=number`

- แสดงตัวเลขคะแนนจริง
- เหมาะสำหรับใช้แทน Score Source เดิมของ OBS
- โหลดคะแนนล่าสุดจาก `localStorage`
- รับการอัปเดตผ่าน `BroadcastChannel`

`mode=effect`

- แสดงเฉพาะ Effect เช่น `+1`
- ไม่วาดตัวเลขคะแนนถาวรทับบนหน้าจอ
- เหมาะสำหรับใช้เป็น Animation Layer

### ลำดับ Animation ของคะแนน

เมื่อมีการยิงประตู:

```text
GoalScoredEvent
      ↓
Score Source เตรียมซ่อนคะแนน
      ↓
Team Name Source แสดง GOAL!!!
      ↓
Team Name Animation จบ
      ↓
TeamNameAnimationCompletedEvent
      ↓
Score Source แสดงคะแนนใหม่
      ↓
เลขเก่าเลื่อนลง
      ↓
เลขใหม่ตกลงจากด้านบน
      ↓
เด้ง 2 ครั้ง
      ↓
แสดงคะแนนค้างไว้
```

หากไม่มี Event แจ้งจบจาก Team Name Source ระบบมี Fallback Timer ประมาณ 4.5 วินาที เพื่อไม่ให้คะแนนค้างอยู่ในสถานะเตรียมแสดง

## 3. การสร้าง Source ใน OBS

หน้า Quick Setup จะใช้ `OBS WebSocket` เพื่อ:

1. ตรวจสอบว่า OBS เชื่อมต่ออยู่หรือไม่
2. สร้าง Browser Source หากยังไม่มี
3. อัปเดต URL และ Settings หากมีอยู่แล้ว
4. เพิ่ม Source เข้า Scene
5. กำหนดขนาด 1920×1080
6. ตั้งพื้นหลังโปร่งใส
7. ตั้ง `shutdown: false` เพื่อให้ Source เปิดค้างและรับ Event ได้ตลอดเวลา

ชื่อ Source ที่ใช้งาน:

```text
Team_Name_A
Team_Name_B

Score_Display_A
Score_Display_B
```

ระบบจะซ่อน Source เดิม เช่น:

```text
name_team_a
name_team_b
Score_Display
```

เพื่อป้องกันชื่อทีมหรือคะแนนแสดงซ้ำ โดยไม่ได้ลบ Source เดิม ทำให้สามารถย้อนกลับได้

## 4. การจัดเก็บ Settings

ค่าการตั้งค่าจะเก็บใน `localStorage` ของ Controller:

```text
teamNameBrowserSettings
scoreBrowserSettings
```

เมื่อเปิด Controller ใหม่ ระบบจะ:

1. อ่านค่าที่บันทึกไว้
2. ตรวจสอบและ Normalize ค่า
3. ใช้ค่า Default หากข้อมูลเสียหายหรือไม่ถูกต้อง
4. สร้าง URL ใหม่จาก Settings ปัจจุบัน

## 5. จุดสำคัญด้านการเชื่อมต่อ

ระบบ Runtime ไม่ได้ส่งข้อมูลผ่าน OBS WebSocket โดยตรง

- OBS WebSocket: ใช้สำหรับสร้างและตั้งค่า Source
- BroadcastChannel: ใช้ส่งข้อมูล Live ระหว่าง Controller กับ Browser Source
- localStorage: ใช้เก็บข้อมูลล่าสุดสำหรับกรณี Browser Source เปิดใหม่หรือ Refresh

ดังนั้น Browser Source และ Controller ต้องเปิดจาก Origin เดียวกัน เช่น Domain, Protocol และ Port เดียวกัน มิฉะนั้น `BroadcastChannel` จะไม่สามารถสื่อสารข้ามกันได้ครับ

> ถ้าผมอยากพัฒนา logo browser source เพิ่มเข้ามา โดยดึง logo จาก (จัดการโลโก้ทีมประจำลีก (Batch Team Logos Manager)).
> ลองวางแผนให้หน่อย.

<details><summary>1 previous message</summary>

> ได้ครับ ผมจะวางแผนโดยอิงจากระบบโลโก้ที่มีอยู่จริงใน `Batch Team Logos Manager` และโครงสร้าง Browser Source ปัจจุบัน เพื่อออกแบบให้ Logo Source ใช้ข้อมูลชุดเดียวกัน ไม่เกิดการเก็บข้อมูลซ้ำ และทำงานสอดคล้องกับ Team Name/Score Source ครับ】【。
</details>

ได้ครับ จากโครงสร้างปัจจุบัน ระบบมีข้อมูลโลโก้พร้อมใช้อยู่แล้ว จึงสามารถเพิ่ม Logo Browser Source ได้โดยไม่ต้องสร้างระบบจัดการโลโก้ใหม่

## แนวทางที่แนะนำ

ให้ `Batch Team Logos Manager` เป็นแหล่งข้อมูลหลัก:

```text
Batch Team Logos Manager
        ↓
Firebase /teams/
        ↓
Scoreboard Controller โหลดเข้า Global Logo Cache
        ↓
getLogoSrc() resolve URL โลโก้
        ↓
ScoreboardState ผ่าน BroadcastChannel
        ↓
Logo Browser Source ใน OBS
```

ไม่แนะนำให้ Logo Browser Source ต่อ Firebase โดยตรง เพราะจะทำให้ต้องส่ง Firebase Config ไปกับ Browser Source และเกิด Listener ซ้ำหลายจุด

## รูปแบบ Logo Browser Source

ใช้ Route เดิมร่วมกับระบบปัจจุบัน:

```text
/goal-animation?template=team-logos&side=A
/goal-animation?template=team-logos&side=B
```

แนะนำให้สร้าง Source แยกกัน:

```text
Logo_Display_A
Logo_Display_B
```

เหตุผลคือสามารถปรับตำแหน่ง, ขนาด และการแสดงผลของแต่ละทีมใน OBS ได้อิสระ

ระยะแรกให้เป็น Logo แบบ Persistent:

- แสดงโลโก้ทีมปัจจุบันค้างไว้
- เปลี่ยนทันทีเมื่อเปลี่ยนทีม
- ไม่ทำ Goal Animation ซ้ำกับ Team Name/Score
- ถ้าไม่มีโลโก้ ให้แสดงเป็นพื้นโปร่งใสหรือซ่อนตัวเอง

## แผนพัฒนา

### 1. เพิ่ม Logo Browser Component

สร้างไฟล์ใหม่ เช่น:

```text
src/components/LogoOnlyAnimation.tsx
src/components/LogoOnlyAnimation.css
```

หน้าที่:

- อ่าน `side` จาก URL
- ฟัง `ScoreboardState`
- ดึง `logoA` หรือ `logoB`
- แสดง `<img>` แบบ `object-fit: contain`
- รองรับการเปลี่ยนโลโก้แบบ real-time
- ซ่อนภาพเมื่อ URL โหลดไม่ได้
- รองรับ fallback โดยไม่ทำให้ OBS แสดงกรอบหรือข้อความที่ไม่ต้องการ

### 2. เพิ่ม Template ใหม่ในระบบ Goal Animation

ปรับ:

```text
src/components/goalAnimationTemplates.ts
src/components/GoalAnimationOverlay.tsx
```

เพิ่ม Template:

```ts
'team-logos'
```

แล้วให้ `GoalAnimationOverlay` เลือก Component ตาม URL:

```text
template=team-names → TeamNamesAnimation
template=score-only  → ScoreOnlyAnimation
template=team-logos  → LogoOnlyAnimation
```

### 3. ใช้ข้อมูล Logo ที่มีอยู่แล้ว

ปัจจุบัน `ScoreboardState` มีข้อมูลเหล่านี้อยู่แล้ว:

```ts
logoA
logoB
```

และ `ScoreboardController` ใช้ `getLogoSrc()` เพื่อ resolve ตามลำดับ:

1. URL ที่กำหนดโดยตรง
2. URL จาก Batch Team Logos Manager
3. Logo ใน Global Firebase Cache
4. Local logo folder ในโหมด Development
5. `/public/logos/ชื่อทีม.png`

ดังนั้นไม่จำเป็นต้องเปลี่ยน Protocol หลัก เพียงเพิ่มให้ Logo Source อ่านข้อมูลชุดเดียวกัน

### 4. แก้การอัปเดตหลังบันทึกโลโก้

ปัจจุบันเมื่อ Batch Manager บันทึกโลโก้:

```text
Firebase teams/ ถูกอัปเดต
Global Logo Cache ถูกอัปเดต
```

ควรตรวจสอบให้ `ScoreboardController` ส่ง `ScoreboardState` ใหม่ทันทีหลัง Cache เปลี่ยน โดยเพิ่ม `teamsCacheVersion` เข้า Dependency ของ Effect ที่ Broadcast State

เพื่อให้ลำดับเป็น:

```text
บันทึกโลโก้ใน Batch Manager
↓
Firebase อัปเดต
↓
Global Cache อัปเดต
↓
ScoreboardState ถูก Broadcast ใหม่
↓
Logo Browser Source เปลี่ยนภาพทันที
```

จุดนี้สำคัญ เพราะถ้าไม่กระตุ้น Broadcast ใหม่ Logo Source อาจยังแสดง URL เก่าอยู่จนกว่าจะเปลี่ยนทีม

### 5. เพิ่ม URL Builder และ Quick Setup

สร้าง Utility ใหม่ เช่น:

```text
src/utils/logoBrowserUrl.ts
```

รับผิดชอบสร้าง URL:

```text
/goal-animation?template=team-logos&side=A
/goal-animation?template=team-logos&side=B
```

เพิ่ม Panel ใน `QuickSetupModal`:

- Logo Browser Source
- แสดง Preview
- Copy URL
- Quick Add Logo A/B to OBS
- Update Logo Sources

### 6. เพิ่ม OBS Configuration

เพิ่มใน:

```text
src/config/obsSetupConfig.ts
src/services/obsSetupService.ts
```

กำหนดค่าเบื้องต้น:

```ts
Logo_Display_A
Logo_Display_B
```

Settings ที่ควรใช้:

- Browser Source ขนาด 1920×1080
- พื้นหลังโปร่งใส
- `shutdown: false`
- `restart_when_active: false`
- `object-fit: contain`

### 7. Migration จาก Image Source เดิม

ปัจจุบันมี Image Source เดิม:

```text
logo_team_a
logo_team_b
```

เมื่อกด Quick Add Logo Browser Source:

1. สร้างหรืออัปเดต `Logo_Display_A`
2. สร้างหรืออัปเดต `Logo_Display_B`
3. เปิดใช้งาน Browser Source ใหม่
4. ซ่อน `logo_team_a` และ `logo_team_b`
5. ไม่ลบ Source เดิม เพื่อให้ย้อนกลับได้

ควรทำให้การซ่อน Source เดิมเกิดขึ้นหลังสร้าง Browser Source สำเร็จเท่านั้น เพื่อป้องกันกรณี OBS ตั้งค่าไม่ครบแล้วโลโก้หายจากหน้าจอ

## ความปลอดภัยและประสิทธิภาพ

- ไม่ส่ง Firebase Config ไปใน URL ของ Browser Source
- ตรวจสอบเฉพาะ URL โลโก้ที่เป็น `http://` หรือ `https://`
- ใช้ Global Cache เดิม ลดการเปิด Firebase Listener ซ้ำ
- ไม่โหลดภาพใหม่หาก URL ยังเหมือนเดิม
- รองรับ fallback เมื่อ Cloudinary หรือ Firebase ใช้งานไม่ได้
- Source ต้องเปิดจาก Origin เดียวกับ Controller เพื่อให้ `BroadcastChannel` ทำงาน
- คง `localStorage` เป็นข้อมูลล่าสุดกรณี Browser Source Refresh

## การทดสอบ

จะทดสอบอย่างน้อย:

- URL ของ Logo A/B ถูกต้อง
- รับ `logoA` และ `logoB` ได้ถูกฝั่ง
- เปลี่ยนโลโก้ทันทีหลัง Batch Manager บันทึก
- ไม่มีโลโก้แล้วไม่แสดง Broken Image
- URL เสียหรือโหลดไม่ได้ไม่ทำให้ Overlay พัง
- Logo Source ไม่บัง Team Name หรือ Score Source
- OBS สร้าง Source และซ่อน Image Source เดิมถูกต้อง
- TypeScript, Lint, Unit Test และ Production Build

สมมติฐานของแผนนี้คือ Logo Browser Source จะแสดงโลโก้ค้างแบบ Persistent ก่อน ยังไม่เพิ่ม Animation ตอนยิงประตู เพื่อไม่ให้ชนกับ Animation ของ Team Name และ Score ครับ

> เริ่มการพัฒนาตามแผนการ.

<details><summary>7 previous messages</summary>

> เริ่มพัฒนาระบบ Logo Browser Source ตามแผนครับ โดยจะใช้ข้อมูลโลโก้จาก `Batch Team Logos Manager` ผ่าน `ScoreboardState` เดิม ไม่สร้าง Firebase Listener ซ้ำใน Browser Source และจะเพิ่ม Source แยก `Logo_Display_A` / `Logo_Display_B` พร้อมซ่อน Image Source เดิมหลังตั้งค่าสำเร็จครับ
>
> <details><summary>Created 4 files, edited 6 files</summary>
>
> - Wrote `./src/components/GoalAnimationOverlay.tsx` (+11 -6)
> - Wrote `./src/components/LogoOnlyAnimation.css` (+32 -0)
> - Wrote `./src/components/LogoOnlyAnimation.tsx` (+104 -0)
> - Wrote `./src/components/goalAnimationTemplates.ts` (+9 -7)
> - Wrote `./src/utils/logoBrowserUrl.test.ts` (+10 -0)
> - Wrote `./src/utils/logoBrowserUrl.ts` (+11 -0)
> - Wrote `./src/config/obsSetupConfig.ts` (+46 -8)
> - Wrote `./src/services/obsSetupService.ts` (+85 -9)
> - Wrote `./src/components/ScoreboardController.tsx` (+49 -7)
> - Wrote `./src/components/ScoreboardController.tsx` (+14 -7)
> - Wrote `./src/components/QuickSetupModal.tsx` (+64 -13)
>
> </details>
>
> โครงสร้างหลักถูกเชื่อมแล้วครับ: เพิ่ม Template `team-logos`, Component รับ `logoA/logoB` จาก `ScoreboardState`, URL Builder, Quick Setup และ OBS Setup Service ตอนนี้กำลังตรวจ compile ก่อนเก็บรายละเอียด UI/การ migrate Source เดิมครับ
>
> <details><summary>Edited 2 files</summary>
>
> - Wrote `./src/components/LogoOnlyAnimation.tsx` (+2 -0)
> - Wrote `./src/config/obsSetupConfig.ts` (+2 -2)
>
> </details>
>
> ตรวจ compile, lint และ tests ผ่านแล้วครับ (16 ไฟล์ / 118 tests) ผมเพิ่มการขอ `ScoreboardState` เมื่อ Logo Source เปิดขึ้นมา เพื่อให้แสดงโลโก้ล่าสุดได้แม้เปิดหลัง Controller จากนั้นจะรัน production build และตรวจ diff รอบสุดท้ายครับ
>
> ฟีเจอร์ทำงานครบในระดับโค้ดแล้วครับ ผมตรวจพบว่า Logo Source ใหม่จะถูกสร้างผ่าน Quick Setup (เช่นเดียวกับ Team Name/Score) ส่วนไฟล์ OBS Scene Collection เดิมเป็น Template คงที่และไม่ได้ถูกใช้เป็นเส้นทางหลักของการเพิ่ม Source รอบนี้ จึงคงวิธี Quick Add/Update ที่ปลอดภัยไว้ และกำลังเพิ่มเอกสารการใช้งานพร้อมตรวจสถานะสุดท้ายครับ
>
> <details><summary>Created a file</summary>
>
> - Wrote `./docs/logo-browser-source.md` (+35 -0)
>
> </details>
</details>

พัฒนาระบบ Logo Browser Source เสร็จแล้วครับ

สิ่งที่เพิ่ม:

- เพิ่ม Template `team-logos`
- เพิ่ม Component แสดงโลโก้แบบโปร่งใส
- รองรับ URL:

```text
/goal-animation?template=team-logos&side=A
/goal-animation?template=team-logos&side=B
```

- เพิ่ม Quick Setup สำหรับ Logo Browser Source
- เพิ่ม OBS Sources:

```text
Logo_Display_A
Logo_Display_B
```

- ใช้โลโก้จาก `Batch Team Logos Manager` ผ่าน `ScoreboardState`
- บันทึกโลโก้ใน Firebase แล้ว Browser Source อัปเดตแบบ Live
- ซ่อน Image Source เดิม `logo_team_a` และ `logo_team_b` หลัง Quick Add สำเร็จ
- มี fallback ผ่าน localStorage และ `/public/logos`
- ไม่เปิด Firebase Listener ซ้ำใน OBS Browser Source

ไฟล์หลัก:

- [LogoOnlyAnimation.tsx](/D:/React_Scoreboard/src/components/LogoOnlyAnimation.tsx)
- [LogoOnlyAnimation.css](/D:/React_Scoreboard/src/components/LogoOnlyAnimation.css)
- [logoBrowserUrl.ts](/D:/React_Scoreboard/src/utils/logoBrowserUrl.ts)
- [logo-browser-source.md](/D:/React_Scoreboard/docs/logo-browser-source.md)

การใช้งาน:

1. เปิด `Quick Setup`
2. เปิดหัวข้อ `Logo Browser Source`
3. กด `Quick Add Logo A/B to OBS`
4. ตรวจสอบ Source `Logo_Display_A` และ `Logo_Display_B` ใน OBS

ผลตรวจสอบ:

- TypeScript ผ่าน
- Lint ผ่าน
- Tests: 16 ไฟล์ / 118 tests ผ่าน
- Production build ผ่าน

มีเพียงคำเตือนเดิมเรื่อง Bundle `exceljs` ขนาดใหญ่ครับ

> ในส่วนของหัวข้อ Logo Browser Source เพิ่ม function ให้สามารถปรับขนาด logo ได้อย่างอิสระ.
> และเพิ่ม checkbox สำหรับทำให้ภาพเป็น no bg หรือ ให้แสดงภาพปกติ.
> ทำการวางแผนให้ก่อน พัฒนานะ.

รับทราบครับ รอบนี้จะวางแผนก่อน ยังไม่แก้โค้ด โดยจะตรวจเส้นทางปัจจุบันของ Logo Browser Source, การสร้าง URL และการตั้งค่า OBS เพื่อออกแบบให้ปรับขนาดได้อิสระและส่งค่าโหมดพื้นหลังไปยัง Browser Source ได้อย่างถูกต้องครับ

> ทำต่อครับ

<details><summary>2 previous messages</summary>

> ผมจะพัฒนาต่อโดยใช้ค่าขนาดแยก Team A/B และ Checkbox โหมด `No BG = พื้นหลังโปร่งใส` / `ปกติ = แสดงพื้นหลังของพื้นที่โลโก้` ครับ หมายเหตุสำคัญคือ CSS ไม่สามารถลบพื้นหลังที่ฝังอยู่ในไฟล์รูปภาพได้ หากเป็น PNG/JPG ที่มีพื้นหลังติดมา จะยังคงต้องใช้ไฟล์โปร่งใสหรือระบบลบพื้นหลังแยกต่างหากครับ
>
> <details><summary>Created 2 files, edited 2 files</summary>
>
> - Wrote `./src/types/logoBrowserSettings.test.ts` (+23 -0)
> - Wrote `./src/types/logoBrowserSettings.ts` (+38 -0)
> - Wrote `./src/utils/logoBrowserUrl.test.ts` (+18 -2)
> - Wrote `./src/utils/logoBrowserUrl.ts` (+49 -4)
>
> </details>
</details>

> ทำต่อครับ.

> ทำต่อครับ.

<details><summary>1 previous message</summary>

> System error
>
> You've hit your usage limit. To continue using Codex and get access to GPT-5.3-Codex, start a free trial of Plus today (https://chatgpt.com/explore/plus), or try again at Sep 14th, 2026 4:05 PM.
</details>
