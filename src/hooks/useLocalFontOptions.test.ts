import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('loads only on demand, shares pending work, reuses cached fonts, and supports explicit refresh', async () => {
  const { useLocalFontOptions } = await import('./useLocalFontOptions');
  let finish!: (fonts: Array<{ family: string }>) => void;
  const query = vi.fn(() => new Promise<Array<{ family: string }>>(resolve => { finish = resolve; }));
  vi.stubGlobal('queryLocalFonts', query);
  const first = renderHook(({ enabled }) => useLocalFontOptions(enabled), { initialProps: { enabled: false } });
  expect(query).not.toHaveBeenCalled();
  first.rerender({ enabled: true });
  const second = renderHook(() => useLocalFontOptions(true));
  expect(query).toHaveBeenCalledTimes(1);
  first.unmount();
  await act(async () => { finish([{ family: 'Custom Thai' }, { family: 'Custom Thai' }]); });
  expect(second.result.current.fontOptions.filter(font => font.value === 'Custom Thai')).toHaveLength(1);
  const third = renderHook(() => useLocalFontOptions(true));
  await waitFor(() => expect(third.result.current.loading).toBe(false));
  expect(query).toHaveBeenCalledTimes(1);
  act(() => third.result.current.refresh());
  expect(query).toHaveBeenCalledTimes(2);
  await act(async () => { finish([{ family: 'New Font' }]); });
  expect(third.result.current.fontOptions.some(font => font.value === 'New Font')).toBe(true);
});

it('keeps fallback options after denied permission and allows retry', async () => {
  const { useLocalFontOptions } = await import('./useLocalFontOptions');
  const query = vi.fn().mockRejectedValueOnce(new Error('Denied')).mockResolvedValue([{ family: 'Allowed Font' }]);
  vi.stubGlobal('queryLocalFonts', query);
  const { result } = renderHook(() => useLocalFontOptions(true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.fontOptions.length).toBeGreaterThan(0);
  expect(result.current.localFontMessage).toContain('ไม่ได้รับสิทธิ์');
  await act(async () => result.current.refresh());
  expect(result.current.fontOptions.some(font => font.value === 'Allowed Font')).toBe(true);
});
