// src/utils/excelParser.ts
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

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
  { key: 'label3', label: 'Label 3', aliases: ['label_3', 'label3', 'label 3', 'field', 'สนาม', 'ป้าย3'] }
];

export const FIREBASE_CONFIG_KEYS = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
export const FIREBASE_REQUIRED_CONFIG_KEYS = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

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

export const cleanExcelText = (value: any): string => String(value ?? '').trim();

export const cleanFirebaseValue = (value: any): string => cleanExcelText(value)
  .replace(/^['"`]+/, '')
  .replace(/[,;'"`]+$/, '')
  .trim();

export const normalizeFirebaseKey = (value: any): string => cleanExcelText(value)
  .replace(/[:：]\s*$/, '')
  .trim();

export const normalizeMetaKey = (value: any): string => normalizeFirebaseKey(value)
  .toLowerCase()
  .replace(/[\s_\-.()[\]/\\:：]+/g, '');

export const isFirebaseConfigSheetName = (sheetName: string): boolean => {
  const normalized = normalizeColumnName(sheetName);
  return normalized === normalizeColumnName('FirebaseRealtimeDatabase')
    || (normalized.includes('firebase') && normalized.includes('database'));
};

const makeSaveTargetId = (projectId: string, fallback: string): string => {
  const cleanProjId = String(projectId || '').trim().replace(/[^a-zA-Z0-9-]/g, '');
  return cleanProjId ? `firebase-${cleanProjId}` : fallback;
};

const isExampleFirebaseBlock = (value: string): boolean => /(exam|example|sample|ตัวอย่าง)/i.test(cleanExcelText(value));

const isFirebaseBlockHeader = (value: string): boolean => {
  const lower = cleanExcelText(value).toLowerCase();
  return lower.includes('firebase') && lower.includes('config');
};

const getFirebaseConfigField = (key: string): string | undefined => {
  return FIREBASE_CONFIG_KEYS.find(configKey => normalizeMetaKey(configKey) === normalizeMetaKey(key));
};

const getFirebaseMetaField = (key: string): string | undefined => {
  const FIREBASE_META_KEYS: Record<string, string[]> = {
    name: ['name', 'league', 'leaguename', 'buttonlabel', 'savelabel', 'ชื่อลีก', 'ชื่อปุ่ม', 'ชื่อลีกleaguename', 'leaguenameชื่อลีก'],
    id: ['id', 'leagueid', 'slug', 'รหัสลีก', 'รหัสลีกleagueid', 'leagueidรหัสลีก']
  };
  return Object.keys(FIREBASE_META_KEYS).find(field => FIREBASE_META_KEYS[field].includes(normalizeMetaKey(key)));
};

const parseFirebaseKeyValue = (row: any[]): { key: string; value: string } | null => {
  const first = cleanExcelText(row[0]);
  const second = cleanFirebaseValue(row[1]);

  if (first.includes(':') || first.includes('=')) {
    const inlineMatch = first.match(/^([^:=]+)[:=](.*)$/);
    if (inlineMatch) {
      return {
        key: normalizeFirebaseKey(inlineMatch[1]),
        value: cleanFirebaseValue(inlineMatch[2] + (second ? ',' + second : ''))
      };
    }
  }

  if (first && second !== '') {
    return {
      key: normalizeFirebaseKey(first),
      value: second
    };
  }

  return null;
};

export const parseFirebaseConfigFromJSON = (jsonString: string): Record<string, string> | null => {
  try {
    const cleaned = jsonString.trim();
    if (cleaned.startsWith('{')) {
      return JSON.parse(cleaned);
    }
  } catch (e) {
    // Treat as inline config string
  }

  const configObj: Record<string, string> = {};
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];

    if ((char === '"' || char === "'" || char === '`') && (i === 0 || jsonString[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      }
      current += char;
    } else if (char === ',' && !inQuotes) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }

  parts.forEach(part => {
    const colonIndex = part.indexOf(':');
    if (colonIndex < 0) return;

    const key = part.substring(0, colonIndex).trim();
    let value = part.substring(colonIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('`') && value.endsWith('`'))) {
      value = value.substring(1, value.length - 1);
    }

    const normalizedKey = FIREBASE_CONFIG_KEYS.find(k =>
      normalizeMetaKey(k) === normalizeMetaKey(key)
    );

    if (normalizedKey && value) {
      configObj[normalizedKey] = value;
    }
  });

  return Object.keys(configObj).length ? configObj : null;
};

const parseFirebaseConfigFromJavaScript = (jsCode: string): Record<string, string> | null => {
  let cleaned = jsCode
    .replace(/const\s+/gi, '')
    .replace(/firebaseConfig\s*=/gi, '')
    .replace(/var\s+/gi, '')
    .replace(/let\s+/gi, '')
    .trim();

  if (cleaned.endsWith(';')) {
    cleaned = cleaned.substring(0, cleaned.length - 1).trim();
  }

  try {
    const jsonString = cleaned.replace(/(\w+):/g, '"$1":');
    return JSON.parse(jsonString);
  } catch (e) {
    // Try manual extraction
  }

  const startBrace = cleaned.indexOf('{');
  const endBrace = cleaned.lastIndexOf('}');

  if (startBrace < 0 || endBrace < 0) return null;

  const innerContent = cleaned.substring(startBrace + 1, endBrace);
  const configObj: Record<string, string> = {};
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let depth = 0;

  for (let i = 0; i < innerContent.length; i++) {
    const char = innerContent[i];

    if ((char === '"' || char === "'" || char === '`') && (i === 0 || innerContent[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      }
      current += char;
    } else if ((char === '{' || char === '[') && !inQuotes) {
      depth++;
      current += char;
    } else if ((char === '}' || char === ']') && !inQuotes) {
      depth--;
      current += char;
    } else if (char === ',' && !inQuotes && depth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }

  parts.forEach(part => {
    const colonIndex = part.indexOf(':');
    if (colonIndex < 0) return;

    let key = part.substring(0, colonIndex).trim();
    let value = part.substring(colonIndex + 1).trim();

    if ((key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))) {
      key = key.substring(1, key.length - 1);
    }

    if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('`') && value.endsWith('`'))) {
      value = value.substring(1, value.length - 1);
    }

    if (value.endsWith(',')) {
      value = value.substring(0, value.length - 1).trim();
    }

    const normalizedKey = FIREBASE_CONFIG_KEYS.find(k =>
      normalizeMetaKey(k) === normalizeMetaKey(key)
    );

    if (normalizedKey && value) {
      configObj[normalizedKey] = value;
    }
  });

  return Object.keys(configObj).length ? configObj : null;
};

const buildFirebaseSaveTarget = (block: { config: Record<string, string>; metadata: Record<string, string>; skip?: boolean }, index: number, targetsLength: number): FirebaseSaveTarget => {
  const leagueName = block.metadata.name || block.config.projectId || `League ${targetsLength + 1}`;
  return {
    id: makeSaveTargetId(block.config.projectId, `league-${targetsLength + 1}`),
    index,
    name: leagueName,
    firebaseConfig: { ...block.config }
  };
};

const parseFirebaseSaveTargetsMultilineFormat = (rows: any[][]): FirebaseSaveTarget[] => {
  const targets: FirebaseSaveTarget[] = [];
  let currentLeague: string | null = null;
  let currentConfigLines: string[] = [];
  let inConfigBlock = false;

  for (let i = 0; i < rows.length; i++) {
    const line = cleanExcelText(rows[i][0]);

    if (!line || line.startsWith('//') || line.startsWith('#')) {
      continue;
    }

    if (line.includes('League Name') && line.includes('"')) {
      const match = line.match(/["']([^"']+)["']/);
      if (match) {
        if (currentLeague && currentConfigLines.length > 0) {
          const config = parseFirebaseConfigFromJavaScript(currentConfigLines.join('\n'));
          if (config && FIREBASE_REQUIRED_CONFIG_KEYS.every(k => config[k])) {
            targets.push({
              id: makeSaveTargetId(config.projectId, `league-${targets.length + 1}`),
              index: targets.length,
              name: currentLeague,
              firebaseConfig: config
            });
          }
        }
        currentLeague = match[1];
        currentConfigLines = [];
        inConfigBlock = false;
      }
      continue;
    }

    if (line.includes('const') && line.includes('firebaseConfig')) {
      inConfigBlock = true;
      currentConfigLines = [line];
      continue;
    }

    if (inConfigBlock) {
      currentConfigLines.push(line);
      if (line.includes('};') || (line.includes('}') && line.includes(';'))) {
        inConfigBlock = false;
      }
    }
  }

  if (currentLeague && currentConfigLines.length > 0) {
    const config = parseFirebaseConfigFromJavaScript(currentConfigLines.join('\n'));
    if (config && FIREBASE_REQUIRED_CONFIG_KEYS.every(k => config[k])) {
      targets.push({
        id: makeSaveTargetId(config.projectId, `league-${targets.length + 1}`),
        index: targets.length,
        name: currentLeague,
        firebaseConfig: config
      });
    }
  }

  return targets;
};

const parseFirebaseSaveTargetsNewFormatNoHeader = (rows: any[][]): FirebaseSaveTarget[] => {
  const targets: FirebaseSaveTarget[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const leagueName = cleanExcelText(row[0]);
    const configText = cleanExcelText(row[1]);

    if (!leagueName || !configText) continue;

    const config = parseFirebaseConfigFromJavaScript(configText);
    if (config && FIREBASE_REQUIRED_CONFIG_KEYS.every(k => config[k])) {
      targets.push({
        id: makeSaveTargetId(config.projectId, `league-${targets.length + 1}`),
        index: targets.length,
        name: leagueName,
        firebaseConfig: config
      });
    }
  }

  return targets;
};

const parseFirebaseSaveTargetsNewFormat = (rows: any[][]): FirebaseSaveTarget[] => {
  const headers = (rows[0] || []).map(cell => cleanExcelText(cell));

  let nameColIndex = -1;
  let configColIndex = -1;

  headers.forEach((header, index) => {
    const normalized = normalizeMetaKey(header);
    if (normalized.includes('league') && normalized.includes('name')) {
      nameColIndex = index;
    } else if (normalized.includes('leaguename') || normalized === 'name' || normalized === 'league') {
      if (nameColIndex < 0) nameColIndex = index;
    }

    if (normalized.includes('firebase') && normalized.includes('config')) {
      configColIndex = index;
    } else if (normalized.includes('firebaseconfig') || normalized === 'firebase' || normalized === 'config') {
      if (configColIndex < 0) configColIndex = index;
    }
  });

  if (nameColIndex < 0 || configColIndex < 0) return [];

  const targets: FirebaseSaveTarget[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const leagueName = cleanExcelText(row[nameColIndex]);
    const configText = cleanExcelText(row[configColIndex]);

    if (!leagueName || !configText) continue;

    const config = parseFirebaseConfigFromJSON(configText);
    if (config && FIREBASE_REQUIRED_CONFIG_KEYS.every(k => config[k])) {
      targets.push({
        id: makeSaveTargetId(config.projectId, `league-${targets.length}`),
        index: targets.length - 1,
        name: leagueName,
        firebaseConfig: config
      });
    }
  }

  return targets;
};

const parseFirebaseSaveTargetsOldFormat = (rows: any[][]): FirebaseSaveTarget[] => {
  const blocks: { config: Record<string, string>; metadata: Record<string, string>; skip: boolean }[] = [];
  let current: { config: Record<string, string>; metadata: Record<string, string>; skip: boolean } | null = null;

  const startBlock = (label = '') => ({
    config: {},
    metadata: {},
    skip: isExampleFirebaseBlock(label)
  });

  const commitBlock = () => {
    if (!current) return;
    const hasAnyConfig = FIREBASE_CONFIG_KEYS.some(key => current!.config[key]);
    if (hasAnyConfig) blocks.push(current);
    current = null;
  };

  rows.forEach(row => {
    const first = cleanExcelText(row[0]);
    const second = cleanExcelText(row[1]);

    if (!first && !second) {
      commitBlock();
      return;
    }

    if (isFirebaseBlockHeader(first)) {
      commitBlock();
      current = startBlock(first);
      return;
    }

    const pair = parseFirebaseKeyValue(row);
    if (!pair) return;

    if (!current) current = startBlock();

    const configField = getFirebaseConfigField(pair.key);
    if (configField) {
      current.config[configField] = pair.value;
      return;
    }

    const metaField = getFirebaseMetaField(pair.key);
    if (metaField && pair.value) {
      current.metadata[metaField] = pair.value;
    }
  });

  commitBlock();

  const completeBlocks = blocks.filter(block => FIREBASE_REQUIRED_CONFIG_KEYS.every(key => block.config[key]));
  const realBlocks = completeBlocks.filter(block => !block.skip);
  const usableBlocks = realBlocks.length ? realBlocks : completeBlocks;
  return usableBlocks.map((block, index) => buildFirebaseSaveTarget(block, index, usableBlocks.length));
};

const getSheetRows = (workbook: XLSX.WorkBook, sheetName: string): any[][] => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false
  });
};

export const parseFirebaseSaveTargets = (workbook: XLSX.WorkBook): FirebaseSaveTarget[] => {
  const sheetName = workbook.SheetNames.find(isFirebaseConfigSheetName);
  if (!sheetName) return [];

  const rows = getSheetRows(workbook, sheetName);
  if (!rows.length) return [];

  const firstRow = rows[0] || [];
  const firstCell = cleanExcelText(firstRow[0]);
  const secondCell = cleanExcelText(firstRow[1]);

  const isMultilineFormat = (
    firstCell.includes('League Name') &&
    !secondCell &&
    rows.length > 3 &&
    rows.some(r => cleanExcelText(r[0]).includes('const') || cleanExcelText(r[0]).includes('firebaseConfig'))
  );

  if (isMultilineFormat) {
    return parseFirebaseSaveTargetsMultilineFormat(rows);
  }

  const firstCellNormalized = normalizeMetaKey(firstCell);
  const isHeaderRow = (
    firstCellNormalized === 'leaguename' ||
    firstCellNormalized === 'name' ||
    firstCellNormalized === 'league' ||
    (firstCellNormalized.includes('league') && firstCellNormalized.includes('name'))
  );

  const secondCellHasData = secondCell.includes('const') ||
    secondCell.includes('firebase') ||
    secondCell.includes('{') ||
    secondCell.includes('apiKey');

  if (isHeaderRow && !secondCellHasData) {
    return parseFirebaseSaveTargetsNewFormat(rows);
  } else if (secondCellHasData) {
    return parseFirebaseSaveTargetsNewFormatNoHeader(rows);
  } else {
    return parseFirebaseSaveTargetsOldFormat(rows);
  }
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

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const rgbToHex = (r: number, g: number, b: number) => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

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

  const fill = cell.fill as any;

  if (fill.type === 'pattern' && fill.fgColor) {
    if (fill.fgColor.argb) {
      const argb = String(fill.fgColor.argb).toUpperCase();
      if (argb.length === 8) {
        return '#' + argb.substring(2);
      } else if (argb.length === 6) {
        return '#' + argb;
      }
    }

    if (typeof fill.fgColor.theme !== 'undefined') {
      const themeIndex = fill.fgColor.theme;
      if (themeIndex >= 0 && themeIndex < themeColors.length) {
        let color = themeColors[themeIndex];
        if (fill.fgColor.tint) {
          color = applyTint(color, fill.fgColor.tint);
        }
        return color;
      }
    }
  }

  return '';
};

export const loadTeamSheetWithColors = async (file: File): Promise<TeamColorRow[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const teamSheet = workbook.worksheets.find(sheet =>
      ['team', 'teams'].includes(normalizeColumnName(sheet.name))
    );

    if (!teamSheet) return [];

    const themeColors = [
      '#FFFFFF', '#000000', '#E7E6E6', '#44546A', '#4472C4',
      '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'
    ];

    const teamData: TeamColorRow[] = [];
    let teamColIndex = -1;
    let color1ColIndex = -1;
    let color2ColIndex = -1;

    teamSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const headerValue = cell.value ? String(cell.value) : '';
          const normalizedHeader = normalizeColumnName(headerValue);

          if (normalizedHeader.includes('team')) {
            teamColIndex = colNumber;
          } else if (normalizedHeader.includes('color_1') || normalizedHeader.includes('color1')) {
            color1ColIndex = colNumber;
          } else if (normalizedHeader.includes('color_2') || normalizedHeader.includes('color2')) {
            color2ColIndex = colNumber;
          }
        });
        return;
      }

      if (teamColIndex < 0) return;

      const teamCell = row.getCell(teamColIndex);
      const team = teamCell.value ? String(teamCell.value).trim() : '';

      if (!team) return;

      let color1 = '';
      let color2 = '';

      if (color1ColIndex > 0) {
        color1 = extractCellColor(row.getCell(color1ColIndex), themeColors);
      }
      if (color2ColIndex > 0) {
        color2 = extractCellColor(row.getCell(color2ColIndex), themeColors);
      }

      teamData.push({
        rowNumber,
        team,
        color1,
        color2
      });
    });

    return teamData;
  } catch (err) {
    console.error('Error loading team colors:', err);
    return [];
  }
};
