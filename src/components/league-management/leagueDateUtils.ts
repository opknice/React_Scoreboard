/**
 * Helper utility functions for formatting and managing league/match dates.
 */

/**
 * Returns today's date in YYYY-MM-DD format based on local time.
 */
export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Safely formats dates into YYYY-MM-DD for HTML5 date input without timezone shift.
 */
export const formatToDateInput = (val?: string | Date | number | null): string => {
  if (val === null || val === undefined) return '';

  // Handle Date instance directly using local time to prevent timezone shift
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const str = typeof val === 'string' ? val.trim() : String(val).trim();
  if (!str) return '';

  // Direct YYYY-MM-DD match
  const matched = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (matched) return matched[1];

  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
};
