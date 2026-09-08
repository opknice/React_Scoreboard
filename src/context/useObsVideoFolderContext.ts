import { useContext, useMemo } from 'react';
import { ObsFolderActionsContext, ObsFolderConnectionContext, ObsFolderFilesContext } from './obsFolderContext';

/** For controller consumers that do not render the clip library. */
export function useObsVideoFolderConnection() {
  const connection = useContext(ObsFolderConnectionContext);
  const actions = useContext(ObsFolderActionsContext);
  if (!connection || !actions) throw new Error('Video folder hooks require ObsVideoFolderProvider');
  return useMemo(() => ({ ...connection, ...actions }), [connection, actions]);
}

/** Replay consumers also subscribe to the file list and scan metadata. */
export function useObsVideoFolderContext() {
  const connection = useObsVideoFolderConnection();
  const files = useObsVideoFolderFiles();
  return useMemo(() => ({ ...connection, ...files }), [connection, files]);
}

export function useObsVideoFolderFiles() {
  const files = useContext(ObsFolderFilesContext);
  if (!files) throw new Error('Video folder hooks require ObsVideoFolderProvider');
  return files;
}
