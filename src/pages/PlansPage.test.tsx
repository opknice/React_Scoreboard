import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthAccessProvider } from '../context/AuthAccessProvider';
import type { AccessDecision } from '../types/authAccess';
import PlansPage from './PlansPage';

function renderPlans(access: AccessDecision) {
  return render(
    <MemoryRouter initialEntries={['/plans']}>
      <AuthAccessProvider value={access}>
        <PlansPage />
      </AuthAccessProvider>
    </MemoryRouter>,
  );
}

describe('PlansPage', () => {
  it('shows the current trial, quotas, feature comparison, and VIP contact action', () => {
    renderPlans({
      isAllowed: true,
      accessType: 'trial',
      email: 'trial@example.com',
      trialExpiresAt: Date.now() + (6 * 24 * 60 * 60 * 1000),
      trialDaysRemaining: 6,
    });

    expect(screen.getByText('แพ็กเกจปัจจุบัน: Free Trial')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Free Trial' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'VIP' })).toBeTruthy();
    expect(screen.getByText('รวม 10 รูป')).toBeTruthy();
    expect(screen.getByText('รวม 20 รูป')).toBeTruthy();
    expect(screen.getByRole('button', { name: /ติดต่อ Admin เพื่อขอ VIP/ })).toBeTruthy();
    expect(screen.getAllByText('trial@example.com').length).toBeGreaterThan(0);
  });

  it('shows VIP as the current plan for a whitelisted user', () => {
    renderPlans({
      isAllowed: true,
      accessType: 'whitelist',
      email: 'vip@example.com',
    });

    expect(screen.getByText('แพ็กเกจปัจจุบัน: VIP')).toBeTruthy();
    expect(screen.getByRole('button', { name: /คุณเป็นสมาชิก VIP แล้ว/ })).toBeTruthy();
  });
});

