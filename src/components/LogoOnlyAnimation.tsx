import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  isGoalScoredEvent,
  isLogoCropUpdatedEvent,
  isLogoSettingsUpdatedEvent,
  isScoreboardStateEvent,
  SCOREBOARD_EVENT_CHANNEL,
  SCOREBOARD_STATE_STORAGE_KEY,
  type ScoreboardStateEvent,
} from '../types/scoreboardEvent';
import {
  LOGO_SETTINGS_STORAGE_KEY,
  normalizeLogoBrowserSettings,
  type LogoBrowserSettings,
} from '../types/logoBrowserSettings';
import { requestScoreboardState } from '../hooks/useScoreboardChannels';
import { getLogoSrc, normalizeTeamKey } from '../utils/logoResolver';
import { getCropMetadataFromLocalStorage, type CropMetadata } from '../utils/logoCropMetadata';
import { getLogoPresentation } from '../utils/logoBrowserUrl';
import LogoWithCrop from './LogoWithCrop';
import type { GoalAnimationSide } from './goalAnimationTemplates';
import './LogoOnlyAnimation.css';

interface LogoOnlyAnimationProps {
  side: GoalAnimationSide;
  overrideSize?: number;
  overrideBackgroundMode?: 'transparent' | 'normal';
}

type LogoState = Pick<ScoreboardStateEvent, 'nameA' | 'nameB' | 'logoA' | 'logoB'>;

const DEFAULT_LOGO_STATE: LogoState = {
  nameA: 'Team A',
  nameB: 'Team B',
  logoA: '',
  logoB: '',
};

function logoStateFromEvent(event: ScoreboardStateEvent): LogoState {
  return {
    nameA: event.nameA,
    nameB: event.nameB,
    logoA: event.logoA,
    logoB: event.logoB,
  };
}

function readInitialLogoState(): LogoState {
  try {
    const savedState = localStorage.getItem(SCOREBOARD_STATE_STORAGE_KEY);
    if (!savedState) return DEFAULT_LOGO_STATE;
    const parsedState: unknown = JSON.parse(savedState);
    return isScoreboardStateEvent(parsedState) ? logoStateFromEvent(parsedState) : DEFAULT_LOGO_STATE;
  } catch {
    return DEFAULT_LOGO_STATE;
  }
}

const LOGO_GOAL_ANIMATION_DURATION_MS = 4000;

export default function LogoOnlyAnimation({ side, overrideSize, overrideBackgroundMode }: LogoOnlyAnimationProps) {
  const [searchParams] = useSearchParams();
  const [logoState, setLogoState] = useState<LogoState>(readInitialLogoState);
  const [goalTeam, setGoalTeam] = useState<'A' | 'B' | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const goalTimerRef = useRef<number | null>(null);
  const [cropMetadata, setCropMetadata] = useState<{ A: CropMetadata | null; B: CropMetadata | null }>({
    A: null,
    B: null,
  });
  const [liveSettings, setLiveSettings] = useState<LogoBrowserSettings | null>(() => {
    try {
      const saved = localStorage.getItem(LOGO_SETTINGS_STORAGE_KEY);
      return saved ? normalizeLogoBrowserSettings(JSON.parse(saved)) : null;
    } catch {
      return null;
    }
  });

  // Listen to live settings updates
  useEffect(() => {
    const updateSettings = () => {
      try {
        const saved = localStorage.getItem(LOGO_SETTINGS_STORAGE_KEY);
        if (saved) {
          setLiveSettings(normalizeLogoBrowserSettings(JSON.parse(saved)));
        }
      } catch { }
    };

    window.addEventListener('storage', updateSettings);
    window.addEventListener('logoSettingsUpdated', updateSettings);
    return () => {
      window.removeEventListener('storage', updateSettings);
      window.removeEventListener('logoSettingsUpdated', updateSettings);
    };
  }, []);

  // Load crop metadata from localStorage on mount & listen to live crop updates
  useEffect(() => {
    const loadCrops = () => {
      const teamAKey = normalizeTeamKey(logoState.nameA);
      const teamBKey = normalizeTeamKey(logoState.nameB);

      const cropA = getCropMetadataFromLocalStorage(teamAKey);
      const cropB = getCropMetadataFromLocalStorage(teamBKey);

      setCropMetadata({
        A: cropA?.crop || null,
        B: cropB?.crop || null,
      });
    };

    loadCrops();
    window.addEventListener('logoCropUpdated', loadCrops);
    return () => {
      window.removeEventListener('logoCropUpdated', loadCrops);
    };
  }, [logoState.nameA, logoState.nameB]);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (isGoalScoredEvent(event.data)) {
        if (goalTimerRef.current !== null) {
          window.clearTimeout(goalTimerRef.current);
        }
        setGoalTeam(event.data.team);
        setAnimationKey((k) => k + 1);
        goalTimerRef.current = window.setTimeout(() => {
          setGoalTeam(null);
          goalTimerRef.current = null;
        }, LOGO_GOAL_ANIMATION_DURATION_MS);
      } else if (isScoreboardStateEvent(event.data)) {
        setLogoState(logoStateFromEvent(event.data));
      } else if (isLogoSettingsUpdatedEvent(event.data)) {
        try {
          const saved = localStorage.getItem(LOGO_SETTINGS_STORAGE_KEY);
          if (saved) {
            setLiveSettings(normalizeLogoBrowserSettings(JSON.parse(saved)));
          }
        } catch { }
      } else if (isLogoCropUpdatedEvent(event.data)) {
        window.dispatchEvent(new Event('logoCropUpdated'));
      }
    };

    try {
      channel = new BroadcastChannel(SCOREBOARD_EVENT_CHANNEL);
      channel.addEventListener('message', handleMessage);
      requestScoreboardState();
    } catch (error) {
      console.error('[LogoOnlyAnimation] Failed to create BroadcastChannel:', error);
    }

    return () => {
      channel?.removeEventListener('message', handleMessage);
      channel?.close();
      if (goalTimerRef.current !== null) {
        window.clearTimeout(goalTimerRef.current);
        goalTimerRef.current = null;
      }
    };
  }, [side]);

  const displays = side === 'both'
    ? [
      { team: 'A' as const, name: logoState.nameA, logo: logoState.logoA },
      { team: 'B' as const, name: logoState.nameB, logo: logoState.logoB },
    ]
    : [
      {
        team: side,
        name: side === 'A' ? logoState.nameA : logoState.nameB,
        logo: side === 'A' ? logoState.logoA : logoState.logoB,
      },
    ];

  return (
    <div className="logo-only-animation-overlay" aria-label="Team logos display">
      {displays.map((display) => {
        const teamKey = normalizeTeamKey(display.name);
        const storedCropRecord = getCropMetadataFromLocalStorage(teamKey);
        const effectiveLogoUrl = storedCropRecord?.originalUrl || display.logo;
        const logoSrc = getLogoSrc(effectiveLogoUrl, display.name);
        if (!logoSrc) return null;

        const cropData = storedCropRecord?.crop || (display.team === 'A' ? cropMetadata.A : cropMetadata.B);
        const presentation = getLogoPresentation(searchParams, display.team);

        // Priority: override prop -> team customSize -> URL param -> liveSettings -> presentation fallback
        const teamCustomSize = cropData?.customSize;
        const hasUrlSizeParam = searchParams.has('size') || searchParams.has('sizeA') || searchParams.has('sizeB');
        const fallbackSize = liveSettings ? (display.team === 'A' ? liveSettings.sizeA : liveSettings.sizeB) : presentation.size;
        const sizePx = overrideSize
          ?? (teamCustomSize && teamCustomSize > 0 ? teamCustomSize : null)
          ?? (hasUrlSizeParam ? presentation.size : null)
          ?? fallbackSize;
        const bgMode = overrideBackgroundMode ?? (searchParams.has('background') ? presentation.backgroundMode : (liveSettings?.backgroundMode || presentation.backgroundMode));

        const containerStyle: React.CSSProperties = {
          width: `${sizePx}px`,
          height: `${sizePx}px`,
          maxWidth: 'none',
          maxHeight: 'none',
          backgroundColor: bgMode === 'normal' ? 'rgba(0, 0, 0, 0.75)' : 'transparent',
          borderRadius: bgMode === 'normal' ? '12px' : '0',
          padding: bgMode === 'normal' ? '8px' : '0',
          boxSizing: 'border-box',
        };

        const isGoal = goalTeam === display.team;
        const isOpponent = goalTeam !== null && goalTeam !== display.team;

        let animationClass = '';
        if (isGoal) {
          animationClass = ' logo-only-instance--goal';
        } else if (isOpponent) {
          animationClass = ' logo-only-instance--opponent-fade';
        }

        return (
          <div
            key={`${display.team}-${display.name}-${display.logo}-${goalTeam ? animationKey : 'idle'}`}
            className={`logo-only-instance logo-only-instance--${display.team.toLowerCase()}${animationClass}`}
            style={containerStyle}
          >
            {cropData ? (
              <LogoWithCrop
                url={logoSrc}
                crop={cropData}
                alt={`${display.name} logo`}
                onError={() => {
                  console.error(`[LogoOnlyAnimation] Failed to render cropped logo for ${display.name}`);
                }}
              />
            ) : (
              <img
                src={logoSrc}
                alt=""
                decoding="async"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}


