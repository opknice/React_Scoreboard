import { describe, it, expect } from 'vitest';
import { getTodayDateString, formatToDateInput } from './leagueDateUtils';

describe('leagueDateUtils', () => {
  describe('getTodayDateString', () => {
    it('returns a valid YYYY-MM-DD format string', () => {
      const today = getTodayDateString();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('formatToDateInput', () => {
    it('returns empty string for null and undefined', () => {
      expect(formatToDateInput(null)).toBe('');
      expect(formatToDateInput(undefined)).toBe('');
      expect(formatToDateInput('')).toBe('');
    });

    it('returns extracted YYYY-MM-DD from standard string', () => {
      expect(formatToDateInput('2026-09-03')).toBe('2026-09-03');
      expect(formatToDateInput('2026-09-03T10:30:00.000Z')).toBe('2026-09-03');
      expect(formatToDateInput('2026-12-25 15:00:00')).toBe('2026-12-25');
    });

    it('formats Date instances correctly', () => {
      const date = new Date(2026, 4, 15); // May 15, 2026
      const result = formatToDateInput(date);
      expect(result).toMatch(/^2026-05-15/);
    });

    it('returns empty string for invalid date values', () => {
      expect(formatToDateInput('invalid-date')).toBe('');
      expect(formatToDateInput('not a timestamp')).toBe('');
    });
  });
});
