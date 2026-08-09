import { createContext, useContext, type ReactNode } from 'react';
import { useObsVideoFolder, type ObsVideoFolderContextValue } from '../hooks/useObsVideoFolder';

const ObsVideoFolderContext = createContext<ObsVideoFolderContextValue | null>(null);

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

export function useObsVideoFolderContext(): ObsVideoFolderContextValue {
  const context = useContext(ObsVideoFolderContext);
  if (!context) {
    throw new Error('useObsVideoFolderContext must be used within ObsVideoFolderProvider');
  }
  return context;
}
