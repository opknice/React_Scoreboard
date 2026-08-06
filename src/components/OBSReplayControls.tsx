import React, { useState } from 'react';
import type { VarState, VarDecision, VarSpeed } from '../types/var';
import { RotateCcw, Video, FastForward, CheckCircle, XCircle, AlertTriangle, ShieldAlert, Sparkles, MonitorUp } from 'lucide-react';

interface OBSReplayControlsProps {
  varState?: VarState;
  isConnected?: boolean;
  onTriggerGoal?: () => void;
  onTriggerVar?: () => void;
  onSetOBSSpeed?: (speed: VarSpeed) => void;
  onAnnounceDecision?: (decision: VarDecision, customText?: string) => void;
  onClearVar: () => void;
}

export const OBSReplayControls: React.FC<OBSReplayControlsProps> = ({
  varState,
  isConnected = true,
  onTriggerGoal,
  onTriggerVar,
  onSetOBSSpeed,
  onAnnounceDecision,
  onClearVar,
}) => {
  const [customText, setCustomText] = useState<string>('');
  const currentSpeed = varState?.videoControls?.obsSpeed || 1.0;
  const currentStatus = varState?.status || 'IDLE';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl flex flex-col gap-4 select-none text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <MonitorUp className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-white">OBS BROADCAST & VAR CONTROLS</h3>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className={`px-2 py-0.5 rounded font-mono font-bold uppercase ${
            currentStatus === 'IDLE'
              ? 'bg-slate-800 text-slate-400'
              : currentStatus === 'PLAYING'
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30 animate-pulse'
              : 'bg-amber-950 text-amber-400 border border-amber-500/30'
          }`}>
            STATUS: {currentStatus}
          </span>
        </div>
      </div>

      {/* Row 1: Replay Trigger Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={onTriggerGoal}
          disabled={!onTriggerGoal || !isConnected}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs py-2.5 px-3 rounded-lg border border-emerald-400/40 shadow flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-emerald-200" />
          <span>⚽ TRIGGER GOAL REPLAY (10s Trim)</span>
        </button>

        <button
          onClick={onTriggerVar}
          disabled={!onTriggerVar || !isConnected}
          className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs py-2.5 px-3 rounded-lg border border-indigo-400/40 shadow flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
        >
          <Video className="w-4 h-4 text-indigo-200" />
          <span>🖥️ TRIGGER VAR REVIEW (Full Clip)</span>
        </button>
      </div>

      {/* Row 2: OBS Replay Speed Selectors */}
      <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
          <span className="flex items-center gap-1.5">
            <FastForward className="w-3.5 h-3.5 text-amber-400" />
            <span>OBS BROADCAST SPEED (OBS Media Source):</span>
          </span>
          <span className="font-mono text-amber-400 font-bold">{currentSpeed}x</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([0.25, 0.5, 1.0] as VarSpeed[]).map((speed) => (
            <button
              key={speed}
              onClick={() => onSetOBSSpeed && onSetOBSSpeed(speed)}
              disabled={!onSetOBSSpeed}
              className={`py-1.5 text-xs font-mono font-bold rounded-lg border transition-all ${
                Math.abs(currentSpeed - speed) < 0.01
                  ? 'bg-amber-600 text-white border-amber-400 shadow'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {speed}x {speed === 0.25 ? 'Slow-Mo' : speed === 0.5 ? 'Half-Speed' : 'Normal'}
            </button>
          ))}
        </div>
      </div>

      {/* Row 3: VAR Decision Overlay Triggers */}
      <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-2">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          VAR DECISION OVERLAY BROADCAST:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <button
            onClick={() => onAnnounceDecision && onAnnounceDecision('GOAL')}
            className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs py-2 px-2 rounded-lg border border-emerald-500/40 flex items-center justify-center gap-1 transition-transform active:scale-95"
          >
            <CheckCircle className="w-3.5 h-3.5" /> GOAL
          </button>

          <button
            onClick={() => onAnnounceDecision && onAnnounceDecision('NO_GOAL')}
            className="bg-red-700 hover:bg-red-600 text-white font-bold text-xs py-2 px-2 rounded-lg border border-red-500/40 flex items-center justify-center gap-1 transition-transform active:scale-95"
          >
            <XCircle className="w-3.5 h-3.5" /> NO GOAL
          </button>

          <button
            onClick={() => onAnnounceDecision && onAnnounceDecision('PENALTY')}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs py-2 px-2 rounded-lg border border-amber-400/40 flex items-center justify-center gap-1 transition-transform active:scale-95"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> PENALTY
          </button>

          <button
            onClick={() => onAnnounceDecision && onAnnounceDecision('RED_CARD')}
            className="bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs py-2 px-2 rounded-lg border border-rose-500/40 flex items-center justify-center gap-1 transition-transform active:scale-95"
          >
            <ShieldAlert className="w-3.5 h-3.5" /> RED CARD
          </button>

          <button
            onClick={() => onAnnounceDecision && onAnnounceDecision('CONFIRMED')}
            className="bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs py-2 px-2 rounded-lg border border-teal-500/40 flex items-center justify-center gap-1 transition-transform active:scale-95"
          >
            ✓ CONFIRMED
          </button>

          <button
            onClick={() => onAnnounceDecision && onAnnounceDecision('OVERTURNED')}
            className="bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs py-2 px-2 rounded-lg border border-indigo-500/40 flex items-center justify-center gap-1 transition-transform active:scale-95"
          >
            🚫 OVERTURNED
          </button>

          <div className="col-span-2 flex items-center gap-1">
            <input
              type="text"
              placeholder="Custom decision..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-purple-500"
            />
            <button
              onClick={() => customText && onAnnounceDecision && onAnnounceDecision('CUSTOM', customText)}
              className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs px-2.5 py-1 rounded-lg border border-purple-500/40"
            >
              SEND
            </button>
          </div>
        </div>
      </div>

      {/* Row 4: Clear VAR & Return to Main Stream */}
      <button
        onClick={onClearVar}
        className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2.5 px-4 rounded-xl border border-slate-700 shadow flex items-center justify-center gap-2 uppercase tracking-wider transition-colors"
      >
        <RotateCcw className="w-4 h-4 text-emerald-400" />
        <span>🔄 CLEAR VAR — กลับสู่ MAIN STREAM</span>
      </button>
    </div>
  );
};

export default OBSReplayControls;
