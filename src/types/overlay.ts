import type { MatchStatusRecord } from '../utils/finishedMatch';

export interface OverlayMatch extends MatchStatusRecord {
  id: string;
  teamA: string;
  teamB: string;
  scoreA: number | string;
  scoreB: number | string;
  logoA?: string | null;
  logoB?: string | null;
  date?: string | null;
  round?: string | null;
  week?: string | null;
  matchday?: string | null;
  roundLabel?: string | null;
}

export interface OverlayTeam {
  id?: string;
  name: string;
  logo?: string | null;
}
