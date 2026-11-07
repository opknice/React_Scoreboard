# Source Record Macro Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution method is pending the user's choice; this document does not authorize implementation.

**Goal:** ให้ Macro/Automation เลือก Filter Source Record และบันทึกย้อนหลังตามการตั้งค่าของ Filter พร้อมยืนยันไฟล์ผลลัพธ์

**Architecture:** เพิ่ม vendor `SourceRecord` บน OBS WebSocket โดยใช้ Filter session และ Replay Buffer ที่มีอยู่ เพิ่มตัวติดตามคำสั่งเพื่อจับคู่ผล saved ให้ตรงงาน แล้วเพิ่ม client, Action และตัวเลือก Filter ใน React Scoreboard ใช้ polling สถานะเพื่อรอการเขียนไฟล์เสร็จก่อนทำ Action ถัดไป

**Tech Stack:** C/C++, OBS SDK/obs-websocket vendor API, Qt 6, CMake/Ninja/MSVC; React 19, TypeScript, obs-websocket-js 5, Vitest/Testing Library

**Spec:** [แบบที่ผู้ใช้ยืนยัน](../specs/2026-11-07-source-record-macro-design.md)

## Global Constraints

- หนึ่ง Action เลือกหนึ่ง Filter; ใช้หลาย Action หากต้องการบันทึกหลาย Filter ตามลำดับ
- Macro ไม่ส่งค่า duration/path/encoder และไม่แก้ settings ของ Filter
- ใช้ Filter ที่เปิดและมี output active อยู่แล้ว; ไม่สร้าง Filter หรือเปิด Buffer ให้เองขณะกดบันทึก
- ไม่ต้องเปิด Replay Buffer หลักของ OBS สำหรับ Action ใหม่นี้
- ไม่สั่งเปลี่ยน Scene ไม่รวมคลิปด้วย FFmpeg และไม่สร้าง session ของ Manager แทน Filter
- เก็บ sourceUuid และ filterUuid เป็นข้อมูลอ้างอิง; เก็บชื่อไว้แสดงผลเท่านั้น
- ห้าม fallback ไปจับชื่อคล้ายกันหรือ Filter ตัวแรก
- vendorName: SourceRecord; protocolVersion = 1; request: ListFilters, SaveReplay, GetSaveStatus
- ทุก responseData มี protocolVersion และ ok; เมื่อ ok=false มี error {code,message}
- รายการและผลคำสั่งใช้ schema และ error codes ตาม Spec; state = pending|outcome_unknown|saved|failed
- เก็บผล terminal ไว้ 10 นาที สูงสุด 256 ผล; ไม่ evict pending/outcome_unknown ที่ยังอาจได้รับ saved
- polling ทุก 250 ms; timeout ต่อ call 5 วินาที; การรอรวมต่อ Action 60 วินาที
- หลัง outcome_unknown ต้องรอผลเดิมหรือให้ผู้ใช้ reset Filter; ไม่ restart หรือ retry save ด้วย requestId ใหม่อัตโนมัติ
- คงเครดิต `By nice.Thanakrit`; ไม่แก้ OBS source หรือ global hotkey router
- ไฟล์เขียนบนเครื่อง OBS; ไม่เพิ่มการโหลดเข้า Replay player และไม่เพิ่ม Trigger จากผลบันทึกในงานนี้

## Review Focus

1. saved ของ output เก่าหรือ Hotkey เดิมห้ามยืนยัน vendor request ใหม่ผิดงาน — Task 1, 2, 6
2. save ที่ไม่ส่ง saved แม้ผ่าน 60 วินาทีห้ามเปิดรับ save ใหม่จนจับคู่ผลผิด — Task 1, 3
3. คนละ Filter บน Source เดียวกัน ชื่อซ้ำ เปลี่ยนชื่อ และเปลี่ยน Collection ต้องยังเลือกตาม UUID — Task 2, 4, 5, 6
4. disconnect/abort หลังรับงานอาจยังมีไฟล์ที่ OBS; ต้องหยุด Macro โดยไม่กล่าวอ้างว่ายกเลิกไฟล์แล้ว — Task 3, 4
5. metadata/ผลตอบกลับรุ่นเก่า ผิดรูปแบบ หรือผิด target ห้ามถูกถือเป็นความสำเร็จ — Task 2, 3, 5

## Workspace และการเตรียมสภาพแวดล้อม

- `WEB = D:/React_Scoreboard` เป็น Git repository; `PLUGIN = D:/obs-source-record-master` ไม่พบ `.git`
- งานทั้งสองฝั่งเป็น feature เดียว มี protocol dependency จึงทำตามลำดับ ไม่แยกเป็นโปรเจกต์อิสระ
- เริ่ม execution ด้วย using-git-worktrees ตามวิธีที่ทักษะกำหนด ตรวจ user changes ก่อนสร้าง isolation
- ไม่ initialize Git ในโฟลเดอร์ปลั๊กอินเดิมโดยพลการ หากต้องใช้สำเนาแยก ให้ configure build ใหม่ให้ตรง source path
- ก่อนแก้ปลั๊กอิน เก็บ baseline ของ source/config/README และทุกไฟล์ที่จะเปลี่ยนไว้ใน checkpoint นอก source tree
  ใช้สำเนาหรือ ZIP พร้อม manifest/hash; แต่ละงานฝั่งปลั๊กอินเก็บ checkpoint เพิ่ม เพราะ commit ในต้นฉบับไม่ได้
- ห้ามนำ `.env*`, node_modules, SDK หรือไฟล์ credential มาใส่ checkpoint/commit; ไม่เปลี่ยน dependency versions
- ด้านล่างใช้ path ต้นฉบับเพื่ออ้างอิง หากทำใน worktree/copy ให้แทน root ทั้งชุดและเก็บ Spec ไปด้วย

PowerShell สำหรับคำสั่ง CMake/CTest (ตรวจ path เหล่านี้ก่อนใช้; ปัจจุบัน cmake/ctest ไม่อยู่ใน PATH):

```powershell
& 'C:/Program Files/Microsoft Visual Studio/18/Community/Common7/Tools/Launch-VsDevShell.ps1' -Arch amd64 -HostArch amd64 -SkipAutomaticLocation
$srCmake = 'C:/Program Files/Microsoft Visual Studio/18/Community/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe'
$srCtest = 'C:/Program Files/Microsoft Visual Studio/18/Community/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/ctest.exe'
$srNinja = 'C:/Program Files/Microsoft Visual Studio/18/Community/Common7/IDE/CommonExtensions/Microsoft/CMake/Ninja/ninja.exe'
```

หาก path ต่างจากนี้ ให้ใช้ค่าที่ตรวจจาก Visual Studio และ CMakeCache จริง ไม่ติดตั้ง SDK ใหม่โดยไม่จำเป็น

## File Structure

| Root | ไฟล์ | หน้าที่ |
| --- | --- | --- |
| PLUGIN | source-record-save-state.c/.h | state machine และอายุผลคำสั่งแบบ pure C ไม่มี OBS dependency |
| PLUGIN | source-record-websocket.c/.h | validate/serialize protocol และ register/unregister vendor |
| PLUGIN | source-record.c, recording_session.h | เชื่อม Filter registry, output generation, lifecycle, shared save gate และ Hotkey |
| PLUGIN | CMakeLists.txt, tests/CMakeLists.txt | build bridge และ standalone core tests; OBS protocol test target |
| PLUGIN | tests/source-record-save-state.test.c, tests/source-record-websocket.test.c | core state tests และ protocol tests ด้วย fake Filter host |
| WEB | src/obs/obsRequest.ts | ย้าย callObsWithTimeout เดิมออกจาก executor เพื่อไม่ให้ client import วนกลับ |
| WEB | src/types/sourceRecord.ts, src/obs/sourceRecordClient.ts | types, schema validation และ save/status client |
| WEB | src/types/macro.ts, src/macros/macroStorage.ts, src/macros/macroSummary.ts, src/macros/macroExecutor.ts | Action, persistence, summary, execution |
| WEB | src/components/SourceRecordActionFields.tsx, src/components/MacroEditorModal.tsx | selector แยกจาก editor เดิมและ validation |
| WEB | ไฟล์ .test.ts/.test.tsx ข้างไฟล์ข้างต้น | ทดสอบ client, Macro, selector และ editor |
| WEB/PLUGIN | docs/source-record-macro.md; README.md | คู่มือเว็บและ API/ติดตั้งปลั๊กอิน |
| WEB | docs/verification/2026-11-07-source-record-macro.md | บันทึกหลักฐาน integration ที่ทำจริง พร้อม OBS version |

## Task 1: ตัวติดตาม save ที่ไม่ผูกกับ OBS

**Files:** Create `PLUGIN/source-record-save-state.c`, `.h`, `PLUGIN/tests/CMakeLists.txt`, `PLUGIN/tests/source-record-save-state.test.c`.

**Interfaces:**

- `sr_save_store_t` opaque, เป็นเจ้าของสำเนาสตริงของงาน; ใช้จาก thread ที่ adapter จัดลำดับแล้วเท่านั้น
- `sr_save_target_t { const char *source_uuid; const char *filter_uuid; uint64_t output_epoch; }`
- `sr_save_origin_t`: `SR_SAVE_VENDOR`, `SR_SAVE_LEGACY`
- `sr_save_disposition_t`: `SR_SAVE_START`, `SR_SAVE_REUSED`, `SR_SAVE_QUEUED`, `SR_SAVE_REJECTED`
- `sr_save_state_t`: `SR_SAVE_PENDING`, `SR_SAVE_OUTCOME_UNKNOWN`, `SR_SAVE_SAVED`, `SR_SAVE_FAILED`
- `sr_save_result_t`: disposition, state (`sr_save_state_t`), error_code (nullable string), request_id,
  source_uuid, filter_uuid, path (nullable string). ผลที่คืนเป็น snapshot borrowed จน store ถูกแก้ไขครั้งถัดไป
- `sr_save_store_t *sr_save_store_create(void); void sr_save_store_destroy(sr_save_store_t *store);`
- `sr_save_result_t sr_save_begin(sr_save_store_t *store, const sr_save_target_t *target, sr_save_origin_t origin, const char *request_id, uint64_t now_ms);`
- `sr_save_result_t sr_save_status(sr_save_store_t *store, const char *request_id, uint64_t now_ms);`
- `void sr_save_finish(sr_save_store_t *store, const char *filter_uuid, uint64_t output_epoch, const char *path, const char *error_code, uint64_t now_ms);`
- `void sr_save_invalidate(sr_save_store_t *store, const char *filter_uuid, uint64_t output_epoch, const char *error_code, uint64_t now_ms);`
- `bool sr_save_take_legacy(sr_save_store_t *store, const sr_save_target_t *target, uint64_t now_ms);`
  คืน true และสร้าง legacy in-flight slot เมื่อมีรายการรอและ slot ว่าง; ไม่เรียก output เอง
- legacy ใช้ request_id=NULL; ความพร้อม Filter/encoder ตรวจที่ adapter ก่อน begin
- idempotency เปรียบเทียบ requestId + sourceUuid/filterUuid; หาก output_epoch เปลี่ยนยังคืนผลคำสั่งเดิม
  ไม่สั่ง save ใหม่ให้ requestId เดิมหลัง reset; retention นับจากเวลาที่เป็น terminal

- [ ] **Step 1: เขียน core tests และ standalone test target**

ใช้ `assert` ที่เปิดใช้งานใน Debug, fixture `store`, target `a={"source-a","filter-a",1}`, `b={"source-b","filter-b",1}`
สร้างชื่อทดสอบ `idempotency_and_conflict`, `independent_filters`, `legacy_coalesces`, `late_saved_does_not_match_new_epoch`,
`unknown_keeps_busy`, `retention_and_invalidation` พร้อม assertions ต่อไปนี้:

```c
assert(sr_save_begin(store, &a, SR_SAVE_VENDOR, "r1", 0).disposition == SR_SAVE_START);
assert(sr_save_begin(store, &a, SR_SAVE_VENDOR, "r1", 1).disposition == SR_SAVE_REUSED);
assert(strcmp(sr_save_begin(store, &b, SR_SAVE_VENDOR, "r1", 2).error_code, "REQUEST_ID_CONFLICT") == 0);
assert(strcmp(sr_save_begin(store, &a, SR_SAVE_VENDOR, "r2", 3).error_code, "SAVE_BUSY") == 0);
assert(sr_save_begin(store, &a, SR_SAVE_LEGACY, NULL, 4).disposition == SR_SAVE_QUEUED);
```

ในแต่ละ test ใช้ store ใหม่; ตรวจ state outcome_unknown ที่ now_ms=60000, save ใหม่ได้ BUFFER_NEEDS_RESET,
saved ของ epoch เดิมไม่เปลี่ยน state งาน epoch ใหม่; legacy ซ้อนหลายครั้ง take ได้ครั้งเดียวหลัง finish
ตรวจผล terminal ที่อายุ 600000 ms ถูกล้าง, เก็บ terminal ได้ไม่เกิน 256 รายการ และงานยังค้างไม่ถูกล้าง

- [ ] **Step 2: รันให้เห็น failure จาก interface ที่ยังไม่มี**

```powershell
& $srCmake -S D:/obs-source-record-master/tests -B D:/obs-source-record-master/build/save-state-tests -G Ninja "-DCMAKE_MAKE_PROGRAM=$srNinja" -DCMAKE_BUILD_TYPE=Debug
& $srCmake --build D:/obs-source-record-master/build/save-state-tests
```

Expected: compile/link fail เพราะยังไม่มี core implementation ไม่ใช่ SDK/toolchain error

- [ ] **Step 3: implement interfaces** ใช้ monotonic now_ms ที่ caller ส่งมา, deep-copy ข้อมูล และคง epoch guard แม้งาน timeout
  `finish` สำเร็จต้องมี path ไม่ว่าง; failed/invalidate จบงานและจัดการ legacy queue ตาม Spec
- [ ] **Step 4: verify** build ซ้ำแล้ว `& $srCtest --test-dir D:/obs-source-record-master/build/save-state-tests --output-on-failure` ต้องผ่านทุก core test
- [ ] **Step 5: checkpoint** เก็บ source/test manifest และ hash ของงานนี้ไว้กับ baseline ของปลั๊กอิน

## Task 2: Filter adapter, vendor API และ Hotkey routing

**Files:** Create `PLUGIN/source-record-websocket.c/.h`, `PLUGIN/tests/source-record-websocket.test.c`;
modify `PLUGIN/source-record.c`, `PLUGIN/recording_session.h`, `PLUGIN/CMakeLists.txt`, `PLUGIN/README.md`.

**Interfaces:** Consumes core ของ Task 1. `source-record-websocket.h` กำหนด:

```c
typedef struct sr_websocket_host {
    obs_data_t *(*list_filters)(void *context);
    obs_data_t *(*save_replay)(obs_data_t *request, void *context);
    obs_data_t *(*get_save_status)(obs_data_t *request, void *context);
    void *context;
} sr_websocket_host_t;
bool source_record_websocket_init(const sr_websocket_host_t *host);
void source_record_websocket_shutdown(void);
obs_data_t *source_record_websocket_dispatch(const sr_websocket_host_t *host, const char *request_type, obs_data_t *request);
```

ทุก host callback/dispatch คืน responseData ใหม่ที่ caller release; callback ต้องส่งผลจาก UI task ที่เสร็จแล้ว
แต่ไม่รอเขียนไฟล์; init เก็บสำเนา host สำหรับ vendor callbacks และ dispatch รับ host ชัดเจน
เพื่อใช้ได้ใน protocol tests โดยไม่ register vendor จริง
host ใน source-record.c เป็นเจ้าของ registry/session access และ core store; ไม่เปิด raw context ให้ WebSocket callback

- [ ] **Step 1: เขียน protocol tests ด้วย fake host**

fake host รับ/คืน `obs_data_t`; test executable link `OBS::libobs` และ bridge แต่ไม่โหลด OBS frontend/server
เพิ่ม `SOURCE_RECORD_BUILD_TESTS` default OFF และ CTest target `source-record-websocket-tests` ใน main CMake
ให้ fake host นับการเรียกและยืนยันตัวอย่างต่อไปนี้ (สร้าง/ปล่อย req, res ใน fixture):

```c
obs_data_t *res = source_record_websocket_dispatch(&fake_host, "SaveReplay", req_missing_filter_uuid);
assert(!obs_data_get_bool(res, "ok"));
assert(obs_data_get_int(res, "protocolVersion") == 1);
/* error.code == INVALID_REQUEST; fake_host.save_calls == 0 */
```

เพิ่ม tests ชื่อ `rejects_setting_overrides`, `rejects_unknown_method`, `preserves_host_error`, `lists_disabled_filters`,
`preserves_request_target_and_state`; assert exact requestId/sourceUuid/filterUuid/path และ error.code ตาม Spec
ไม่ตีความชื่อซ้ำเป็น UUID; ไม่ serialize pointer หรือ Manager-only session

- [ ] **Step 2: configure เปิด tests แล้ว build ให้ fail เพราะ bridge/adapter ยังไม่มี**

```powershell
& $srCmake -S D:/obs-source-record-master -B D:/obs-source-record-master/build -DSOURCE_RECORD_BUILD_TESTS=ON
& $srCmake --build D:/obs-source-record-master/build --target source-record-websocket-tests
```

- [ ] **Step 3: implement bridge และต่อ adapter ใน source-record.c**

  - register vendor/request ใน post_load; unregister ก่อน shutdown; ถ้า vendor ใช้ไม่ได้ให้ Filter เดิมยังทำงาน
  - registry lookup ด้วย UUID คู่ source/filter, type id และ owner_is_filter; ListFilters เป็น snapshot ของค่าจริงปัจจุบัน
  - validate schema ตาม Spec รวม reject override settings; preflight disabled/replay-disabled/inactive/paused แล้วค่อย begin
  - UI dispatch ใช้ inline เมื่ออยู่ UI thread อยู่แล้ว มิฉะนั้น queue เฉพาะ validation/start/status แบบสั้น
    ห้ามถือ registry/store lock ขณะรอ UI task; saved callback copy path และถือ output reference ที่ถูกต้องก่อนส่งกลับ UI
  - แต่ละ output creation มี epoch เพิ่ม; signal context ผูก output/epoch ไม่ค้นผ่าน context->replayOutput ที่อาจถูกแทนแล้ว
  - แทน Hotkey ReplayBuffer.Save เฉพาะ Filter-owned output ก่อน start ด้วย gate เดียวกับ frontend_event/vendor
    คง binding/name/description; ไม่แก้ Hotkey ของ Manager หรือ global router
  - จัด legacy queue และ unknown ตาม Task 1; อ่าน status ต้องอัปเดตเวลาค้างแม้เว็บไม่ได้ poll ชั่วคราว
  - ทุก stop/restart/remove/collection cleanup ต้อง invalidate และถอด callback/hotkey ก่อน release; callbacks ที่รออยู่ใช้ lifetime guard
  - ไม่เขียนทับ Manager saved_callback; direct Filter save ไม่ขึ้นกับ source_record_manager_controls_source
  - README ระบุ protocolVersion=1, API และข้อจำกัด raw output procedure ที่ข้าม gate

- [ ] **Step 4: verify** build main plugin และ protocol tests; รัน CTest เฉพาะ `source-record-websocket-tests` โดยเพิ่ม OBS runtime directory ใน process PATH ของ test
  ต้องผ่าน และ `source-record.dll` build ได้; การทดสอบ callback race/Hotkey บน OBS จริงอยู่ Task 6
- [ ] **Step 5: checkpoint** เก็บ diff-equivalent ของไฟล์ปลั๊กอินและผล CTest โดยไม่รวม DLL/SDK ลง Git ของเว็บ

## Task 3: Client ฝั่งเว็บที่ตรวจ protocol และรอผลได้

**Files:** Create `WEB/src/obs/obsRequest.ts`, `WEB/src/types/sourceRecord.ts`, `WEB/src/obs/sourceRecordClient.ts`,
`WEB/src/obs/sourceRecordClient.test.ts`; modify `WEB/src/macros/macroExecutor.ts` เฉพาะย้าย utility/re-export.

**Interfaces:**

- `SourceRecordConnection = Pick<OBSWebSocket, 'call' | 'on' | 'off'>`
- `SourceRecordTarget {sourceUuid:string; sourceName:string; filterUuid:string; filterName:string}`
- `SourceRecordFilter extends SourceRecordTarget`: targetKind, enabled/replayEnabled/replayActive/busy และ settings ตาม Spec
- `SourceRecordSaveResult {requestId:string; sourceUuid:string; filterUuid:string; path:string}`
- `SourceRecordError extends Error {code:string; outcomeUnknown:boolean}`
- `listSourceRecordFilters(obs:SourceRecordConnection, signal?:AbortSignal):Promise<SourceRecordFilter[]>`
- `saveSourceRecordReplay(obs:SourceRecordConnection, target:SourceRecordTarget, signal?:AbortSignal):Promise<SourceRecordSaveResult>`
- `callObsWithTimeout` ย้าย implementation เดิมไป obsRequest.ts คง signature เดิม และ re-export ที่ macroExecutor.ts เพื่อไม่ให้ import เดิมพัง

- [ ] **Step 1: เขียน client tests ใช้ vi.useFakeTimers**

fixture `obs` mock call/on/off, `target`, `pendingResponse`, `savedResponse` ใช้ UUID จริงและ protocolVersion=1
test `waits_for_saved_and_preserves_filter_settings`:

```ts
const promise = saveSourceRecordReplay(obs, target);
await vi.advanceTimersByTimeAsync(250);
expect(obs.call).toHaveBeenCalledWith('CallVendorRequest', expect.objectContaining({
  vendorName: 'SourceRecord', requestType: 'SaveReplay',
  requestData: { requestId: expect.any(String), sourceUuid: target.sourceUuid, filterUuid: target.filterUuid },
}));
await expect(promise).resolves.toMatchObject({ path: 'D:\\Clips\\A\\replay.mkv' });
```

เพิ่ม tests: `rejects_wrong_protocol`, `rejects_malformed_list`, `rejects_wrong_request_or_target`, `rejects_empty_saved_path`,
`distinguishes_plugin_failure_from_unknown_transport_outcome`, `bounds_each_call_to_5000ms`, `stops_at_60000ms`,
`aborts_without_retry`, `disconnect_stops_polling`, `retains_uuid_on_rename` ตรวจว่าเหลือ timer/listener=0 หลังจบ
timeout/disconnect/invalid acknowledgment หลังส่ง SaveReplay ต้อง outcomeUnknown=true; pre-send offline/validation และ explicit failed ใช้ false

- [ ] **Step 2: run** `npm test -- src/obs/sourceRecordClient.test.ts` ใน WEB ต้อง fail เพราะ module/interface ยังไม่มี
- [ ] **Step 3: implement interfaces** ตรวจ responseData runtime schema; UUID ใหม่ด้วย crypto.randomUUID ต่อหนึ่ง invocation
  เริ่ม total deadline ก่อน SaveReplay, ต่อ call ใช้ timeout utility, poll หลัง response pending 250 ms ไม่ทำ overlapping polls
  clamp การรอแต่ละ call ด้วย total deadline และ signal; ไม่ retry SaveReplay อัตโนมัติ
  pending acknowledgment ต้องมี requestId ถูกต้อง; status/saved ต้องตรวจ UUID ทั้งคู่; unknown ให้ข้อความตาม Spec และหยุดรอ
  ถอด ConnectionClosed listener/timer ใน finally ทุกเส้นทาง
- [ ] **Step 4: verify** `npm test -- src/obs/sourceRecordClient.test.ts src/macros/macroExecutor.test.ts` ต้องผ่าน
- [ ] **Step 5: commit** เฉพาะไฟล์ Task 3 ด้วยข้อความ `feat: add Source Record replay client`

## Task 4: เพิ่ม Action, persistence และ execution ของ Macro/Automation

**Files:** Modify `WEB/src/types/macro.ts`, `WEB/src/macros/macroStorage.ts`, `WEB/src/macros/macroSummary.ts`,
`WEB/src/macros/macroExecutor.ts`, `WEB/src/macros/macroStorage.test.ts`, `WEB/src/macros/macroExecutor.test.ts`;
create `WEB/src/macros/macroSummary.test.ts` ถ้ายังไม่มี

**Interfaces:** Consumes `SourceRecordTarget`, `saveSourceRecordReplay` จาก Task 3;
produces ActionType=`saveSourceRecordReplay`, `ActionStep.sourceRecordTarget?:SourceRecordTarget`;
คง executeMacroActions signature/return Promise<boolean> เดิม และ storage key `customMacrosList`

- [ ] **Step 1: เพิ่ม regression tests**

test `source_record_action_round_trips` ใช้ save/loadCustomMacros แล้ว assert macro ทั้งก้อนเท่ากัน และ Macro เดิมยังโหลดได้
test `source_record_runs_next_action_only_after_saved` ใช้ deferred client promise และ action ถัดไป switchScene:

```ts
expect(call).not.toHaveBeenCalledWith('SetCurrentProgramScene', expect.anything());
resolveSave({ requestId, sourceUuid, filterUuid, path: 'D:\\Clips\\A\\replay.mkv' });
await expect(execution).resolves.toBe(true);
expect(call).toHaveBeenCalledWith('SetCurrentProgramScene', { sceneName: 'Outro' });
```

เพิ่ม tests `source_record_failure_stops_macro`, `missing_uuid_sends_nothing`, `unknown_outcome_is_not_success`,
`summary_names_the_selected_filter`; assert ไม่เรียก SaveReplayBuffer และ Log success มี path เฉพาะหลัง saved
storage ต้องไม่เก็บ runtime requestId/status เป็นส่วน settings; malformed target เก็บ Macro ไว้แก้ไขได้แต่ executor ปฏิเสธ

- [ ] **Step 2: run** `npm test -- src/macros/macroStorage.test.ts src/macros/macroExecutor.test.ts src/macros/macroSummary.test.ts` ต้อง fail ที่ Action ใหม่
- [ ] **Step 3: implement** เพิ่ม type/whitelist/summary และ branch executor
  log error จาก SourceRecordError แล้ว return false ผ่าน error path เดิม; ไม่ catch แล้วปล่อยให้รายงาน Macro success
  ไม่เพิ่ม subscription/Trigger ใหม่และไม่เปลี่ยน useAutoMacros เพราะใช้ executor เดียวกันอยู่แล้ว
- [ ] **Step 4: verify** รันชุด Task 3 และ Task 4 รวม ต้องผ่าน
- [ ] **Step 5: commit** `feat: support Source Record saves in macros`

## Task 5: ตัวเลือก Source/Scene และ Filter ใน Macro editor

**Files:** Create `WEB/src/components/SourceRecordActionFields.tsx`, `.test.tsx`;
modify `WEB/src/components/MacroEditorModal.tsx`, `.test.tsx`

**Interfaces:**

`SourceRecordActionFields(props:{obs?:SourceRecordConnection; isConnected:boolean; value?:SourceRecordTarget;
onChange:(target:SourceRecordTarget|undefined)=>void}):React.JSX.Element`

Consumes listSourceRecordFilters และ target จาก Task 3; editor ใส่ Action option
`{value:'saveSourceRecordReplay',label:'Source Record: บันทึกย้อนหลัง'}` และ validation UUID ที่เลือกก่อนบันทึก

- [ ] **Step 1: เขียน selector/editor tests**

ใช้ aria-label `เลือก Source หรือ Scene`, `เลือก Filter Source Record`, ปุ่ม `รีเฟรช Source Record`
สร้าง fixture Source หนึ่งตัวมีสอง Filter กับ Scene อีกหนึ่งตัว test `selects_exact_filter`:

```ts
fireEvent.change(screen.getByLabelText('เลือก Source หรือ Scene'), { target: { value: sourceUuid } });
fireEvent.change(screen.getByLabelText('เลือก Filter Source Record'), { target: { value: secondFilterUuid } });
expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ sourceUuid, filterUuid: secondFilterUuid }));
expect(screen.getByText('ใช้การตั้งค่าจาก Filter Source Record')).toBeTruthy();
```

เพิ่ม tests `shows_live_duration_and_readiness`, `offline_preserves_saved_target`, `refresh_does_not_select_replacement`,
`reconnect_discards_stale_response`, `duplicate_names_are_not_identity`, `missing_vendor_and_bad_schema_are_visible`,
`cannot_save_new_action_without_uuids`; editor integration assert onSave.actions มี sourceRecordTarget ที่เลือก
อนุญาตบันทึก Macro เดิมขณะ offline เมื่อมี UUID ครบ; ไม่มี input แก้ duration/path/encoder ใน Action นี้

- [ ] **Step 2: run** `npm test -- src/components/SourceRecordActionFields.test.tsx src/components/MacroEditorModal.test.tsx` ต้อง fail ที่ UI ใหม่
- [ ] **Step 3: implement** selector โหลดเมื่อ mount/action ถูกเลือก, refresh และ reconnect
  cancel ผลโหลดเก่าเมื่อ props เปลี่ยน/unmount; state แยก loading/offline/error/empty/ready
  Filter ที่ไม่พร้อมยังแสดงและบอกเหตุผล ไม่เปิด Buffer ให้อัตโนมัติ; เปลี่ยน Source ต้องล้าง Filter ที่เลือกก่อนหน้า
  เป้าหมายหายคงแสดงชื่อเดิมพร้อมแจ้งให้เลือกใหม่; โหลดสำเร็จแล้วเปลี่ยนชื่อให้แสดงชื่อสดตาม UUID
- [ ] **Step 4: verify** รันชุด Task 3–5 รวม และ `npm run build` ต้องผ่าน
- [ ] **Step 5: commit** `feat: add Source Record filter selection to automation editor`

## Task 6: Build, ทดสอบกับ OBS จริง และคู่มือ

**Files:** Create `WEB/docs/source-record-macro.md`, `WEB/docs/verification/2026-11-07-source-record-macro.md`;
update `PLUGIN/README.md`; แก้ code/test เฉพาะเมื่อพบข้อผิดพลาดจริง

**Interfaces:** Consumes API และ UI ทั้งหมด ไม่มี protocol/Trigger เพิ่ม

- [ ] **Step 1: สร้างตารางตรวจรับใน verification document**

ระบุ OBS version/bitness, plugin DLL hash/build timestamp, roots/commits/checkpoints ที่ใช้, fixture UUIDs,
expected/actual และหลักฐาน filename/duration/log ต่อ scenario; ช่องที่ยังไม่ทดสอบต้องเขียน NOT RUN

| Scenario | Assertion ที่ต้องพิสูจน์บน OBS จริง |
| --- | --- |
| A=15s/โฟลเดอร์ A, B=30s/โฟลเดอร์ B; เปิดสะสมภาพก่อนทดสอบ | สั่ง A ได้ไฟล์ A; ไม่มี save ที่ B หรือ OBS หลัก; duration สอดคล้อง Buffer/encoder เดิม |
| ปิด Replay Buffer หลัก แต่ Filter buffer พร้อม | Action ยังสำเร็จและมีไฟล์จริง |
| เปลี่ยน Filter A settings แล้วเรียก Macro เดิม | ใช้ duration/path/format ล่าสุด ไม่ใช้ค่าค้างจาก editor |
| Scene Filter, สอง Filter บน Source เดียว, rename และชื่อซ้ำ | UUID ที่เลือกถูกบันทึก; ตัวอื่นไม่รับ save |
| vendor ซ้อน vendor, vendor ซ้อน frontend/hotkey และ legacy ซ้อน vendor | busy/queue/coalescing ตาม Spec; saved/path ไม่จับผิด request |
| disable/remove/restart/collection cleanup ขณะ pending | ไม่มี crash/use-after-free/success ผิด; Hotkey binding ยังอยู่หลังสร้าง output ใหม่ |
| ไม่มี saved >60s, encoder paused, saved มาช้า | unknown/paused ตาม Spec; ไม่สั่งซ้ำอัตโนมัติ; reset ด้วยมือแล้วงานใหม่ไม่รับ signal เก่า |
| abort/disconnect หลังส่ง save | Macro หยุด; Log บอกยังยืนยันไม่ได้; ไฟล์ที่ OBS เขียนต่อไม่ถูกถือว่ายกเลิก |
| reload เว็บและเปิด editor ขณะ offline | Macro ใหม่/เดิมยังอยู่ เป้าหมายเดิมไม่ถูกเปลี่ยนเอง |
| Macro ผ่านปุ่ม/Hotkey/Automation event ที่มีอยู่ และ PlayGroup/SaveReplayBuffer เดิม | ใช้ Action ใหม่ได้และ regression เดิมไม่เสีย |

- [ ] **Step 2: รัน final automated checks**

ใน WEB: `npm test -- --run`, `npm run lint`, `npm run build` และ `git diff --check`
ใน PLUGIN: build main DLL, standalone state tests และ protocol tests ตาม Task 1–2; CTest ต้องผ่านทั้งหมด
ตรวจ runtime DLL dependency ของ test ก่อนสรุปว่าเป็น test failure; บันทึก baseline failure ที่ไม่เกี่ยวข้องแยกจากงานนี้

- [ ] **Step 3: ทดสอบทุก scenario ในตารางกับปลั๊กอินใหม่**

ตรวจ OBS ปัจจุบันก่อนติดตั้งหรือ restart; ไม่ปิดงานบันทึก/ไลฟ์ของผู้ใช้ หากการติดตั้งต้องขัดจังหวะ
ให้เตรียม DLL/คู่มือพร้อมแล้วขอเวลาที่เหมาะสมอย่างเจาะจงแทนการปิด OBS เอง
ใช้ไฟล์ทดสอบในโฟลเดอร์เฉพาะและ `ffprobe -v error -show_entries format=filename,duration -of json <path>`
ตรวจ path จาก API ตรงไฟล์จริง; อย่าอ้างว่าผ่าน integration จาก mocked tests เพียงอย่างเดียว
หากพบ bug ให้ใช้ systematic-debugging, เพิ่ม failing test ของกรณีนั้น แล้วแก้และรัน checks ที่เกี่ยวข้องซ้ำ

- [ ] **Step 4: เขียนคู่มือและสรุปผลตรวจรับ**

คู่มืออธิบายเปิด Filter buffer ล่วงหน้า → สร้าง Macro Action → เลือก Source/Scene + Filter → เรียก Macro → ดู path ใน Log
อธิบาย clip สั้นเมื่อ Buffer ยังสะสมไม่ครบ, สถานะ unknown/วิธี reset ที่ล้างภาพย้อนหลัง และข้อจำกัด plugin รุ่นเก่า
ระบุว่าการติดตั้ง Source Record รุ่นที่มี API ใหม่นี้จำเป็น; ใช้ SaveReplayBuffer เดิมแทนอย่างเงียบ ๆ ไม่ได้

- [ ] **Step 5: checkpoint/commit และส่งมอบ**

เก็บ checkpoint ปลั๊กอินสุดท้าย; commit เฉพาะ docs/การแก้ไขใน WEB ของ Task 6
ส่งลิงก์คู่มือและ verification report พร้อมตำแหน่ง DLL และสิ่งที่ยัง NOT RUN; ไม่ publish/deploy เว็บเอง

## Self-review ของแผน

- Spec coverage: identity/settings/readiness→Task 2, client deadlines/correlation→Task 3, persistence/execution→Task 4,
  editor→Task 5, races/Hotkey/OBS จริงและคู่มือ→Task 1/2/6
- ทุก Interface ที่ข้าม Task ถูกระบุชื่อและชนิด; schema/error รายละเอียดใช้ Spec เดียวกัน ไม่มี definition ที่ขัดกัน
- Review Focus ทั้งห้าข้อมี automated assertions หรือ live scenario ของ task เจ้าของงาน
- ไม่รันทดสอบโปรแกรมหรือ build ระหว่างการเขียนแผน; ขั้นตอนทดสอบทั้งหมดข้างต้นยังเป็นงานที่จะทำ
- เหลือให้ผู้ใช้เลือกวิธี execution และทบทวนแผนก่อนเริ่มแก้ product code
