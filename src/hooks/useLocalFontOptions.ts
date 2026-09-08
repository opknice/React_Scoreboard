import { useCallback, useEffect, useRef, useState } from 'react';
import { TEAM_NAME_FONT_OPTIONS } from '../types/teamNameBrowserSettings';

interface FontOption { value: string; label: string }
interface FontResult { options: FontOption[]; message: string }
type FontWindow = Window & { queryLocalFonts?: () => Promise<Array<{ family: string }>> };

let cached: FontResult | undefined;
let pending: Promise<FontResult> | undefined;

function readFonts(force: boolean): Promise<FontResult> {
  if (pending) return pending;
  if (!force && cached) return Promise.resolve(cached);
  const query = (window as FontWindow).queryLocalFonts;
  if (!query) return Promise.resolve({ options: TEAM_NAME_FONT_OPTIONS, message: 'Browser นี้ไม่รองรับการอ่าน Font ในเครื่อง ใช้รายการสำรอง' });
  pending = query.call(window).then(fonts => {
    const options = new Map<string, FontOption>(TEAM_NAME_FONT_OPTIONS.map(option => [option.value, option]));
    for (const font of fonts) {
      const family = font.family.trim();
      if (family && !options.has(family)) options.set(family, { value: family, label: `${family} (ในเครื่อง)` });
    }
    cached = {
      options: [...options.values()].sort((a, b) => a.label.localeCompare(b.label)),
      message: `พบ Font ในเครื่อง ${fonts.length} รายการ`,
    };
    return cached;
  }).finally(() => { pending = undefined; });
  return pending;
}

export function useLocalFontOptions(enabled: boolean) {
  const [result, setResult] = useState<FontResult>(() => cached ?? { options: TEAM_NAME_FONT_OPTIONS, message: '' });
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);
  const load = useCallback(async (force: boolean) => {
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const next = await readFonts(force);
      if (request === requestRef.current) setResult(next);
    } catch {
      if (request === requestRef.current) setResult(previous => ({ ...previous, message: 'ไม่ได้รับสิทธิ์อ่าน Font ในเครื่อง ใช้รายการเดิมหรือลองโหลดใหม่' }));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (enabled) void load(false);
    return () => { requestRef.current += 1; };
  }, [enabled, load]);
  const refresh = useCallback(() => { void load(true); }, [load]);
  return { fontOptions: result.options, localFontMessage: result.message, loading, refresh };
}
