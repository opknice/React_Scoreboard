import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { League, Team } from '../../config/supabaseClient';
import { getLogoSyncSessionId } from '../../hooks/useLogoCropPreviewSync';
import { useLeagueLogoScalePreviewSync } from '../../hooks/useLeagueLogoScalePreviewSync';
import {
  DEFAULT_LOGO_SCALE_PERCENT,
  MAX_LOGO_SCALE_PERCENT,
  MIN_LOGO_SCALE_PERCENT,
  mergeLeagueLogoSizing,
  normalizeLogoScalePercent,
  parseLeagueLogoSizing,
  scaleLogoPixels,
  type LeagueLogoSizingSettings,
  type LogoSizingContext,
} from '../../types/leagueLogoSizing';
import { parseCropMetadata } from '../../types/teamLogo';

interface LeagueLogoScaleControlsProps {
  league: League;
  teams: Team[];
  disabled?: boolean;
  onUpdateLeague: (leagueId: string, updates: Partial<League>) => Promise<League | null>;
  onPreviewSizingChange?: (sizing: LeagueLogoSizingSettings | null) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onCancel?: () => void;
}

interface ScaleControlDefinition {
  context: LogoSizingContext;
  label: string;
  description: string;
  basePixels: number;
  valueKey: keyof LeagueLogoSizingSettings;
}

const CONTROLS: ScaleControlDefinition[] = [
  {
    context: 'overlay',
    label: 'Overlay Size',
    description: 'ปรับตามขนาดฐานของแต่ละ Layout',
    basePixels: 64,
    valueKey: 'overlayScalePercent',
  },
  {
    context: 'logo-browser',
    label: 'Logo Browser Size',
    description: 'ขนาดฐานของ Browser Source คือ 190px',
    basePixels: 190,
    valueKey: 'logoBrowserScalePercent',
  },
];

function createEditSessionId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `league_size_${Date.now()}`;
}

export default function LeagueLogoScaleControls({
  league,
  teams,
  disabled = false,
  onUpdateLeague,
  onPreviewSizingChange,
  onDirtyChange,
  onCancel,
}: LeagueLogoScaleControlsProps) {
  const persistedSizing = useMemo(() => parseLeagueLogoSizing(league.settings), [league.settings]);
  const [draftSizing, setDraftSizing] = useState<LeagueLogoSizingSettings>(persistedSizing);
  const [baselineSizing, setBaselineSizing] = useState<LeagueLogoSizingSettings>(persistedSizing);
  const [isSaving, setIsSaving] = useState(false);
  const editSessionIdRef = useRef(createEditSessionId());
  const sequenceRef = useRef(0);
  const draftRef = useRef(draftSizing);
  const persistedRef = useRef(baselineSizing);
  const isDirtyRef = useRef(false);
  const syncSessionId = getLogoSyncSessionId();
  const { publish, status } = useLeagueLogoScalePreviewSync({
    sessionId: syncSessionId,
    onMessage: () => undefined,
  });

  const isDirty = draftSizing.overlayScalePercent !== baselineSizing.overlayScalePercent
    || draftSizing.logoBrowserScalePercent !== baselineSizing.logoBrowserScalePercent;
  draftRef.current = draftSizing;
  persistedRef.current = baselineSizing;
  isDirtyRef.current = isDirty;

  const publishSizing = (
    action: 'preview' | 'saved' | 'cancelled',
    sizing: LeagueLogoSizingSettings,
  ) => {
    sequenceRef.current += 1;
    publish({
      type: 'LeagueLogoScalePreview',
      sessionId: syncSessionId,
      editSessionId: editSessionIdRef.current,
      leagueId: league.id,
      action,
      sizing,
      sequence: sequenceRef.current,
      timestamp: Date.now(),
    });
  };

  useEffect(() => {
    setDraftSizing(persistedSizing);
    setBaselineSizing(persistedSizing);
    editSessionIdRef.current = createEditSessionId();
    sequenceRef.current = 0;
  }, [league.id, persistedSizing]);

  useEffect(() => {
    if (isDirty) publishSizing('preview', draftSizing);
    // The transport owns throttling; only actual slider values trigger a draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftSizing, isDirty]);

  useEffect(() => {
    onPreviewSizingChange?.(isDirty ? draftSizing : null);
  }, [draftSizing, isDirty, onPreviewSizingChange]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Layout-effect cleanup runs before the transport's passive cleanup, allowing
  // an unsaved draft to be cancelled when the modal/tab closes.
  useLayoutEffect(() => () => {
    onPreviewSizingChange?.(null);
    if (isDirtyRef.current) publishSizing('cancelled', persistedRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league.id]);

  const updateValue = (key: keyof LeagueLogoSizingSettings, value: number) => {
    setDraftSizing((current) => ({ ...current, [key]: normalizeLogoScalePercent(value) }));
  };

  const handleCancel = () => {
    isDirtyRef.current = false;
    setDraftSizing(baselineSizing);
    publishSizing('cancelled', baselineSizing);
    onCancel?.();
  };

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      const normalizedSizing: LeagueLogoSizingSettings = {
        overlayScalePercent: normalizeLogoScalePercent(draftSizing.overlayScalePercent),
        logoBrowserScalePercent: normalizeLogoScalePercent(draftSizing.logoBrowserScalePercent),
      };
      await onUpdateLeague(league.id, {
        settings: mergeLeagueLogoSizing(league.settings, normalizedSizing),
      });
      isDirtyRef.current = false;
      setBaselineSizing(normalizedSizing);
      persistedRef.current = normalizedSizing;
      publishSizing('saved', normalizedSizing);
      setDraftSizing(normalizedSizing);
    } catch {
      // useSupabaseLeague already reports the database error to the user.
    } finally {
      setIsSaving(false);
    }
  };

  const statusLabel = status === 'connected'
    ? 'Realtime พร้อมส่งไป OBS'
    : status === 'connecting'
      ? 'กำลังเชื่อมต่อ Realtime…'
      : status === 'local-only'
        ? 'Preview เฉพาะ Browser นี้'
        : 'Realtime เชื่อมต่อไม่สำเร็จ';

  return (
    <section className="league-logo-scale-panel" aria-labelledby="league-logo-scale-title">
      <div className="league-logo-scale-header">
        <div>
          <h3 id="league-logo-scale-title">
            <i className="fas fa-expand-arrows-alt" aria-hidden="true" />
            ขนาดโลโก้เริ่มต้นของลีก
          </h3>
          <p>มีผลเฉพาะทีมที่ยังไม่ได้ปรับภาพด้วย Crop และ Preview ใน OBS จะเปลี่ยนทันที</p>
        </div>
        <span className={`league-logo-scale-connection is-${status}`} role="status">
          <span aria-hidden="true" />
          {statusLabel}
        </span>
      </div>

      <div className="league-logo-scale-grid">
        {CONTROLS.map((control) => {
          const value = draftSizing[control.valueKey];
          const customCount = teams.filter((team) => parseCropMetadata(
            control.context === 'overlay'
              ? team.overlay_crop_metadata
              : team.logo_browser_crop_metadata,
          ) !== null).length;
          const inheritedCount = teams.length - customCount;

          return (
            <div className="league-logo-scale-control" key={control.context}>
              <div className="league-logo-scale-control-heading">
                <div>
                  <strong>{control.label}</strong>
                  <span>{control.description}</span>
                </div>
                <label>
                  <span className="sr-only">{control.label} เปอร์เซ็นต์</span>
                  <input
                    type="number"
                    min={MIN_LOGO_SCALE_PERCENT}
                    max={MAX_LOGO_SCALE_PERCENT}
                    step={1}
                    value={value}
                    disabled={disabled || isSaving}
                    onChange={(event) => updateValue(control.valueKey, Number(event.target.value))}
                  />
                  <span>%</span>
                </label>
              </div>

              <input
                className="league-logo-scale-range"
                type="range"
                min={MIN_LOGO_SCALE_PERCENT}
                max={MAX_LOGO_SCALE_PERCENT}
                step={1}
                value={value}
                disabled={disabled || isSaving}
                onChange={(event) => updateValue(control.valueKey, Number(event.target.value))}
                aria-label={`${control.label} slider`}
              />

              <div className="league-logo-scale-meta">
                <span>ตัวอย่าง {control.basePixels}px → {scaleLogoPixels(control.basePixels, value)}px</span>
                <span>ใช้กับ {inheritedCount} ทีม · Custom Crop {customCount} ทีม</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="league-logo-scale-actions">
        <button
          type="button"
          className="league-btn-secondary"
          disabled={disabled || isSaving || (
            draftSizing.overlayScalePercent === DEFAULT_LOGO_SCALE_PERCENT
            && draftSizing.logoBrowserScalePercent === DEFAULT_LOGO_SCALE_PERCENT
          )}
          onClick={() => setDraftSizing({
            overlayScalePercent: DEFAULT_LOGO_SCALE_PERCENT,
            logoBrowserScalePercent: DEFAULT_LOGO_SCALE_PERCENT,
          })}
        >
          <i className="fas fa-undo" aria-hidden="true" /> กลับเป็น 100%
        </button>
        <div>
          <button type="button" className="league-btn-secondary" disabled={!isDirty || isSaving} onClick={handleCancel}>
            ยกเลิก
          </button>
          <button type="button" className="league-btn-primary" disabled={!isDirty || disabled || isSaving} onClick={() => void handleSave()}>
            <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-save'}`} aria-hidden="true" />
            {isSaving ? 'กำลังบันทึก…' : 'บันทึกขนาด'}
          </button>
        </div>
      </div>
    </section>
  );
}
