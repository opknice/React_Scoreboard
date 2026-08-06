import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ScoreboardController from './components/ScoreboardController';
import OverlayContainer from './components/OverlayContainer';
import AllScoresStandalone from './components/AllScoresStandalone';
import LeagueTableStandalone from './components/LeagueTableStandalone';
import AllScoreCombinedStandalone from './components/AllScoreCombinedStandalone';
import PenaltyShootoutController from './components/PenaltyShootoutController';
import PenaltyDotsOverlay from './components/PenaltyDotsOverlay';
import InstantReplayPage from './components/InstantReplayPage';
import VarPreviewPage from './components/VarPreviewPage';
import AuthGuard from './components/AuthGuard';
import AdminWhitelist from './components/AdminWhitelist';
import './App.css';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
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

        {/* Admin Whitelist Management */}
        <Route path="/admin/whitelist" element={<AdminWhitelist />} />
        <Route path="/whitelist" element={<AdminWhitelist />} />

        {/* Dynamic OBS overlays */}
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

        {/* PlayInstant Instant Replay & VAR System */}
        <Route path="/instant-replay" element={<InstantReplayPage />} />
        <Route path="/var-controller" element={<InstantReplayPage />} />
        <Route path="/var-preview" element={<VarPreviewPage />} />

        {/* Catch-all redirect to main panel */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
