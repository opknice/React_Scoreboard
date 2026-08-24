import { createContext } from 'react';
import type { AccessDecision } from '../config/supabaseAccess';

export const AuthAccessContext = createContext<AccessDecision | null>(null);
