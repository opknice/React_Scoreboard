import type { MacroEvent } from '../types/macro';

export interface MacroEventOption {
  value: MacroEvent;
  label: string;
  description: string;
  category: 'scoreboard' | 'obs' | 'keyboard';
  filterKind: 'any' | 'button' | 'key' | 'hotkey' | 'scene' | 'input';
}

export const MACRO_EVENT_OPTIONS: MacroEventOption[] = [
  {
    value: 'CustomEvent',
    label: 'เมื่อ ได้รับ Hotkey จาก OBS Script',
    description: 'ใช้เมื่อ OBS Script ส่ง CustomEvent เข้ามา',
    category: 'obs',
    filterKind: 'hotkey',
  },
  {
    value: 'ButtonClicked',
    label: 'เมื่อ กดปุ่มบน Scoreboard',
    description: 'เริ่มทำงานเมื่อมีการกดปุ่มที่เลือกในหน้า Scoreboard',
    category: 'scoreboard',
    filterKind: 'button',
  },
  {
    value: 'ReplayVideoEnded',
    label: 'เมื่อ Replay เล่นจบ',
    description: 'ทำงานหลัง Replay ปกติแบบ Single เล่นจบ (ไม่รวม Highlight Playlist)',
    category: 'scoreboard',
    filterKind: 'any',
  },
  {
    value: 'ReplayPlaylistCompleted',
    label: 'เมื่อ Highlight Playlist เล่นจบ',
    description: 'ทำงานเมื่อวิดีโอทุกคลิปใน Highlight Playlist เล่นครบทั้งชุด',
    category: 'scoreboard',
    filterKind: 'any',
  },
  {
    value: 'KeyPressed',
    label: 'เมื่อ กดคีย์ลัด',
    description: 'จับคีย์จากระบบคีย์บอร์ดของ Scoreboard',
    category: 'keyboard',
    filterKind: 'key',
  },
  {
    value: 'ReplayBufferSaved',
    label: 'เมื่อ มีการ บันทึก Replay Buffer',
    description: 'ทำงานเมื่อ OBS บันทึก Replay Buffer สำเร็จ',
    category: 'obs',
    filterKind: 'any',
  },
  {
    value: 'ReplayBufferStateChanged',
    label: 'เมื่อ สถานะ Replay Buffer เปลี่ยน',
    description: 'ทำงานเมื่อ Replay Buffer ของ OBS เริ่มหรือหยุดทำงาน',
    category: 'obs',
    filterKind: 'any',
  },
  {
    value: 'StreamStateChanged',
    label: 'เมื่อ สถานะ Stream เปลี่ยน',
    description: 'ทำงานเมื่อเริ่มหรือหยุดการถ่ายทอดสดใน OBS',
    category: 'obs',
    filterKind: 'any',
  },
  {
    value: 'RecordStateChanged',
    label: 'เมื่อ สถานะการบันทึกเปลี่ยน',
    description: 'ทำงานเมื่อเริ่มหรือหยุดการบันทึกใน OBS',
    category: 'obs',
    filterKind: 'any',
  },
  {
    value: 'MediaInputPlaybackStarted',
    label: 'เมื่อ วิดีโอเริ่มเล่นใน OBS',
    description: 'ทำงานเมื่อ Media Input ที่เลือกเริ่มเล่น',
    category: 'obs',
    filterKind: 'input',
  },
  {
    value: 'MediaInputPlaybackEnded',
    label: 'เมื่อ วิดีโอเล่นจบใน OBS',
    description: 'ทำงานเมื่อ Media Input ที่เลือกเล่นจบ',
    category: 'obs',
    filterKind: 'input',
  },
  {
    value: 'CurrentProgramSceneChanged',
    label: 'เมื่อ เปลี่ยน Scene ใน OBS',
    description: 'ทำงานเมื่อ Scene หลักของ OBS เปลี่ยน',
    category: 'obs',
    filterKind: 'scene',
  },
];

export const SCOREBOARD_BUTTON_OPTIONS = [
  { value: 'goal_A', label: 'กด ประตูทีม A' },
  { value: 'goal_B', label: 'กด ประตูทีม B' },
  { value: 'start_timer', label: 'กด เริ่มเวลา' },
  { value: 'pause_timer', label: 'กด หยุด/ซ่อนเวลา' },
  { value: 'half_time', label: 'กด พักครึ่ง' },
  { value: 'full_time', label: 'กด จบเกม' },
  { value: '', label: '------------------------' },
  { value: 'penalty_shootout', label: 'เปิด การยิงจุดโทษ' },
  { value: 'var_replay', label: 'เปิด VAR Controller' },
  { value: 'instant_replay', label: 'เปิด Instant Replay' },
  { value: '', label: '------------------------' },
  { value: 'close_penalty_shootout', label: 'ปิด การยิงจุดโทษ' },
  { value: 'close_var_replay', label: 'ปิด VAR Controller' },
  { value: 'close_instant_replay', label: 'ปิด Instant Replay' },
];

export const OBS_HOTKEY_OPTIONS = [
  { value: 'play1', label: 'เริ่มครึ่งแรก' },
  { value: 'halfpause', label: 'พักครึ่งแรก' },
  { value: 'play2', label: 'เริ่มครึ่งหลัง' },
  { value: 'fullend', label: 'จบเกม' },
  { value: 'hidetimer', label: 'ซ่อน/แสดงเวลา' },
  { value: 'scoreAplus', label: 'เพิ่มคะแนนทีม A' },
  { value: 'scoreAminus', label: 'ลดคะแนนทีม A' },
  { value: 'scoreBplus', label: 'เพิ่มคะแนนทีม B' },
  { value: 'scoreBminus', label: 'ลดคะแนนทีม B' },
  { value: 'swap', label: 'สลับทีม' },
];

export function getMacroEventOption(event: MacroEvent): MacroEventOption {
  return MACRO_EVENT_OPTIONS.find((option) => option.value === event) || MACRO_EVENT_OPTIONS[0];
}
