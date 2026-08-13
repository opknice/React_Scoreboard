import type { ReactNode } from 'react';
import { useObsVideoFolder } from '../hooks/useObsVideoFolder';
import { ObsVideoFolderContext } from './obsFolderContext';

export function ObsVideoFolderProvider({ children }: { children: ReactNode }) {
  const value = useObsVideoFolder();
  return (
    <ObsVideoFolderContext.Provider value={value}>
      {children}
      <input
        ref={value.folderInputRef}
        type="file"
        accept="video/*"
        hidden
        multiple
        {...({ webkitdirectory: 'true', directory: 'true' } as Record<string, string>)}
        onChange={(event) => value.handleFallbackFolderChange(event.target.files)}
      />
    </ObsVideoFolderContext.Provider>
  );
}
