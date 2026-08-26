// Excel helpers used for temporary workbook import and team color extraction.
// Supabase is the only runtime data provider.
import type ExcelJS from 'exceljs';

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

export interface TeamColorRow {
  rowNumber: number;
  team: string;
  color1: string;
  color2: string;
  logoUrl?: string;
}

export const normalizeColumnName = (value: unknown): string => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_\-.()[\]/\\]+/g, '');

export const cleanExcelText = (value: unknown): string => String(value ?? '').trim();

export const inferExcelMapping = (headers: string[]): Record<string, string> => {
  const normalizedHeaders = headers.map(normalizeColumnName);
  return EXCEL_FIELDS.reduce((mapping, field) => {
    const aliases = [field.key, field.label, ...field.aliases].map(normalizeColumnName);
    const matchIndex = normalizedHeaders.findIndex(header => aliases.includes(header));
    mapping[field.key] = matchIndex >= 0 ? headers[matchIndex] : '';
    return mapping;
  }, {} as Record<string, string>);
};

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
};

const rgbToHex = (r: number, g: number, b: number): string => '#' + [r, g, b].map(value => {
  const hex = value.toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
}).join('');

export const applyTint = (hexColor: string, tint: number): string => {
  if (!hexColor || tint === 0) return hexColor;

  const rgb = hexToRgb(hexColor);
  if (!rgb) return hexColor;

  if (tint > 0) {
    rgb.r = Math.round(rgb.r + (255 - rgb.r) * tint);
    rgb.g = Math.round(rgb.g + (255 - rgb.g) * tint);
    rgb.b = Math.round(rgb.b + (255 - rgb.b) * tint);
  } else {
    rgb.r = Math.round(rgb.r * (1 + tint));
    rgb.g = Math.round(rgb.g * (1 + tint));
    rgb.b = Math.round(rgb.b * (1 + tint));
  }

  return rgbToHex(rgb.r, rgb.g, rgb.b);
};

const extractCellColor = (cell: ExcelJS.Cell, themeColors: string[]): string => {
  if (!cell.fill) return '';

  const fill = cell.fill as ExcelJS.FillPattern;
  if (fill.type !== 'pattern' || !fill.fgColor) return '';

  if (fill.fgColor.argb) {
    const argb = String(fill.fgColor.argb).toUpperCase();
    if (argb.length === 8) return `#${argb.substring(2)}`;
    if (argb.length === 6) return `#${argb}`;
  }

  if (typeof fill.fgColor.theme === 'number' && fill.fgColor.theme < themeColors.length) {
    let color = themeColors[fill.fgColor.theme];
    const tint = (fill.fgColor as Partial<ExcelJS.Color> & { tint?: number }).tint;
    if (tint) color = applyTint(color, tint);
    return color;
  }

  return '';
};

export const loadTeamSheetWithColors = async (file: File | ArrayBuffer): Promise<TeamColorRow[]> => {
  try {
    const excelJsModule = await import('exceljs');
    const ExcelJSRuntime = 'default' in excelJsModule ? excelJsModule.default : excelJsModule;
    const arrayBuffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
    const workbook = new ExcelJSRuntime.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const teamSheet = workbook.worksheets.find(sheet => ['team', 'teams'].includes(normalizeColumnName(sheet.name)));
    if (!teamSheet) return [];

    const themeColors = [
      '#FFFFFF', '#000000', '#E7E6E6', '#44546A', '#4472C4',
      '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47',
    ];
    const teamData: TeamColorRow[] = [];
    let teamColIndex = -1;
    let color1ColIndex = -1;
    let color2ColIndex = -1;

    teamSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const normalizedHeader = normalizeColumnName(cell.value ? String(cell.value) : '');
          if (normalizedHeader.includes('team')) teamColIndex = colNumber;
          else if (normalizedHeader.includes('color1')) color1ColIndex = colNumber;
          else if (normalizedHeader.includes('color2')) color2ColIndex = colNumber;
        });
        return;
      }

      if (teamColIndex < 0) return;
      const team = cleanExcelText(row.getCell(teamColIndex).value);
      if (!team) return;

      teamData.push({
        rowNumber,
        team,
        color1: color1ColIndex > 0 ? extractCellColor(row.getCell(color1ColIndex), themeColors) : '',
        color2: color2ColIndex > 0 ? extractCellColor(row.getCell(color2ColIndex), themeColors) : '',
      });
    });

    return teamData;
  } catch (error) {
    console.error('Error loading team colors:', error);
    return [];
  }
};
