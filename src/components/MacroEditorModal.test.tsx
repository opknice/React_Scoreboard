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

    const actionSelects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const addedActionSelect = actionSelects[actionSelects.length - 2];
    expect(addedActionSelect.value).toBe(actionType);
    expect(addActionSelect.value).toBe('');
  });
});
