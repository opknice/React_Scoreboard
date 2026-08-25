import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AccessDecision } from '../config/supabaseAccess';
import { AuthAccessContext } from './authAccessContext';
import { AuthUserContext } from './authUserContext';

export function AuthAccessProvider({
  value,
  user,
  children,
}: {
  value: AccessDecision | null;
  user: User | null;
  children: ReactNode;
}) {
  return (
    <AuthUserContext.Provider value={user}>
      <AuthAccessContext.Provider value={value}>{children}</AuthAccessContext.Provider>
    </AuthUserContext.Provider>
  );
}
