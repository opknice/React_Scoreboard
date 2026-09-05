import type { CSSProperties, ReactNode } from 'react';

export type UiIconName =
  | 'camera'
  | 'check'
  | 'clock'
  | 'copy'
  | 'exchange'
  | 'expand'
  | 'info'
  | 'logout'
  | 'magic'
  | 'pause'
  | 'pencil'
  | 'play'
  | 'playCircle'
  | 'plusCircle'
  | 'rocket'
  | 'settings'
  | 'sliders'
  | 'spinner'
  | 'sync'
  | 'trophy'
  | 'upload'
  | 'users';

interface UiIconProps {
  name: UiIconName;
  className?: string;
  size?: number | string;
  style?: CSSProperties;
  title?: string;
}

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  strokeWidth: 1.9,
};

const iconPaths: Record<UiIconName, ReactNode> = {
  camera: (
    <>
      <path {...strokeProps} d="M5 8.5h3l1.2-2h5.6l1.2 2H19A1.5 1.5 0 0 1 20.5 10v8A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18v-8A1.5 1.5 0 0 1 5 8.5Z" />
      <circle {...strokeProps} cx="12" cy="14" r="3.2" />
    </>
  ),
  check: <path {...strokeProps} d="m5 12.5 4.2 4.2L19 7" />,
  clock: (
    <>
      <circle {...strokeProps} cx="12" cy="12" r="8.5" />
      <path {...strokeProps} d="M12 7v5l3.2 2" />
    </>
  ),
  copy: (
    <>
      <rect {...strokeProps} x="8" y="8" width="10" height="10" rx="1.5" />
      <path {...strokeProps} d="M16 8V6.5A1.5 1.5 0 0 0 14.5 5h-8A1.5 1.5 0 0 0 5 6.5v8A1.5 1.5 0 0 0 6.5 16H8" />
    </>
  ),
  exchange: <path {...strokeProps} d="M4 8h13m0 0-3-3m3 3-3 3M20 16H7m0 0 3-3m-3 3 3 3" />,
  expand: <path {...strokeProps} d="M8 4H4v4m12-4h4v4M8 20H4v-4m16 0v4h-4" />,
  info: (
    <>
      <circle {...strokeProps} cx="12" cy="12" r="8.5" />
      <path {...strokeProps} d="M12 10.5v5M12 7.5h.01" />
    </>
  ),
  logout: <path {...strokeProps} d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10m4-4 3-3-3-3m3 3H9" />,
  magic: <path {...strokeProps} d="m15 4 .5 2.5L18 7l-2.5.5L15 10l-.5-2.5L12 7l2.5-.5L15 4Zm-6 5 .7 3.3L13 13l-3.3.7L9 17l-.7-3.3L5 13l3.3-.7L9 9Zm8 5 .4 2.1L19.5 17l-2.1.4L17 19.5l-.4-2.1-2.1-.4 2.1-.4L17 14Z" />,
  pause: <path fill="currentColor" d="M7 5.5h3v13H7zM14 5.5h3v13h-3z" />,
  pencil: <path {...strokeProps} d="m4.5 16.8-.8 3.5 3.5-.8L18.5 8.2a2.1 2.1 0 0 0-3-3L4.5 16.8Zm9.8-9.8 3 3" />,
  play: <path fill="currentColor" d="m7 4.8 11 7.2-11 7.2V4.8Z" />,
  playCircle: (
    <>
      <circle {...strokeProps} cx="12" cy="12" r="8.5" />
      <path fill="currentColor" d="m10 8.5 5.5 3.5-5.5 3.5v-7Z" />
    </>
  ),
  plusCircle: (
    <>
      <circle {...strokeProps} cx="12" cy="12" r="8.5" />
      <path {...strokeProps} d="M12 8v8M8 12h8" />
    </>
  ),
  rocket: <path {...strokeProps} d="M14.8 4.2c2.1-.7 3.8-.7 4.9-.1.6 1.1.6 2.8-.1 4.9-1 2.8-3.5 5.6-6.3 7.1l-4.3-4.3c1.6-2.8 4.3-5.3 7.1-6.3ZM9 16l-3 1-1 3 3-1 1-3Zm2.2-6.1 2.9 2.9m-1.2-4.6h.01" />,
  settings: (
    <>
      <circle {...strokeProps} cx="12" cy="12" r="3" />
      <path {...strokeProps} d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.1h-2.4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6.7v-2.4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L8 8.6l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.1h2.4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1V14h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  sliders: <path {...strokeProps} d="M5 7h14M5 17h14M9 5v4M15 15v4M7 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 10a2 2 0 1 0 0 4 2 2 0 0 0-4 0 2 2 0 0 0 4 0Z" />,
  spinner: <path {...strokeProps} strokeDasharray="36 14" d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />,
  sync: <path {...strokeProps} d="M20 7v4h-4m-12 6v-4h4m-.9-5.8A7 7 0 0 1 19 11m-2.1 5.8A7 7 0 0 1 5 13" />,
  trophy: <path {...strokeProps} d="M8 4h8v3a4 4 0 0 1-8 0V4Zm4 7v5m-4 4h8m-6-4h4M8 6H5v2a3 3 0 0 0 3 3m8-5h3v2a3 3 0 0 1-3 3" />,
  upload: <path {...strokeProps} d="M12 15V4m0 0L8 8m4-4 4 4M5 14v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" />,
  users: (
    <>
      <circle {...strokeProps} cx="9" cy="9" r="3" />
      <path {...strokeProps} d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a3 3 0 0 1 0 5.8M16 14a4.5 4.5 0 0 1 4.5 5" />
    </>
  ),
};

export default function UiIcon({ name, className = '', size = '1em', style, title }: UiIconProps) {
  const classes = ['ui-icon', name === 'spinner' ? 'ui-icon--spin' : '', className].filter(Boolean).join(' ');
  const labelled = Boolean(title);

  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden={labelled ? undefined : true}
      aria-label={labelled ? title : undefined}
      role={labelled ? 'img' : undefined}
      focusable="false"
      style={style}
    >
      {title ? <title>{title}</title> : null}
      {iconPaths[name]}
    </svg>
  );
}
