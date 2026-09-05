import type { MatchStatusRecord } from '../utils/finishedMatch';
import type { CropMetadata } from './teamLogo';

export interface OverlayMatch extends MatchStatusRecord {
  id: string;
  teamIdA?: string | null;
  teamIdB?: string | null;
  teamA: string;
  teamB: string;
  scoreA: number | string;
  scoreB: number | string;
  logoA?: string | null;
  logoB?: string | null;
  cropA?: CropMetadata | null;
  cropB?: CropMetadata | null;
  date?: string | null;
  round?: string | null;
  week?: string | null;
  matchday?: string | null;
  roundLabel?: string | null;
}

export interface OverlayTeam {
  id?: string | null;
  name: string;
  logo?: string | null;
  crop?: CropMetadata | null;
}
