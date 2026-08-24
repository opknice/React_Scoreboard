import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';
import { evaluateTrialAccess, FREE_TRIAL_DAYS } from '../utils/trialAccess';
export { FREE_TRIAL_DAYS } from '../utils/trialAccess';

export type AccessType = 'super-admin' | 'whitelist' | 'trial' | 'trial-expired' | 'denied' | 'pending';

export interface AccessDecision {
  isAllowed: boolean;
  accessType: AccessType;
  reason?: string;
  trialStartedAt?: number;
  trialExpiresAt?: number;
  trialDaysRemaining?: number;
}

export interface SupabaseUserAccessRecord {
  userId: string;
  status: 'allowed' | 'denied' | 'pending';
  trialStartedAt?: number;
  uploadedImageCount: number;
}

export interface SupabaseAdminUserRecord {
  email: string;
  displayName?: string;
  photoURL?: string;
  status: 'allowed' | 'denied' | 'pending';
  lastLogin: string;
  trialStartedAt?: number;
}

export const SUPER_ADMIN_EMAILS = ['thanakrit_kas@hotmail.com'];

function getAllowedEmails(): string[] {
  return (import.meta.env.VITE_ALLOWED_EMAILS || '')
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toTimestamp(value: string | null): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export async function recordSupabaseLoginAttempt(): Promise<void> {
  const { error } = await getSupabaseClient().rpc('record_user_login');

  if (error) throw error;
}

export async function getSupabaseUserAccess(user: User): Promise<SupabaseUserAccessRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from('user_access')
    .select('user_id, status, trial_started_at, uploaded_image_count')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    userId: data.user_id,
    status: data.status,
    trialStartedAt: toTimestamp(data.trial_started_at),
    uploadedImageCount: data.uploaded_image_count,
  };
}

export async function isSupabaseSuperAdmin(user: User): Promise<boolean> {
  const email = user.email?.trim().toLowerCase();
  if (email && SUPER_ADMIN_EMAILS.includes(email)) return true;

  const { data, error } = await getSupabaseClient()
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'super_admin')
    .maybeSingle();

  if (error) throw error;
  return data?.role === 'super_admin';
}

export async function fetchAllSupabaseUserPermissions(): Promise<SupabaseAdminUserRecord[]> {
  const client = getSupabaseClient();
  const [profilesResult, accessResult] = await Promise.all([
    client.from('profiles').select('id, email, display_name, photo_url'),
    client.from('user_access').select('user_id, status, last_login_at, trial_started_at'),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (accessResult.error) throw accessResult.error;

  const accessByUserId = new Map(
    accessResult.data.map((record) => [record.user_id, record]),
  );

  return profilesResult.data.map((profile) => {
    const access = accessByUserId.get(profile.id);
    return {
      email: profile.email,
      displayName: profile.display_name,
      photoURL: profile.photo_url,
      status: access?.status ?? 'pending',
      lastLogin: access?.last_login_at ?? '',
      trialStartedAt: toTimestamp(access?.trial_started_at ?? null),
    };
  });
}

export async function setSupabaseUserAccessStatus(
  targetEmail: string,
  nextStatus: 'allowed' | 'denied' | 'pending',
): Promise<SupabaseAdminUserRecord[]> {
  const cleanEmail = targetEmail.trim().toLowerCase();
  const { data: profile, error: profileError } = await getSupabaseClient()
    .from('profiles')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    throw new Error('ผู้ใช้นี้ยังไม่เคยเข้าสู่ระบบด้วย Google จึงยังไม่มี profile ใน Supabase');
  }

  const { error } = await getSupabaseClient().rpc('admin_set_user_access', {
    target_user_id: profile.id,
    next_status: nextStatus,
  });
  if (error) throw error;

  return fetchAllSupabaseUserPermissions();
}

export async function verifySupabaseUserAccess(user: User | null): Promise<AccessDecision> {
  const email = user?.email?.trim().toLowerCase();
  if (!user || !email) {
    return { isAllowed: false, accessType: 'denied', reason: 'ไม่พบอีเมลของบัญชีผู้ใช้' };
  }

  try {
    if (await isSupabaseSuperAdmin(user)) {
      return { isAllowed: true, accessType: 'super-admin' };
    }

    const allowedEmails = getAllowedEmails();
    if (allowedEmails.includes(email)) {
      return { isAllowed: true, accessType: 'whitelist' };
    }

    const access = await getSupabaseUserAccess(user);
    if (!access) {
      return { isAllowed: false, accessType: 'pending', reason: `บัญชี ${email} กำลังรอการสร้างรายการสิทธิ์` };
    }

    if (access.status === 'allowed') {
      return { isAllowed: true, accessType: 'whitelist' };
    }

    if (access.status === 'denied') {
      return { isAllowed: false, accessType: 'denied', reason: 'บัญชีนี้ถูกปฏิเสธ/ระงับการเข้าใช้งานโดย Super Admin' };
    }

    const trial = evaluateTrialAccess(access.trialStartedAt);
    if (trial?.isActive) {
      return {
        isAllowed: true,
        accessType: 'trial',
        trialStartedAt: access.trialStartedAt,
        trialExpiresAt: trial.expiresAt,
        trialDaysRemaining: trial.daysRemaining,
      };
    }

    if (trial && !trial.isActive) {
      return {
        isAllowed: false,
        accessType: 'trial-expired',
        trialStartedAt: access.trialStartedAt,
        trialExpiresAt: trial.expiresAt,
        reason: `สิทธิ์ทดลองใช้งานฟรี ${FREE_TRIAL_DAYS} วันหมดอายุแล้ว กรุณาติดต่อ Super Admin เพื่อขออนุมัติสิทธิ์ใช้งาน`,
      };
    }

    return { isAllowed: false, accessType: 'pending', reason: `บัญชี ${email} กำลังรอ Super Admin อนุมัติสิทธิ์การใช้งาน` };
  } catch (error: unknown) {
    throw new Error(`ไม่สามารถตรวจสอบสิทธิ์บน Supabase ได้: ${getErrorMessage(error)}`);
  }
}
