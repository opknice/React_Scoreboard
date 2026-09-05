import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createTimerStore } from '../hooks/useTimer';
import { DEFAULT_LEAGUE_DETAIL_LABELS } from '../types/leagueDetailLabels';
import ScoreboardSettingsModal from './ScoreboardSettingsModal';

describe('ScoreboardSettingsModal', () => {
  const timer = createTimerStore();

  afterEach(() => {
    timer.resetToZero();
  });

  it('shows persisted values for league-level labels in the tag description', () => {
    render(
      <ScoreboardSettingsModal
        isOpen
        trans={{ settings: 'ตั้งค่า', detailsDesc: 'รายละเอียด', save: 'บันทึก', close: 'ปิด' }}
        detailsTemplate=""
        nameA="Team A"
        nameB="Team B"
        scoreA={0}
        scoreB={0}
        timer={timer}
        label1="รอบแรก"
        label2="สัปดาห์ที่ 1"
        label3="สนาม 1"
        detailLabels={{ ...DEFAULT_LEAGUE_DETAIL_LABELS, label4: 'test', label10: 'สนามพิเศษ' }}
        onTemplateChange={() => undefined}
        onOpenDetailLabels={() => undefined}
        onPreview={(template) => template}
        onSave={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.getAllByText('<label4>')[1].parentElement?.textContent).toContain('ข้อความ Label 4 (test)');
    expect(screen.getAllByText('<label10>')[1].parentElement?.textContent).toContain('ข้อความ Label 10 (สนามพิเศษ)');
    expect(screen.getAllByText('<label5>')[1].parentElement?.textContent).toContain('ข้อความ Label 5 (-)');
  });

  it('opens the resolved preview dialog only after the Preview button is clicked', () => {
    render(
      <ScoreboardSettingsModal
        isOpen
        trans={{ settings: 'ตั้งค่า', detailsDesc: 'รายละเอียด', save: 'บันทึก', close: 'ปิด' }}
        detailsTemplate="<label4>"
        nameA="Team A"
        nameB="Team B"
        scoreA={1}
        scoreB={2}
        timer={timer}
        label1="รอบแรก"
        label2="สัปดาห์ที่ 1"
        label3="สนาม 1"
        detailLabels={{ ...DEFAULT_LEAGUE_DETAIL_LABELS, label4: 'test' }}
        onTemplateChange={() => undefined}
        onOpenDetailLabels={() => undefined}
        onPreview={() => 'test (ข้อความจริง)'}
        onSave={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /แสดง Preview/i }));
    expect(screen.getByRole('dialog').textContent).toContain('test (ข้อความจริง)');
  });
});
