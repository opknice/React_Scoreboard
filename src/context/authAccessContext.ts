import { createContext } from 'react';
import type { AccessDecision } from '../types/authAccess';

export const AuthAccessContext = createContext<AccessDecision | null>(null);
