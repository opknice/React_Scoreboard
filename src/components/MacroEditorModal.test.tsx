import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MacroEditorModal from './MacroEditorModal';

function renderEditor() {
  render(<MacroEditorModal onSave={vi.fn()} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
}

function renderActionsStep() {
  renderEditor();
  fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
}

describe('MacroEditorModal event step', () => {
  it('ignores clicks on the empty backdrop area', () => {
    const onClose = vi.fn();
    const { container } = render(<MacroEditorModal onSave={vi.fn()} onClose={onClose} />);

    const backdrop = container.querySelector('.modal-overlay');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps future steps disabled until they are reached', () => {
    render(<MacroEditorModal onSave={vi.fn()} onClose={vi.fn()} />);

    expect((screen.getByRole('button', { name: '2. เลือกเหตุการณ์' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '3. กำหนดขั้นตอน' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('captures a selected keyboard code without allowing text input to corrupt it', () => {
    renderEditor();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'KeyPressed' } });
    const keyInput = screen.getByPlaceholderText('เช่น F5, KeyA, Space') as HTMLInputElement;

    expect(keyInput.readOnly).toBe(true);
    fireEvent.keyDown(keyInput, { key: 'a', code: 'KeyA' });

    expect(keyInput.value).toBe('KeyA');
  });

  it('requires a specific Scoreboard button and removes the all-buttons choice', () => {
    renderEditor();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ButtonClicked' } });

    expect(screen.queryByText('ทุกปุ่ม')).toBeNull();
    expect(screen.queryByText('ปุ่มที่เลือก')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
    expect(screen.getByText('กรุณาเลือกปุ่มบน Scoreboard ที่ต้องการ')).toBeTruthy();

    const buttonSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
    fireEvent.change(buttonSelect, { target: { value: 'close_var_replay' } });
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));

    expect(screen.getByText('Automation ใหม่')).toBeTruthy();
  });

  it('requires a specific OBS hotkey and removes the all-hotkeys choice', () => {
    renderEditor();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CustomEvent' } });

    expect(screen.queryByText('ทุก Hotkey')).toBeNull();
    expect(screen.queryByText('Hotkey ที่เลือก')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
    expect(screen.getByText('กรุณาเลือก Hotkey จาก OBS Script')).toBeTruthy();

    const hotkeySelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
    fireEvent.change(hotkeySelect, { target: { value: 'play1' } });
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));

    expect(screen.getByText('Automation ใหม่')).toBeTruthy();
  });

  it('does not close while Escape is being used to clear a keyboard filter', () => {
    const onClose = vi.fn();
    render(<MacroEditorModal onSave={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'KeyPressed' } });

    fireEvent.keyDown(screen.getByPlaceholderText('เช่น F5, KeyA, Space'), { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('allows an unfiltered keyboard trigger and clears the previous validation error', () => {
    renderEditor();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'KeyPressed' } });
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));

    expect(screen.getByText('กรุณาเลือกเงื่อนไขของเหตุการณ์ หรือเลือก “ทุกครั้ง”')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /ทุกคีย์/ }));

    expect(screen.queryByText('กรุณาเลือกเงื่อนไขของเหตุการณ์ หรือเลือก “ทุกครั้ง”')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
    expect(screen.getByText('Automation ใหม่')).toBeTruthy();
  });

  it('can return to the event step from the action step', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));

    expect((screen.getByRole('button', { name: '2. เลือกเหตุการณ์' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '2. เลือกเหตุการณ์' }));
    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it.each([
    'switchScene',
    'showSource',
    'hideSource',
    'showPlayGroup',
    'hidePlayGroup',
    'wait',
    'openVarReplay',
    'closeVarReplay',
    'openReplayControl',
    'closeReplayControl',
    'closePenaltyShootout',
    'saveReplayBuffer',
    'loadLatestReplay',
  ])('adds the selected action type: %s', (actionType) => {
    renderActionsStep();

    const comboboxes = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const addActionSelect = comboboxes[comboboxes.length - 1];
    fireEvent.change(addActionSelect, { target: { value: actionType } });

    const actionSelects = (screen.getAllByRole('combobox') as HTMLSelectElement[])
      .filter((select) => select.getAttribute('aria-label') !== 'เลือกกลุ่ม PlayGroup');
    const addedActionSelect = actionSelects[actionSelects.length - 2];
    expect(addedActionSelect.value).toBe(actionType);
    expect(addActionSelect.value).toBe('');
  });

  it('loads PlayGroup groups and saves the chosen UUID with the action', async () => {
    const onSave = vi.fn();
    const call = vi.fn(async (requestType: string) => requestType === 'CallVendorRequest'
      ? { responseData: { groups: [{ uuid: 'group-uuid', name: 'Score overlay', scene: 'Main' }] } }
      : {});
    render(<MacroEditorModal obs={{ isConnected: true, call }} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
    fireEvent.change(screen.getAllByRole('combobox').at(-1)!, { target: { value: 'showPlayGroup' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก Automation' }));
    expect(onSave).not.toHaveBeenCalled();

    await screen.findByRole('option', { name: 'Score overlay (Main)' });
    expect(call).toHaveBeenCalledWith('CallVendorRequest', { vendorName: 'PlayGroup', requestType: 'ListGroups' });
    fireEvent.change(screen.getByRole('combobox', { name: 'เลือกกลุ่ม PlayGroup' }), { target: { value: 'group-uuid' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก Automation' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      actions: expect.arrayContaining([expect.objectContaining({
        type: 'showPlayGroup', playGroupUuid: 'group-uuid', playGroupName: 'Score overlay',
      })]),
    }));
  });

  it('cannot_save_new_source_record_action_without_uuids', () => {
    const onSave = vi.fn();
    render(<MacroEditorModal onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
    fireEvent.change(screen.getAllByRole('combobox').at(-1)!, { target: { value: 'saveSourceRecordReplay' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก Automation' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('กรุณาเลือก Source และ Filter Source Record ที่มี UUID ถูกต้อง')).toBeTruthy();
  });

  it('saves the exact Source Record filter target selected in the editor', async () => {
    const target = { sourceUuid: '23456789-1234-4123-8123-123456789abc', filterUuid: '34567890-1234-4123-8123-123456789abc', sourceName: 'Camera', filterName: 'Highlights' };
    const call = vi.fn(async (type: string, data?: any) => type === 'CallVendorRequest' && data.vendorName === 'SourceRecord'
      ? { responseData: { protocolVersion: 1, ok: true, filters: [{ ...target, targetKind: 'source', enabled: true, replayEnabled: true, replayActive: true, busy: false,
        settings: { durationSeconds: 20, directory: 'D:\\Clips', filenameFormatting: '%CCYY', format: 'mkv', replayPerformance: 1 } }] } } : {});
    const onSave = vi.fn();
    const connection = { call, on: vi.fn(), off: vi.fn() };
    render(<MacroEditorModal obs={{ isConnected: true, call, getObsRef: () => connection }} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
    fireEvent.change(screen.getAllByRole('combobox').at(-1)!, { target: { value: 'saveSourceRecordReplay' } });
    await screen.findByRole('option', { name: /Camera \(Source\)/ });
    fireEvent.change(screen.getByLabelText('เลือก Source หรือ Scene'), { target: { value: target.sourceUuid } });
    fireEvent.change(screen.getByLabelText('เลือก Filter Source Record'), { target: { value: target.filterUuid } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก Automation' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ actions: expect.arrayContaining([
      expect.objectContaining({ type: 'saveSourceRecordReplay', sourceRecordTarget: target }),
    ]) }));
  });

  it('allows an existing target to be saved while offline', () => {
    const sourceRecordTarget = { sourceUuid: '23456789-1234-4123-8123-123456789abc', filterUuid: '34567890-1234-4123-8123-123456789abc', sourceName: 'Camera', filterName: 'Replay' };
    const onSave = vi.fn();
    render(<MacroEditorModal macro={{ id: 'existing', name: 'Existing', color: '#fff', isEnabled: true,
      trigger: { event: 'ReplayBufferSaved' }, actions: [{ id: 'save', type: 'saveSourceRecordReplay', sourceRecordTarget }], logs: [], lastTrigger: '' }}
      onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก Automation' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ actions: [{ id: 'save', type: 'saveSourceRecordReplay', sourceRecordTarget }] }));
  });
});
