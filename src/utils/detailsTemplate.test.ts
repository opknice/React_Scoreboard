import { describe, expect, it } from 'vitest';
import { renderDetailsTemplate, type DetailsTemplateValues } from './detailsTemplate';

const values: DetailsTemplateValues = {
  nameA: 'Team A',
  nameB: 'Team B',
  scoreA: 2,
  scoreB: 1,
  thaiDate: 'วันเสาร์ที่ 5 กันยายน 2569',
  timeCounter: '12:34',
  halfText: '1st',
  label1: 'รอบแรก',
  label2: 'สัปดาห์ที่ 1',
  label3: 'สนาม 1',
  label4: 'test',
  label5: 'League Label',
  label6: '',
  label7: '',
  label8: '',
  label9: '',
  label10: '',
};

describe('detailsTemplate', () => {
  it('renders all supported tags with current values and preserves line breaks', () => {
    expect(renderDetailsTemplate(
      '<TeamA> <score_team_a> - <score_team_b> <TeamB>\n<label4> | <thai_date> | <time_counter>',
      values,
    )).toBe('Team A 2 - 1 Team B\ntest | วันเสาร์ที่ 5 กันยายน 2569 | 12:34');
  });

  it('keeps unknown tags unchanged and cleans legacy break markup', () => {
    expect(renderDetailsTemplate('<TeamA><br><label5> <unknown>', values))
      .toBe('Team A League Label <unknown>');
  });
});

