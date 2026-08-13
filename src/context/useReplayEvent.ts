import { useContext } from 'react';
import { ReplayEventContext } from './replayEventContext';

export function useReplayEvent() {
  const context = useContext(ReplayEventContext);
  if (!context) {
    throw new Error('useReplayEvent must be used within ReplayEventProvider');
  }
  return context;
}
