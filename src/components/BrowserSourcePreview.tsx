import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { BrowserSourceKind } from './BrowserSourceWorkspace';
import type { Team } from '../config/supabaseClient';
import type { PlayerBrowserSettings } from '../types/playerBrowserSettings';
import type { TeamNameBrowserSettings } from '../types/teamNameBrowserSettings';
import type { TeamColorBrowserSettings } from '../types/teamColorBrowserSettings';
import type { LogoBrowserSettings } from '../types/logoBrowserSettings';
import type { ScoreBrowserSettings } from '../types/scoreBrowserSettings';
import { parseCropMetadata, LOGO_FRAME_SIZE_PX, type CropMetadata } from '../types/teamLogo';
import { getEffectiveLogoScalePercent, scaleLogoPixels } from '../types/leagueLogoSizing';
import { getLogoSrc } from '../utils/logoResolver';
import { useBrowserSourcePreviewState } from '../hooks/useBrowserSourcePreviewState';
import { useCanvasObjectEditor, type CanvasObject } from '../hooks/useCanvasObjectEditor';
import type { BrowserPosition } from '../types/browserPositions';
import TeamColorPreview from './TeamColorPreview';
import CroppedLogoImage from './CroppedLogoImage';
import './PlayerBrowserSource.css';
import './TeamNamesAnimation.css';

interface Props {
  kind: BrowserSourceKind;
  player: PlayerBrowserSettings;
  teamName: TeamNameBrowserSettings;
  teamColor: TeamColorBrowserSettings;
  logo: LogoBrowserSettings;
  score: ScoreBrowserSettings;
  teams: Team[];
  logoScale: number;
  onMove: (id: string, position: BrowserPosition) => void;
}

function autoNameSize(name: string): number {
  const length = name.trim().length;
  return length <= 10 ? 48 : length <= 14 ? 40 : length <= 18 ? 33.6 : length <= 24 ? 28.8 : 24;
}

function PreviewLogo({ src, crop, name, side }: { src: string; crop: CropMetadata | null | undefined; name: string; side: 'A' | 'B' }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!src || failedUrl === src) return <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', border: '2px dashed #64748b', fontSize: 32 }}>Logo {side}</div>;
  return crop
    ? <CroppedLogoImage url={src} crop={crop} frameAspectRatio={crop.browserFrame ? crop.browserFrame.width / crop.browserFrame.height : undefined} alt={name} onError={() => setFailedUrl(src)} />
    : <img src={src} alt={name} onError={() => setFailedUrl(src)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
}

export default function BrowserSourcePreview({ kind, player, teamName, teamColor, logo, score, teams, logoScale, onMove }: Props) {
  const { match, player: displayedPlayer } = useBrowserSourcePreviewState();
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const objects: CanvasObject[] = kind === 'player'
    ? (['image', 'jersey', 'name'] as const).map(id => ({ id, label: id === 'image' ? 'รูปนักเตะ' : id === 'jersey' ? 'หมายเลขเสื้อ' : 'ชื่อนักเตะ', position: player[id] }))
    : kind === 'team-color'
      ? (['A1', 'A2', 'B1', 'B2'] as const).map(id => ({ id, label: `สีทีม ${id}`, position: teamColor.positions[id], maxX: 1920 - teamColor.appearance.width, maxY: 1080 - teamColor.appearance.height }))
      : (['A', 'B'] as const).map(id => ({ id, label: `${kind === 'team-name' ? 'ชื่อทีม' : kind === 'logo' ? 'โลโก้' : 'คะแนน'} ${id}`, position: (kind === 'team-name' ? teamName : kind === 'logo' ? logo : score).positions[id] }));
  const editor = useCanvasObjectEditor(objects, scale, onMove);
  const selected = objects.find(object => object.id === editor.selected);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const resize = () => setScale(element.clientWidth / 1920);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const colors = {
    A: { primary: match?.colorA1 ?? '#38bdf8', secondary: match?.colorA2 ?? '#ffffff' },
    B: { primary: match?.colorB1 ?? '#fb7185', secondary: match?.colorB2 ?? '#ffffff' },
  };
  return <>
    <div className="canvas-editor-toolbar">
      <label>วัตถุ<select aria-label="เลือกวัตถุบน Canvas" value={editor.selected ?? ''} onChange={event => {
        const id = event.target.value;
        editor.setSelected(id || null);
        if (id) frame.current?.querySelector<HTMLElement>(`[data-canvas-object="${id}"]`)?.focus({ preventScroll: true });
      }}><option value="">เลือกวัตถุ…</option>{objects.map(object => <option key={object.id} value={object.id}>{object.label}</option>)}</select></label>
      <label><input type="checkbox" checked={editor.snap} onChange={event => editor.setSnap(event.target.checked)} /> จัดแนวอัตโนมัติ</label>
      <span>{selected ? `${selected.label} · X ${Math.round(selected.position.x * 100) / 100} / Y ${Math.round(selected.position.y * 100) / 100}` : 'คลิกวัตถุเพื่อเลือก'}</span>
    </div>
    <div className="browser-source-canvas-frame" ref={frame} role="group" tabIndex={0} aria-label={`Canvas ${kind}`} onPointerDown={event => {
      if (!(event.target as HTMLElement).closest('[data-canvas-object]')) { editor.setSelected(null); event.currentTarget.focus({ preventScroll: true }); }
    }} onDragStart={event => event.preventDefault()}>
      <div className="browser-source-canvas" style={{ transform: `scale(${scale})` }}>
        {kind === 'team-color' && <>
          <TeamColorPreview settings={teamColor} colors={colors} />
          {(['A1', 'A2', 'B1', 'B2'] as const).map(id => <div key={id} {...editor.objectProps(id)} className="canvas-color-hitbox" style={{ position: 'absolute', left: teamColor.positions[id].x, top: teamColor.positions[id].y, width: teamColor.appearance.width, height: teamColor.appearance.height }} />)}
        </>}
        {kind === 'player' && <>
          <div {...editor.objectProps('image')} className="player-browser-image" style={{ left: player.image.x, top: player.image.y, width: player.image.size, height: player.image.size }}>
            {displayedPlayer?.imageUrl ? <img src={displayedPlayer.imageUrl} alt="นักเตะ" /> : <div className="player-browser-photo-placeholder"><i className="fas fa-user" aria-hidden="true" /></div>}
          </div>
          <div {...editor.objectProps('jersey')} className="player-browser-jersey" style={{ left: player.jersey.x, top: player.jersey.y, fontSize: player.jersey.size }}>{displayedPlayer?.jerseyNumber ?? 10}</div>
          <div {...editor.objectProps('name')} className="player-browser-name" style={{ left: player.name.x, top: player.name.y, fontSize: player.name.size }}><strong>{displayedPlayer?.name || 'ชื่อนักเตะตัวอย่าง'}</strong><span>{displayedPlayer?.teamName || 'Team A'}</span></div>
        </>}
        {(kind === 'team-name' || kind === 'logo' || kind === 'score') && (['A', 'B'] as const).map(side => {
          const name = (side === 'A' ? match?.nameA : match?.nameB) || `Team ${side}`;
          if (kind === 'team-name') {
            const settings = teamName;
            const style = {
              left: settings.positions[side].x, top: settings.positions[side].y,
              '--team-name-font-family': settings.fontFamily,
              '--team-name-color': settings[`textColor${side}`],
              '--team-name-font-weight': settings[`fontWeight${side}`],
              '--team-name-font-size': `${settings[`fontMode${side}`] === 'manual' ? settings[`fontSize${side}`] : autoNameSize(name)}px`,
            } as CSSProperties;
            return <div key={side} {...editor.objectProps(side)} className="team-name-instance" style={style}><div className="team-name-slot"><div className="team-name-value">{name}</div></div></div>;
          }
          if (kind === 'score') {
            const value = (side === 'A' ? match?.scoreA : match?.scoreB) ?? 0;
            const digits = Math.abs(Math.trunc(value)).toString().length;
            return <div key={side} {...editor.objectProps(side)} className="browser-source-sample browser-source-sample--text" style={{ left: score.positions[side].x, top: score.positions[side].y, transform: 'translateX(-50%)', fontFamily: score.fontFamily, fontWeight: score[`fontWeight${side}`], fontSize: score[`fontMode${side}`] === 'manual' ? score[`fontSize${side}`] : digits <= 2 ? 72 : digits === 3 ? 64 : 56, lineHeight: 1.2, color: '#fff' }}>{value}</div>;
          }
          const teamId = side === 'A' ? match?.teamIdA : match?.teamIdB;
          const team = teams.find(item => teamId ? item.id === teamId : item.name.trim().toLowerCase() === name.trim().toLowerCase());
          const crop = team ? parseCropMetadata(team.logo_browser_crop_metadata) : (side === 'A' ? match?.logoBrowserCropA : match?.logoBrowserCropB);
          const size = scaleLogoPixels(LOGO_FRAME_SIZE_PX, getEffectiveLogoScalePercent(crop, logoScale));
          const src = getLogoSrc(team?.logo_url || (side === 'A' ? match?.logoA : match?.logoB) || '', name);
          return <div key={side} {...editor.objectProps(side)} className="browser-source-sample" style={{ left: logo.positions[side].x, top: logo.positions[side].y, width: crop?.browserFrame?.width ?? size, height: crop?.browserFrame?.height ?? size, boxSizing: 'border-box', padding: logo.backgroundMode === 'normal' ? 8 : 0, background: logo.backgroundMode === 'normal' ? '#000c' : 'transparent', borderRadius: logo.backgroundMode === 'normal' ? 12 : 0 }}>
            <PreviewLogo src={src} crop={crop} name={name} side={side} />
          </div>;
        })}
        {editor.guides.x !== undefined && editor.selected && <div className="canvas-alignment-guide canvas-alignment-guide--x" aria-hidden="true" style={{ left: editor.guides.x }} />}
        {editor.guides.y !== undefined && editor.selected && <div className="canvas-alignment-guide canvas-alignment-guide--y" aria-hidden="true" style={{ top: editor.guides.y }} />}
      </div>
    </div>
    <p className="browser-source-hint">ลากเพื่อย้าย · ลูกศร 1 px · Shift + ลูกศร 10 px · Alt ขณะลากเพื่อข้ามการจัดแนว · Esc ยกเลิกการลาก<br />เส้นช่วยจัดแนวเทียบจุดอ้างอิงของวัตถุ กับกึ่งกลาง/ขอบ Canvas และวัตถุอื่น</p>
    <p className="browser-source-hint">{kind === 'player' ? 'แสดงนักเตะล่าสุด หรือข้อมูลตัวอย่างเมื่อยังไม่ได้เลือกนักเตะ' : match ? 'แสดงข้อมูลทีมปัจจุบัน · ตัวอย่างแบบนิ่ง' : 'ยังไม่มีข้อมูลการแข่งขัน ใช้ข้อมูลตัวอย่าง'}</p>
  </>;
}
