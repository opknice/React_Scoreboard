# Source Record: บันทึกย้อนหลังจาก Macro/Automation

วันที่: 2026-11-07 (Asia/Bangkok)
สถานะ: ผู้ใช้ยืนยันแบบแล้วเมื่อ 2026-11-07; จัดทำแผนลงมือได้ ยังไม่ได้สั่งให้แก้โปรแกรม

## ความต้องการที่ผู้ใช้ยืนยัน

- เรียกบันทึกย้อนหลังจาก Macro หรือ Automation ใน React Scoreboard
- เลือก Source หรือ Scene และ Filter Source Record ที่จะบันทึกได้
- ใช้ระยะเวลาย้อนหลังและค่าบันทึกจาก Filter Source Record ที่มีอยู่
- ใช้แนวทางเลือก Filter แล้วสั่งบันทึกโดยตรงผ่าน OBS WebSocket

## ผลลัพธ์ที่ต้องการ

ผู้ใช้ติดตั้งและเปิด Replay Buffer ใน Filter Source Record ล่วงหน้า จากนั้นเพิ่ม Action
“Source Record: บันทึกย้อนหลัง” ใน Macro เลือกเป้าหมายและ Filter เมื่อ Macro ทำงาน
ให้ปลั๊กอินบันทึกบัฟเฟอร์ของ Filter นั้นเป็นไฟล์ และให้ Macro ทำขั้นตอนต่อไปเมื่อยืนยันการบันทึกสำเร็จ

ตัวอย่าง: Camera A / Source Record ตั้งไว้ 15 วินาทีและโฟลเดอร์ D:\Clips\A
เมื่อ Automation เรียก Action จะบันทึกภาพย้อนหลังที่มีอยู่ในบัฟเฟอร์ของ Filter นี้
ใช้โฟลเดอร์ รูปแบบไฟล์ ชื่อไฟล์ ตัวเข้ารหัส เสียง ความละเอียด และอัตราเฟรมตาม Filter
หากบัฟเฟอร์เพิ่งเริ่มเก็บภาพ คลิปอาจสั้นกว่าระยะเวลาที่ตั้งไว้ ตามพฤติกรรม Replay Buffer เดิม

## สถานะโค้ดที่ตรวจพบ

### D:\React_Scoreboard

- src/types/macro.ts: มี ActionStep และ ActionType; ยังไม่มี Source Record action
- src/components/MacroEditorModal.tsx: มีตัวเลือก Action และโหลด Scene/Source จาก OBS
- src/macros/macroExecutor.ts: ใช้ CallVendorRequest กับ PlayGroup อยู่แล้ว
- src/macros/macroStorage.ts: whitelist Action ที่อ่านกลับจาก localStorage
- src/macros/macroSummary.ts: ข้อความสรุป Action
- src/hooks/useAutoMacros.ts: ใช้ useCustomMacros; จึงเพิ่ม Action ที่ executor เดียวแล้วใช้ได้ทั้งสองทาง
- มี Vitest และชุดทดสอบ executor, editor, storage

### D:\obs-source-record-master

- source-record.c: Filter มี recording_session_t และ replayOutput ของตนเอง
- มีการสั่ง save ผ่าน output procedure และรับ saved signal พร้อมค้นหา last replay path
- source_record_filters เก็บ Filter ที่สร้างไว้ แต่ยังไม่มี vendor request ที่ลงทะเบียนใช้งาน
- obs-websocket-api.h มี API สำหรับ register vendor/request และ unregister request
- recording_manager.c มี session สำหรับ Manager แยกจาก Filter และมี saved callback ของตัวเอง
- โปรเจกต์ใช้ C/C++, Qt 6, CMake; build ปัจจุบันเป็น Ninja/RelWithDebInfo

## แนวทางที่พิจารณา

1. **Vendor API ของ Source Record — ผู้ใช้เลือกแล้ว:** ระบุ Filter ได้โดยตรง ใช้บัฟเฟอร์ของ Filter
   และรายงานผลเป็นรายคำสั่ง ต้องแก้ปลั๊กอินและเว็บ
2. **SaveReplayBuffer ของ OBS + ตัวเลือก save_on_obs_replay:** ใช้กลไกเดิมได้เร็ว
   แต่บันทึกตาม Filter ที่เปิดการเชื่อมทั้งหมด และต้องอาศัยบัฟเฟอร์หลักของ OBS จึงไม่ตอบโจทย์การเลือกเฉพาะ Filter

## ขอบเขตและสิ่งที่คงพฤติกรรมเดิม

- หนึ่ง Action เลือกหนึ่ง Filter; ใช้หลาย Action หากต้องการบันทึกหลาย Filter ตามลำดับ (ข้อเสนอของผู้ออกแบบ)
- Macro ไม่ส่งค่า duration/path/encoder และไม่แก้ settings ของ Filter
- ใช้ Filter ที่เปิดและมี output active อยู่แล้ว; ไม่สร้าง Filter หรือเปิด Buffer ให้เองขณะกดบันทึก
- ไม่ต้องเปิด Replay Buffer หลักของ OBS สำหรับ Action ใหม่นี้
- ไม่สั่งเปลี่ยน Scene ไม่รวมคลิปด้วย FFmpeg และไม่สร้าง session ของ Manager แทน Filter
- การบันทึก OBS หลัก, Source Record Manager และ Macro เดิมคงเส้นทางเดิม
  ส่วนการ save ของ Filter ต้องเข้าตัวจัดลำดับเดียวกันเมื่อชนกับคำสั่งใหม่ ตามกติกาด้านล่าง
- ไฟล์เขียนบนเครื่องที่รัน OBS; การนำไฟล์ไปโหลดใน Replay player ของเว็บอัตโนมัติอยู่นอกขอบเขตนี้
- ไม่เพิ่ม Trigger ใหม่จากผลบันทึก Source Record ในรอบนี้ เพื่อลดความเสี่ยง Automation เรียกตัวเองวนซ้ำ

## แบบการเชื่อมต่อ

Macro/Automation → executor → OBS CallVendorRequest → SourceRecord vendor
→ Filter session ที่เลือก → save ของ replayOutput เดิม → saved signal/last replay path
→ สถานะคำสั่ง → Macro log และขั้นตอนถัดไป

### ตัวตนของเป้าหมาย

- เก็บ sourceUuid และ filterUuid เป็นข้อมูลอ้างอิง; เก็บชื่อไว้แสดงผลเท่านั้น
- รายการรวม Filter Source Record ที่ติดกับ Source และ Scene สาธารณะใน Scene Collection ปัจจุบัน
- Filter ต้องมี id เป็น source_record_filter และเป็น session ที่ Filter เป็นเจ้าของ
- หลาย Filter ใน Source เดียวกันต้องแยกแถวและเลือกแยกได้
- เปลี่ยนชื่อยังอ้างอิง UUID เดิมได้; ลบ/สร้างใหม่/เปลี่ยน Scene Collection แล้ว UUID ไม่ตรงให้เลือกใหม่
- ห้าม fallback ไปจับชื่อคล้ายกันหรือ Filter ตัวแรก

### Vendor contract ที่เสนอ (protocolVersion = 1)

vendorName: SourceRecord

ทุก responseData มี protocolVersion และ ok; เมื่อ ok=false มี error {code,message}
เป็นข้อผิดพลาดในคำสั่งปลั๊กอิน แม้ OBS CallVendorRequest ชั้นนอกสำเร็จ
ฝั่งเว็บแยกข้อผิดพลาด transport/vendor unavailable ออกจาก error ของปลั๊กอิน

1. **ListFilters** — ไม่รับพารามิเตอร์
   - คืน filters[]: sourceUuid, sourceName, targetKind (source|scene), filterUuid, filterName,
     enabled, replayEnabled, replayActive, busy,
     settings {durationSeconds, directory, filenameFormatting, format, replayPerformance}
   - แสดง Filter ที่ปิดไว้ได้พร้อมเหตุผลว่าไม่พร้อม; ไม่รวม Manager-only session
   - directory คือค่าตั้งค่า ไม่ใช่ไฟล์ผลลัพธ์จริง; metadata เป็น snapshot และต้องตรวจซ้ำตอนสั่ง save
2. **SaveReplay** — รับ {requestId, sourceUuid, filterUuid}
   - requestId เป็น UUID ที่ client สร้างต่อการเรียกหนึ่งครั้ง
   - validate เป้าหมาย/ความพร้อม และผูกคำสั่งกับ output instance ก่อนเริ่ม save
   - เมื่อรับงานคืน {ok:true, requestId, state:"pending"}; หากเสร็จเร็วสามารถคืน state:"saved" และ path ได้
   - ไม่รอการเขียนไฟล์ใน WebSocket callback; ไม่ยอมรับ parameter สำหรับ override settings
   - requestId เดิม + target เดิมคืนงานเดิม ไม่สั่งบันทึกซ้ำ; requestId เดิม + target ต่างกันคืน REQUEST_ID_CONFLICT
3. **GetSaveStatus** — รับ {requestId}
   - คืน requestId, state (pending|outcome_unknown|saved|failed), sourceUuid, filterUuid
   - saved มี path จาก output หลัง saved signal; failed มี error
   - outcome_unknown หมายถึงรับคำสั่งแล้วแต่ไม่พบผลภายใน 60 วินาที อาจมีไฟล์หรือผลตามมาภายหลัง
     Filter ยัง busy จนได้รับ saved จริง หรือ output ถูกหยุด/สร้างใหม่; สามารถเปลี่ยนเป็น saved/failed ได้ภายหลัง
   - ไม่พบหรือหมดอายุคืน REQUEST_NOT_FOUND

error codes ขั้นต่ำ: INVALID_REQUEST, REQUEST_ID_CONFLICT, FILTER_NOT_FOUND, TARGET_MISMATCH,
FILTER_DISABLED, REPLAY_DISABLED, BUFFER_NOT_READY, ENCODER_PAUSED, SAVE_BUSY, BUFFER_NEEDS_RESET, SAVE_FAILED, OUTPUT_STOPPED,
SCENE_COLLECTION_CHANGED, REQUEST_NOT_FOUND

ไม่ต้องใช้ VendorEvent ในรอบนี้: เลือก polling สถานะเพื่อไม่พลาด event ที่เกิดก่อนรับ response
และใช้โครงสร้าง call/timeout ของเว็บที่มีอยู่ (ข้อเสนอของผู้ออกแบบ)

## Lifecycle และการเรียกซ้อน

- ลงทะเบียน vendor ใน obs_module_post_load ตาม header ที่มี; ถอน request และปิดรับงานก่อนทำลาย session ตอน unload
- resolve Filter และอ่าน/เปลี่ยน session บน task/thread ที่สอดคล้องกับ lifecycle OBS เดิม
  ห้ามถือ raw session pointer ข้าม asynchronous work โดยไม่มี lifetime guard
- งาน save ของ Filter เดียวกันมีได้หนึ่งงานค้างอยู่; Filter ต่างกันทำงานอิสระได้
- ประสานเส้นทาง save เดิมของ Filter (เช่น save_on_obs_replay และ hotkey ต่อ output) ด้วยสถานะ in-flight เดียวกัน
  เพื่อไม่ให้ saved signal ของคำสั่งหนึ่งถูกนับเป็นผลอีกคำสั่ง; ไม่เขียนทับ callback ของ Manager
- OBS replay_buffer ที่ตรวจจาก D:/obs-build/obs-studio/plugins/obs-ffmpeg/obs-ffmpeg-mux.c
  ลงทะเบียน hotkey ReplayBuffer.Save ที่เข้าถึง output โดยตรง และ save procedure ไม่ได้ส่งผลยอมรับงานกลับมา
  ต้องแทน hotkey เฉพาะ output ที่ Filter นี้เป็นเจ้าของด้วย callback ผ่าน tracker โดยคงชื่อ คำอธิบาย และ binding
  จัดการก่อนเปิดรับ save/เริ่ม output; ทำใหม่เมื่อสร้าง output ใหม่ และถอนก่อนทำลาย session
  ห้ามเปลี่ยน global hotkey router หรือแก้ hotkey ของ output หลัก/Manager และห้ามแก้ source ของ OBS
  ทดสอบ binding หลัง restart และ cleanup; ถ้าทำ routing ให้ปลอดภัยไม่ได้ต้องรายงานข้อจำกัดก่อนลงมือทางเลือกอื่น
- เมื่อ vendor SaveReplay มาชน save ที่ค้าง (ไม่ว่ามาจากทางใด) ให้ตอบ SAVE_BUSY
  เมื่อ legacy/hotkey มาชนงานที่ค้าง ให้เก็บ legacy save ที่รอได้หนึ่งรายการ รวมคำสั่ง legacy ที่ซ้ำเป็นรายการล่าสุด
  หลังงานเดิมจบให้สั่งรายการนั้นโดยใช้บัฟเฟอร์ ณ เวลาที่เริ่มสั่งจริง; Log ว่าถูกเลื่อน
  หาก output ถูกปิด/เปลี่ยน collection ให้ล้างรายการรอพร้อม Log
  นี่เป็นข้อเสนอของผู้ออกแบบเพื่อไม่ทิ้งคำสั่ง legacy และไม่จับคู่ผลผิด ไม่ใช่การรับรองการตัดคลิปตรงเวลาที่กดทุกครั้ง
- ผล saved ต้องผูกกับ output instance และคำสั่งที่รับไว้จริง; callbacks หลัง restart/remove ต้องไม่ผูกเข้ากับงานใหม่
- เปลี่ยน settings ที่ทำให้ output หยุด/restart, ปิด Filter, ลบ Filter หรือเปลี่ยน collection
  ขณะมีงานค้าง ต้องจบงานนั้นด้วย error และคืนทรัพยากรอย่างปลอดภัย
- ถ้า source ถูก Manager ควบคุมอยู่ คำสั่งตรงยังเลือก Filter session จริง ไม่แอบ route ไป Manager session
- เก็บผล terminal ไว้ 10 นาที สูงสุด 256 ผล; ล้างผลเก่าตามเวลา/จำนวนเมื่อมีการเข้าถึง
  ไม่ evict pending เพื่อเปิดให้ save ซ้อนโดยไม่มีหลักฐานว่าครั้งก่อนจบแล้ว
- ตรวจ encoder paused ก่อนเริ่ม save; หากพบให้ตอบ ENCODER_PAUSED
  ถ้ารอ saved เกิน 60 วินาทีให้ state เป็น outcome_unknown และตอบ BUFFER_NEEDS_RESET ต่อคำสั่งใหม่
  โดยยังรับ saved ที่ตามมาของงานเดิมได้ ห้ามปลด busy ด้วย timer แล้วจับ signal เก่าเข้ากับงานใหม่
- เว็บแสดงวิธีแก้เมื่อค้าง: “ปิดแล้วเปิด Replay Buffer ของ Filter ใหม่เพื่อเริ่มเก็บภาพใหม่”
  พร้อมบอกว่าภาพย้อนหลังในบัฟเฟอร์เดิมจะถูกล้าง; ไม่ restart Filter อัตโนมัติ
- โปรแกรมภายนอกที่เรียก raw procedure ของ output โดยตรงข้าม API ที่ปลั๊กอินจัดไว้
  อยู่นอกขอบเขตการรับรอง request correlation; ไม่เพิ่ม public raw-output control ให้เว็บ

## การทำงานในเว็บ

- ActionType ใหม่: saveSourceRecordReplay
- ActionStep เพิ่ม sourceRecordTarget {sourceUuid, sourceName, filterUuid, filterName}
- editor โหลด ListFilters เมื่อเลือก Action นี้/กดรีเฟรช/เชื่อมต่อ OBS ใหม่
- เลือก Source/Scene ก่อน แล้วเลือก Filter ของเป้าหมายนั้น พร้อมแสดงระยะเวลาและสถานะจาก Filter
- ข้อความกำกับ: “ใช้การตั้งค่าจาก Filter Source Record” ไม่มีช่องกำหนดระยะเวลาหรือโฟลเดอร์ใหม่ใน Macro
- เมื่อ OBS offline, vendor ไม่มี/รุ่น API ไม่รองรับ, ไม่มี Filter, หรือเป้าหมายหาย:
  แสดงเหตุผลชัดเจน ไม่เลือกตัวอื่นให้เอง และเก็บตัวเลือกเดิมของ Macro ไว้เพื่อให้แก้ไขได้
- อนุญาตเก็บ Macro เดิมขณะ offline หากมี UUID ครบ แต่ตรวจจริงอีกครั้งเมื่อ execute
- executor สร้าง requestId, เรียก SaveReplay และอ่าน GetSaveStatus ทุก 250 ms หลังตอบ pending
  จำกัด timeout ของแต่ละ call 5 วินาทีตาม utility เดิม; จำกัดการรอรวมต่อ Action 60 วินาที
- Macro ทำขั้นตอนถัดไปหลัง saved พร้อม path ที่ตรง requestId และคู่ sourceUuid/filterUuid เท่านั้น
  failed/offline/timeout/outcome_unknown ทำให้ Macro หยุดและรายงานผลที่ทราบ
- หาก timeout/disconnect หลังส่งคำสั่ง ให้ Log ว่า “ยังยืนยันผลบันทึกไม่ได้” เพราะไฟล์อาจถูกเขียนต่อที่ OBS
  ห้าม retry SaveReplay อัตโนมัติด้วย requestId ใหม่; ถ้าต้องเรียกซ้ำเพื่อยืนยันให้ใช้ requestId เดิมเท่านั้น
- Abort ของ Macro ยกเลิกการรอและล้าง timer/listener; ไม่กล่าวอ้างว่ายกเลิกการเขียนไฟล์ที่ OBS ได้
- ไม่ต้องเชื่อมผลคำสั่งนี้เข้ากับ ReplayBufferSaved หลักของ OBS

## ไฟล์ที่คาดว่าจะเปลี่ยน

### ปลั๊กอิน

- เพิ่ม source-record-websocket.c/.h: vendor protocol, validation และ command status store
- source-record.c: จุดเชื่อม registry/session, save lifecycle และ post_load/unload
- recording_session.h: interface ที่จำเป็นสำหรับ identity/readiness/status โดยไม่เปิด raw context ให้ bridge จัดการเอง
- CMakeLists.txt: รวม source ของ bridge
- README.md: API, การใช้งานกับ Macro, การ build/install ปลั๊กอินรุ่นใหม่
- อาจเพิ่ม source-record-websocket.test.c และ test target สำหรับ protocol/state machine หากแยก core ให้ทดสอบโดยไม่เปิด OBS ได้

### เว็บ

- เพิ่ม src/obs/sourceRecordClient.ts และชุดทดสอบ: vendor responses และการรอผลที่ยกเลิกได้
- src/types/macro.ts, src/macros/macroStorage.ts, src/macros/macroSummary.ts
- src/components/MacroEditorModal.tsx และ src/components/MacroEditorModal.test.tsx
- src/macros/macroExecutor.ts และ src/macros/macroExecutor.test.ts
- src/macros/macroStorage.test.ts

ชื่อและการแบ่ง helper ภายในให้ผู้ลงมือเลือกตามรูปแบบโค้ดเดิม โดยคง contract และพฤติกรรมที่ระบุข้างต้น

## หลักฐานตรวจรับ

1. เปิด Buffer ใน Filter ของ Camera A=15 วินาที/โฟลเดอร์ A และ Camera B=30 วินาที/โฟลเดอร์ B ล่วงหน้าจนมีภาพสะสม
   สั่ง Macro ของ A แล้วมีไฟล์จาก A ตามค่าตั้ง ไม่มีคำสั่ง save ไป B หรือ Replay Buffer หลัก
   ระยะคลิปตรวจตามพฤติกรรมเดิมของ encoder/container และปริมาณภาพในบัฟเฟอร์ ไม่รับรองความแม่นยำระดับเฟรม
2. เปลี่ยนค่า Filter A แล้วเรียก Macro เดิม ใช้ค่าปัจจุบันโดยไม่ต้องแก้ Macro
3. Scene ที่ติด Filter และ Source ที่มีหลาย Filter เลือกได้ถูกตัว; เปลี่ยนชื่อแล้วยังตรง UUID
4. ปิด Replay Buffer หลักของ OBS แล้ว Action ใหม่นี้ยังบันทึกได้เมื่อ Filter buffer พร้อม
5. ปิด/ลบ Filter, restart output, เปลี่ยน collection หรือ disconnect ระหว่างรอ ไม่ crash และไม่แสดง success เท็จ
6. requestId ซ้ำไม่ทำไฟล์ซ้ำ; requestId ชนคนละเป้าหมายถูกปฏิเสธ; save ซ้อนกับเส้นทางเดิม/ต่อ-output hotkey
   ไม่จับคู่ผลผิด และ legacy ที่รอถูกเรียกหลังงานเดิมโดยรวมคำสั่งซ้ำตามกติกา
7. หน้าตั้งค่าแสดงกรณีไม่มีปลั๊กอินและเลือก Filter ได้; localStorage โหลด Action ใหม่และ Macro เดิมกลับได้
8. Vitest สำหรับ client/executor/editor/storage ผ่าน รวมกรณีผล pending/outcome_unknown/saved/failed,
   timeout, abort, response ที่ผิด target และ malformed response; ทดสอบ core ของปลั๊กอินกรณีไม่มี saved,
   saved มาช้า, encoder paused และ reset ก่อนรับงานใหม่
9. npm run build และ npm run lint ผ่าน; build ปลั๊กอินด้วย cmake --build D:/obs-source-record-master/build ผ่าน
10. ทดสอบบน OBS จริงด้วยปลั๊กอินที่ build ใหม่หลังติดตั้งและเปิด OBS ใหม่; ระบุ version OBS ที่ใช้ในบันทึกผล

## ลำดับงานสำหรับจัดทำแผนลงมือหลังอนุมัติแบบ

1. สร้าง bridge API และตัวติดตามสถานะบนปลั๊กอิน พร้อมทดสอบ protocol/lifecycle
2. เพิ่ม client ของเว็บและทดสอบการรอผล
3. เพิ่ม Action, storage และ summary
4. เพิ่มตัวเลือก Filter ใน editor และเชื่อม executor ของ Macro/Automation
5. build และทดสอบ end-to-end กับ OBS จริง พร้อมคู่มือใช้งาน

ขั้นนี้สร้างเฉพาะเอกสาร ยังไม่แก้ product code, build/install ปลั๊กอิน หรือเปลี่ยนค่าใน OBS
