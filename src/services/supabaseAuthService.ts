import type {
  AuthChangeEvent,
  Session,
  User,
  UserResponse,
} from '@supabase/supabase-js';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  type UserAccessRecord,
  type UserAccessStatus,
} from '../config/supabaseClient';
import { FREE_TRIAL_DAYS, evaluateTrialAccess } from '../utils/trialAccess';
import type { AccessDecision } from '../types/authAccess';

export { FREE_TRIAL_DAYS, FREE_TRIAL_DURATION_MS } from '../utils/trialAccess';
export type { AccessDecision } from '../types/authAccess';

export const SUPER_ADMIN_EMAILS: string[] = ['thanakrit_kas@hotmail.com'];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  return Boolean(email && SUPER_ADMIN_EMAILS.includes(normalizeEmail(email)));
}

export function getUserDisplayName(user: User | null | undefined): string {
  if (!user) return '';
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const name = metadata?.full_name ?? metadata?.name;
  return typeof name === 'string' ? name : '';
}

export function getUserPhotoUrls(user: User | null | undefined): string[] {
  if (!user) return [];
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  return [metadata?.picture, metadata?.avatar_url]
    .filter((photo): photo is string => typeof photo === 'string' && photo.trim().length > 0)
    .map((photo) => photo.trim())
    .filter((photo, index, photos) => photos.indexOf(photo) === index);
}

export function getUserPhotoUrl(user: User | null | undefined): string {
  return getUserPhotoUrls(user)[0] || '';
}

function getOAuthRedirectUrl(): string {
  const baseUrl = import.meta.env.BASE_URL || '/';
  return new URL(baseUrl, window.location.origin).toString();
}

function requireConfiguredClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY');
  }
  return getSupabaseClient();
}

export async function loginWithGoogle(): Promise<void> {
  const client = requireConfiguredClient();
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getOAuthRedirectUrl(),
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
}

export async function logoutUser(): Promise<void> {
  await requireConfiguredClient().auth.signOut();
}

export async function getAuthUser(): Promise<User | null> {
  const response: UserResponse = await requireConfiguredClient().auth.getUser();
  if (response.error) throw response.error;
  return response.data.user;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const { data } = requireConfiguredClient().auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

function asUserAccessRecord(value: unknown): UserAccessRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<UserAccessRecord>;
  if (typeof record.id !== 'string' || typeof record.email !== 'string') return null;
  return {
    id: record.id,
    email: record.email,
    display_name: typeof record.display_name === 'string' ? record.display_name : '',
    photo_url: typeof record.photo_url === 'string' ? record.photo_url : '',
    status: record.status === 'allowed' || record.status === 'denied' ? record.status : 'pending',
    trial_started_at: typeof record.trial_started_at === 'number' ? record.trial_started_at : null,
    last_login: typeof record.last_login === 'string' ? record.last_login : '',
    uploaded_image_count: typeof record.uploaded_image_count === 'number' ? record.uploaded_image_count : 0,
    created_at: typeof record.created_at === 'string' ? record.created_at : '',
    updated_at: typeof record.updated_at === 'string' ? record.updated_at : '',
  };
}

function asUserAccessRecords(value: unknown): UserAccessRecord[] {
  if (!Array.isArray(value)) return [];
  return value.map(asUserAccessRecord).filter((record): record is UserAccessRecord => record !== null);
}

export async function recordUserLoginAttempt(user: User): Promise<UserAccessRecord> {
  const email = normalizeEmail(user.email || '');
  if (!email) throw new Error('ไม่พบอีเมลของผู้ใช้ Google');

  const { data, error } = await requireConfiguredClient().rpc('ensure_user_permission', {
    p_email: email,
    p_display_name: getUserDisplayName(user),
    p_photo_url: getUserPhotoUrl(user),
  });
  if (error) throw error;

  const record = asUserAccessRecord(data);
  if (!record) throw new Error('Supabase ไม่ได้ส่งข้อมูลสิทธิ์ผู้ใช้กลับมา');
  return record;
}

export async function verifyUserWhitelist(email: string | null | undefined): Promise<AccessDecision> {
  if (!email) return { isAllowed: false, accessType: 'denied', reason: 'ไม่พบอีเมลของผู้ใช้' };

  const cleanEmail = normalizeEmail(email);
  if (isSuperAdmin(cleanEmail)) {
    return { isAllowed: true, accessType: 'super-admin', email: cleanEmail };
  }

  const localAllowedEmails = [
    import.meta.env.VITE_ALLOWED_EMAILS || '',
    typeof window === 'undefined' ? '' : window.localStorage.getItem('local_allowed_emails') || '',
  ].join(',')
    .split(',')
    .map((item: string) => normalizeEmail(item))
    .filter(Boolean);

  const { data, error } = await requireConfiguredClient()
    .from('user_permissions')
    .select('*')
    .eq('email', cleanEmail)
    .maybeSingle();
  if (error) throw error;

  const record = asUserAccessRecord(data);
  if (!record) {
    if (localAllowedEmails.includes(cleanEmail)) {
      return { isAllowed: true, accessType: 'whitelist', email: cleanEmail };
    }
    return {
      isAllowed: false,
      accessType: 'pending',
      email: cleanEmail,
      reason: `บัญชี ${cleanEmail} กำลังรอ Super Admin (${SUPER_ADMIN_EMAILS[0]}) อนุมัติสิทธิ์การใช้งาน`,
    };
  }

  if (record.status === 'allowed' || localAllowedEmails.includes(cleanEmail)) {
    return { isAllowed: true, accessType: 'whitelist', email: cleanEmail };
  }
  if (record.status === 'denied') {
    return { isAllowed: false, accessType: 'denied', email: cleanEmail, reason: 'บัญชีนี้ถูกปฏิเสธ/ระงับการเข้าใช้งานโดย Super Admin' };
  }

  const trial = evaluateTrialAccess(record.trial_started_at);
  if (trial?.isActive) {
    return {
      isAllowed: true,
      accessType: 'trial',
      email: cleanEmail,
      trialStartedAt: record.trial_started_at ?? undefined,
      trialExpiresAt: trial.expiresAt,
      trialDaysRemaining: trial.daysRemaining,
    };
  }
  if (trial) {
    return {
      isAllowed: false,
      accessType: 'trial-expired',
      email: cleanEmail,
      trialStartedAt: record.trial_started_at ?? undefined,
      trialExpiresAt: trial.expiresAt,
      reason: `สิทธิ์ทดลองใช้งานฟรี ${FREE_TRIAL_DAYS} วันหมดอายุแล้ว กรุณาติดต่อ Super Admin เพื่อขออนุมัติสิทธิ์ใช้งาน`,
    };
  }
  return {
    isAllowed: false,
    accessType: 'pending',
    email: cleanEmail,
    reason: `บัญชีของคุณกำลังรอการอนุมัติสิทธิ์จาก Super Admin (${SUPER_ADMIN_EMAILS[0]})`,
  };
}

export async function fetchAllUserPermissions(): Promise<UserAccessRecord[]> {
  const { data, error } = await requireConfiguredClient().rpc('admin_list_user_permissions');
  if (error) throw error;
  return asUserAccessRecords(data);
}

export async function setUserAccessStatus(
  targetEmail: string,
  newStatus: UserAccessStatus,
): Promise<UserAccessRecord[]> {
  const { data, error } = await requireConfiguredClient().rpc('admin_set_user_access_status', {
    p_email: normalizeEmail(targetEmail),
    p_status: newStatus,
  });
  if (error) throw error;
  return asUserAccessRecords(data);
}

export async function incrementUploadedImageCount(): Promise<number> {
  const { data, error } = await requireConfiguredClient().rpc('increment_uploaded_image_count');
  if (error) throw error;
  if (typeof data !== 'number') throw new Error('Supabase ไม่ได้ส่งจำนวน quota กลับมา');
  return data;
}
