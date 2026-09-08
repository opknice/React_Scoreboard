import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import VarReplayV2Page from './VarReplayV2Page';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  folder: {
    isConnected: false,
    videoFiles: [] as File[],
    folderName: '',
  },
}));

const channel = new EventTarget() as EventTarget & { onmessage: ((event: MessageEvent) => void) | null };
channel.onmessage = null;

vi.mock('../../context/useObsVideoFolderContext', () => ({
  useObsVideoFolderContext: () => mocks.folder,
}));

vi.mock('./useVarReplayV2Channel', () => ({
  useVarReplayV2Channel: () => ({
    channelRef: { current: channel },
    send: mocks.send,
  }),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

function renderControl(obsSetup?: Parameters<typeof VarReplayV2Page>[0]['obsSetup']) {
  return render(
    <MemoryRouter>
      <VarReplayV2Page mode="control" obsSetup={obsSetup} />
    </MemoryRouter>,
  );
}

it('shows Quick Add only when opened with main-controller OBS setup', () => {
  const standalone = renderControl();
  expect(screen.queryByRole('button', { name: /Quick Add to OBS/ })).toBeNull();
  standalone.unmount();

  const onQuickAdd = vi.fn();
  const { rerender } = renderControl({ connected: false, busy: false, message: '', onQuickAdd });
  const button = screen.getByRole('button', { name: /Quick Add to OBS/ });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(Array.from(button.parentElement!.querySelectorAll('button')).map((item) => item.textContent?.trim())).toEqual([
    'เปิด Screen',
    'Quick Add to OBS',
    'คัดลอก URL OBS',
  ]);

  rerender(
    <MemoryRouter>
      <VarReplayV2Page
        mode="control"
        obsSetup={{ connected: true, busy: false, message: 'พร้อมใช้งาน', onQuickAdd }}
      />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Quick Add to OBS/ }));
  expect(onQuickAdd).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole('status').some((status) => status.textContent?.includes('พร้อมใช้งาน'))).toBe(true);
});
