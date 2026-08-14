import { describe, expect, it } from 'vitest';
import { FREE_TRIAL_DURATION_MS, evaluateTrialAccess, formatTrialRemaining } from './trialAccess';

describe('evaluateTrialAccess', () => {
  it('starts a seven-day trial with the correct expiry and remaining days', () => {
    const startedAt = 1_700_000_000_000;
    const result = evaluateTrialAccess(startedAt, startedAt);

    expect(result).toEqual({
      isActive: true,
      expiresAt: startedAt + FREE_TRIAL_DURATION_MS,
      daysRemaining: 7,
    });
  });

  it('keeps the trial active until the exact expiry boundary', () => {
    const startedAt = 1_700_000_000_000;

    expect(evaluateTrialAccess(startedAt, startedAt + FREE_TRIAL_DURATION_MS - 1)?.isActive).toBe(true);
    expect(evaluateTrialAccess(startedAt, startedAt + FREE_TRIAL_DURATION_MS)?.isActive).toBe(false);
  });

  it('returns null when no server trial timestamp exists', () => {
    expect(evaluateTrialAccess(undefined)).toBeNull();
    expect(evaluateTrialAccess('1700000000000')).toBeNull();
  });

  it('formats the remaining trial time for the account header', () => {
    const now = 1_700_000_000_000;
    const expiresAt = now + (2 * 24 * 60 + 3 * 60 + 15) * 60 * 1000;

    expect(formatTrialRemaining(expiresAt, now)).toBe('เหลืออีก 2 วัน 3 ชั่วโมง 15 นาที');
  });
});
