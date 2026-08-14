export interface ExcelField {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

export const EXCEL_FIELDS: ExcelField[] = [
  { key: 'matchId', label: 'Match ID', required: true, aliases: ['match', 'id', 'matchid', 'match id', 'no', 'no.', 'number', 'ลำดับ', 'ที่', 'แมตช์'] },
  { key: 'teamA', label: 'Team A', required: true, aliases: ['team_a', 'teama', 'team a', 'home', 'home team', 'team1', 'team 1', 'ทีมa', 'ทีม a', 'ทีมเหย้า'] },
  { key: 'teamB', label: 'Team B', required: true, aliases: ['team_b', 'teamb', 'team b', 'away', 'away team', 'team2', 'team 2', 'ทีมb', 'ทีม b', 'ทีมเยือน'] },
  { key: 'logoA', label: 'Logo A', aliases: ['team_a', 'logoa', 'logo a', 'home logo', 'logo1', 'โลโก้a', 'โลโก้ a'] },
  { key: 'logoB', label: 'Logo B', aliases: ['team_b', 'logob', 'logo b', 'away logo', 'logo2', 'โลโก้b', 'โลโก้ b'] },
  { key: 'colorA', label: 'Color A', aliases: [] },
  { key: 'colorB', label: 'Color B', aliases: [] },
  { key: 'colorA2', label: 'Color A 2', aliases: [] },
  { key: 'colorB2', label: 'Color B 2', aliases: [] },
  { key: 'label1', label: 'Label 1', aliases: ['label_1', 'label1', 'label 1', 'round', 'รอบ', 'ป้าย1'] },
  { key: 'label2', label: 'Label 2', aliases: ['label_2', 'label2', 'label 2', 'week', 'สัปดาห์', 'ป้าย2'] },
  { key: 'label3', label: 'Label 3', aliases: ['label_3', 'label3', 'label 3', 'field', 'สนาม', 'ป้าย3'] },
];

export interface FirebaseSaveTarget {
  id: string;
  index: number;
  name: string;
  firebaseConfig: Record<string, string>;
}

export interface TeamColorRow {
  rowNumber: number;
  team: string;
  color1: string;
  color2: string;
}

export const normalizeColumnName = (value: any): string => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_\-.()[\]/\\]+/g, '');

export const isFirebaseConfigSheetName = (sheetName: string): boolean => {
  const normalized = normalizeColumnName(sheetName);
  return normalized === normalizeColumnName('FirebaseRealtimeDatabase')
    || (normalized.includes('firebase') && normalized.includes('database'));
};

export const inferExcelMapping = (headers: string[]): Record<string, string> => {
  const normalizedHeaders = headers.map(normalizeColumnName);
  return EXCEL_FIELDS.reduce((mapping, field) => {
    const aliases = [field.key, field.label, ...field.aliases].map(normalizeColumnName);
    const matchIndex = normalizedHeaders.findIndex(header => aliases.includes(header));
    mapping[field.key] = matchIndex >= 0 ? headers[matchIndex] : '';
    return mapping;
  }, {} as Record<string, string>);
};
