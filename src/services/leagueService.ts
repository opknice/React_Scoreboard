import { supabase, isSupabaseConfigured, type League, type Team, type Match } from '../config/supabaseClient';
import { retryWithBackoff } from '../utils/retry';

const LEAGUE_COLUMNS = 'id, name, slug, season, description, is_active, created_by, settings, created_at, updated_at';
const TEAM_COLUMNS = 'id, league_id, name, short_name, logo_url, color_primary, color_secondary, crop_metadata, created_at, updated_at';
const MATCH_COLUMNS = 'id, league_id, match_number, team_a_id, team_b_id, team_a_name, team_b_name, score_a, score_b, status, label1, label2, label3, match_date, created_at, updated_at';

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
    await executeSupabaseRequest(() => supabase!
      .from('teams')
      .delete()
      .eq('id', id)
      .eq('league_id', expectedLeagueId));
  }

  /**
   * Uploads a logo file or blob to Supabase Storage 'team-logos' bucket
   */
  static async uploadTeamLogo(file: File | Blob, fileName: string): Promise<string> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }

    // Extract and validate file extension
    const dotIndex = fileName.lastIndexOf('.');
    let ext = dotIndex !== -1 ? fileName.slice(dotIndex).toLowerCase() : '';
    if (!ext || ext.length > 6 || !/^\.[a-z0-9]+$/i.test(ext)) {
      if (file.type === 'image/jpeg') ext = '.jpg';
      else if (file.type === 'image/webp') ext = '.webp';
      else if (file.type === 'image/svg+xml') ext = '.svg';
      else if (file.type === 'image/gif') ext = '.gif';
      else ext = '.png';
    }

    // Clean ASCII-only base name (Supabase/S3 requires safe ASCII keys; non-ASCII/Thai letters cause 'Invalid key' error)
    const baseName = dotIndex !== -1 ? fileName.slice(0, dotIndex) : fileName;
    const cleanAsciiBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);

    const randomSuffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).substring(2, 10);

    const timestamp = Date.now();
    const finalFileName = cleanAsciiBase
      ? `${cleanAsciiBase}_${timestamp}_${randomSuffix}${ext}`
      : `logo_${timestamp}_${randomSuffix}${ext}`;

    const filePath = `logos/${finalFileName}`;

    await executeSupabaseRequest(() => supabase!.storage
      .from('team-logos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'image/png',
      }));

    const { data } = supabase.storage
      .from('team-logos')
      .getPublicUrl(filePath);

    return data.publicUrl;
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
    const data = await executeSupabaseRequest(() => supabase!
      .from('matches')
      .insert([{
        ...payload,
        label1: payload.label1 || '',
        label2: payload.label2 || '',
        label3: payload.label3 || '',
        updated_at: new Date().toISOString(),
      }])
      .select(MATCH_COLUMNS)
      .single());

    return data as Match;
  }

  static async updateMatch(id: string, updates: Partial<Match>, expectedLeagueId: string): Promise<Match> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    if (updates.league_id !== undefined && updates.league_id !== expectedLeagueId) {
      throw new Error('Match league_id does not match the active league.');
    }
    const cleanUpdates: Partial<Match> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    if (updates.label1 !== undefined) cleanUpdates.label1 = updates.label1 || '';
    if (updates.label2 !== undefined) cleanUpdates.label2 = updates.label2 || '';
    if (updates.label3 !== undefined) cleanUpdates.label3 = updates.label3 || '';

    const data = await executeSupabaseRequest(() => supabase!
      .from('matches')
      .update(cleanUpdates)
      .eq('id', id)
      .eq('league_id', expectedLeagueId)
      .select(MATCH_COLUMNS)
      .single());

    return data as unknown as Match;
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
    const stats: Record<string, StandingsRow> = {};

    // Initialize stats for all registered teams
    teams.forEach((team) => {
      stats[team.name] = {
        teamId: team.id,
        teamName: team.name,
        logoUrl: team.logo_url || '',
        P: 0,
        W: 0,
        D: 0,
        L: 0,
        GF: 0,
        GA: 0,
        GD: 0,
        Pts: 0,
      };
    });

    // Process finished matches (or matches with score recorded)
    matches.forEach((m) => {
      const teamA = (m.team_a_name || '').trim();
      const teamB = (m.team_b_name || '').trim();
      if (!teamA || !teamB) return;

      // Only count matches that are finished or in progress with valid score
      if (m.status === 'scheduled' && m.score_a === 0 && m.score_b === 0) {
        return;
      }

      if (!stats[teamA]) {
        stats[teamA] = {
          teamId: m.team_a_id || undefined,
          teamName: teamA,
          logoUrl: '',
          P: 0,
          W: 0,
          D: 0,
          L: 0,
          GF: 0,
          GA: 0,
          GD: 0,
          Pts: 0,
        };
      }

      if (!stats[teamB]) {
        stats[teamB] = {
          teamId: m.team_b_id || undefined,
          teamName: teamB,
          logoUrl: '',
          P: 0,
          W: 0,
          D: 0,
          L: 0,
          GF: 0,
          GA: 0,
          GD: 0,
          Pts: 0,
        };
      }

      const a = stats[teamA];
      const b = stats[teamB];
      const sA = m.score_a || 0;
      const sB = m.score_b || 0;

      a.P += 1;
      b.P += 1;
      a.GF += sA;
      a.GA += sB;
      b.GF += sB;
      b.GA += sA;

      if (sA > sB) {
        a.W += 1;
        a.Pts += 3;
        b.L += 1;
      } else if (sA < sB) {
        b.W += 1;
        b.Pts += 3;
        a.L += 1;
      } else {
        a.D += 1;
        b.D += 1;
        a.Pts += 1;
        b.Pts += 1;
      }
    });

    return Object.values(stats)
      .map((row) => ({ ...row, GD: row.GF - row.GA }))
      .sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || a.teamName.localeCompare(b.teamName, 'th'));
  }
}
