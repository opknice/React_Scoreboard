import type { ReactNode } from 'react';
import type { AccessDecision } from '../config/firebaseAuth';
import { AuthAccessContext } from './authAccessContext';

export function AuthAccessProvider({ value, children }: { value: AccessDecision | null; children: ReactNode }) {
  return <AuthAccessContext.Provider value={value}>{children}</AuthAccessContext.Provider>;
}
