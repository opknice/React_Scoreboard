import { createContext } from 'react';

export interface ReplayEventContextType {
  emitReplayEvent: (eventType: string, data?: any) => void;
  onReplayEvent: (listener: (eventType: string, data?: any) => void) => () => void;
}

export const ReplayEventContext = createContext<ReplayEventContextType | null>(null);
