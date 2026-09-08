import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ObsVideoFolderProvider } from './ObsVideoFolderContext';
import { useObsVideoFolderConnection, useObsVideoFolderFiles } from './useObsVideoFolderContext';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

it('updates file consumers without rerendering connection consumers and ignores a scan after disconnect', async () => {
  let files = [new File(['one'], 'one.mp4', { lastModified: 1 })];
  let pendingFile: Promise<File> | undefined;
  const handle = {
    name: 'replays',
    async *values() {
      for (const file of files) yield { kind: 'file', getFile: () => pendingFile ?? Promise.resolve(file) };
    },
  };
  vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(handle));
  vi.stubGlobal('indexedDB', { open: () => { throw new Error('No stored handle'); } });
  let connection!: ReturnType<typeof useObsVideoFolderConnection>;
  let library!: ReturnType<typeof useObsVideoFolderFiles>;
  const connectionRender = vi.fn();
  function Connection() { connection = useObsVideoFolderConnection(); connectionRender(); return null; }
  function Library() { library = useObsVideoFolderFiles(); return <span>{library.videoFiles.length}</span>; }
  render(<ObsVideoFolderProvider><Connection /><Library /></ObsVideoFolderProvider>);
  await act(async () => { await connection.connect(); });
  expect(connection.isConnected).toBe(true);
  const rescan = connection.rescan;
  const originalFiles = library.videoFiles;
  const renderCount = connectionRender.mock.calls.length;
  await act(async () => { await rescan(); });
  expect(library.videoFiles).toBe(originalFiles);
  expect(connectionRender).toHaveBeenCalledTimes(renderCount);

  files = [...files, new File(['two'], 'two.mp4', { lastModified: 2 })];
  await act(async () => { await rescan(); });
  expect(library.videoFiles).toHaveLength(2);
  expect(connectionRender).toHaveBeenCalledTimes(renderCount);
  expect(connection.rescan).toBe(rescan);

  let finish!: (file: File) => void;
  pendingFile = new Promise(resolve => { finish = resolve; });
  let scan!: Promise<File[]>;
  act(() => { scan = rescan(); connection.disconnect(); });
  await act(async () => { finish(files[0]); await scan; });
  expect(connection.isConnected).toBe(false);
  expect(library.videoFiles).toEqual([]);
});
