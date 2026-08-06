import React, { useState } from 'react';
import type { HighlightPlaylistItem } from '../types/var';
import { Play, Square, ListOrdered, Edit2, Trash2, ArrowUp, ArrowDown, Radio } from 'lucide-react';

interface HighlightPlaylistProps {
  playlist: HighlightPlaylistItem[];
  selectedId: string | null;
  onSelectId: (id: string) => void;
  isPlayingLoop: boolean;
  currentIndex: number;
  onRemoveItem: (id: string) => void;
  onRenameItem: (id: string, newTitle: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onPlayItem: (item: HighlightPlaylistItem) => void;
  onStartLoop: () => void;
  onStopLoop: () => void;
}

export const HighlightPlaylist: React.FC<HighlightPlaylistProps> = ({
  playlist,
  selectedId,
  onSelectId,
  isPlayingLoop,
  currentIndex,
  onRemoveItem,
  onRenameItem,
  onMoveUp,
  onMoveDown,
  onPlayItem,
  onStartLoop,
  onStopLoop,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: HighlightPlaylistItem; index: number } | null>(null);

  const handleStartRename = (item: HighlightPlaylistItem) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
    setContextMenu(null);
  };

  const handleSaveRename = (id: string) => {
    if (editingTitle.trim()) {
      onRenameItem(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const handleContextMenu = (e: React.MouseEvent, item: HighlightPlaylistItem, index: number) => {
    e.preventDefault();
    onSelectId(item.id);
    setContextMenu({ x: e.clientX, y: e.clientY, item, index });
  };

  return (
    <div
      className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-2xl flex flex-col h-full select-none text-slate-100 relative"
      onClick={() => setContextMenu(null)}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-amber-400" />
          <h3 className="font-bold text-sm text-white tracking-wide">HIGHLIGHT PLAYLIST (NDI)</h3>
          <span className="bg-slate-800 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-mono">
            {playlist.length} items
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isPlayingLoop ? (
            <button
              onClick={onStopLoop}
              className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1 rounded font-bold shadow flex items-center gap-1.5 animate-pulse"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>STOP LOOP</span>
            </button>
          ) : (
            <button
              onClick={onStartLoop}
              disabled={playlist.length === 0}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs px-3 py-1 rounded font-bold shadow flex items-center gap-1.5"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>▶ LOOP NDI OUTPUT</span>
            </button>
          )}
        </div>
      </div>

      {/* Playlist Loop Status Banner */}
      {isPlayingLoop && (
        <div className="bg-amber-950/50 border border-amber-500/40 text-amber-300 text-xs px-3 py-1.5 rounded-lg mb-3 flex items-center justify-between font-mono animate-pulse">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            NDI LOOP ACTIVE: Playing #{playlist[currentIndex]?.orderNumber} - {playlist[currentIndex]?.title}
          </span>
          <span className="text-[10px] text-amber-400/80">Continuous Loop</span>
        </div>
      )}

      {/* Items List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[400px] scrollbar-thin scrollbar-thumb-slate-700">
        {playlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 gap-2">
            <span className="text-3xl opacity-40">📜</span>
            <p className="text-xs">Highlight playlist is empty</p>
            <p className="text-[10px] text-slate-600">
              Save trimmed clips from VAR Window to build a halftime / post-match highlight reel
            </p>
          </div>
        ) : (
          playlist.map((item, idx) => {
            const isSelected = selectedId === item.id;
            const isCurrentlyPlayingInLoop = isPlayingLoop && currentIndex === idx;

            return (
              <div
                key={item.id}
                onClick={() => onSelectId(item.id)}
                onContextMenu={(e) => handleContextMenu(e, item, idx)}
                className={`group p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                  isCurrentlyPlayingInLoop
                    ? 'bg-amber-950/60 border-amber-400 shadow-md'
                    : isSelected
                    ? 'bg-slate-800/80 border-slate-600'
                    : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="font-mono text-xs font-bold text-amber-400 w-6 text-center">
                    #{item.orderNumber}
                  </div>

                  {item.thumbnailUrl && (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-12 h-7 object-cover rounded border border-slate-700"
                    />
                  )}

                  <div className="flex flex-col overflow-hidden">
                    {editingId === item.id ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleSaveRename(item.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(item.id)}
                        autoFocus
                        className="bg-slate-950 text-white text-xs px-2 py-0.5 rounded border border-amber-500 outline-none"
                      />
                    ) : (
                      <span className="text-xs font-bold text-slate-200 truncate group-hover:text-white">
                        {item.title}
                      </span>
                    )}

                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.duration > 0 ? `${item.duration.toFixed(1)}s` : 'Full clip'}
                      {item.matchMinute ? ` • นาทีที่ ${item.matchMinute}` : ''}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayItem(item);
                    }}
                    className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs"
                    title="Play clip on OBS"
                  >
                    <Play className="w-3 h-3 fill-current" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveUp(idx);
                    }}
                    disabled={idx === 0}
                    className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveDown(idx);
                    }}
                    disabled={idx === playlist.length - 1}
                    className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-slate-950 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 text-xs w-36 text-slate-200"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleStartRename(contextMenu.item)}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2"
          >
            <Edit2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Rename</span>
          </button>
          <button
            onClick={() => {
              onMoveUp(contextMenu.index);
              setContextMenu(null);
            }}
            disabled={contextMenu.index === 0}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 disabled:opacity-40 flex items-center gap-2"
          >
            <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
            <span>Move Up</span>
          </button>
          <button
            onClick={() => {
              onMoveDown(contextMenu.index);
              setContextMenu(null);
            }}
            disabled={contextMenu.index === playlist.length - 1}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 disabled:opacity-40 flex items-center gap-2"
          >
            <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
            <span>Move Down</span>
          </button>
          <div className="border-t border-slate-800 my-1"></div>
          <button
            onClick={() => {
              onRemoveItem(contextMenu.item.id);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-red-950 text-red-400 flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Delete [Del]</span>
          </button>
        </div>
      )}
    </div>
  );
};
