interface AppLoadingShellProps {
  message?: string;
  transparent?: boolean;
}

/**
 * Shared loading surface used by route and auth boundaries.
 *
 * The loading UI intentionally uses a CSS spinner and a system font so it
 * does not wait for Font Awesome or the application web fonts before it can
 * paint.
 */
export default function AppLoadingShell({
  message = 'กำลังโหลดหน้าจอ...',
  transparent = false,
}: AppLoadingShellProps) {
  return (
    <div
      className={`app-loading${transparent ? ' app-loading--transparent' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="app-loading__content">
        <span className="app-loading__spinner" aria-hidden="true" />
        <p className="app-loading__message">{message}</p>
      </div>
    </div>
  );
}
