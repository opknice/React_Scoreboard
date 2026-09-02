export type AccessType =
  | 'super-admin'
  | 'whitelist'
  | 'trial'
  | 'trial-expired'
  | 'denied'
  | 'pending';

export interface AccessDecision {
  isAllowed: boolean;
  accessType: AccessType;
  email?: string;
  reason?: string;
  trialStartedAt?: number;
  trialExpiresAt?: number;
  trialDaysRemaining?: number;
}
