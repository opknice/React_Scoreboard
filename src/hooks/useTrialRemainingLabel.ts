import { useEffect, useState } from 'react';
import { formatTrialRemaining } from '../utils/trialAccess';

const TRIAL_CLOCK_INTERVAL_MS = 60 * 1000;

export function useTrialRemainingLabel(expiresAt?: number): string | null {
  const [, setClock] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return undefined;
    const intervalId = window.setInterval(() => setClock(Date.now()), TRIAL_CLOCK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [expiresAt]);

  return expiresAt ? formatTrialRemaining(expiresAt) : null;
}

