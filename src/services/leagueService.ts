import { supabase, isSupabaseConfigured, type League, type Team, type Match, type Player, type PlayerMatchStat } from '../config/supabaseClient';
import { retryWithBackoff } from '../utils/retry';
import { calculateFinishedStandings } from '../utils/standingsCalculator';
import { parseMatchScore } from '../utils/matchScore';
import { LogoStorageService } from './logoStorageService';
import { deletePlayerImage } from './playerImageStorageService';
import type { LogoStorageProvider } from '../types/logoStorage';

const LEAGUE_COLUMNS = 'id, name, slug, season, description, is_active, created_by, settings, created_at, updated_at';
const TEAM_COLUMNS = 'id, league_id, name, short_name, logo_url, color_primary, color_secondary, overlay_crop_metadata, logo_browser_crop_metadata, created_at, updated_at';
const MATCH_COLUMNS = 'id, league_id, match_number, team_a_id, team_b_id, team_a_name, team_b_name, score_a, score_b, status, label1, label2, label3, match_date, created_at, updated_at';
const PLAYER_COLUMNS = 'id, league_id, team_id, jersey_number, name, position, image_url, image_public_id, created_at, updated_at';
const PLAYER_STAT_COLUMNS = 'id, league_id, match_id, player_id, team_id, goals, created_at, updated_at';

interface SupabaseRequestResult<T> {
  data: T;
  error: unknown | null;
}

async function executeSupabaseRequest<T>(
  operation: () => PromiseLike<SupabaseRequestResult<T>>,
): Promise<T> {
  const result = await retryWithBackoff(operation);
  if (result.error) throw result.error;
  return result.data;
}

function storagePathFromPublicUrl(imageUrl: string): string | null {
  const marker = '/storage/v1/object/public/team-logos/';
  const index = imageUrl.indexOf(marker);
  if (index < 0) return null;
  return decodeURIComponent(imageUrl.slice(index + marker.length));
}

const MATCH_STATUSES = new Set(['scheduled', 'in_progress', 'finished', 'postponed']);
const MATCH_MUTABLE_FIELDS = [
  'match_number',
  'team_a_id',
  'team_b_id',
  'team_a_name',
  'team_b_name',
  'score_a',
  'score_b',
  'status',
  'label1',
  'label2',
  'label3',
  'match_date',
] as const satisfies readonly (keyof Match)[];

type MutableMatchField = typeof MATCH_MUTABLE_FIELDS[number];

function validateMatchValues(values: Partial<Match>): void {
  if (values.match_number !== undefined && (!Number.isInteger(values.match_number) || values.match_number <= 0)) {
    throw new Error('หมายเลขแมตช์ต้องเป็นจำนวนเต็มมากกว่า 0');
  }
  if (values.score_a !== undefined && parseMatchScore(values.score_a) === null) {
    throw new Error('สกอร์ทีม A ไม่ถูกต้อง');
  }
  if (values.score_b !== undefined && parseMatchScore(values.score_b) === null) {
    throw new Error('สกอร์ทีม B ไม่ถูกต้อง');
  }
  if (values.status !== undefined && !MATCH_STATUSES.has(values.status)) {
    throw new Error('สถานะแมตช์ไม่ถูกต้อง');
  }
  if (values.team_a_id && values.team_b_id && values.team_a_id === values.team_b_id) {
    throw new Error('ทีม A และทีม B ต้องไม่เป็นทีมเดียวกัน');
  }
  if (values.team_a_name !== undefined && !values.team_a_name.trim()) {
    throw new Error('ชื่อทีม A ห้ามว่าง');
  }
  if (values.team_b_name !== undefined && !values.team_b_name.trim()) {
    throw new Error('ชื่อทีม B ห้ามว่าง');
  }
}

function sanitizeMatchUpdates(updates: Partial<Match>): Partial<Match> {
  const clean: Partial<Match> = {};
  MATCH_MUTABLE_FIELDS.forEach((field) => {
    const value = updates[field];
    if (value !== undefined) {
      (clean as Record<MutableMatchField, Match[MutableMatchField] | undefined>)[field] = value;
    }
  });
  if (clean.team_a_name !== undefined) clean.team_a_name = clean.team_a_name.trim();
  if (clean.team_b_name !== undefined) clean.team_b_name = clean.team_b_name.trim();
  if (clean.label1 !== undefined) clean.label1 = clean.label1 || '';
  if (clean.label2 !== undefined) clean.label2 = clean.label2 || '';
  if (clean.label3 !== undefined) clean.label3 = clean.label3 || '';
  validateMatchValues(clean);
  return clean;
}

function isNoRowsError(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'PGRST116';
}

function matchContainsUpdates(match: Match, updates: Partial<Match>): boolean {
  return MATCH_MUTABLE_FIELDS.every((field) => (
    updates[field] === undefined || Object.is(match[field], updates[field])
  ));
}

export interface StandingsRow {
  teamId?: string;
  teamName: string;
  logoUrl?: string;
  P: number;
  W: number;
  D: number;
  L: number;
  GF: number;
  GA: number;
  GD: number;
  Pts: number;
}

export class LeagueService {
  // ==========================================
  // LEAGUES CRUD
  // ==========================================

  static async getLeagues(userEmail?: string): Promise<League[]> {
    if (!isSupabaseConfigured() || !supabase) return [];
    
    // Strict creator isolation: If no user email is provided, return empty array
    if (!userEmail || !userEmail.trim()) {
      return [];
    }

    const cleanEmail = userEmail.trim().toLowerCase();
    const data = await executeSupabaseRequest(() => supabase!
      .from('leagues')
      .select(LEAGUE_COLUMNS)
      .eq('created_by', cleanEmail)
      .order('created_at', { ascending: false }));

    return (data as unknown as League[]) || [];
  }

  static async getLeagueById(id: string): Promise<League | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    const data = await executeSupabaseRequest(() => supabase!
      .from('leagues')
      .select(LEAGUE_COLUMNS)
      .eq('id', id)
      .single());

    return (data as unknown as League);
  }

  static async createLeague(payload: Omit<League, 'id' | 'created_at' | 'updated_at'>): Promise<League> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    const cleanCreatedBy = payload.created_by ? payload.created_by.trim().toLowerCase() : null;
    const data = await executeSupabaseRequest(() => supabase!
      .from('leagues')
      .insert([{
        ...payload,
        created_by: cleanCreatedBy,
        updated_at: new Date().toISOString()
      }])
      .select(LEAGUE_COLUMNS)
      .single());

    return (data as unknown as League);
  }

  static async updateLeague(id: string, updates: Partial<League>): Promise<League> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    const data = await executeSupabaseRequest(() => supabase!
      .from('leagues')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(LEAGUE_COLUMNS)
      .single());

    return (data as unknown as League);
  }

  static async deleteLeague(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    const teams = await this.getTeamsByLeague(id);
    await Promise.all(teams.map((team) => this.deletePlayerImagesByTeam(team.id, id)));
    await executeSupabaseRequest(() => supabase!
      .from('leagues')
      .delete()
      .eq('id', id));
  }

  // ==========================================
  // TEAMS CRUD
  // ==========================================

  static async getTeamsByLeague(leagueId: string): Promise<Team[]> {
    if (!isSupabaseConfigured() || !supabase || !leagueId) return [];
    const data = await executeSupabaseRequest(() => supabase!
      .from('teams')
      .select(TEAM_COLUMNS)
      .eq('league_id', leagueId)
      .order('name', { ascending: true }));

    return (data as unknown as Team[]) || [];
  }

  static async createTeam(payload: Omit<Team, 'id' | 'created_at' | 'updated_at'>): Promise<Team> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    const data = await executeSupabaseRequest(() => supabase!
      .from('teams')
      .insert([{ ...payload, updated_at: new Date().toISOString() }])
      .select(TEAM_COLUMNS)
      .single());

    return (data as unknown as Team);
  }

  static async updateTeam(id: string, updates: Partial<Team>, expectedLeagueId: string): Promise<Team> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    if (updates.league_id !== undefined && updates.league_id !== expectedLeagueId) {
      throw new Error('Team league_id does not match the active league.');
    }
    const data = await executeSupabaseRequest(() => supabase!
      .from('teams')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('league_id', expectedLeagueId)
      .select(TEAM_COLUMNS)
      .single());

    return (data as unknown as Team);
  }

  static async deleteTeam(id: string, expectedLeagueId: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    await this.deletePlayerImagesByTeam(id, expectedLeagueId);
    await executeSupabaseRequest(() => supabase!
      .from('teams')
      .delete()
      .eq('id', id)
      .eq('league_id', expectedLeagueId));
  }

  /** Uploads a logo using the storage provider selected by the user. */
  static async uploadTeamLogo(
    file: File | Blob,
    fileName: string,
    provider: LogoStorageProvider = 'supabase',
  ): Promise<string> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    return LogoStorageService.upload(file, fileName, provider);
  }

  // ==========================================
  // PLAYERS & PER-MATCH GOAL STATISTICS
  // ==========================================

  static async getPlayersByTeam(teamId: string, leagueId: string): Promise<Player[]> {
    if (!isSupabaseConfigured() || !supabase || !teamId || !leagueId) return [];
    const data = await executeSupabaseRequest(() => supabase!
      .from('players')
      .select(PLAYER_COLUMNS)
      .eq('team_id', teamId)
      .eq('league_id', leagueId)
      .order('jersey_number', { ascending: true }));
    return (data as unknown as Player[]) || [];
  }

  static async createPlayer(payload: Omit<Player, 'id' | 'created_at' | 'updated_at'>): Promise<Player> {
    if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase is not configured.');
    const data = await executeSupabaseRequest(() => supabase!
      .from('players')
      .insert([{ ...payload, name: payload.name.trim(), updated_at: new Date().toISOString() }])
      .select(PLAYER_COLUMNS)
      .single());
    return data as unknown as Player;
  }

  static async updatePlayer(id: string, updates: Partial<Player>, expectedTeamId: string, expectedLeagueId: string): Promise<Player> {
    if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase is not configured.');
    if (updates.team_id !== undefined && updates.team_id !== expectedTeamId) throw new Error('ไม่สามารถย้ายนักเตะไปทีมอื่นได้');
    if (updates.league_id !== undefined && updates.league_id !== expectedLeagueId) throw new Error('ไม่สามารถแก้ไขนักเตะข้ามลีกได้');
    const previous = await executeSupabaseRequest(() => supabase!
      .from('players')
      .select('image_public_id')
      .eq('id', id)
      .eq('team_id', expectedTeamId)
      .eq('league_id', expectedLeagueId)
      .maybeSingle());
    const previousPublicId = (previous as { image_public_id?: string | null } | null)?.image_public_id;
    const data = await executeSupabaseRequest(() => supabase!
      .from('players')
      .update({ ...updates, name: updates.name?.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('team_id', expectedTeamId)
      .eq('league_id', expectedLeagueId)
      .select(PLAYER_COLUMNS)
      .single());
    const updated = data as unknown as Player;
    if (previousPublicId && previousPublicId !== updated.image_public_id) {
      try {
        await deletePlayerImage(previousPublicId);
      } catch (cleanupError: unknown) {
        console.error('[LeagueService] Failed to delete replaced player image:', cleanupError);
      }
    }
    return updated;
  }

  static async deletePlayer(id: string, expectedTeamId: string, expectedLeagueId: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase is not configured.');
    const player = await executeSupabaseRequest(() => supabase!
      .from('players').select('image_url, image_public_id').eq('id', id).eq('team_id', expectedTeamId).eq('league_id', expectedLeagueId).maybeSingle());
    const playerRecord = player as { image_url?: string | null; image_public_id?: string | null } | null;
    await deletePlayerImage(playerRecord?.image_public_id);
    await this.deleteStorageImage(playerRecord?.image_url);
    await executeSupabaseRequest(() => supabase!
      .from('players').delete().eq('id', id).eq('team_id', expectedTeamId).eq('league_id', expectedLeagueId));
  }

  private static async deleteStorageImage(imageUrl?: string | null): Promise<void> {
    if (!imageUrl || !supabase) return;
    const path = storagePathFromPublicUrl(imageUrl);
    if (!path) return;
    await supabase.storage.from('team-logos').remove([path]);
  }

  private static async deletePlayerImagesByTeam(teamId: string, leagueId: string): Promise<void> {
    if (!supabase) return;
    const data = await executeSupabaseRequest(() => supabase!
      .from('players').select('image_url, image_public_id').eq('team_id', teamId).eq('league_id', leagueId));
    const records = (data as Array<{ image_url?: string | null; image_public_id?: string | null }>) || [];
    await Promise.all(records.map((row) => deletePlayerImage(row.image_public_id)));
    const paths = records
      .map((row) => row.image_url ? storagePathFromPublicUrl(row.image_url) : null)
      .filter((path): path is string => Boolean(path));
    if (paths.length > 0) await supabase.storage.from('team-logos').remove(paths);
  }

  static async getPlayerMatchStats(teamId: string, leagueId: string): Promise<PlayerMatchStat[]> {
    if (!isSupabaseConfigured() || !supabase || !teamId || !leagueId) return [];
    const data = await executeSupabaseRequest(() => supabase!
      .from('player_match_stats').select(PLAYER_STAT_COLUMNS)
      .eq('team_id', teamId).eq('league_id', leagueId));
    return (data as unknown as PlayerMatchStat[]) || [];
  }

  static async upsertPlayerMatchStat(payload: Omit<PlayerMatchStat, 'id' | 'created_at' | 'updated_at'>): Promise<PlayerMatchStat> {
    if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase is not configured.');
    const data = await executeSupabaseRequest(() => supabase!
      .from('player_match_stats')
      .upsert([{ ...payload, updated_at: new Date().toISOString() }], { onConflict: 'match_id,player_id' })
      .select(PLAYER_STAT_COLUMNS).single());
    return data as unknown as PlayerMatchStat;
  }

  static async deletePlayerMatchStat(id: string, leagueId: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase is not configured.');
    await executeSupabaseRequest(() => supabase!.from('player_match_stats').delete().eq('id', id).eq('league_id', leagueId));
  }

  // ==========================================
  // MATCHES CRUD
  // ==========================================

  static async getMatchesByLeague(leagueId: string): Promise<Match[]> {
    if (!isSupabaseConfigured() || !supabase || !leagueId) return [];
    const data = await executeSupabaseRequest(() => supabase!
      .from('matches')
      .select(MATCH_COLUMNS)
      .eq('league_id', leagueId)
      .order('match_number', { ascending: true }));

    return (data as Match[]) || [];
  }

  static async createMatch(payload: Omit<Match, 'id' | 'created_at' | 'updated_at'>): Promise<Match> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    validateMatchValues(payload);
    const data = await executeSupabaseRequest(() => supabase!
      .from('matches')
      .insert([{
        league_id: payload.league_id,
        match_number: payload.match_number,
        team_a_id: payload.team_a_id,
        team_b_id: payload.team_b_id,
        team_a_name: payload.team_a_name.trim(),
        team_b_name: payload.team_b_name.trim(),
        score_a: payload.score_a,
        score_b: payload.score_b,
        status: payload.status,
        label1: payload.label1 || '',
        label2: payload.label2 || '',
        label3: payload.label3 || '',
        match_date: payload.match_date,
        updated_at: new Date().toISOString(),
      }])
      .select(MATCH_COLUMNS)
      .single());

    return data as Match;
  }

  static async updateMatch(
    id: string,
    updates: Partial<Match>,
    expectedLeagueId: string,
    expectedUpdatedAt: string,
  ): Promise<Match> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    if (updates.league_id !== undefined && updates.league_id !== expectedLeagueId) {
      throw new Error('Match league_id does not match the active league.');
    }
    if (!expectedUpdatedAt.trim()) {
      throw new Error('ไม่พบเวอร์ชันข้อมูลแมตช์ กรุณารีเฟรชข้อมูลก่อนบันทึก');
    }
    const cleanUpdates: Partial<Match> = {
      ...sanitizeMatchUpdates(updates),
      updated_at: new Date().toISOString(),
    };

    try {
      const data = await executeSupabaseRequest(() => {
        let query = supabase!
          .from('matches')
          .update(cleanUpdates)
          .eq('id', id)
          .eq('league_id', expectedLeagueId);
        query = query.eq('updated_at', expectedUpdatedAt);
        return query.select(MATCH_COLUMNS).single();
      });
      return data as unknown as Match;
    } catch (error: unknown) {
      if (isNoRowsError(error)) {
        // A transient network failure may occur after PostgreSQL committed the
        // first attempt. Re-read once so an already-applied idempotent result
        // is reported as success, while a genuinely newer/different edit is
        // still rejected as a conflict.
        try {
          const currentData = await executeSupabaseRequest(() => supabase!
            .from('matches')
            .select(MATCH_COLUMNS)
            .eq('id', id)
            .eq('league_id', expectedLeagueId)
            .maybeSingle());
          const current = currentData as unknown as Match | null;
          if (current && matchContainsUpdates(current, cleanUpdates)) return current;
        } catch {
          // Keep the deterministic conflict error below if reconciliation fails.
        }
        throw new Error('ข้อมูลแมตช์ถูกแก้ไขจากหน้าจออื่น กรุณารีเฟรชข้อมูลก่อนบันทึกอีกครั้ง');
      }
      throw error;
    }
  }

  static async deleteMatch(id: string, expectedLeagueId: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    await executeSupabaseRequest(() => supabase!
      .from('matches')
      .delete()
      .eq('id', id)
      .eq('league_id', expectedLeagueId));
  }

  static async deleteMatchesByLeague(leagueId: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !leagueId) return;
    await executeSupabaseRequest(() => supabase!
      .from('matches')
      .delete()
      .eq('league_id', leagueId));
  }

  // ==========================================
  // STANDINGS COMPUTATION
  // ==========================================

  static calculateStandings(matches: Match[], teams: Team[] = []): StandingsRow[] {
    return calculateFinishedStandings(
      matches.map((match) => ({
        id: match.id,
        teamIdA: match.team_a_id,
        teamIdB: match.team_b_id,
        teamA: match.team_a_name,
        teamB: match.team_b_name,
        scoreA: match.score_a,
        scoreB: match.score_b,
        status: match.status,
      })),
      teams.map((team) => ({
        id: team.id,
        name: team.name,
        logo: team.logo_url,
      })),
    ).map((row) => ({
      teamId: row.teamId || undefined,
      teamName: row.team,
      logoUrl: row.logo,
      P: row.P,
      W: row.W,
      D: row.D,
      L: row.L,
      GF: row.GF,
      GA: row.GA,
      GD: row.GD,
      Pts: row.Pts,
    }));
  }
}
