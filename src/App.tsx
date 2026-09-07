import { lazy, Suspense, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ObsVideoFolderProvider } from './context/ObsVideoFolderContext';
import './App.css';
import AppLoadingShell from './components/AppLoadingShell';

let authGuardModulePromise: Promise<typeof import('./components/AuthGuard')> | undefined;
let scoreboardControllerModulePromise: Promise<typeof import('./components/ScoreboardController')> | undefined;

function loadAuthGuard() {
  return (authGuardModulePromise ??= import('./components/AuthGuard'));
}

function loadScoreboardController() {
  return (scoreboardControllerModulePromise ??= import('./components/ScoreboardController'));
}

const AuthGuard = lazy(loadAuthGuard);
const AdminWhitelist = lazy(() => import('./components/AdminWhitelist'));
const ScoreboardController = lazy(loadScoreboardController);
const OverlayContainer = lazy(() => import('./components/OverlayContainer'));
const AllScoresStandalone = lazy(() => import('./components/AllScoresStandalone'));
const LeagueTableStandalone = lazy(() => import('./components/LeagueTableStandalone'));
const AllScoreCombinedStandalone = lazy(() => import('./components/AllScoreCombinedStandalone'));
const PenaltyShootoutController = lazy(() => import('./components/PenaltyShootoutController'));
const PenaltyDotsOverlay = lazy(() => import('./components/PenaltyDotsOverlay'));
const GoalAnimationOverlay = lazy(() => import('./components/GoalAnimationOverlay'));
const TeamColorBrowserSource = lazy(() => import('./components/TeamColorBrowserSource'));
const VarReplayV2Page = lazy(() => import('./components/var-replay-v2/VarReplayV2Page'));
const InstantReplayPage = lazy(() => import('./components/InstantReplayPage'));
const TailwindTestPage = lazy(() => import('./pages/TailwindTestPage'));

function isTransparentSurfacePath(pathname: string): boolean {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  return /\/(?:overlay|all-scores|league-table|all-score-combined|dots|goal-animation|team-color|var-replay(?:-v2)?\/screen|replay\/screen)$/.test(normalizedPath);
}

function getAppRoutePath(pathname: string): string {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const basePath = import.meta.env.BASE_URL.replace(/\/+$/, '');

  if (
    basePath
    && basePath !== '/'
    && (normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`))
  ) {
    return normalizedPath.slice(basePath.length) || '/';
  }

  return normalizedPath;
}

function preloadControllerRoute(): void {
  if (typeof window === 'undefined' || isTransparentSurfacePath(window.location.pathname)) return;

  const appRoutePath = getAppRoutePath(window.location.pathname);
  const isControllerRoute = appRoutePath === '/' || appRoutePath === '/controller';

  if (isControllerRoute) {
    // Start both requests from the same turn. The lazy components reuse the
    // cached promises below, so rendering does not create another waterfall.
    void loadAuthGuard();
    void loadScoreboardController();
  }
}

// The controller is the primary authenticated route. Begin fetching its
// modules as soon as the app entry executes, while public overlay routes keep
// their smaller route-specific bundles.
preloadControllerRoute();

function AppRoutes() {
  const location = useLocation();
  const transparentSurface = isTransparentSurfacePath(location.pathname);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.surface = transparentSurface ? 'transparent' : 'dark';
  }, [transparentSurface]);

  return (
    <>
      <ObsVideoFolderProvider>
        <Suspense fallback={<AppLoadingShell transparent={transparentSurface} />}>
          <Routes>
          {/* Scoreboard Controller (main panel protected by Google Auth + Whitelist) */}
          <Route
            path="/"
            element={
              <AuthGuard>
                <ScoreboardController />
              </AuthGuard>
            }
          />
          <Route path="/controller" element={<Navigate to="/" replace />} />

          {/* Admin Whitelist Management (Super Admin only: thanakrit_kas@hotmail.com) */}
          <Route path="/admin/whitelist" element={<AdminWhitelist />} />
          <Route path="/whitelist" element={<AdminWhitelist />} />

          {/* Dynamic OBS overlays (accessed by OBS Browser Source) */}
          <Route path="/overlay" element={<OverlayContainer />} />

          {/* Standalone Views */}
          <Route path="/all-scores" element={<AllScoresStandalone />} />
          <Route path="/league-table" element={<LeagueTableStandalone />} />
          <Route path="/all-score-combined" element={<AllScoreCombinedStandalone />} />

          {/* Penalty Shootout */}
          <Route
            path="/penalty-shootout"
            element={
              <AuthGuard>
                <PenaltyShootoutController />
              </AuthGuard>
            }
          />
          <Route path="/dots" element={<PenaltyDotsOverlay />} />
          <Route path="/goal-animation" element={<GoalAnimationOverlay />} />
          <Route path="/team-color" element={<TeamColorBrowserSource />} />

          {/* Legacy VAR URLs are kept as compatibility aliases for VAR Controller V2. */}
          <Route
            path="/var-replay"
            element={
              <AuthGuard>
                <VarReplayV2Page mode="control" />
              </AuthGuard>
            }
          />
          <Route path="/var-replay/screen" element={<VarReplayV2Page mode="screen" />} />

          {/* VAR Controller V2: control panel and OBS Browser Source screen */}
          <Route
            path="/var-replay-v2"
            element={
              <AuthGuard>
                <VarReplayV2Page mode="control" />
              </AuthGuard>
            }
          />
          <Route path="/var-replay-v2/screen" element={<VarReplayV2Page mode="screen" />} />

          {/* Instant Replay: control panel and OBS Browser Source screen */}
          <Route
            path="/replay"
            element={
              <AuthGuard>
                <InstantReplayPage mode="control" />
              </AuthGuard>
            }
          />
          <Route path="/replay/screen" element={<InstantReplayPage mode="screen" />} />

          {/* Tailwind CSS Test Page */}
          <Route path="/test-tailwind" element={<TailwindTestPage />} />

          {/* Catch-all redirect to main panel */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ObsVideoFolderProvider>
    </>
  );
}

function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

  return (
    <BrowserRouter basename={basename}>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
