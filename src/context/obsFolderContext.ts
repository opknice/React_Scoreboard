import { createContext } from 'react';
import type { ObsVideoFolderContextValue } from '../hooks/useObsVideoFolder';

export type FolderActions = Pick<ObsVideoFolderContextValue,
  'connect' | 'disconnect' | 'clearStoredFolder' | 'rescan' | 'getVideoFiles' | 'setSavedPath'
  | 'savePathToStorage' | 'handleFallbackFolderChange' | 'folderInputRef'>;
export type FolderFiles = Pick<ObsVideoFolderContextValue, 'videoFiles' | 'lastScanTimestamp' | 'folderHandle'>;
export type FolderConnection = Omit<ObsVideoFolderContextValue, keyof FolderActions | keyof FolderFiles>;

export const ObsFolderActionsContext = createContext<FolderActions | null>(null);
export const ObsFolderFilesContext = createContext<FolderFiles | null>(null);
export const ObsFolderConnectionContext = createContext<FolderConnection | null>(null);
