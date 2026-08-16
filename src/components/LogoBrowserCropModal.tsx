import { useState, useEffect } from 'react';
import type { Database } from 'firebase/database';
import {
  getCropMetadataFromLocalStorage,
  saveCropMetadataToLocalStorage,
  saveCropMetadataToFirebase,
  removeCropMetadata,
  type CropMetadata,
} from '../utils/logoCropMetadata';
import { SCOREBOARD_EVENT_CHANNEL, SCOREBOARD_STATE_STORAGE_KEY } from '../types/scoreboardEvent';
import { getLogoSrc, normalizeTeamKey } from '../utils/logoResolver';
import LogoWithCrop from './LogoWithCrop';

interface LogoBrowserCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamSide: 'A' | 'B';
  teamName: string;
  logoUrl: string;
  db?: Database | null;
  onToast?: (message: string, type?: string) => void;
}

export default function LogoBrowserCropModal({
  isOpen,
  onClose,
  teamSide,
  teamName,
  logoUrl,
  db,
  onToast,
}: LogoBrowserCropModalProps) {
  const teamKey = normalizeTeamKey(teamName || `Team ${teamSide}`);
  const [activeUrl, setActiveUrl] = useState<string>(() => logoUrl || getLogoSrc('', teamName));
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [baseWidth, setBaseWidth] = useState<number>(200);
  const [baseHeight, setBaseHeight] = useState<number>(200);
  const [customSize, setCustomSize] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load existing crop metadata & URL on modal open
  useEffect(() => {
    if (!isOpen) return;

    setActiveUrl(logoUrl || getLogoSrc('', teamName));

    const existingData = getCropMetadataFromLocalStorage(teamKey);
    if (existingData?.crop) {
      const c = existingData.crop;
      setZoom(c.zoom || 1);
      setRotation(c.rotation || 0);
      setOffsetX(c.x || 0);
      setOffsetY(c.y || 0);
      setBaseWidth(c.width || 200);
      setBaseHeight(c.height || 200);
      setCustomSize(c.customSize || 0);
      if (existingData.originalUrl) {
        setActiveUrl(existingData.originalUrl);
      }
    } else {
      setZoom(0.2);
      setRotation(0);
      setOffsetX(0);
      setOffsetY(0);
      setBaseWidth(200);
      setBaseHeight(200);
      setCustomSize(0);
    }
  }, [isOpen, teamKey, logoUrl, teamName]);

  if (!isOpen) return null;

  const currentCrop: CropMetadata = {
    x: offsetX,
    y: offsetY,
    width: baseWidth,
    height: baseHeight,
    zoom,
    rotation,
    aspectRatio: baseWidth > 0 && baseHeight > 0 ? baseWidth / baseHeight : 1,
    createdAt: new Date().toISOString(),
    ...(customSize > 0 ? { customSize } : {}),
  };

  const handleSave = async () => {
    const targetUrl = activeUrl || logoUrl || getLogoSrc('', teamName);
    if (!targetUrl) {
      onToast?.('❌ ไม่พบ URL รูปภาพโลโก้ทีม', 'error');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Save to LocalStorage
      saveCropMetadataToLocalStorage(teamKey, targetUrl, currentCrop);

      // 2. Save team logo mapping in teamLogos localStorage
      try {
        const existingLogos = JSON.parse(localStorage.getItem('teamLogos') || '{}');
        existingLogos[teamKey] = targetUrl;
        localStorage.setItem('teamLogos', JSON.stringify(existingLogos));
      } catch { }

      // 3. Update active ScoreboardState in localStorage & broadcast to overlays
      try {
        const currentStateRaw = localStorage.getItem(SCOREBOARD_STATE_STORAGE_KEY);
        if (currentStateRaw) {
          const currentState = JSON.parse(currentStateRaw);
          if (teamSide === 'A') currentState.logoA = targetUrl;
          if (teamSide === 'B') currentState.logoB = targetUrl;
          localStorage.setItem(SCOREBOARD_STATE_STORAGE_KEY, JSON.stringify(currentState));

          const bcState = new BroadcastChannel(SCOREBOARD_EVENT_CHANNEL);
          bcState.postMessage({
            type: 'ScoreboardState',
            eventId: `logo_crop_update_${Date.now()}`,
            ...currentState,
            timestamp: Date.now(),
          });
          bcState.close();
        }
      } catch { }

      // 4. Save to Firebase if database is connected
      if (db) {
        try {
          await saveCropMetadataToFirebase(db, teamKey, targetUrl, currentCrop);
        } catch (err) {
          console.warn('[LogoBrowserCropModal] Firebase save warning:', err);
        }
      }

      // 5. Dispatch global event to update previews in real-time
      window.dispatchEvent(new Event('logoCropUpdated'));
      try {
        const bc = new BroadcastChannel(SCOREBOARD_EVENT_CHANNEL);
        bc.postMessage({
          type: 'LogoCropUpdated',
          teamKey,
          timestamp: Date.now(),
        });
        bc.close();
      } catch { }

      onToast?.(`✅ บันทึก Crop โลโก้ ${teamName} เรียบร้อยแล้ว`, 'success');
      onClose();
    } catch (err: any) {
      console.error('[LogoBrowserCropModal] Save error:', err);
      onToast?.(`❌ บันทึกไม่สำเร็จ: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await removeCropMetadata(db || null, teamKey);
      setZoom(1);
      setRotation(0);
      setOffsetX(0);
      setOffsetY(0);
      setCustomSize(0);

      window.dispatchEvent(new Event('logoCropUpdated'));
      try {
        const bc = new BroadcastChannel(SCOREBOARD_EVENT_CHANNEL);
        bc.postMessage({
          type: 'LogoCropUpdated',
          teamKey,
          timestamp: Date.now(),
        });
        bc.close();
      } catch { }
      onToast?.(`🔄 รีเซ็ต Crop โลโก้ ${teamName} เป็นค่าเริ่มต้นแล้ว`, 'info');
      onClose();
    } catch (err: any) {
      console.error('[LogoBrowserCropModal] Reset error:', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          width: '90vw',
          backgroundColor: '#161922',
          borderRadius: '12px',
          border: '1px solid #334155',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          padding: '20px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: teamSide === 'A' ? '#38bdf8' : '#f43f5e' }}>✂️</span>
            ปรับแต่ง Crop โลโก้ Team {teamSide}: {teamName}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Image Source Input / File Picker */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="วาง URL โลโก้ (https://...)"
            value={activeUrl}
            onChange={(e) => setActiveUrl(e.target.value)}
            style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}
          />
          <input
            type="file"
            accept="image/*"
            id="modal-logo-file-input"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  if (event.target?.result) {
                    setActiveUrl(event.target.result as string);
                  }
                };
                reader.readAsDataURL(file);
              }
            }}
          />
          <label
            htmlFor="modal-logo-file-input"
            className="btn-secondary"
            style={{ padding: '6px 10px', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            📁 เลือกรูปจากเครื่อง
          </label>
        </div>

        {/* Live Crop Canvas Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
          <div
            style={{
              width: '180px',
              height: '180px',
              backgroundColor: '#0f172a',
              backgroundImage: 'linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
              borderRadius: '10px',
              border: '2px solid #38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            {activeUrl ? (
              <LogoWithCrop url={activeUrl} crop={currentCrop} alt={teamName} />
            ) : (
              <span style={{ color: '#64748b', fontSize: '13px' }}>ไม่พบโลโก้</span>
            )}
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
            พรีวิวผลลัพธ์ที่จะแสดงใน Logo Browser Source
          </span>
        </div>

        {/* Sliders & Controls */}
        <div style={{ display: 'grid', gap: '14px', backgroundColor: '#0f172a', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
          {/* Zoom Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
              <span>🔍 ซูม (Scale / Zoom):</span>
              <strong style={{ color: '#38bdf8' }}>{zoom.toFixed(2)}x</strong>
            </div>
            <input
              type="range"
              min="0.05"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#38bdf8' }}
            />
          </div>

          {/* Rotation Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
              <span>🔄 หมุนภาพ (Rotation):</span>
              <strong style={{ color: '#38bdf8' }}>{rotation}°</strong>
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              step="5"
              value={rotation}
              onChange={(e) => setRotation(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: '#38bdf8' }}
            />
          </div>

          {/* Offset X & Y */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                <span>↔️ ขยับแกน X:</span>
                <strong style={{ color: '#38bdf8' }}>{offsetX}px</strong>
              </div>
              <input
                type="range"
                min="-150"
                max="150"
                step="2"
                value={offsetX}
                onChange={(e) => setOffsetX(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#38bdf8' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                <span>↕️ ขยับแกน Y:</span>
                <strong style={{ color: '#38bdf8' }}>{offsetY}px</strong>
              </div>
              <input
                type="range"
                min="-150"
                max="150"
                step="2"
                value={offsetY}
                onChange={(e) => setOffsetY(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#38bdf8' }}
              />
            </div>
          </div>

          {/* Custom Logo Size for this team */}
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: '12px', marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#cbd5e1', marginBottom: '6px' }}>
              <span>📐 ขนาดเฉพาะของทีมนี้ (px):</span>
              <strong style={{ color: customSize > 0 ? '#38bdf8' : '#94a3b8' }}>
                {customSize > 0 ? `${customSize}px` : 'ใช้ขนาดส่วนกลาง (Default)'}
              </strong>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="range"
                min="0"
                max="300"
                step="5"
                value={customSize}
                onChange={(e) => setCustomSize(parseInt(e.target.value, 10))}
                style={{ flex: 1, accentColor: '#38bdf8' }}
              />
              <input
                type="number"
                min="0"
                max="300"
                value={customSize || ''}
                placeholder="Default"
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setCustomSize(isNaN(val) ? 0 : Math.max(0, Math.min(300, val)));
                }}
                style={{ width: '80px', padding: '4px 6px', borderRadius: '4px', background: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '12px', textAlign: 'center' }}
              />
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              * ปล่อยเป็น 0 หรือว่างไว้ เพื่อใช้ขนาดส่วนกลางจาก Quick Setup Modal
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '20px', borderTop: '1px solid #334155', paddingTop: '14px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleReset}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            🔄 รีเซ็ต Crop
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className="btn-success"
              onClick={handleSave}
              disabled={isSaving}
              style={{ fontSize: '12px', padding: '6px 18px', fontWeight: 'bold' }}
            >
              {isSaving ? '⏳ กำลังบันทึก...' : '💾 บันทึก Crop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

