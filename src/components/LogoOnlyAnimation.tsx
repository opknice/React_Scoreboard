import { useEffect, useState } from 'react';
import {
  isScoreboardStateEvent,
  SCOREBOARD_EVENT_CHANNEL,
  SCOREBOARD_STATE_STORAGE_KEY,
  type ScoreboardStateEvent,
} from '../types/scoreboardEvent';
import { requestScoreboardState } from '../hooks/useScoreboardChannels';
import { getLogoSrc } from '../utils/logoResolver';
import { getCropMetadataFromLocalStorage, type CropMetadata } from '../utils/logoCropMetadata';
import LogoWithCrop from './LogoWithCrop';
import type { GoalAnimationSide } from './goalAnimationTemplates';
import './LogoOnlyAnimation.css';

interface LogoOnlyAnimationProps {
  side: GoalAnimationSide;
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

export default function LogoOnlyAnimation({ side }: LogoOnlyAnimationProps) {
  const [logoState, setLogoState] = useState<LogoState>(readInitialLogoState);
  const [cropMetadata, setCropMetadata] = useState<{ A: CropMetadata | null; B: CropMetadata | null }>({
    A: null,
    B: null,
  });

  // Load crop metadata from localStorage on mount
  useEffect(() => {
    const teamAKey = logoState.nameA.trim().toLowerCase();
    const teamBKey = logoState.nameB.trim().toLowerCase();
    
    const cropA = getCropMetadataFromLocalStorage(teamAKey);
    const cropB = getCropMetadataFromLocalStorage(teamBKey);

    setCropMetadata({
      A: cropA?.crop || null,
      B: cropB?.crop || null,
    });
  }, [logoState.nameA, logoState.nameB]);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (isScoreboardStateEvent(event.data)) {
        setLogoState(logoStateFromEvent(event.data));
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

        const cropData = display.team === 'A' ? cropMetadata.A : cropMetadata.B;

        return (
          <div key={`${display.team}-${display.name}-${display.logo}`} className={`logo-only-instance logo-only-instance--${display.team.toLowerCase()}`}>
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
