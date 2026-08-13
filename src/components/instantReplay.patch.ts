// ============================================================
// PATCH: src/types/instantReplay.ts
// เพิ่ม 'setSpeed' เข้า action union ของ CommandMessage
// ============================================================
//
// หา type CommandMessage แล้วแก้บรรทัด action ให้เป็น:
//
// BEFORE:
//   action: 'pause' | 'play' | 'seek' | 'setA' | 'setB' | 'clearLoop';
//
// AFTER:
//   action: 'pause' | 'play' | 'seek' | 'setA' | 'setB' | 'clearLoop' | 'setSpeed';
//
// เมื่อแก้แล้ว:
//   - InstantReplayControl.tsx  → sendCommand('setSpeed', speed) ผ่าน type-check ทันที
//                                  (ลบ `as CommandMessage['action']` cast ออกได้)
//   - InstantReplayScreen.tsx   → handler ที่เพิ่มใหม่รับ action === 'setSpeed' ถูกต้อง
//
// ============================================================
