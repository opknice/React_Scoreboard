import React from 'react';
import type { ClipItem } from '../types/var';
import { RefreshCw, Video, Play, FileVideo, Sparkles, Settings as SettingsIcon, Eye } from 'lucide-react';

interface ClipLibraryProps {
  clips: ClipItem[];
  loading: boolean;
  onScanClips: () => void;
  onSelectClip: (clip: ClipItem) => void;  // Single-click: preview in VarWindow (no OBS)
  onPlayClip?: (clip: ClipItem) => void;   // Play button / double-click: send to OBS
  selectedClipPath?: string;
  onOpenSettings?: () => void;
}

export const ClipLibrary: React.FC<ClipLibraryProps> = ({
  clips,
  loading,
  onScanClips,
  onSelectClip,
  onPlayClip,
  selectedClipPath,
  onOpenSettings,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-2xl flex flex-col h-full select-none text-slate-100">
      {/* Library Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-sm text-white tracking-wide">REPLAY CLIP LIBRARY</h3>
          <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-mono">
            {clips.length} clips
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onScanClips}
            disabled={loading}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Scan</span>
          </button>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Settings</span>
            </button>
          )}
        </div>
      </div>

      {/* Usage hint */}
      <p className="text-[10px] text-slate-500 mb-2 italic">
        👁 Click to preview locally &nbsp;•&nbsp; <span className="text-emerald-400 not-italic">▶ Play</span> to send to OBS
      </p>

      {/* Clip List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[700px] scrollbar-thin scrollbar-thumb-slate-700">
        {clips.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 gap-2">
            <FileVideo className="w-8 h-8 opacity-40" />
            <p className="text-xs">No replay clips detected in folder</p>
            <p className="text-[10px] text-slate-600">
              Trigger OBS Replay Buffer or click Scan to search replays folder (.mkv/.mp4)
            </p>
          </div>
        ) : (
          clips.map((clip) => {
            const isSelected = selectedClipPath === clip.path;
            const isMkv = clip.name.endsWith('.mkv');

            return (
              <div
                key={clip.id}
                onDoubleClick={() => onPlayClip ? onPlayClip(clip) : onSelectClip(clip)}
                onClick={() => onSelectClip(clip)}
                className={`group p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500/70 shadow-lg shadow-emerald-950/30'
                    : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`w-9 h-9 rounded flex items-center justify-center font-bold text-xs ${
                    isMkv ? 'bg-amber-950/60 text-amber-400 border border-amber-500/30' : 'bg-blue-950/60 text-blue-400 border border-blue-500/30'
                  }`}>
                    {isMkv ? 'MKV' : 'MP4'}
                  </div>

                  <div className="flex flex-col overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-200 truncate group-hover:text-white">
                        {clip.name}
                      </span>
                      {clip.isNew && (
                        <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded uppercase animate-pulse flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" /> NEW
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {clip.formattedDate} • {(clip.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {/* Preview button (eye icon) — loads clip into VarWindow only, does NOT touch OBS */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClip(clip);
                    }}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs flex items-center gap-1"
                    title="Preview clip in VAR Window (no OBS)"
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                  {/* Play button (green) — sends clip to OBS Media Source and plays */}
                  {onPlayClip && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayClip(clip);
                      }}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs flex items-center gap-1"
                      title="Send to OBS Media Source & Play"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
