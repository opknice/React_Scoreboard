import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import InstantReplayControl from './InstantReplayControl';

const mocks = vi.hoisted(() => ({ send: vi.fn(), playlistRender: vi.fn(), folder: { value: {} as Record<string, unknown> } }));
const channel = new EventTarget();
vi.mock('../hooks/useReplayChannel', () => {
  const channelRef = { get current() { return channel; } };
  return { useReplayChannel: () => ({ channelRef, send: mocks.send }) };
});
vi.mock('../context/useObsVideoFolderContext', () => ({ useObsVideoFolderContext: () => mocks.folder.value }));
// Deliberately not memoized: any parent render would reach this observer.
vi.mock('./ReplayPlaylistPanel', () => ({ default: () => { mocks.playlistRender(); return null; } }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); vi.clearAllMocks(); });

it('updates the timeline without rendering the control lists, rejects old playback status, and keeps seek/trim commands', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('BroadcastChannel', class { postMessage() {} close() {} });
  const file = new File(['clip'], 'clip.mp4', { type: 'video/mp4', lastModified: 1 });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(4) });
  mocks.folder.value = { isConnected: true, videoFiles: [file], folderHandle: null };
  const { container } = render(<InstantReplayControl />);
  expect(screen.queryByRole('button', { name: /Quick Add to OBS/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /คลิกเดียว โหลดและเล่น/ }));
  await waitFor(() => expect(mocks.send.mock.calls.some(([message]) => message.type === 'file')).toBe(true));
  const playbackId = mocks.send.mock.calls.find(([message]) => message.type === 'file')![0].playbackId;
  const status = (time: number, id = playbackId) => channel.dispatchEvent(new MessageEvent('message', {
    data: { type: 'status', playbackId: id, duration: 60, currentTime: time, markerA: 52, markerB: 60 },
  }));
  act(() => { status(0); status(0); });
  expect(mocks.send.mock.calls.filter(([message]) => message.action === 'setA')).toHaveLength(1);
  expect(mocks.send).toHaveBeenCalledWith({ type: 'cmd', action: 'seek', value: 52 });
  const renders = mocks.playlistRender.mock.calls.length;
  for (const time of [1, 2, 3, 4, 5]) act(() => { status(time); });
  expect(container.querySelector('.current-time-label')?.textContent).toBe('0:05');
  expect(mocks.playlistRender).toHaveBeenCalledTimes(renders);
  act(() => { status(45, 'old-playback'); });
  expect(container.querySelector('.current-time-label')?.textContent).toBe('0:05');
  const track = container.querySelector('.timeline-track')!;
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 100 } as DOMRect);
  fireEvent.click(track, { clientX: 50 });
  expect(mocks.send).toHaveBeenCalledWith({ type: 'cmd', action: 'seek', value: 30 });
  fireEvent.click(screen.getByRole('button', { name: '10s' }));
  expect(mocks.send).toHaveBeenCalledWith({ type: 'cmd', action: 'setA', value: 50 });
});

it('shows Quick Add only when OBS setup is provided and reflects its connection state', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('BroadcastChannel', class { postMessage() {} close() {} });
  mocks.folder.value = { isConnected: false, videoFiles: [], folderHandle: null };
  const onQuickAdd = vi.fn();
  const { rerender } = render(
    <InstantReplayControl obsSetup={{ connected: false, busy: false, message: '', onQuickAdd }} />,
  );
  const button = screen.getByRole('button', { name: /Quick Add to OBS/ });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(Array.from(button.parentElement!.querySelectorAll('button')).map((item) => item.textContent?.trim())).toEqual([
    'Quick Add to OBS',
    'คัดลอก URL สำหรับ OBS',
  ]);

  rerender(<InstantReplayControl obsSetup={{ connected: true, busy: false, message: 'พร้อมใช้งาน', onQuickAdd }} />);
  fireEvent.click(screen.getByRole('button', { name: /Quick Add to OBS/ }));
  expect(onQuickAdd).toHaveBeenCalledOnce();
  const brand = screen.getByText('Replay Controller');
  expect(brand.nextElementSibling?.className).toBe('replay-header-obs-status');
  expect(brand.nextElementSibling?.textContent).toContain('Connected');
  expect(brand.nextElementSibling?.textContent).toContain('พร้อมใช้งาน');
});
