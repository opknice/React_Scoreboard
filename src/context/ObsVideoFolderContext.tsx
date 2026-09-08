import { useMemo, type ReactNode } from 'react';
import { useObsVideoFolder } from '../hooks/useObsVideoFolder';
import { ObsFolderActionsContext, ObsFolderConnectionContext, ObsFolderFilesContext } from './obsFolderContext';

export function ObsVideoFolderProvider({ children }: { children: ReactNode }) {
  const value = useObsVideoFolder();
  const { connect, disconnect, clearStoredFolder, rescan, getVideoFiles, setSavedPath, savePathToStorage,
    handleFallbackFolderChange, folderInputRef, videoFiles, lastScanTimestamp, folderHandle,
    savedPath, folderName, isConnected, isConnecting, lastError, supportsDirectoryPicker } = value;
  const actions = useMemo(() => ({ connect, disconnect, clearStoredFolder, rescan, getVideoFiles, setSavedPath,
    savePathToStorage, handleFallbackFolderChange, folderInputRef }), [connect, disconnect, clearStoredFolder,
    rescan, getVideoFiles, setSavedPath, savePathToStorage, handleFallbackFolderChange, folderInputRef]);
  const files = useMemo(() => ({ videoFiles, lastScanTimestamp, folderHandle }), [videoFiles, lastScanTimestamp, folderHandle]);
  const connection = useMemo(() => ({ savedPath, folderName, isConnected, isConnecting, lastError, supportsDirectoryPicker }),
    [savedPath, folderName, isConnected, isConnecting, lastError, supportsDirectoryPicker]);
  return (
    <ObsFolderActionsContext.Provider value={actions}>
      <ObsFolderConnectionContext.Provider value={connection}>
        <ObsFolderFilesContext.Provider value={files}>
          {children}
          <input ref={folderInputRef} type="file" accept="video/*" hidden multiple
            {...({ webkitdirectory: 'true', directory: 'true' } as Record<string, string>)}
            onChange={event => handleFallbackFolderChange(event.target.files)} />
        </ObsFolderFilesContext.Provider>
      </ObsFolderConnectionContext.Provider>
    </ObsFolderActionsContext.Provider>
  );
}
