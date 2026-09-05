import type { Json } from './supabase';

/** League-wide labels that can be reused by the announcement template and OBS. */
export interface LeagueDetailLabels {
  label4: string;
  label5: string;
  label6: string;
  label7: string;
  label8: string;
  label9: string;
  label10: string;
}

export const LEAGUE_DETAIL_LABEL_KEYS = [
  'label4',
  'label5',
  'label6',
  'label7',
  'label8',
  'label9',
  'label10',
] as const satisfies readonly (keyof LeagueDetailLabels)[];

export type LeagueDetailLabelKey = typeof LEAGUE_DETAIL_LABEL_KEYS[number];

export const DEFAULT_LEAGUE_DETAIL_LABELS: LeagueDetailLabels = {
  label4: '',
  label5: '',
  label6: '',
  label7: '',
  label8: '',
  label9: '',
  label10: '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Keep values single-line even when settings were written by an older client. */
function normalizeLabelValue(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/[\r\n]+/g, ' ')
    : '';
}

export function parseLeagueDetailLabels(settings: unknown): LeagueDetailLabels {
  const settingsRecord = isRecord(settings) ? settings : undefined;
  const labelsRecord = settingsRecord && isRecord(settingsRecord.detailLabels)
    ? settingsRecord.detailLabels
    : undefined;

  return LEAGUE_DETAIL_LABEL_KEYS.reduce<LeagueDetailLabels>((labels, key) => {
    labels[key] = normalizeLabelValue(labelsRecord?.[key]);
    return labels;
  }, { ...DEFAULT_LEAGUE_DETAIL_LABELS });
}

/** Merge only the detailLabels namespace and preserve unrelated league settings. */
export function mergeLeagueDetailLabels(
  settings: Json | null | undefined,
  labels: LeagueDetailLabels,
): Json {
  const root = isRecord(settings) ? settings : {};
  const normalizedLabels = LEAGUE_DETAIL_LABEL_KEYS.reduce<Record<string, string>>((result, key) => {
    result[key] = normalizeLabelValue(labels[key]);
    return result;
  }, {});

  return {
    ...root,
    detailLabels: normalizedLabels,
  } as Json;
}

