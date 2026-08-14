export const FREE_TRIAL_DAYS = 7;
export const FREE_TRIAL_DURATION_MS = FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;

export interface TrialAccessResult {
  isActive: boolean;
  expiresAt: number;
  daysRemaining: number;
}

export function evaluateTrialAccess(trialStartedAt: unknown, now = Date.now()): TrialAccessResult | null {
  if (typeof trialStartedAt !== 'number' || !Number.isFinite(trialStartedAt)) return null;

  const expiresAt = trialStartedAt + FREE_TRIAL_DURATION_MS;
  const remainingMs = expiresAt - now;

  return {
    isActive: remainingMs > 0,
    expiresAt,
    daysRemaining: Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))),
  };
}

export function formatTrialRemaining(expiresAt: number, now = Date.now()): string {
  const remainingMinutes = Math.max(0, Math.ceil((expiresAt - now) / (60 * 1000)));
  if (remainingMinutes <= 0) return 'หมดอายุ';

  const days = Math.floor(remainingMinutes / (24 * 60));
  const hours = Math.floor((remainingMinutes % (24 * 60)) / 60);
  const minutes = remainingMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days} วัน`);
  if (hours > 0) parts.push(`${hours} ชั่วโมง`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} นาที`);

  return `เหลืออีก ${parts.join(' ')}`;
}
