export type AccessPlanId = 'trial' | 'vip';

export interface AccessPlanSummary {
  id: AccessPlanId;
  name: string;
  eyebrow: string;
  description: string;
  duration: string;
  logoUploadLimit: string;
  playerImageUploadLimit: string;
  recommended?: boolean;
}

export interface AccessPlanFeature {
  label: string;
  description: string;
  trial: string;
  vip: string;
  trialAvailable: boolean;
  vipAvailable: boolean;
}

export interface AccessPlanFeatureGroup {
  title: string;
  icon: string;
  features: readonly AccessPlanFeature[];
}

export const ACCESS_PLAN_SUMMARIES: readonly AccessPlanSummary[] = [
  {
    id: 'trial',
    name: 'Free Trial',
    eyebrow: 'เริ่มต้นทดลองระบบ',
    description: 'ทดลองใช้เครื่องมือถ่ายทอดฟุตบอลชุดหลักได้ครบ ก่อนตัดสินใจขอสิทธิ์ VIP',
    duration: '7 วัน',
    logoUploadLimit: '10 รูป',
    playerImageUploadLimit: '20 รูป',
  },
  {
    id: 'vip',
    name: 'VIP',
    eyebrow: 'สำหรับใช้งานต่อเนื่อง',
    description: 'ใช้งานระบบควบคุมการแข่งขันต่อเนื่อง พร้อมโควตาอัปโหลดรูปภาพแบบไม่จำกัด',
    duration: 'ไม่หมดอายุระหว่างได้รับสิทธิ์',
    logoUploadLimit: 'ไม่จำกัด',
    playerImageUploadLimit: 'ไม่จำกัด',
    recommended: true,
  },
] as const;

export const ACCESS_PLAN_FEATURE_GROUPS: readonly AccessPlanFeatureGroup[] = [
  {
    title: 'ควบคุมการแข่งขัน',
    icon: '⚽',
    features: [
      {
        label: 'Scoreboard Controller',
        description: 'ควบคุมคะแนน ชื่อทีม สี โลโก้ และเวลาแข่งขัน',
        trial: 'ใช้งานได้',
        vip: 'ใช้งานได้',
        trialAvailable: true,
        vipAvailable: true,
      },
      {
        label: 'Penalty Shootout',
        description: 'ควบคุมและแสดงผลการยิงจุดโทษ',
        trial: 'ใช้งานได้',
        vip: 'ใช้งานได้',
        trialAvailable: true,
        vipAvailable: true,
      },
      {
        label: 'บันทึกผลและสถิติ',
        description: 'บันทึกผลการแข่งขันและประตูของนักเตะรายแมตช์',
        trial: 'ใช้งานได้',
        vip: 'ใช้งานได้',
        trialAvailable: true,
        vipAvailable: true,
      },
    ],
  },
  {
    title: 'จัดการข้อมูลการแข่งขัน',
    icon: '🏆',
    features: [
      {
        label: 'ลีก ทีม และตารางแข่งขัน',
        description: 'สร้าง แก้ไข และจัดการข้อมูลการแข่งขันใน Supabase',
        trial: 'ใช้งานได้',
        vip: 'ใช้งานได้',
        trialAvailable: true,
        vipAvailable: true,
      },
      {
        label: 'รายชื่อนักเตะ',
        description: 'จัดการเบอร์เสื้อ ตำแหน่ง รูปภาพ และสถิติ',
        trial: 'ใช้งานได้',
        vip: 'ใช้งานได้',
        trialAvailable: true,
        vipAvailable: true,
      },
      {
        label: 'จำนวนลีก ทีม และแมตช์',
        description: 'ปัจจุบันระบบไม่ได้กำหนดเพดานจำนวนรายการ',
        trial: 'ไม่จำกัดในระบบ',
        vip: 'ไม่จำกัดในระบบ',
        trialAvailable: true,
        vipAvailable: true,
      },
    ],
  },
  {
    title: 'OBS และงานถ่ายทอดสด',
    icon: '🎥',
    features: [
      {
        label: 'OBS Browser Sources',
        description: 'ชื่อทีม สี โลโก้ คะแนน นักเตะ ตารางคะแนน และผลการแข่งขัน',
        trial: 'ใช้งานได้',
        vip: 'ใช้งานได้',
        trialAvailable: true,
        vipAvailable: true,
      },
      {
        label: 'Quick Add และ Auto Sync',
        description: 'เพิ่มหรืออัปเดต Browser Source ผ่าน OBS WebSocket',
        trial: 'ใช้งานได้',
        vip: 'ใช้งานได้',
        trialAvailable: true,
        vipAvailable: true,
      },
      {
        label: 'Instant Replay, VAR และ Macros',
        description: 'ควบคุมคลิปย้อนหลัง ตรวจเหตุการณ์ และเรียกคำสั่งอัตโนมัติ',
        trial: 'ใช้งานได้',
        vip: 'ใช้งานได้',
        trialAvailable: true,
        vipAvailable: true,
      },
    ],
  },
  {
    title: 'ระยะเวลาและรูปภาพ',
    icon: '✨',
    features: [
      {
        label: 'ระยะเวลาการใช้งาน',
        description: 'Trial เริ่มนับจากการเข้าสู่ระบบครั้งแรก',
        trial: '7 วัน',
        vip: 'ต่อเนื่องระหว่างได้รับสิทธิ์',
        trialAvailable: true,
        vipAvailable: true,
      },
      {
        label: 'อัปโหลดโลโก้/รูปทั่วไป',
        description: 'รองรับ PNG, JPG, WebP และ GIF ขนาดไม่เกิน 2MB',
        trial: 'รวม 10 รูป',
        vip: 'ไม่จำกัด',
        trialAvailable: true,
        vipAvailable: true,
      },
      {
        label: 'อัปโหลดรูปนักเตะ',
        description: 'รองรับ PNG, JPG, WebP และ GIF ขนาดไม่เกิน 500KB',
        trial: 'รวม 20 รูป',
        vip: 'ไม่จำกัด',
        trialAvailable: true,
        vipAvailable: true,
      },
      {
        label: 'ใช้งานหลัง Trial หมดอายุ',
        description: 'ต้องให้ Admin อนุมัติบัญชีเข้าสู่ Whitelist',
        trial: 'เข้าแผงควบคุมไม่ได้',
        vip: 'ใช้งานได้',
        trialAvailable: false,
        vipAvailable: true,
      },
    ],
  },
  {
    title: 'สิทธิ์ผู้ดูแลระบบ',
    icon: '🛡️',
    features: [
      {
        label: 'จัดการ Whitelist',
        description: 'สงวนไว้สำหรับ Super Admin เท่านั้น ไม่ใช่สิทธิ์ของสมาชิก VIP',
        trial: 'ไม่ได้',
        vip: 'ไม่ได้',
        trialAvailable: false,
        vipAvailable: false,
      },
    ],
  },
] as const;
