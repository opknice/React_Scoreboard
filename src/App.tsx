import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ScoreboardController from './components/ScoreboardController';
import OverlayContainer from './components/OverlayContainer';
import AllScoresStandalone from './components/AllScoresStandalone';
import LeagueTableStandalone from './components/LeagueTableStandalone';
import PenaltyShootoutController from './components/PenaltyShootoutController';
import PenaltyDotsOverlay from './components/PenaltyDotsOverlay';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Scoreboard Controller (main panel) */}
        <Route path="/" element={<ScoreboardController />} />
        <Route path="/controller" element={<Navigate to="/" replace />} />

        {/* Dynamic OBS overlays (table, results, ticker, stadium) */}
        <Route path="/overlay" element={<OverlayContainer />} />

        {/* Standalone Views */}
        <Route path="/all-scores" element={<AllScoresStandalone />} />
        <Route path="/league-table" element={<LeagueTableStandalone />} />
        
        {/* Penalty Shootout */}
        <Route path="/penalty-shootout" element={<PenaltyShootoutController />} />
        <Route path="/dots" element={<PenaltyDotsOverlay />} />

        {/* Catch-all redirect to main panel */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
