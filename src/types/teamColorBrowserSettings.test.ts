import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEAM_COLOR_BROWSER_SETTINGS,
  mergeTeamColorBrowserSettings,
  normalizeTeamColorBrowserSettings,
} from './teamColorBrowserSettings';

describe('teamColorBrowserSettings', () => {
  it('returns a complete default contract for missing settings', () => {
    expect(normalizeTeamColorBrowserSettings(null)).toEqual(DEFAULT_TEAM_COLOR_BROWSER_SETTINGS);
  });

  it('normalizes invalid colors, dimensions, opacity and positions safely', () => {
    const normalized = normalizeTeamColorBrowserSettings({
      appearance: {
        preset: 'unknown',
        width: 9999,
        height: 0,
        borderRadius: 9999,
        customFillColor: 'red',
        fillOpacity: 2,
        borderWidth: -5,
        shadowOpacity: -1,
        shadowOffsetX: -9999,
      },
      positions: {
        A1: { x: 9999, y: -10 },
      },
    });

    expect(normalized.appearance.preset).toBe('square');
    expect(normalized.appearance.width).toBe(1920);
    expect(normalized.appearance.height).toBe(1);
    expect(normalized.appearance.borderRadius).toBe(0);
    expect(normalized.appearance.customFillColor).toBe('#ffffff');
    expect(normalized.appearance.fillOpacity).toBe(1);
    expect(normalized.appearance.borderWidth).toBe(0);
    expect(normalized.appearance.shadowOpacity).toBe(0);
    expect(normalized.appearance.shadowOffsetX).toBe(-1000);
    expect(normalized.positions.A1).toEqual({ x: 0, y: 0 });
  });

  it('clamps positions to the canvas after resizing', () => {
    const normalized = normalizeTeamColorBrowserSettings({
      appearance: { width: 500, height: 300 },
      positions: {
        A1: { x: 9999, y: 9999 },
        A2: { x: 9999, y: 9999 },
        B1: { x: -50, y: -50 },
        B2: { x: -50, y: -50 },
      },
    });

    expect(normalized.positions.A1).toEqual({ x: 1420, y: 780 });
    expect(normalized.positions.B1).toEqual({ x: 0, y: 0 });
  });

  it('migrates legacy A/B positions to the first color slot', () => {
    const normalized = normalizeTeamColorBrowserSettings({
      positions: { A: { x: 321, y: 45 }, B: { x: 1500, y: 60 } },
    });

    expect(normalized.positions.A1).toEqual({ x: 321, y: 45 });
    expect(normalized.positions.B1).toEqual({ x: 1500, y: 60 });
    expect(normalized.positions.A2).toEqual(DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.positions.A2);
    expect(normalized.positions.B2).toEqual(DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.positions.B2);
  });

  it('preserves legacy A/B overrides when deep-merging league settings', () => {
    const merged = mergeTeamColorBrowserSettings(DEFAULT_TEAM_COLOR_BROWSER_SETTINGS, {
      positions: { A: { x: 321 }, B: { y: 60 } },
    });

    expect(merged.positions.A1.x).toBe(321);
    expect(merged.positions.B1.y).toBe(60);
  });

  it('preserves supported partial values while filling missing fields', () => {
    const normalized = normalizeTeamColorBrowserSettings({
      version: 99,
      appearance: {
        preset: 'circle',
        fillColorSource: 'secondary',
        borderEnabled: false,
      },
    });

    expect(normalized.version).toBe(2);
    expect(normalized.appearance.preset).toBe('circle');
    expect(normalized.appearance.fillColorSource).toBe('secondary');
    expect(normalized.appearance.borderEnabled).toBe(false);
    expect(normalized.appearance.width).toBe(DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.width);
    expect(normalized.positions).toEqual(DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.positions);
  });
});
