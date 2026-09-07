import { memo, type CSSProperties } from 'react';
import {
  TEAM_COLOR_CANVAS_HEIGHT,
  TEAM_COLOR_CANVAS_WIDTH,
  type TeamColorBrowserSettings,
  type TeamColorReference,
  type TeamColorSlot,
} from '../types/teamColorBrowserSettings';
import './TeamColorPreview.css';

export interface TeamColorValues {
  primary: string;
  secondary: string;
}

interface TeamColorPreviewProps {
  settings: TeamColorBrowserSettings;
  colors: { A: TeamColorValues; B: TeamColorValues };
  side?: 'A' | 'B' | 'both';
  showLabels?: boolean;
  className?: string;
}

const DEFAULT_COLOR = '#ffffff';

function safeHex(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_COLOR;
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = safeHex(hex).slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function resolveColor(reference: TeamColorReference, values: TeamColorValues, custom: string): string {
  if (reference === 'secondary') return safeHex(values.secondary);
  if (reference === 'custom') return safeHex(custom);
  return safeHex(values.primary);
}

function getBorderRadius(settings: TeamColorBrowserSettings): string {
  const { appearance } = settings;
  if (appearance.preset === 'circle') return '50%';
  if (appearance.preset === 'square') return '0';
  const radiusPercent = Math.min(
    50,
    (appearance.borderRadius / Math.max(1, Math.min(appearance.width, appearance.height))) * 100,
  );
  return `${radiusPercent}%`;
}

function getShapeStyle(
  settings: TeamColorBrowserSettings,
  slot: TeamColorSlot,
  values: TeamColorValues,
): CSSProperties {
  const { appearance } = settings;
  const position = settings.positions[slot];
  // Each team source always renders its two team colors in a stable order.
  const fill = slot.endsWith('1') ? safeHex(values.primary) : safeHex(values.secondary);
  const border = resolveColor(appearance.borderColorSource, values, appearance.customBorderColor);
  const style: CSSProperties = {
    position: 'absolute',
    left: `${(position.x / TEAM_COLOR_CANVAS_WIDTH) * 100}%`,
    top: `${(position.y / TEAM_COLOR_CANVAS_HEIGHT) * 100}%`,
    width: `${(appearance.width / TEAM_COLOR_CANVAS_WIDTH) * 100}%`,
    height: `${(appearance.height / TEAM_COLOR_CANVAS_HEIGHT) * 100}%`,
    boxSizing: 'border-box',
    borderRadius: getBorderRadius(settings),
    backgroundColor: withAlpha(fill, appearance.fillOpacity),
    border: appearance.borderEnabled
      ? `${appearance.borderWidth}px solid ${withAlpha(border, appearance.borderOpacity)}`
      : 'none',
  };

  if (appearance.shadowEnabled && appearance.shadowOpacity > 0) {
    style.boxShadow = `${appearance.shadowOffsetX}px ${appearance.shadowOffsetY}px ${appearance.shadowBlur}px ${appearance.shadowSpread}px ${withAlpha(appearance.shadowColor, appearance.shadowOpacity)}`;
  }

  return style;
}

function TeamColorPreview({
  settings,
  colors,
  side = 'both',
  showLabels = false,
  className = '',
}: TeamColorPreviewProps) {
  const slots: TeamColorSlot[] = side === 'both'
    ? ['A1', 'A2', 'B1', 'B2']
    : side === 'A' ? ['A1', 'A2'] : ['B1', 'B2'];

  return (
    <div
      className={`team-color-preview ${className}`.trim()}
      role="img"
      aria-label="Team color browser source preview"
    >
      {slots.map((slot) => {
        const displaySide = slot.startsWith('A') ? 'A' : 'B';
        const colorLabel = slot.endsWith('1') ? 'Primary' : 'Secondary';
        return (
        <div
          key={slot}
          className="team-color-preview__shape"
          style={getShapeStyle(settings, slot, colors[displaySide])}
        >
          {showLabels ? `Team ${displaySide} · ${colorLabel}` : null}
        </div>
        );
      })}
    </div>
  );
}

export default memo(TeamColorPreview);
