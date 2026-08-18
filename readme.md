# เตรียมพัฒนา React ระดับสูง

> คุณคือ "Senior React Specialist & Frontend Architect" ระดับ World-Class ที่มีความเชี่ยวชาญสูงสุดในระบบ React Ecosystem (React 18/19, Next.js App Router, TypeScript, State Management, Performance Optimization, และ Testing)
>
> เป้าหมายของคุณคือการช่วยฉันพัฒนา React Application ให้มีคุณภาพสูงสุด สะอาด อ่านง่าย ปลอดภัย และมี Performance ที่ดีที่สุด
>
> [กฎและแนวทางการทำงานของคุณ]
>
> 1. การเขียนโค้ด (Code Standards):
>
>    - ใช้ TypeScript แบบ Strict Type เสมอ (ห้ามใช้ `any` เด็ดขาด เว้นแต่จำเป็นจริงๆ และต้องอธิบายเหตุผล)
>    - ใช้ Modern React Standards (Functional Components, Custom Hooks, Modern State Management)
>    - ปฏิบัติตามหลัก Clean Code, SOLID Principles และ DRY (Don't Repeat Yourself)
>    - แยก Logic กับ UI ออกจากกันอย่างชัดเจน (เช่น ใช้ Custom Hooks สำหรับ Business Logic)
>
> 2. การแก้ปัญหาและ Debugging:
>
>    - วิเคราะห์สาเหตุของปัญหาอย่างตรงจุด (Root Cause Analysis) ก่อนเสนอวิธีแก้ไข
>    - หากมี Error หรือ Bug ให้เสนอวิธีแก้พร้อมอธิบายว่า "ทำไมถึงเกิด Error นี้" และ "วิธีแก้ไขนี้ทำงานอย่างไร"
>    - ถ้ามีวิธีแก้หลายแบบ ให้เปรียบเทียบข้อดี-ข้อเสีย (Pros/Cons) และแนะนำวิธีที่ดีที่สุดตาม Context
>
> 3. การปรับแต่ง Performance (Optimization):
>
>    - คำนึงถึง Re-rendering, Memory Leaks, และ Bundle Size อยู่เสมอ
>    - แนะนำการใช้ `useMemo`, `useCallback`, `React.memo` หรือ Server/Client Components อย่างเหมาะสม ไม่พร่ำเพรื่อ
>
> 4. สไตล์การสื่อสาร:
>
>    - ตอบอย่างกระชับ ตรงประเด็น และเป็นมืออาชีพ
>    - เขียนโค้ดแบบสมบูรณ์ที่สามารถนำไปใช้งานได้จริง (Production-Ready)
>    - หากคำถามหรือ Requirement ไม่ชัดเจน ให้ถามคำถามเพื่อรวบรวมบริบทที่จำเป็นก่อนล่วงหน้า
>
> หากคุณเข้าใจบทบาทนี้แล้ว ตอบกลับสั้นๆ ว่า "พร้อมสำหรับการพัฒนา React ระดับสูงสุดแล้วครับ โปรดส่งโจทย์หรือปัญหาของคุณมาได้เลย"

พร้อมสำหรับการพัฒนา React ระดับสูงสุดแล้วครับ โปรดส่งโจทย์หรือปัญหาของคุณมาได้เลย

> ช่วยวิเคราะห์โปรเจกต์ที่อยู่ในโฟลเดอร์นี้ให้ผมอย่างละเอียด โดยขอให้ครอบคลุมหัวข้อเหล่านี้:
>
>    1. ภาษาและเทคโนโลยีหลัก: โปรเจกต์นี้พัฒนาด้วยภาษาโปรแกรมมิ่งอะไร, ใช้ Framework, Library หรือเครื่องมืออะไรบ้าง (ดูจากไฟล์ Config เช่น package.json, requirements.txt, pom.xml หรือโครงสร้างโฟลเดอร์)
>    2. โครงสร้างโปรเจกต์: โครงสร้างโฟลเดอร์หลักมีอะไรบ้าง และแต่ละโฟลเดอร์ทำหน้าที่เกี่ยวกับอะไร
>    3. ฟังก์ชันและการทำงานหลัก (Core Functions/Features): โปรเจกต์นี้ทำอะไรได้บ้าง มีฟังก์ชันหลักหรือโมดูลสำคัญอะไรบ้าง อธิบายการทำงานคร่าวๆ ของแต่ละส่วน
>    4. จุดเริ่มต้นของโปรแกรม (Entry Point): ไฟล์ไหนคือจุดเริ่มต้นหลัก (Main file) ที่ควรเปิดดูหรือรันก่อนเป็นอันดับแรก
> 5. วิธีรันโปรเจกต์ (Quick Start): ขอคำแนะนำเบื้องต้นหรือคำสั่ง (Command) ในการติดตั้งและรันโปรเจกต์นี้ขึ้นมาใช้งานในเครื่อง

<details><summary>6 previous messages</summary>

> ผมจะสำรวจไฟล์ Config, โครงสร้างโฟลเดอร์ และจุดที่ประกอบเป็นฟีเจอร์หลักก่อน จากนั้นจะสรุปภาพรวมพร้อมคำสั่งรันที่อ้างอิงจากโปรเจกต์จริงครับ
>
> <details><summary>Ran 5 commands</summary>
>
> - Ran `Get-ChildItem -Force | Select-Object Mode,Length,LastWriteTime,Name`
> - Ran `if (Test-Path package.json) { Get-Content package.json } ; if (Test-Path tsconfig.json) { Write-Output '--- tsconfig.json ---'; Get-Content tsconfig.json } ; if (Test-Path vite.config.ts) { Write-Output '--- vite.config.ts ---'; Get-Content vite.config.ts } ; if (Test-Path next.config.js) { Write-Output '--- next.config.js ---'; Get-Content next.config.js } ; if (Test-Path README.md) { Write-Output '--- README.md ---'; Get-Content README.md -TotalCount 240 }`
> - Ran `rg --files -g '!node_modules' -g '!dist' -g '!build' -g '!coverage' | Select-Object -First 250`
> - Ran `Get-ChildItem -Force | Select-Object Mode,Length,LastWriteTime,Name`
> - Ran `Get-Location; Get-ChildItem -Force | Select-Object Name,Mode,Length`
>
> </details>
>
> การตรวจสอบครั้งแรกติดข้อจำกัดของตัว runner ที่เปิด PowerShell ใน workspace ไม่สำเร็จ ผมจะลองเรียกแบบสิทธิ์ยกระดับเฉพาะการอ่านไฟล์ เพื่อให้ได้ข้อมูลจริงของโปรเจกต์ครับ
>
> <details><summary>Ran 7 commands</summary>
>
> - Ran `Get-ChildItem -Force | Select-Object Mode,Length,LastWriteTime,Name`
> - Ran `Get-Content package.json; Write-Output '--- tsconfig.json ---'; Get-Content tsconfig.json; Write-Output '--- tsconfig.app.json ---'; Get-Content tsconfig.app.json; Write-Output '--- vite.config.ts ---'; Get-Content vite.config.ts; Write-Output '--- tailwind.config.js ---'; Get-Content tailwind.config.js; Write-Output '--- README candidates ---'; Get-ChildItem -File -Filter README* | ForEach-Object { Write-Output ('--- ' + $_.Name + ' ---'); Get-Content $_.FullName -TotalCount 240 }`
> - Ran `rg --files -g '!node_modules' -g '!dist' -g '!build' -g '!coverage' | Select-Object -First 300`
> - Ran `Get-ChildItem src -Recurse -File | Select-Object FullName,Length | Sort-Object FullName; Write-Output '--- public ---'; Get-ChildItem public -Recurse -File | Select-Object FullName,Length | Sort-Object FullName; Write-Output '--- scripts ---'; Get-ChildItem scripts -Recurse -File | Select-Object FullName,Length | Sort-Object FullName`
> - Ran `Write-Output '--- .env.example ---'; Get-Content .env.example; Write-Output '--- index.html ---'; Get-Content index.html; Write-Output '--- vitest.config.ts ---'; Get-Content vitest.config.ts; Write-Output '--- postcss.config.js ---'; Get-Content postcss.config.js; Write-Output '--- vercel.json ---'; Get-Content vercel.json; Write-Output '--- fallback script ---'; Get-Content scripts/create-spa-fallback.mjs`
> - Ran `rg -n "^(import|export)|createBrowserRouter|BrowserRouter|Routes|Route|Firebase|OBS|replay|Excel|macro|scoreboard|Admin|firebase|use[A-Z]" src/App.tsx src/main.tsx src/components src/hooks src/context src/services src/utils src/macros | Select-Object -First 500`
> - Ran `Get-Content src/main.tsx; Write-Output '--- App.tsx ---'; Get-Content src/App.tsx`
>
> </details>
>
> จากโครงสร้างเบื้องต้นพบว่าเป็น Vite + React 19 + TypeScript แบบแอป SPA สำหรับควบคุมสกอร์บอร์ดฟุตบอลและเชื่อมต่อ OBS/Firebase โดยมีหลายหน้าแยกสำหรับ Controller, Overlay, Replay และตารางคะแนน ผมกำลังไล่ดู data flow และโมดูลสำคัญเพื่อไม่สรุปจากชื่อไฟล์เพียงอย่างเดียวครับ
>
> <details><summary>Ran 27 commands</summary>
>
> - Ran `Get-Content src/components/AuthGuard.tsx; Write-Output '--- firebaseAuth ---'; Get-Content src/config/firebaseAuth.ts; Write-Output '--- useScoreboardFirebase ---'; Get-Content src/hooks/useScoreboardFirebase.ts; Write-Output '--- useScoreboardDatabase ---'; Get-Content src/hooks/useScoreboardDatabase.ts`
> - Ran `Get-Content src/components/ScoreboardController.tsx -TotalCount 260`
> - Ran `Write-Output '--- component imports ---'; rg -n "^import |^export default|^export function" src/components src/pages | Select-Object -First 400; Write-Output '--- hook imports/exports ---'; rg -n "^import |^export function|^export const|^export default" src/hooks src/context src/services src/config src/utils src/macros | Select-Object -First 500`
> - Ran `Get-Content src/components/OverlayContainer.tsx; Write-Output '--- penalty controller ---'; Get-Content src/components/PenaltyShootoutController.tsx -TotalCount 240; Write-Output '--- instant replay page ---'; Get-Content src/components/InstantReplayPage.tsx -TotalCount 240`
> - Ran `Write-Output '--- var replay page ---'; Get-Content src/components/var-replay-v2/VarReplayV2Page.tsx -TotalCount 280; Write-Output '--- obs websocket hook ---'; Get-Content src/hooks/useOBSWebSocket.ts; Write-Output '--- obs setup config summary ---'; rg -n "export const|name:|scene|source|Browser|OBS" src/config/obsSetupConfig.ts | Select-Object -First 220`
> - Ran `rg -n "const handle|function handle|onClick=|navigate\(|setShow|useScoreboard|useOBS|useTimer|Excel|Firebase|OBS|Replay|Penalty|Macro|Logo|Team|score" src/components/ScoreboardController.tsx | Select-Object -First 350`
> - Ran `Get-Content src/components/var-replay-v2/varReplayV2Protocol.ts; Get-Content src/components/var-replay-v2/useVarReplayV2Channel.ts -TotalCount 220; Get-Content src/components/var-replay-v2/varReplayKeybindings.ts -TotalCount 180`
> - Ran `Get-Content src/components/InstantReplayPage.tsx -TotalCount 220`
> - Ran `Get-Content src/components/PenaltyShootoutController.tsx -TotalCount 220`
> - Ran `Get-Content src/components/OverlayContainer.tsx -TotalCount 220`
> - Ran `Get-Content src/hooks/useAutoMacros.ts -TotalCount 260; Write-Output '--- macro types ---'; Get-Content src/types/macro.ts; Write-Output '--- macro executor ---'; Get-Content src/macros/macroExecutor.ts -TotalCount 240`
> - Ran `Get-Content src/hooks/useReplayPlaylist.ts; Write-Output '--- replay channel ---'; Get-Content src/hooks/useReplayChannel.ts; Write-Output '--- replay control imports ---'; rg -n "^import |^export default|function |useReplay|Broadcast|File|video|OBS" src/components/InstantReplayControl.tsx src/components/InstantReplayScreen.tsx | Select-Object -First 260`
> - Ran `Get-Content src/hooks/useScoreboardFirebase.ts; Write-Output '--- database ---'; Get-Content src/hooks/useScoreboardDatabase.ts -TotalCount 260; Write-Output '--- channels ---'; Get-Content src/hooks/useScoreboardChannels.ts -TotalCount 240`
> - Ran `npm run lint`
> - Ran `npm test`
> - Ran `rg -n "from ['\"](exceljs|xlsx|firebase|obs-websocket-js|react-router-dom|react-easy-crop)|BroadcastChannel|localStorage|File System Access|showDirectoryPicker|MediaSource" src | Select-Object -First 420`
> - Ran `Get-Content tailwind.config.js; Write-Output '--- index.css head ---'; Get-Content src/index.css -TotalCount 100; Write-Output '--- css files ---'; Get-ChildItem src -Recurse -File -Include *.css,*.module.css | Select-Object FullName,Length`
> - Ran `Get-Content src/components/AllScoresStandalone.tsx -TotalCount 180; Write-Output '--- league table ---'; Get-Content src/components/LeagueTableStandalone.tsx -TotalCount 180; Write-Output '--- combined ---'; Get-Content src/components/AllScoreCombinedStandalone.tsx -TotalCount 150`
> - Ran `Get-Content tailwind.config.js; Write-Output '--- index.css head ---'; Get-Content src/index.css -TotalCount 100; Write-Output '--- css files ---'; Get-ChildItem src -Recurse -File -Include *.css,*.module.css | Select-Object FullName,Length`
> - Ran `rg -n "BroadcastChannel|localStorage|showDirectoryPicker|MediaSource|exceljs|xlsx|firebase|obs-websocket-js|react-router-dom|react-easy-crop" src | Select-Object -First 420`
> - Ran `Get-Content src/components/AllScoresStandalone.tsx -TotalCount 180; Write-Output '--- league table ---'; Get-Content src/components/LeagueTableStandalone.tsx -TotalCount 180; Write-Output '--- combined ---'; Get-Content src/components/AllScoreCombinedStandalone.tsx -TotalCount 150`
> - Ran `Get-Content src/hooks/useObsVideoFolder.ts -TotalCount 380`
> - Ran `Get-Content src/config/firebaseAuth.ts -TotalCount 390`
> - Ran `Get-Content src/utils/excelParserCore.ts; Write-Output '--- excel parser exports ---'; rg -n "^export (async )?function|^export const|^export interface|^export type" src/utils/excelParser.ts`
> - Ran `Get-ChildItem src -Directory | Select-Object Name; Get-ChildItem src/components -Directory | Select-Object Name; Get-ChildItem public -Directory | Select-Object Name; Get-ChildItem images,logos,excel,fonts -File | Measure-Object | Select-Object Count`
> - Ran `Get-ChildItem .github,.kiro,.vscode,docs,plugin -Recurse -File -ErrorAction SilentlyContinue | Select-Object FullName,Length | Sort-Object FullName`
> - Ran `Get-Content .github/workflows/deploy.yml; Write-Output '--- docs summary headings ---'; rg -n "^#|^##" docs TAILWIND_INSTALLATION_SUMMARY.md .kiro/specs | Select-Object -First 180`
>
> </details>
</details>

## ภาพรวม

โปรเจกต์นี้คือ **Football Scoreboard Controller** สำหรับควบคุมกราฟิกการแข่งขันฟุตบอลและส่งภาพไปยัง OBS Studio โดยทำงานเป็น SPA บน Browser และเชื่อมต่อกับ Firebase Realtime Database, OBS WebSocket และไฟล์วิดีโอ Replay ในเครื่อง

จุดเริ่มต้นที่ควรอ่านคือ [src/main.tsx](/D:/React_Scoreboard/src/main.tsx) → [src/App.tsx](/D:/React_Scoreboard/src/App.tsx) → [ScoreboardController.tsx](/D:/React_Scoreboard/src/components/ScoreboardController.tsx)

---

## 1. ภาษาและเทคโนโลยีหลัก

### ภาษา

- TypeScript
- JavaScript / ESM สำหรับไฟล์ Config และ Script
- CSS
- Lua สำหรับ OBS Hotkey Plugin

### Framework และ Library

อ้างอิงจาก [package.json](/D:/React_Scoreboard/package.json)

| หมวด | เทคโนโลยี |
|---|---|
| UI | React 19.2 |
| Build Tool | Vite 8 |
| Routing | React Router DOM 7 |
| Backend/Data | Firebase 12, Realtime Database, Firebase Auth |
| OBS Integration | obs-websocket-js 5 |
| Excel | `xlsx`, `exceljs` |
| Image Crop | react-easy-crop |
| Styling | Tailwind CSS 3, PostCSS, Autoprefixer, CSS Modules |
| Testing | Vitest, Testing Library, jsdom |
| Linting | Oxlint |
| Deployment | GitHub Pages, Vercel |
| Runtime communication | BroadcastChannel, localStorage, IndexedDB |

โปรเจกต์ใช้ React แบบ Functional Components และมีการใช้ `lazy()` + `Suspense` เพื่อแบ่งโหลดหน้าและลด Initial Bundle

### การตั้งค่า TypeScript

มีการตั้งค่า strict checks บางส่วน เช่น

- `noUnusedLocals`
- `noUnusedParameters`
- `noFallthroughCasesInSwitch`
- `verbatimModuleSyntax`

แต่ยังไม่ได้เปิด `"strict": true` ใน [tsconfig.app.json](/D:/React_Scoreboard/tsconfig.app.json) และยังพบการใช้ `any` หลายจุด จึงยังไม่ใช่ TypeScript Strict เต็มรูปแบบ

---

## 2. โครงสร้างโปรเจกต์

### โฟลเดอร์หลัก

| โฟลเดอร์ | หน้าที่ |
|---|---|
| `src/` | Source code หลักของ React Application |
| `src/components/` | React Components, Modal, Controller และ Overlay |
| `src/hooks/` | Custom Hooks สำหรับ Business Logic และ Side Effects |
| `src/context/` | React Context เช่น OBS Video Folder และ Auth Access |
| `src/config/` | Firebase และ OBS Configuration |
| `src/constants/` | ค่าคงที่ เช่น Translation และ Upload Config |
| `src/macros/` | ระบบ Custom Macro และ Automation |
| `src/services/` | Service Layer สำหรับตั้งค่า OBS |
| `src/types/` | TypeScript interfaces และ domain models |
| `src/utils/` | Excel parser, URL builder, Logo resolver และ formatter |
| `src/pages/` | หน้าเฉพาะกิจ เช่น Tailwind Test Page |
| `src/styles/` | Font และ style เฉพาะส่วน |
| `public/` | Static assets และทีมโลโก้ |
| `images/` | Background, Logo และภาพประกอบ |
| `logos/` | โลโก้ทีมสำหรับระบบภายใน/OBS |
| `excel/` | ไฟล์ Excel ตัวอย่างและข้อมูลการแข่งขัน |
| `fonts/` | Font ภาษาไทย |
| `plugin/` | OBS Lua script และ installer |
| `scripts/` | Script หลัง Build เช่นสร้าง `404.html` |
| `docs/` | เอกสาร Tailwind และ Migration |
| `.github/workflows/` | GitHub Actions สำหรับ Deploy |
| `.kiro/specs/` | Requirements และ Design ของฟีเจอร์ |
| `dist/` | Production build ที่ generate แล้ว |
| `node_modules/` | Dependencies ที่ติดตั้งแล้ว |

### โครงสร้างภายใน `src`

```text
src/
├── App.tsx
├── main.tsx
├── components/
│   ├── ScoreboardController.tsx
│   ├── OverlayContainer.tsx
│   ├── InstantReplay*
│   ├── Penalty*
│   ├── GoalAnimation*
│   ├── Logo*
│   ├── Team*
│   └── var-replay-v2/
├── hooks/
├── context/
├── config/
├── services/
├── macros/
├── types/
├── utils/
├── constants/
├── pages/
└── styles/
```

---

## 3. ฟังก์ชันและการทำงานหลัก

### 3.1 Scoreboard Controller

ไฟล์หลักคือ [ScoreboardController.tsx](/D:/React_Scoreboard/src/components/ScoreboardController.tsx)

รองรับ:

- ตั้งชื่อทีม A/B
- ตั้งคะแนน
- ตั้งเวลาและครึ่งการแข่งขัน
- ตั้งสีทีม 2 สี
- ตั้ง Logo ทีม
- แสดง Label เช่น รอบ, สนาม, สัปดาห์
- สลับทีม
- ควบคุมด้วย Keyboard และ OBS Hotkey
- บันทึกผลการแข่งขันลง Firebase
- เปิด Modal สำหรับ Settings, Replay, Penalty และ Database
- สร้าง URL สำหรับ OBS Browser Sources
- Synchronize ข้อมูลไปยัง OBS แบบอัตโนมัติ

### 3.2 Firebase Authentication และ Access Control

ไฟล์สำคัญ:

- [AuthGuard.tsx](/D:/React_Scoreboard/src/components/AuthGuard.tsx)
- [firebaseAuth.ts](/D:/React_Scoreboard/src/config/firebaseAuth.ts)

ระบบรองรับ:

- Login ด้วย Google
- ตรวจสอบ Whitelist
- Super Admin
- สถานะ `allowed`, `denied`, `pending`
- Trial ใช้งานฟรี 7 วัน
- บันทึกประวัติการ Login
- Admin จัดการสิทธิ์ผู้ใช้งานผ่าน Firebase Realtime Database

หน้า Admin:

```text
/admin/whitelist
/whitelist
```

### 3.3 Excel Import และ Firebase Database

ใช้ [excelParser.ts](/D:/React_Scoreboard/src/utils/excelParser.ts) และ `excelParserCore.ts`

รองรับ:

- Upload ไฟล์ `.xlsx`
- โหลดจาก URL ของ Excel หรือ Google Sheets
- จดจำ URL ที่ใช้บ่อย
- Auto-detect column mapping
- อ่านข้อมูล Match ID, Team A/B, Logo, สี และ Label
- อ่าน Firebase Configuration จาก Sheet
- รองรับ Team Sheet พร้อมสีทีม
- สร้าง Firebase Target หลายลีก
- โหลดข้อมูลการแข่งขันจาก Firebase
- แก้ไขและลบ Match ใน Database

### 3.4 OBS WebSocket Integration

ไฟล์หลัก:

- [useOBSWebSocket.ts](/D:/React_Scoreboard/src/hooks/useOBSWebSocket.ts)
- [obsSetupService.ts](/D:/React_Scoreboard/src/services/obsSetupService.ts)
- [obsSetupConfig.ts](/D:/React_Scoreboard/src/config/obsSetupConfig.ts)

รองรับ:

- เชื่อมต่อ OBS WebSocket ที่ `ws://localhost:4455`
- Reconnect อัตโนมัติ
- รับ OBS Custom Event และ Hotkey
- แก้ไข Text Source
- แก้ไข Image Source
- แก้ไขสี Source
- เปิด/ปิด Scene Item
- สร้างและอัปเดต Browser Source
- ตั้งค่า Scene และ Source อัตโนมัติ
- Synchronize Team Name, Logo และ Score ไปยัง OBS

### 3.5 Overlay และ Standalone Views

Routes สำคัญ:

```text
/overlay
/all-scores
/league-table
/all-score-combined
```

หน้าจอเหล่านี้ทำหน้าที่เป็น OBS Browser Source โดยอ่านข้อมูลจาก Firebase แบบ Realtime

รองรับ:

- ตารางอันดับ
- ผลการแข่งขันทั้งหมด
- ตารางคะแนนรวม
- Ticker
- กรองตามวันที่
- กำหนด Logo และ Background ผ่าน Query Parameters
- คำนวณ Win/Draw/Lose, Goal For, Goal Against, Goal Difference และ Points

### 3.6 Goal Animation และ Scoreboard Animation

Components ที่เกี่ยวข้อง:

- `GoalAnimationOverlay`
- `GoalAnimationOverlay.css`
- `ScoreOnlyAnimation`
- `TeamNamesAnimation`
- `LogoOnlyAnimation`

ใช้ `BroadcastChannel` และ localStorage เพื่อรับ Scoreboard State และแสดง Animation ในหน้าต่าง/แท็บอื่น

### 3.7 Instant Replay

Components หลัก:

- `InstantReplayControl`
- `InstantReplayScreen`
- `useReplayPlaylist`
- `useReplayChannel`

รองรับ:

- เลือกโฟลเดอร์วิดีโอ Replay
- อ่านไฟล์ผ่าน File System Access API
- Fallback เป็น input แบบเลือกโฟลเดอร์
- ค้นหา Replay ล่าสุด
- Playlist
- เล่นวิดีโอใน OBS Browser Source
- ควบคุม Play, Pause, Seek และ Speed
- สื่อสารระหว่าง Control Panel และ Screen ผ่าน BroadcastChannel
- เก็บ Playlist ใน localStorage

Routes:

```text
/replay
/replay/screen
```

### 3.8 VAR Replay V2

โฟลเดอร์:

```text
src/components/var-replay-v2/
```

รองรับ:

- เล่นวิดีโอ Replay
- กำหนด Marker A/B
- Loop ช่วง Replay
- ปรับ Speed
- Zoom และ Pan ภาพ
- Keyboard Shortcut
- แยก Control Mode และ Screen Mode
- ส่งคำสั่งผ่าน BroadcastChannel

Routes:

```text
/var-replay-v2
/var-replay-v2/screen
/var-replay
/var-replay/screen
```

### 3.9 Penalty Shootout

Components:

- `PenaltyShootoutController`
- `PenaltyShootoutModal`
- `PenaltyDotsOverlay`

รองรับ:

- บันทึกผลยิงจุดโทษของทั้งสองทีม
- แสดงจุดยิงสำเร็จ/ไม่สำเร็จ
- ตั้งค่าขนาดและระยะห่างของ Dot
- เลือก Layout
- ควบคุมการแสดง/ซ่อน Source ใน OBS

Routes:

```text
/penalty-shootout
/dots
```

### 3.10 Custom Macro และ Automation

โฟลเดอร์:

```text
src/macros/
```

รองรับ Event เช่น:

- กดปุ่มใน Scoreboard
- Keyboard Hotkey
- OBS Replay Buffer Saved
- OBS Stream State
- OBS Record State
- Scene Changed
- Video Playback Started/Ended

Action ที่ทำได้:

- เปลี่ยน Scene
- แสดง/ซ่อน Source
- หน่วงเวลา
- เปิด/ปิด VAR Replay
- เปิด/ปิด Replay Control
- Save Replay Buffer
- โหลด Replay ล่าสุด

Macro ถูกเก็บใน localStorage และมีระบบ Log, Status, Abort และ Timeout

---

## 4. จุดเริ่มต้นของโปรแกรม

ลำดับการทำงานคือ:

```text
src/main.tsx
  ↓
src/App.tsx
  ↓
BrowserRouter
  ↓
Route "/"
  ↓
AuthGuard
  ↓
ScoreboardController
```

### ไฟล์ที่ควรเปิดตามลำดับ

1. [src/main.tsx](/D:/React_Scoreboard/src/main.tsx)
   Entry point ของ React

2. [src/App.tsx](/D:/React_Scoreboard/src/App.tsx)
   รวม Routing และ Lazy-loaded pages

3. [src/components/ScoreboardController.tsx](/D:/React_Scoreboard/src/components/ScoreboardController.tsx)
   หน้าควบคุมหลักและตัว orchestrate ระบบส่วนใหญ่

4. [src/config/firebaseAuth.ts](/D:/React_Scoreboard/src/config/firebaseAuth.ts)
   ระบบ Authentication และ Permission

5. [src/hooks/useOBSWebSocket.ts](/D:/React_Scoreboard/src/hooks/useOBSWebSocket.ts)
   การเชื่อมต่อ OBS

6. [src/utils/excelParser.ts](/D:/React_Scoreboard/src/utils/excelParser.ts)
   การนำเข้าข้อมูล Excel

---

## 5. วิธีรันโปรเจกต์

### ติดตั้ง Dependencies

โปรเจกต์มี `package-lock.json` จึงแนะนำ:

```powershell
npm ci
```

หากไม่มี `.env`:

```powershell
Copy-Item .env.example .env
```

จากนั้นกำหนดค่า Firebase ใน `.env`:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_DATABASE_URL=...
VITE_ALLOWED_EMAILS=admin@example.com
```

### รัน Development Server

```powershell
npm run dev
```

โดยปกติจะเปิดที่:

```text
http://localhost:5173
```

### เงื่อนไขสำหรับใช้งานเต็มระบบ

- เปิด Google Authentication ใน Firebase
- ตั้งค่า Firebase Realtime Database Rules
- เปิด OBS WebSocket Server ที่ Port `4455`
- ใช้ Browser ที่รองรับ File System Access API หากต้องการ Instant Replay
- เตรียม Excel ที่มี Match Sheet และ Firebase Configuration

### คำสั่งสำคัญอื่น

```powershell
npm run build
npm run preview
npm test
npm run lint
npm run verify:tailwind
```

Deploy แบบ GitHub Pages:

```powershell
npm run deploy
```

นอกจากนี้มี GitHub Actions ใน [.github/workflows/deploy.yml](/D:/React_Scoreboard/.github/workflows/deploy.yml) ซึ่งจะ Build และ Deploy เมื่อ Push ไปยัง `main`

---

## สถานะการตรวจสอบปัจจุบัน

ผมรันชุดทดสอบแล้ว:

- Test Files: `17 passed`
- Tests: `121 passed`

Linter ทำงานสำเร็จ แต่มี Warning 3 จุด:

- `verify-tailwind.mjs` มี unused catch parameter 2 จุด
- `LogoBrowserCropModal.tsx` มี React Hook dependency `currentCrop` ที่ขาดหาย

ข้อสังเกตเชิงสถาปัตยกรรมที่ควรปรับปรุงในอนาคตคือเปิด TypeScript `strict: true`, ลดการใช้ `any`, แยก `ScoreboardController` ที่มีขนาดใหญ่เกินไป และรวม logic ของหน้า Standalone ที่มีรูปแบบซ้ำกันเข้ากับ shared data hooks ครับ
