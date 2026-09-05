export interface DetailsTemplateValues {
  nameA: string;
  nameB: string;
  scoreA: number;
  scoreB: number;
  thaiDate: string;
  timeCounter: string;
  halfText: string;
  label1: string;
  label2: string;
  label3: string;
  label4: string;
  label5: string;
  label6: string;
  label7: string;
  label8: string;
  label9: string;
  label10: string;
}

function cleanText(value: string): string {
  return value.replace(/<br\s*\/?\s*>/gi, ' ').replace(/&amp;/g, '&');
}

/** Returns the current Thai Buddhist-calendar date used by the detail template. */
export function getThaiDateString(date = new Date()): string {
  return date.toLocaleDateString('th-TH-u-ca-buddhist', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Replaces supported tags while preserving unknown tags as plain text. */
export function renderDetailsTemplate(
  template: string,
  values: DetailsTemplateValues,
): string {
  const replacements: Record<string, string> = {
    teama: cleanText(values.nameA),
    teamb: cleanText(values.nameB),
    score_team_a: String(values.scoreA),
    score_team_b: String(values.scoreB),
    thai_date: values.thaiDate,
    time_counter: values.timeCounter,
    half_text: values.halfText,
    label1: cleanText(values.label1),
    label2: cleanText(values.label2),
    label3: cleanText(values.label3),
    label4: cleanText(values.label4),
    label5: cleanText(values.label5),
    label6: cleanText(values.label6),
    label7: cleanText(values.label7),
    label8: cleanText(values.label8),
    label9: cleanText(values.label9),
    label10: cleanText(values.label10),
  };

  return template.replace(/<br\s*\/?\s*>/gi, ' ').replace(
    /<(TeamA|TeamB|score_team_a|score_team_b|thai_date|time_counter|half_text|label(?:1|2|3|4|5|6|7|8|9|10))>/gi,
    (tag, key: string) => replacements[key.toLowerCase()] ?? tag,
  );
}
