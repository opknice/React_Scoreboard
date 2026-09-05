import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEAGUE_DETAIL_LABELS,
  mergeLeagueDetailLabels,
  parseLeagueDetailLabels,
} from './leagueDetailLabels';

describe('leagueDetailLabels', () => {
  it('returns empty labels when a league has no detail label settings', () => {
    expect(parseLeagueDetailLabels(null)).toEqual(DEFAULT_LEAGUE_DETAIL_LABELS);
    expect(parseLeagueDetailLabels({ unrelated: true })).toEqual(DEFAULT_LEAGUE_DETAIL_LABELS);
  });

  it('normalizes malformed values and keeps labels single-line', () => {
    expect(parseLeagueDetailLabels({
      detailLabels: {
        label4: '  รอบชิง\nพิเศษ  ',
        label5: 42,
        label10: 'สนาม 1',
      },
    })).toEqual({
      label4: '  รอบชิง พิเศษ  ',
      label5: '',
      label6: '',
      label7: '',
      label8: '',
      label9: '',
      label10: 'สนาม 1',
    });
  });

  it('merges labels without overwriting unrelated league settings', () => {
    const merged = mergeLeagueDetailLabels(
      { theme: 'dark', logoSizing: { overlayScalePercent: 120 } },
      {
        label4: 'รอบชิง',
        label5: '',
        label6: '',
        label7: '',
        label8: '',
        label9: '',
        label10: 'สนาม 1',
      },
    );

    expect(merged).toEqual({
      theme: 'dark',
      logoSizing: { overlayScalePercent: 120 },
      detailLabels: {
        label4: 'รอบชิง',
        label5: '',
        label6: '',
        label7: '',
        label8: '',
        label9: '',
        label10: 'สนาม 1',
      },
    });
  });
});

