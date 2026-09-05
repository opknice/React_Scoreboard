import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Team } from '../config/supabaseClient';
import type { Json } from '../types/supabase';
import {
  calculateContainZoom,
  LOGO_FRAME_SIZE_PX,
  parseCropMetadata,
  type CropMetadata,
} from '../types/teamLogo';
import { normalizeLogoScalePercent, scaleLogoPixels } from '../types/leagueLogoSizing';
import { getLogoSrc } from '../utils/logoResolver';
import LogoWithCrop from './LogoWithCrop';
import {
  getLogoSyncSessionId,
  useLogoCropPreviewSync,
  type CropPreviewConnectionStatus,
  type LogoCropPreviewMessage,
} from '../hooks/useLogoCropPreviewSync';

interface LogoBrowserCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: Team;
  cropMetadata: Json | null | undefined;
  cropContext: 'overlay' | 'logo-browser';
  initialFrameScalePercent?: number;
  onSave: (crop: CropMetadata) => Promise<void>;
  onReset: () => Promise<void>;
  onToast?: (message: string, type?: string) => void;
}

export default function LogoBrowserCropModal({
  isOpen,
  onClose,
  team,
  cropMetadata,
  cropContext,
  initialFrameScalePercent = 100,
  onSave,
  onReset,
  onToast,
}: LogoBrowserCropModalProps) {
  const teamName = team.name;
  const logoUrl = team.logo_url || '';
  const [activeUrl, setActiveUrl] = useState<string>(() => logoUrl || getLogoSrc('', teamName));
  const [zoom, setZoom] = useState<number>(1);
  const [fitZoom, setFitZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [baseWidth, setBaseWidth] = useState<number>(500);
  const [baseHeight, setBaseHeight] = useState<number>(500);
  const [frameScalePercent, setFrameScalePercent] = useState<number>(() => normalizeLogoScalePercent(initialFrameScalePercent));
  const [isCropEditing, setIsCropEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialOffset, setInitialOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const editSessionIdRef = useRef<string>('');
  const sequenceRef = useRef(0);
  const syncSessionId = getLogoSyncSessionId();
  const { publish: publishCropMessage, status: previewConnectionStatus } = useLogoCropPreviewSync({
    sessionId: syncSessionId,
    onMessage: (_message: LogoCropPreviewMessage) => undefined,
  });

  const publishDraft = (action: 'preview' | 'saved' | 'cancelled' | 'reset', crop: CropMetadata | null) => {
    if (!team.id) return;
    if (!editSessionIdRef.current) {
      editSessionIdRef.current = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `edit_${Date.now()}`;
    }
    sequenceRef.current += 1;
    publishCropMessage({
      type: 'LogoCropPreview',
      sessionId: syncSessionId,
      editSessionId: editSessionIdRef.current,
      teamId: team.id,
      teamName,
      context: cropContext,
      action,
      crop,
      sequence: sequenceRef.current,
      timestamp: Date.now(),
    });
  };

  // Supabase is the source of truth. Opening or cancelling this editor never mutates browser storage.
  useEffect(() => {
    if (!isOpen) return;

    setActiveUrl(logoUrl || getLogoSrc('', teamName));
    const existingCrop = parseCropMetadata(cropMetadata);
    setIsCropEditing(Boolean(existingCrop));

    if (existingCrop) {
      const c = existingCrop;
      setZoom(c.zoom || 1);
      setRotation(c.rotation || 0);
      setOffsetX(c.x || 0);
      setOffsetY(c.y || 0);
      setBaseWidth(c.width || 500);
      setBaseHeight(c.height || 500);
      setFrameScalePercent(normalizeLogoScalePercent(c.frameScalePercent));
    } else {
      setZoom(1);
      setFitZoom(1);
      setRotation(0);
      setOffsetX(0);
      setOffsetY(0);
      setBaseWidth(500);
      setBaseHeight(500);
      setFrameScalePercent(normalizeLogoScalePercent(initialFrameScalePercent));
    }
  }, [cropMetadata, initialFrameScalePercent, isOpen, logoUrl, teamName]);

  const currentCrop: CropMetadata = {
    x: offsetX,
    y: offsetY,
    width: baseWidth,
    height: baseHeight,
    zoom,
    rotation,
    aspectRatio: baseWidth > 0 && baseHeight > 0 ? baseWidth / baseHeight : 1,
    frameScalePercent,
    createdAt: new Date().toISOString(),
  };

  // A team without persisted crop metadata starts in contain mode. The crop canvas
  // becomes active only after the user begins editing or when saved crop exists.
  const persistedCrop = parseCropMetadata(cropMetadata);
  const previewCrop = persistedCrop || isCropEditing ? currentCrop : null;

  const handleImageLoad = ({ naturalWidth, naturalHeight }: { naturalWidth: number; naturalHeight: number }) => {
    const nextFitZoom = calculateContainZoom(naturalWidth, naturalHeight, baseWidth, baseHeight);
    setFitZoom(nextFitZoom);

    // A new crop starts from the same visual scale as the initial Contain preview.
    // Preserve an existing crop or a user-entered zoom value.
    if (!persistedCrop && zoom === 1) setZoom(nextFitZoom);
  };

  const connectionPresentation: Record<CropPreviewConnectionStatus, { label: string; color: string; background: string }> = {
    connecting: { label: 'กำลังเชื่อมต่อ OBS…', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.14)' },
    connected: { label: 'เชื่อมต่อช่อง Realtime แล้ว — พร้อมส่งไป OBS', color: '#4ade80', background: 'rgba(34, 197, 94, 0.14)' },
    'local-only': { label: 'Preview เฉพาะหน้าจอนี้ — Supabase ยังไม่พร้อม', color: '#fb923c', background: 'rgba(249, 115, 22, 0.14)' },
    error: { label: 'เชื่อมต่อ OBS Realtime ไม่สำเร็จ', color: '#f87171', background: 'rgba(239, 68, 68, 0.14)' },
  };
  const connectionUi = connectionPresentation[previewConnectionStatus];

  useEffect(() => {
    if (!isOpen || !isCropEditing || isSaving) return;
    publishDraft('preview', currentCrop);
    // Publish only when a crop input changes; the transport throttles cross-context delivery.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isCropEditing, isSaving, offsetX, offsetY, zoom, rotation, baseWidth, baseHeight, frameScalePercent, team.id, cropContext]);

  const beginCropEditing = () => {
    setIsCropEditing(true);
  };

  // Pointer Events support both mouse and touch. Convert preview pixels to the
  // canvas coordinate space so the logo follows the pointer exactly.
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    beginCropEditing();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialOffset({ x: offsetX, y: offsetY });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const scaleX = baseWidth / Math.max(1, e.currentTarget.clientWidth);
    const scaleY = baseHeight / Math.max(1, e.currentTarget.clientHeight);
    const deltaX = (e.clientX - dragStart.x) * scaleX;
    const deltaY = (e.clientY - dragStart.y) * scaleY;
    setOffsetX(Math.max(-1000, Math.min(1000, Math.round(initialOffset.x + deltaX))));
    setOffsetY(Math.max(-1000, Math.min(1000, Math.round(initialOffset.y + deltaY))));
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  };

  // Mouse Scroll Wheel Zooming on Preview Canvas
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    beginCropEditing();
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
      await onSave(currentCrop);
      publishDraft('saved', currentCrop);

      onToast?.(`✅ บันทึก Crop โลโก้ ${teamName} เรียบร้อยแล้ว`, 'success');
      onClose();
    } catch (err: unknown) {
      console.error('[LogoBrowserCropModal] Save error:', err);
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
      onToast?.(`❌ บันทึกไม่สำเร็จ: ${message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    publishDraft('cancelled', null);
    onClose();
  };

  const handleReset = async () => {
    try {
      setIsSaving(true);
      await onReset();
      publishDraft('reset', null);
      setZoom(fitZoom);
      setRotation(0);
      setOffsetX(0);
      setOffsetY(0);
      setBaseWidth(500);
      setBaseHeight(500);
      setFrameScalePercent(normalizeLogoScalePercent(initialFrameScalePercent));

      onToast?.(`🔄 รีเซ็ต Crop โลโก้ ${teamName} เป็นค่าเริ่มต้นแล้ว`, 'info');
      onClose();
    } catch (err: unknown) {
      console.error('[LogoBrowserCropModal] Reset error:', err);
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
      onToast?.(`❌ รีเซ็ตไม่สำเร็จ: ${message}`, 'error');
    } finally {
      setIsSaving(false);
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
                ครอบตัดโลโก้สำหรับ {cropContext === 'overlay' ? 'Overlay/OBS' : 'Logo Browser Source'}: {teamName}
              </h3>
              <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                กรอบ Custom {frameScalePercent}% — ปรับเฉพาะตำแหน่ง ซูม และการหมุนของรูปด้านใน
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

        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            width: 'fit-content',
            marginBottom: '14px',
            padding: '6px 10px',
            borderRadius: '999px',
            border: `1px solid ${connectionUi.color}55`,
            background: connectionUi.background,
            color: connectionUi.color,
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: connectionUi.color,
              boxShadow: `0 0 8px ${connectionUi.color}`,
            }}
          />
          {connectionUi.label}
        </div>

        {/* Centerpiece: Interactive Canvas Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onWheel={handleWheel}
            style={{
              width: 'min(280px, 100%)',
              aspectRatio: '1 / 1',
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
            <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 2, padding: '4px 8px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.88)', border: '1px solid rgba(56, 189, 248, 0.35)', color: '#7dd3fc', fontSize: '10px', fontWeight: 700, pointerEvents: 'none' }}>
              FRAME {frameScalePercent}%{cropContext === 'logo-browser'
                ? ` · ${scaleLogoPixels(LOGO_FRAME_SIZE_PX, frameScalePercent)}px`
                : ' · ตาม Layout'}
            </div>
            {activeUrl ? (
              <LogoWithCrop
                url={activeUrl}
                crop={previewCrop}
                alt={teamName}
                onImageLoad={handleImageLoad}
              />
            ) : (
              <span style={{ color: '#64748b', fontSize: '13px' }}>ไม่พบรูปภาพโลโก้</span>
            )}

            {/* Interaction Overlay Hint */}
            <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', color: '#cbd5e1', whiteSpace: 'nowrap', border: '1px solid rgba(255, 255, 255, 0.1)', pointerEvents: 'none' }}>
              {isDragging ? '✊ กำลังขยับตำแหน่ง...' : 'ลากรูปเพื่อขยับ · ใช้ Slider หรือลูกกลิ้งเพื่อซูม'}
            </div>
          </div>

          {/* Canvas Quick Actions */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => { beginCropEditing(); setOffsetX(0); setOffsetY(0); }}
              style={{ fontSize: '12px', padding: '4px 12px', background: '#1e293b', border: '1px solid #334155', color: '#38bdf8', borderRadius: '4px', cursor: 'pointer' }}
            >
              🎯 จัดกลาง (X:0, Y:0)
            </button>
            <button
              type="button"
              onClick={() => { beginCropEditing(); setZoom(fitZoom); setRotation(0); }}
              style={{ fontSize: '12px', padding: '4px 12px', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
            >
                🔄 รีเซ็ตซูม ({fitZoom.toFixed(2)}x, 0°)
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
                onClick={() => { beginCropEditing(); setZoom((prev) => Math.max(0.05, Number((prev - 0.05).toFixed(2)))); }}
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
                onChange={(e) => { beginCropEditing(); setZoom(parseFloat(e.target.value)); }}
                style={{ flex: 1, accentColor: '#38bdf8' }}
              />
              <button
                type="button"
                onClick={() => { beginCropEditing(); setZoom((prev) => Math.min(10, Number((prev + 0.05).toFixed(2)))); }}
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
                  beginCropEditing();
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
                onClick={() => { beginCropEditing(); setRotation((prev) => Math.max(-180, prev - 5)); }}
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
                onChange={(e) => { beginCropEditing(); setRotation(parseInt(e.target.value, 10)); }}
                style={{ flex: 1, accentColor: '#38bdf8' }}
              />
              <button
                type="button"
                onClick={() => { beginCropEditing(); setRotation((prev) => Math.min(180, prev + 5)); }}
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
                  beginCropEditing();
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setRotation(Math.max(-180, Math.min(180, val)));
                }}
                style={{ width: '65px', padding: '4px', borderRadius: '4px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12px', textAlign: 'center', flexShrink: 0 }}
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
