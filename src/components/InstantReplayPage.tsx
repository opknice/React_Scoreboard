import React, { useState } from 'react';
import { useOBSWebSocket } from '../hooks/useOBSWebSocket';
import { useVarSystem } from '../hooks/useVarSystem';
import { useClipScanner } from '../hooks/useClipScanner';
import { VarWindow } from './VarWindow';
import { ClipLibrary } from './ClipLibrary';
import { OBSReplayControls } from './OBSReplayControls';
import { ReplaySettingsPanel } from './ReplaySettingsPanel';

export const InstantReplayPage: React.FC = () => {
  const obs = useOBSWebSocket();
  const {
    varState,
    settings,
    setSettings,
    triggerVar,
    previewClip,
    announceDecision,
    clearVar,
    setOBSSpeed,
    updateVideoControls,
  } = useVarSystem(obs);

  const { clips, loading: scanningLoading, scanClips } = useClipScanner(obs, settings.replayFolderPath);

  const [activeTab, setActiveTab] = useState<'main' | 'settings'>('main');

  // Auto-connect to OBS WebSocket on page mount
  React.useEffect(() => {
    obs.connect('ws://localhost:4455').catch((err) => {
      console.warn('[InstantReplayPage] OBS auto-connect notice:', err);
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-3 sm:p-5 flex flex-col gap-4">
      {/* Main Workspace */}
      {activeTab === 'main' ? (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Replay Clip Library (4 cols on lg) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <ClipLibrary
              clips={clips}
              loading={scanningLoading}
              onScanClips={scanClips}
              onSelectClip={(clip) => previewClip(clip.path)}
              onPlayClip={(clip) => triggerVar('var', clip.path)}
              selectedClipPath={varState.clipPath}
              onOpenSettings={() => setActiveTab('settings')}
            />
          </div>

          {/* Right Column: VAR Window & OBS Broadcast Controls (8 cols on lg) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {/* Professional VAR Review Window */}
            <VarWindow
              varState={varState}
              onUpdateControls={updateVideoControls}
            />

            {/* OBS Replay Broadcast & VAR Decision Controls */}
            <OBSReplayControls
              varState={varState}
              isConnected={obs.isConnected}
              onTriggerGoal={() => triggerVar('goal')}
              onTriggerVar={() => triggerVar('var')}
              onSetOBSSpeed={setOBSSpeed}
              onAnnounceDecision={announceDecision}
              onClearVar={clearVar}
            />
          </div>
        </div>
      ) : (
        <ReplaySettingsPanel 
          settings={settings} 
          onUpdateSettings={setSettings}
          onBack={() => setActiveTab('main')}
        />
      )}
    </div>
  );
};

export default InstantReplayPage;
