import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import AdminWhitelist from './components/AdminWhitelist';
import { ObsVideoFolderProvider } from './context/ObsVideoFolderContext';
import './App.css';

const ScoreboardController = lazy(() => import('./components/ScoreboardController'));
const OverlayContainer = lazy(() => import('./components/OverlayContainer'));
const AllScoresStandalone = lazy(() => import('./components/AllScoresStandalone'));
const LeagueTableStandalone = lazy(() => import('./components/LeagueTableStandalone'));
const AllScoreCombinedStandalone = lazy(() => import('./components/AllScoreCombinedStandalone'));
const PenaltyShootoutController = lazy(() => import('./components/PenaltyShootoutController'));
const PenaltyDotsOverlay = lazy(() => import('./components/PenaltyDotsOverlay'));
const VarReplayPage = lazy(() => import('./components/VarReplayPage'));
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

          {/* VAR Replay: control page and OBS Browser Source screen */}
          <Route
            path="/var-replay"
            element={
              <AuthGuard>
                <VarReplayPage mode="control" />
              </AuthGuard>
            }
          />
          <Route path="/var-replay/screen" element={<VarReplayPage mode="screen" />} />

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
