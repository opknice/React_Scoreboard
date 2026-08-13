import { useContext } from 'react';
import { ObsVideoFolderContext } from './obsFolderContext';
import type { ObsVideoFolderContextValue } from '../hooks/useObsVideoFolder';

export function useObsVideoFolderContext(): ObsVideoFolderContextValue {
  const context = useContext(ObsVideoFolderContext);
  if (!context) {
    throw new Error('useObsVideoFolderContext must be used within ObsVideoFolderProvider');
  }
  return context;
}
