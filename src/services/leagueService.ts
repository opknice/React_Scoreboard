import { supabase, isSupabaseConfigured, type League, type Team, type Match } from '../config/supabaseClient';

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
    const { data, error } = await supabase
      .from('leagues')
      .select('*')
      .eq('created_by', cleanEmail)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leagues:', error);
      throw error;
    }
    return data || [];
  }

  static async getLeagueById(id: string): Promise<League | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    const { data, error } = await supabase
      .from('leagues')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Error fetching league ${id}:`, error);
      return null;
    }
    return data;
  }

  static async createLeague(payload: Omit<League, 'id' | 'created_at' | 'updated_at'>): Promise<League> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    const cleanCreatedBy = payload.created_by ? payload.created_by.trim().toLowerCase() : null;
    const { data, error } = await supabase
      .from('leagues')
      .insert([{
        ...payload,
        created_by: cleanCreatedBy,
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating league:', error);
      throw error;
    }
    return data;
  }

  static async updateLeague(id: string, updates: Partial<League>): Promise<League> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    const { data, error } = await supabase
      .from('leagues')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating league ${id}:`, error);
      throw error;
    }
    return data;
  }

  static async deleteLeague(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await supabase
      .from('leagues')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting league ${id}:`, error);
      throw error;
    }
  }

  // ==========================================
  // TEAMS CRUD
  // ==========================================

  static async getTeamsByLeague(leagueId: string): Promise<Team[]> {
    if (!isSupabaseConfigured() || !supabase || !leagueId) return [];
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('league_id', leagueId)
      .order('name', { ascending: true });

    if (error) {
      console.error(`Error fetching teams for league ${leagueId}:`, error);
      throw error;
    }
    return data || [];
  }

  static async createTeam(payload: Omit<Team, 'id' | 'created_at' | 'updated_at'>): Promise<Team> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    const { data, error } = await supabase
      .from('teams')
      .insert([{ ...payload, updated_at: new Date().toISOString() }])
      .select()
      .single();

    if (error) {
      console.error('Error creating team:', error);
      throw error;
    }
    return data;
  }

  static async updateTeam(id: string, updates: Partial<Team>): Promise<Team> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    const { data, error } = await supabase
      .from('teams')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating team ${id}:`, error);
      throw error;
    }
    return data;
  }

  static async deleteTeam(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting team ${id}:`, error);
      throw error;
    }
  }

  /**
   * Uploads a logo file or blob to Supabase Storage 'team-logos' bucket
   */
  static async uploadTeamLogo(file: File | Blob, fileName: string): Promise<string> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }

    const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const filePath = `logos/${timestamp}_${cleanName}`;

    const { error: uploadError } = await supabase.storage
      .from('team-logos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'image/png',
      });

    if (uploadError) {
      console.error('Error uploading team logo to Supabase Storage:', uploadError);
      throw uploadError;
    }

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
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('league_id', leagueId)
      .order('match_number', { ascending: true });

    if (error) {
      console.error(`Error fetching matches for league ${leagueId}:`, error);
      throw error;
    }
    return data || [];
  }

  static async createMatch(payload: Omit<Match, 'id' | 'created_at' | 'updated_at'>): Promise<Match> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    const { data, error } = await supabase
      .from('matches')
      .insert([{ ...payload, updated_at: new Date().toISOString() }])
      .select()
      .single();

    if (error) {
      console.error('Error creating match:', error);
      throw error;
    }
    return data;
  }

  static async createMatchesBatch(matches: Omit<Match, 'id' | 'created_at' | 'updated_at'>[]): Promise<Match[]> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    if (matches.length === 0) return [];

    const payload = matches.map((m) => ({
      ...m,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('matches')
      .insert(payload)
      .select();

    if (error) {
      console.error('Error batch creating matches:', error);
      throw error;
    }
    return data || [];
  }

  static async updateMatch(id: string, updates: Partial<Match>): Promise<Match> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    const { data, error } = await supabase
      .from('matches')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating match ${id}:`, error);
      throw error;
    }
    return data;
  }

  static async deleteMatch(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting match ${id}:`, error);
      throw error;
    }
  }

  static async deleteMatchesByLeague(leagueId: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase || !leagueId) return;
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('league_id', leagueId);

    if (error) {
      console.error(`Error clearing matches for league ${leagueId}:`, error);
      throw error;
    }
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
