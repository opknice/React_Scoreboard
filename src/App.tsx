import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ObsVideoFolderProvider } from './context/ObsVideoFolderContext';
import './App.css';

const AuthGuard = lazy(() => import('./components/AuthGuard'));
const AdminWhitelist = lazy(() => import('./components/AdminWhitelist'));
const ScoreboardController = lazy(() => import('./components/ScoreboardController'));
const OverlayContainer = lazy(() => import('./components/OverlayContainer'));
const AllScoresStandalone = lazy(() => import('./components/AllScoresStandalone'));
const LeagueTableStandalone = lazy(() => import('./components/LeagueTableStandalone'));
const AllScoreCombinedStandalone = lazy(() => import('./components/AllScoreCombinedStandalone'));
const PenaltyShootoutController = lazy(() => import('./components/PenaltyShootoutController'));
const PenaltyDotsOverlay = lazy(() => import('./components/PenaltyDotsOverlay'));
const GoalAnimationOverlay = lazy(() => import('./components/GoalAnimationOverlay'));
const VarReplayV2Page = lazy(() => import('./components/var-replay-v2/VarReplayV2Page'));
const InstantReplayPage = lazy(() => import('./components/InstantReplayPage'));

function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

  return (
    <BrowserRouter basename={basename}>
      <ObsVideoFolderProvider>
        <Suspense fallback={<div className="app-loading">กำลังโหลดหน้าจอ...</div>}>
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

          {/* Catch-all redirect to main panel */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ObsVideoFolderProvider>
    </BrowserRouter>
  );
}

export default App;
