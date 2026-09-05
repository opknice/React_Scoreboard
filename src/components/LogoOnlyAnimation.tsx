import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  isGoalScoredEvent,
  isLogoSettingsUpdatedEvent,
  isScoreboardStateEvent,
  SCOREBOARD_EVENT_CHANNEL,
  SCOREBOARD_STATE_STORAGE_KEY,
  type ScoreboardStateEvent,
} from '../types/scoreboardEvent';
import { parseCropMetadata } from '../types/teamLogo';
import { useCropPreviewOverrides } from '../hooks/useLogoCropPreviewSync';
import { useLeagueLogoSizingForObs } from '../hooks/useLeagueLogoSizingForObs';
import {
  DEFAULT_LEAGUE_LOGO_SIZING,
  getEffectiveLogoScalePercent,
  scaleLogoPixels,
} from '../types/leagueLogoSizing';
import {
  LOGO_DEFAULT_SIZE,
  LOGO_SETTINGS_STORAGE_KEY,
  normalizeLogoBrowserSettings,
  type LogoBrowserSettings,
} from '../types/logoBrowserSettings';
import { requestScoreboardState } from '../hooks/useScoreboardChannels';
import { getLogoSrc } from '../utils/logoResolver';
import { getLogoPresentation } from '../utils/logoBrowserUrl';
import LogoWithCrop from './LogoWithCrop';
import type { GoalAnimationSide } from './goalAnimationTemplates';
import './LogoOnlyAnimation.css';

interface LogoOnlyAnimationProps {
  side: GoalAnimationSide;
  overrideBackgroundMode?: 'transparent' | 'normal';
}

type LogoState = Pick<ScoreboardStateEvent, 'nameA' | 'nameB' | 'logoA' | 'logoB' | 'teamIdA' | 'teamIdB' | 'logoBrowserCropA' | 'logoBrowserCropB' | 'leagueId' | 'leagueLogoSizing'>;

const DEFAULT_LOGO_STATE: LogoState = {
  nameA: 'Team A',
  nameB: 'Team B',
  logoA: '',
  logoB: '',
  teamIdA: null,
  teamIdB: null,
  logoBrowserCropA: null,
  logoBrowserCropB: null,
  leagueId: null,
  leagueLogoSizing: DEFAULT_LEAGUE_LOGO_SIZING,
};

function logoStateFromEvent(event: ScoreboardStateEvent): LogoState {
  return {
    nameA: event.nameA,
    nameB: event.nameB,
    logoA: event.logoA,
    logoB: event.logoB,
    teamIdA: event.teamIdA ?? null,
    teamIdB: event.teamIdB ?? null,
    logoBrowserCropA: parseCropMetadata(event.logoBrowserCropA),
    logoBrowserCropB: parseCropMetadata(event.logoBrowserCropB),
    leagueId: event.leagueId ?? null,
    leagueLogoSizing: event.leagueLogoSizing ?? DEFAULT_LEAGUE_LOGO_SIZING,
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

export default function LogoOnlyAnimation({ side, overrideBackgroundMode }: LogoOnlyAnimationProps) {
  const [searchParams] = useSearchParams();
  const [logoState, setLogoState] = useState<LogoState>(readInitialLogoState);
  const [goalTeam, setGoalTeam] = useState<'A' | 'B' | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const goalTimerRef = useRef<number | null>(null);
  const syncSessionId = searchParams.get('sync') || 'default';
  const sourceLeagueId = searchParams.get('league') || logoState.leagueId;

  const { resolveCrop } = useCropPreviewOverrides({
    sessionId: syncSessionId,
    context: 'logo-browser',
  });
  const leagueLogoSizing = useLeagueLogoSizingForObs({
    leagueId: sourceLeagueId,
    sessionId: syncSessionId,
    initialSizing: logoState.leagueLogoSizing,
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
        const logoSrc = getLogoSrc(display.logo, display.name);
        if (!logoSrc) return null;

        const persistedCrop = display.team === 'A' ? logoState.logoBrowserCropA : logoState.logoBrowserCropB;
        const teamId = display.team === 'A' ? logoState.teamIdA : logoState.teamIdB;
        const cropData = resolveCrop(teamId, display.name, persistedCrop);
        const presentation = getLogoPresentation(searchParams, display.team);

        const scalePercent = getEffectiveLogoScalePercent(
          cropData,
          leagueLogoSizing.logoBrowserScalePercent,
        );
        const sizePx = scaleLogoPixels(LOGO_DEFAULT_SIZE, scalePercent);
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
            key={`${display.team}-${display.name}-${display.logo}`}
            className={`logo-only-instance logo-only-instance--${display.team.toLowerCase()}`}
            style={containerStyle}
          >
            <div
              key={`anim-${goalTeam ? animationKey : 'idle'}`}
              className={`logo-only-inner-anim${animationClass}`}
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
          </div>
        );
      })}
    </div>
  );
}
