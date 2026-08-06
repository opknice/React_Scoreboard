import React from 'react';
import type { VarSettings } from '../types/var';
import { Settings, CheckCircle2, ArrowLeft } from 'lucide-react';

interface ReplaySettingsPanelProps {
  settings: VarSettings;
  onUpdateSettings: (settings: VarSettings) => void;
  onBack?: () => void;
}

export const ReplaySettingsPanel: React.FC<ReplaySettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  onBack,
}) => {
  const handleChange = (key: keyof VarSettings, val: any) => {
    onUpdateSettings({ ...settings, [key]: val });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl flex flex-col gap-4 select-none text-slate-100">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-sm text-white tracking-wide">OBS & VAR SYSTEM CONFIGURATION</h3>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Main</span>
          </button>
        )}
      </div>

      {/* OBS Setup Checklist & Guidance */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-2 text-emerald-400 font-bold">
          <CheckCircle2 className="w-4 h-4" />
          <span>คำแนะนำการตั้งค่า OBS Studio ให้สมบูรณ์แบบ:</span>
        </div>

        <ul className="space-y-1.5 text-slate-300 pl-6 list-disc text-[11px]">
          <li>
            <strong>Output → Replay Buffer:</strong> เปิดใช้งาน Replay Buffer และตั้งค่า <strong>Maximum Replay Time ≥ 20 วินาที</strong>
          </li>
          <li>
            <strong>Recording Format:</strong> เลือกเป็น <strong>Matroska (.mkv)</strong> เพื่อป้องกันไฟล์เสียหายถ้าไฟดับ
          </li>
          <li>
            <strong>Scene Setup:</strong> สร้าง Scene ชื่อ <code className="text-amber-400 bg-slate-900 px-1 py-0.5 rounded">Goal Replay</code> และ <code className="text-amber-400 bg-slate-900 px-1 py-0.5 rounded">VAR</code> ใน OBS
          </li>
          <li>
            <strong>Media Source:</strong> เพิ่ม Media Source ใน Scene ข้างต้น โดยตั้งชื่อว่า <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">VAR_Replay_Source</code>
          </li>
          <li>
            <strong>NDI Output:</strong> ติดตั้ง <strong>OBS NDI Plugin</strong> และเปิด Main NDI Output ใน Tools → NDI Output Settings
          </li>
        </ul>
      </div>

      {/* Editable Settings Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 font-semibold">โฟลเดอร์เก็บ Replay (Optional Path):</label>
          <input
            type="text"
            placeholder="เช่น D:\OBS_Football\replays"
            value={settings.replayFolderPath}
            onChange={(e) => handleChange('replayFolderPath', e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-slate-400 font-semibold">ชื่อ Media Source ใน OBS:</label>
          <input
            type="text"
            value={settings.mediaSourceName}
            onChange={(e) => handleChange('mediaSourceName', e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-slate-400 font-semibold">ชื่อ Scene Goal Replay:</label>
          <input
            type="text"
            value={settings.goalSceneName}
            onChange={(e) => handleChange('goalSceneName', e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-slate-400 font-semibold">ชื่อ Scene VAR Review:</label>
          <input
            type="text"
            value={settings.varSceneName}
            onChange={(e) => handleChange('varSceneName', e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-slate-400 font-semibold">ชื่อ Scene ถ่ายทอดสดหลัก (Main):</label>
          <input
            type="text"
            value={settings.mainSceneName}
            onChange={(e) => handleChange('mainSceneName', e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-slate-400 font-semibold">ตัดคลิป Goal Replay (เริ่มถอยหลังจากท้าย):</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={settings.goalTrimStart}
              onChange={(e) => handleChange('goalTrimStart', parseFloat(e.target.value) || 10)}
              className="w-20 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white outline-none focus:border-emerald-500"
            />
            <span className="text-slate-400">วิ, ความยาว:</span>
            <input
              type="number"
              value={settings.goalTrimDuration}
              onChange={(e) => handleChange('goalTrimDuration', parseFloat(e.target.value) || 10)}
              className="w-20 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white outline-none focus:border-emerald-500"
            />
            <span className="text-slate-400">วิ</span>
          </div>
        </div>
      </div>
    </div>
  );
};
