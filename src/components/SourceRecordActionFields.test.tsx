import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SourceRecordActionFields from './SourceRecordActionFields';
import { listSourceRecordFilters } from '../obs/sourceRecordClient';
import type { SourceRecordConnection, SourceRecordFilter } from '../types/sourceRecord';

vi.mock('../obs/sourceRecordClient', () => ({ listSourceRecordFilters: vi.fn() }));
const target = { sourceUuid: '23456789-1234-4123-8123-123456789abc', filterUuid: '34567890-1234-4123-8123-123456789abc', sourceName: 'Camera', filterName: 'Replay' };
const secondUuid = '45678901-1234-4123-8123-123456789abc';
const row: SourceRecordFilter = { ...target, targetKind: 'source', enabled: true, replayEnabled: true, replayActive: true, busy: false,
  settings: { durationSeconds: 25, directory: 'D:\\Clips', filenameFormatting: '%CCYY', format: 'mkv', replayPerformance: 1 } };
const obs = {} as SourceRecordConnection;
describe('Source Record filter selection', () => {
  beforeEach(() => { vi.mocked(listSourceRecordFilters).mockReset().mockResolvedValue([row, { ...row, filterUuid: secondUuid, filterName: 'Replay', busy: true },
    { ...row, sourceUuid: secondUuid, targetKind: 'scene', sourceName: 'Scene' }]); });
  it('selects_exact_filter even with duplicate names', async () => {
    const onChange = vi.fn(); render(<SourceRecordActionFields obs={obs} isConnected value={undefined} onChange={onChange} />);
    await screen.findByRole('option', { name: /Camera/ });
    fireEvent.change(screen.getByLabelText('เลือก Source หรือ Scene'), { target: { value: target.sourceUuid } });
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    fireEvent.change(screen.getByLabelText('เลือก Filter Source Record'), { target: { value: secondUuid } });
    expect(onChange).toHaveBeenLastCalledWith({ ...target, filterUuid: secondUuid });
    expect(screen.getByText('ใช้การตั้งค่าจาก Filter Source Record')).toBeTruthy();
  });
  it('shows_live_duration_and_readiness and follows UUID through rename', async () => {
    vi.mocked(listSourceRecordFilters).mockResolvedValue([{ ...row, sourceName: 'Renamed', replayActive: false }]);
    const onChange = vi.fn(); render(<SourceRecordActionFields obs={obs} isConnected value={target} onChange={onChange} />);
    await screen.findByText(/25 วินาที/); expect(screen.getAllByText(/Buffer ยังไม่พร้อม/).length).toBeGreaterThan(0);
    expect(onChange).toHaveBeenCalledWith({ ...target, sourceName: 'Renamed' });
  });
  it('offline_preserves_saved_target', () => {
    const onChange = vi.fn(); render(<SourceRecordActionFields obs={obs} isConnected={false} value={target} onChange={onChange} />);
    expect(screen.getByRole('option', { name: /Camera/ })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled(); expect(listSourceRecordFilters).not.toHaveBeenCalled();
  });
  it('refresh_does_not_select_replacement', async () => {
    const onChange = vi.fn(); render(<SourceRecordActionFields obs={obs} isConnected value={target} onChange={onChange} />);
    await screen.findByText(/25 วินาที/);
    vi.mocked(listSourceRecordFilters).mockResolvedValue([{ ...row, filterUuid: secondUuid }]);
    fireEvent.click(screen.getByRole('button', { name: 'รีเฟรช Source Record' }));
    await screen.findByText(/ไม่พบ Filter เดิม/); expect(onChange).not.toHaveBeenCalled();
  });
  it('reconnect_discards_stale_response', async () => {
    let resolveOld!: (rows: SourceRecordFilter[]) => void;
    vi.mocked(listSourceRecordFilters).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
    const onChange = vi.fn(); const props = { obs, onChange, value: undefined };
    const { rerender } = render(<SourceRecordActionFields {...props} isConnected />);
    rerender(<SourceRecordActionFields {...props} isConnected={false} />);
    rerender(<SourceRecordActionFields {...props} isConnected />);
    await screen.findByRole('option', { name: /Camera/ }); resolveOld([]);
    await waitFor(() => expect(screen.queryByText(/ไม่พบ Source Record Filter/)).toBeNull());
  });
  it.each(['vendor unavailable', 'Malformed response'])('shows load error: %s', async (message) => {
    vi.mocked(listSourceRecordFilters).mockRejectedValue(new Error(message));
    render(<SourceRecordActionFields obs={obs} isConnected onChange={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining(message));
  });
});
