import { fireEvent, render, screen } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import ScoreboardHeader from './ScoreboardHeader';

describe('ScoreboardHeader', () => {
  it('opens the plan comparison when the trial badge is pressed', () => {
    const onNavigatePlans = vi.fn();

    render(
      <ScoreboardHeader
        videoFolder={{ isConnected: false, isConnecting: false, folderName: '', savedPath: '' }}
        onConnectVideoFolder={vi.fn()}
        onResetVideoFolder={vi.fn()}
        currentUser={{ id: 'trial-user', email: 'trial@example.com' } as User}
        authAccess={{
          isAllowed: true,
          accessType: 'trial',
          email: 'trial@example.com',
          trialExpiresAt: Date.now() + (6 * 24 * 60 * 60 * 1000),
          trialDaysRemaining: 6,
        }}
        isSuperAdminUser={false}
        onNavigatePlans={onNavigatePlans}
        onNavigateWhitelist={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ดูรายละเอียด Trial และ VIP/ }));
    expect(onNavigatePlans).toHaveBeenCalledTimes(1);
  });
});

