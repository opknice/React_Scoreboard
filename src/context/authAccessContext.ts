import { createContext } from 'react';
import type { AccessDecision } from '../config/firebaseAuth';

export const AuthAccessContext = createContext<AccessDecision | null>(null);
