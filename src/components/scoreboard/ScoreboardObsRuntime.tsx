import { memo } from 'react';
import type { TimerStore } from '../../hooks/useTimer';
import type { OBSWebSocketApi } from '../../hooks/useOBSWebSocket';
import { useScoreboardObsConnection } from '../../hooks/useScoreboardObsConnection';
import { useScoreboardObsSync } from '../../hooks/useScoreboardObsSync';
import { useAutoObsSourceSync } from '../../hooks/useAutoObsSourceSync';
import { useLeagueDetailLabelsObsSync } from '../../hooks/useLeagueDetailLabelsObsSync';
import { useScoreboardStateResponder } from '../../hooks/useScoreboardChannels';
import ScoreboardTimerObsSync from './ScoreboardTimerObsSync';
import type { TeamNameBrowserSettings } from '../../types/teamNameBrowserSettings';
import type { LogoBrowserSettings } from '../../types/logoBrowserSettings';
import type { ScoreBrowserSettings } from '../../types/scoreBrowserSettings';
import type { LeagueDetailLabels } from '../../types/leagueDetailLabels';
import type { ScoreboardStatePayload } from '../../types/scoreboardEvent';

interface ScoreboardObsRuntimeProps {
  obs: OBSWebSocketApi;
  timer: TimerStore;
  scoreA: number;
  scoreB: number;
  activeLeagueId: string;
  labels: LeagueDetailLabels;
  teamNameSettings: TeamNameBrowserSettings;
  logoSettings: LogoBrowserSettings;
  scoreSettings: ScoreBrowserSettings;
  scoreboardStatePayload: ScoreboardStatePayload;
  onConnected: () => void;
  onError: () => void;
}

/** Owns OBS effects so connection/synchronization work has its own render boundary. */
function ScoreboardObsRuntime({
  obs,
  timer,
  scoreA,
  scoreB,
  activeLeagueId,
  labels,
  teamNameSettings,
  logoSettings,
  scoreSettings,
  scoreboardStatePayload,
  onConnected,
  onError,
}: ScoreboardObsRuntimeProps) {
  useScoreboardObsConnection({
    obs,
    initialConnectDelayMs: 250,
    onConnected,
    onError,
  });

  useScoreboardObsSync({ obs, scoreA, scoreB });
  useLeagueDetailLabelsObsSync({ obs, activeLeagueId, labels });
  useAutoObsSourceSync({
    obs,
    teamNameSettings,
    logoSettings,
    scoreSettings,
    activeLeagueId,
  });
  useScoreboardStateResponder(scoreboardStatePayload);

  return <ScoreboardTimerObsSync obs={obs} timer={timer} />;
}

ScoreboardObsRuntime.displayName = 'ScoreboardObsRuntime';

export default memo(ScoreboardObsRuntime);
