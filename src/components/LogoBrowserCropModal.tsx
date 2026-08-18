import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const [baseWidth, setBaseWidth] = useState<number>(500);
  const [baseHeight, setBaseHeight] = useState<number>(500);
  const [customSize, setCustomSize] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialOffset, setInitialOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const initialCropRef = useRef<{ originalUrl: string; crop: CropMetadata | null } | null>(null);

  // Load existing crop metadata & URL on modal open + backup initial crop state
  useEffect(() => {
    if (!isOpen) return;

    setActiveUrl(logoUrl || getLogoSrc('', teamName));

    const existingData = getCropMetadataFromLocalStorage(teamKey);
    initialCropRef.current = existingData;

    if (existingData?.crop) {
      const c = existingData.crop;
      setZoom(c.zoom || 1);
      setRotation(c.rotation || 0);
      setOffsetX(c.x || 0);
      setOffsetY(c.y || 0);
      setBaseWidth(c.width || 500);
      setBaseHeight(c.height || 500);
      setCustomSize(c.customSize || 0);
      if (existingData.originalUrl) {
        setActiveUrl(existingData.originalUrl);
      }
    } else {
      setZoom(1);
      setRotation(0);
      setOffsetX(0);
      setOffsetY(0);
      setBaseWidth(500);
      setBaseHeight(500);
      setCustomSize(0);
    }
  }, [isOpen, teamKey, logoUrl, teamName]);

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

  // Real-time Live Sync: Broadcast crop changes instantly to OBS Browser Source overlay as sliders move
  useEffect(() => {
    if (!isOpen) return;

    const targetUrl = activeUrl || logoUrl || getLogoSrc('', teamName);
    if (!targetUrl) return;

    // Reconstruct currentCrop inside the effect so all deps are declared explicitly
    // (avoids referencing the unstable object identity from the render scope)
    const liveCrop: CropMetadata = {
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

    saveCropMetadataToLocalStorage(teamKey, targetUrl, liveCrop);
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
  }, [isOpen, teamKey, activeUrl, logoUrl, teamName, offsetX, offsetY, baseWidth, baseHeight, zoom, rotation, customSize]);

  // Mouse Dragging on Preview Canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialOffset({ x: offsetX, y: offsetY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    setOffsetX(Math.max(-1000, Math.min(1000, Math.round(initialOffset.x + deltaX))));
    setOffsetY(Math.max(-1000, Math.min(1000, Math.round(initialOffset.y + deltaY))));
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Mouse Scroll Wheel Zooming on Preview Canvas
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const step = e.deltaY < 0 ? 0.05 : -0.05;
    setZoom((prev) => Math.max(0.05, Math.min(10, Number((prev + step).toFixed(2)))));
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    const targetUrl = activeUrl || logoUrl || getLogoSrc('', teamName);
    if (!targetUrl) {
      onToast?.('❌ ไม่พบ URL รูปภาพโลโก้ทีม', 'error');
      return;
    }

    setIsSaving(true);
    try {
      saveCropMetadataToLocalStorage(teamKey, targetUrl, currentCrop);

      try {
        const existingLogos = JSON.parse(localStorage.getItem('teamLogos') || '{}');
        existingLogos[teamKey] = targetUrl;
        localStorage.setItem('teamLogos', JSON.stringify(existingLogos));
      } catch { }

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

      if (db) {
        try {
          await saveCropMetadataToFirebase(db, teamKey, targetUrl, currentCrop);
        } catch (err) {
          console.warn('[LogoBrowserCropModal] Firebase save warning:', err);
        }
      }

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

  const handleCancel = () => {
    if (initialCropRef.current) {
      const backup = initialCropRef.current;
      if (backup.crop) {
        saveCropMetadataToLocalStorage(teamKey, backup.originalUrl, backup.crop);
      } else {
        removeCropMetadata(db || null, teamKey);
      }
    } else {
      removeCropMetadata(db || null, teamKey);
    }

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

    onClose();
  };

  const handleReset = async () => {
    try {
      await removeCropMetadata(db || null, teamKey);
      setZoom(1);
      setRotation(0);
      setOffsetX(0);
      setOffsetY(0);
      setBaseWidth(500);
      setBaseHeight(500);
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

  return createPortal(
    <div
      className="logo-crop-modal-overlay"
      onClick={handleCancel}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(6px)',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="logo-crop-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '680px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: '#0f172a',
          borderRadius: '16px',
          border: '1px solid #334155',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.95)',
          padding: '22px',
          color: '#f8fafc',
          boxSizing: 'border-box',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>✂️</span>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.3 }}>
                ครอบตัดโลโก้: Team {teamSide} ({teamName})
              </h3>
              <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                ปรับตำแหน่ง ซูม และขนาดแสดงผลใน OBS Browser Source
              </span>
            </div>
          </div>
          <button
            onClick={handleCancel}
            style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Centerpiece: Interactive Canvas Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onWheel={handleWheel}
            style={{
              width: '280px',
              height: '280px',
              backgroundColor: '#020617',
              backgroundImage: 'linear-gradient(45deg, #0f172a 25%, transparent 25%), linear-gradient(-45deg, #0f172a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0f172a 75%), linear-gradient(-45deg, transparent 75%, #0f172a 75%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
              borderRadius: '12px',
              border: `2px solid ${isDragging ? '#f59e0b' : '#38bdf8'}`,
              boxShadow: isDragging ? '0 0 20px rgba(245, 158, 11, 0.4)' : '0 4px 20px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
          >
            {activeUrl ? (
              <LogoWithCrop url={activeUrl} crop={currentCrop} alt={teamName} />
            ) : (
              <span style={{ color: '#64748b', fontSize: '13px' }}>ไม่พบรูปภาพโลโก้</span>
            )}

            {/* Interaction Overlay Hint */}
            <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', color: '#cbd5e1', whiteSpace: 'nowrap', border: '1px solid rgba(255, 255, 255, 0.1)', pointerEvents: 'none' }}>
              {isDragging ? '✊ กำลังขยับตำแหน่ง...' : '🖱️ คลิกลากบนรูปเพื่อขยับ | 📜 หมุนลูกกลิ้งเพื่อซูม'}
            </div>
          </div>

          {/* Canvas Quick Actions */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => { setOffsetX(0); setOffsetY(0); }}
              style={{ fontSize: '12px', padding: '4px 12px', background: '#1e293b', border: '1px solid #334155', color: '#38bdf8', borderRadius: '4px', cursor: 'pointer' }}
            >
              🎯 จัดกลาง (X:0, Y:0)
            </button>
            <button
              type="button"
              onClick={() => { setZoom(1); setRotation(0); }}
              style={{ fontSize: '12px', padding: '4px 12px', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
            >
              🔄 รีเซ็ตซูม (1x, 0°)
            </button>
          </div>
        </div>

        {/* Compact Controls Toolbar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#1e293b', padding: '14px 16px', borderRadius: '12px', border: '1px solid #334155' }}>
          {/* Zoom Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#cbd5e1', minWidth: '130px', flexShrink: 0, whiteSpace: 'nowrap' }}>
              🔍 ซูม (<strong style={{ color: '#38bdf8' }}>{zoom.toFixed(2)}x</strong>):
            </span>
            <div style={{ display: 'flex', gap: '6px', flex: 1, alignItems: 'center', minWidth: '200px' }}>
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(0.05, Number((prev - 0.05).toFixed(2))))}
                style={{ padding: '3px 10px', background: '#334155', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                -
              </button>
              <input
                type="range"
                min="0.05"
                max="10"
                step="0.01"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: '#38bdf8' }}
              />
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(10, Number((prev + 0.05).toFixed(2))))}
                style={{ padding: '3px 10px', background: '#334155', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                +
              </button>
              <input
                type="number"
                min="0.05"
                max="10"
                step="0.1"
                value={zoom}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) setZoom(Math.max(0.01, Math.min(10, val)));
                }}
                style={{ width: '65px', padding: '4px', borderRadius: '4px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12px', textAlign: 'center', flexShrink: 0 }}
              />
            </div>
          </div>

          {/* Rotation Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#cbd5e1', minWidth: '130px', flexShrink: 0, whiteSpace: 'nowrap' }}>
              🔄 หมุนภาพ (<strong style={{ color: '#38bdf8' }}>{rotation}°</strong>):
            </span>
            <div style={{ display: 'flex', gap: '6px', flex: 1, alignItems: 'center', minWidth: '200px' }}>
              <button
                type="button"
                onClick={() => setRotation((prev) => Math.max(-180, prev - 5))}
                style={{ padding: '3px 10px', background: '#334155', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                -
              </button>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={rotation}
                onChange={(e) => setRotation(parseInt(e.target.value, 10))}
                style={{ flex: 1, accentColor: '#38bdf8' }}
              />
              <button
                type="button"
                onClick={() => setRotation((prev) => Math.min(180, prev + 5))}
                style={{ padding: '3px 10px', background: '#334155', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                +
              </button>
              <input
                type="number"
                min="-180"
                max="180"
                step="5"
                value={rotation}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setRotation(Math.max(-180, Math.min(180, val)));
                }}
                style={{ width: '65px', padding: '4px', borderRadius: '4px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12px', textAlign: 'center', flexShrink: 0 }}
              />
            </div>
          </div>

          {/* Custom Size Control & Quick Presets */}
          <div style={{ borderTop: '1px solid #334155', paddingTop: '12px', marginTop: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                📐 ขนาดเฉพาะทีมนี้: <strong style={{ color: customSize > 0 ? '#38bdf8' : '#94a3b8' }}>{customSize > 0 ? `${customSize}px` : 'ใช้ขนาดส่วนกลาง (Default)'}</strong>
              </span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {[0, 80, 100, 120, 150, 200].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setCustomSize(size)}
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid #334155',
                      backgroundColor: customSize === size ? '#38bdf8' : '#0f172a',
                      color: customSize === size ? '#0f172a' : '#cbd5e1',
                      fontWeight: customSize === size ? 'bold' : 'normal',
                      cursor: 'pointer',
                    }}
                  >
                    {size === 0 ? 'Default' : `${size}px`}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="range"
                min="0"
                max="1000"
                step="5"
                value={customSize}
                onChange={(e) => setCustomSize(parseInt(e.target.value, 10))}
                style={{ flex: 1, accentColor: '#38bdf8' }}
              />
              <input
                type="number"
                min="0"
                max="1000"
                value={customSize || ''}
                placeholder="Default"
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setCustomSize(isNaN(val) ? 0 : Math.max(0, Math.min(1000, val)));
                }}
                style={{ width: '80px', padding: '4px', borderRadius: '4px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12px', textAlign: 'center', flexShrink: 0 }}
              />
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '18px', borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleReset}
            style={{ fontSize: '12px', padding: '8px 16px' }}
          >
            🔄 รีเซ็ตทั้งหมด
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCancel}
              style={{ fontSize: '12px', padding: '8px 18px' }}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className="btn-success"
              onClick={handleSave}
              disabled={isSaving}
              style={{ fontSize: '12px', padding: '8px 24px', fontWeight: 'bold' }}
            >
              {isSaving ? '⏳ กำลังบันทึก...' : '💾 บันทึก Crop'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

