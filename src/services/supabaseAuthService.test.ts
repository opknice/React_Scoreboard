import { describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { UserAccessRecord } from '../config/supabaseClient';

const authMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../config/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({ rpc: authMocks.rpc }),
}));

import { FREE_TRIAL_DURATION_MS, evaluateUserAccess, getUserAccessDecision } from './supabaseAuthService';

const NOW = Date.UTC(2026, 0, 1);

function makeRecord(overrides: Partial<UserAccessRecord> = {}): UserAccessRecord {
  return {
    id: 'permission-1',
    email: 'user@example.com',
    display_name: 'User',
    photo_url: '',
    status: 'pending',
    trial_started_at: null,
    last_login: '',
    uploaded_image_count: 0,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('evaluateUserAccess', () => {
  it('allows the configured super admin without a permission row', () => {
    expect(evaluateUserAccess(null, 'THANAKRIT_KAS@HOTMAIL.COM', NOW, [])).toMatchObject({
      isAllowed: true,
      accessType: 'super-admin',
      email: 'thanakrit_kas@hotmail.com',
    });
  });

  it('allows an explicitly allowed record', () => {
    expect(evaluateUserAccess(makeRecord({ status: 'allowed' }), 'user@example.com', NOW, [])).toMatchObject({
      isAllowed: true,
      accessType: 'whitelist',
    });
  });

  it('denies a denied record', () => {
    expect(evaluateUserAccess(makeRecord({ status: 'denied' }), 'user@example.com', NOW, [])).toMatchObject({
      isAllowed: false,
      accessType: 'denied',
    });
  });

  it('allows an active trial', () => {
    const startedAt = NOW - (60 * 60 * 1000);
    expect(evaluateUserAccess(makeRecord({ trial_started_at: startedAt }), 'user@example.com', NOW, [])).toMatchObject({
      isAllowed: true,
      accessType: 'trial',
      trialStartedAt: startedAt,
      trialExpiresAt: startedAt + FREE_TRIAL_DURATION_MS,
    });
  });

  it('reports an expired trial', () => {
    const startedAt = NOW - FREE_TRIAL_DURATION_MS - 1;
    expect(evaluateUserAccess(makeRecord({ trial_started_at: startedAt }), 'user@example.com', NOW, [])).toMatchObject({
      isAllowed: false,
      accessType: 'trial-expired',
    });
  });

  it('keeps a pending record pending when no trial exists', () => {
    expect(evaluateUserAccess(makeRecord(), 'user@example.com', NOW, [])).toMatchObject({
      isAllowed: false,
      accessType: 'pending',
    });
  });

  it('supports the configured local allowlist', () => {
    expect(evaluateUserAccess(null, 'USER@example.com', NOW, [' user@example.com '])).toMatchObject({
      isAllowed: true,
      accessType: 'whitelist',
    });
  });

  it('denies a missing email', () => {
    expect(evaluateUserAccess(null, null, NOW, [])).toMatchObject({
      isAllowed: false,
      accessType: 'denied',
    });
  });
});

describe('getUserAccessDecision', () => {
  it('uses the permission-sync RPC response without a second whitelist query', async () => {
    authMocks.rpc.mockResolvedValueOnce({
      data: makeRecord({ status: 'allowed' }),
      error: null,
    });

    const user = {
      id: 'user-1',
      email: 'user@example.com',
      user_metadata: { full_name: 'User' },
    } as unknown as User;

    await expect(getUserAccessDecision(user)).resolves.toMatchObject({
      isAllowed: true,
      accessType: 'whitelist',
    });
    expect(authMocks.rpc).toHaveBeenCalledTimes(1);
    expect(authMocks.rpc).toHaveBeenCalledWith('ensure_user_permission', {
      p_email: 'user@example.com',
      p_display_name: 'User',
      p_photo_url: '',
    });
  });
});
