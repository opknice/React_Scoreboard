import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../config/supabaseClient';
import type { Json } from '../types/database';

export interface LeagueRecord {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  isPublic: boolean;
  isActive: boolean;
}

export interface MatchRecord {
  id: string;
  leagueId: string;
  date: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  roundLabel: string;
  url: string;
  logoA: string;
  logoB: string;
}

export interface CreateMatchInput {
  leagueId: string;
  date?: string | null;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  roundLabel?: string;
  url?: string;
  logoA?: string;
  logoB?: string;
}

export interface UpdateMatchInput {
  date?: string | null;
  teamA?: string;
  teamB?: string;
  scoreA?: number;
  scoreB?: number;
  roundLabel?: string;
  url?: string;
  logoA?: string;
  logoB?: string;
}

export interface TeamRecord {
  id: string;
  leagueId: string;
  teamKey: string;
  name: string;
  logoUrl: string;
  cropMetadata: Json | null;
}

export interface UpsertTeamInput {
  leagueId: string;
  teamKey: string;
  name: string;
  logoUrl?: string;
  cropMetadata?: Json | null;
}

export type MatchChangeListener = (matches: MatchRecord[]) => void;
export type TeamChangeListener = (teams: TeamRecord[]) => void;

export interface SupabaseOverlaySnapshot {
  league: { id: string; name: string; slug: string };
  matches: MatchRecord[];
  teams: TeamRecord[];
}

function mapLeague(row: {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  is_public: boolean;
  is_active: boolean;
}): LeagueRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    isPublic: row.is_public,
    isActive: row.is_active,
  };
}

function mapMatch(row: {
  id: string;
  league_id: string;
  match_date: string | null;
  team_a: string;
  team_b: string;
  score_a: number;
  score_b: number;
  round_label: string;
  match_url: string;
  logo_a: string;
  logo_b: string;
}): MatchRecord {
  return {
    id: row.id,
    leagueId: row.league_id,
    date: row.match_date || '',
    teamA: row.team_a,
    teamB: row.team_b,
    scoreA: row.score_a,
    scoreB: row.score_b,
    roundLabel: row.round_label,
    url: row.match_url,
    logoA: row.logo_a,
    logoB: row.logo_b,
  };
}

function mapTeam(row: {
  id: string;
  league_id: string;
  team_key: string;
  name: string;
  logo_url: string;
  crop_metadata: Json | null;
}): TeamRecord {
  return {
    id: row.id,
    leagueId: row.league_id,
    teamKey: row.team_key,
    name: row.name,
    logoUrl: row.logo_url,
    cropMetadata: row.crop_metadata,
  };
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(`Supabase request failed: ${error.message}`);
}

function requireData<T>(data: T | null, error: { message: string } | null): T {
  throwIfError(error);
  if (data === null) throw new Error('Supabase request returned no data');
  return data;
}

function isJsonObject(value: Json | undefined | null): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonString(value: Json | undefined, field: string): string {
  if (typeof value !== 'string') throw new Error(`Supabase overlay field ${field} is invalid`);
  return value;
}

function jsonNumber(value: Json | undefined, field: string): number {
  if (typeof value !== 'number') throw new Error(`Supabase overlay field ${field} is invalid`);
  return value;
}

function jsonNullableString(value: Json | undefined): string | null {
  return value === null || value === undefined ? null : jsonString(value, 'nullable string');
}

function parseOverlaySnapshot(value: Json | null): SupabaseOverlaySnapshot {
  if (!isJsonObject(value) || !isJsonObject(value.league) || !Array.isArray(value.matches) || !Array.isArray(value.teams)) {
    throw new Error('Supabase overlay returned an invalid snapshot');
  }

  const league = value.league;
  const matches = value.matches.map((item) => {
    if (!isJsonObject(item)) throw new Error('Supabase overlay returned an invalid match');
    return {
      id: jsonString(item.id, 'match id'),
      leagueId: jsonString(item.leagueId, 'match league id'),
      date: jsonNullableString(item.date) || '',
      teamA: jsonString(item.teamA, 'team A'),
      teamB: jsonString(item.teamB, 'team B'),
      scoreA: jsonNumber(item.scoreA, 'score A'),
      scoreB: jsonNumber(item.scoreB, 'score B'),
      roundLabel: jsonString(item.roundLabel, 'round label'),
      url: jsonString(item.url, 'match URL'),
      logoA: jsonString(item.logoA, 'logo A'),
      logoB: jsonString(item.logoB, 'logo B'),
    } satisfies MatchRecord;
  });
  const teams = value.teams.map((item) => {
    if (!isJsonObject(item)) throw new Error('Supabase overlay returned an invalid team');
    return {
      id: jsonString(item.id, 'team id'),
      leagueId: jsonString(item.leagueId, 'team league id'),
      teamKey: jsonString(item.teamKey, 'team key'),
      name: jsonString(item.name, 'team name'),
      logoUrl: jsonString(item.logoUrl, 'team logo URL'),
      cropMetadata: item.cropMetadata ?? null,
    } satisfies TeamRecord;
  });

  return {
    league: {
      id: jsonString(league.id, 'league id'),
      name: jsonString(league.name, 'league name'),
      slug: jsonString(league.slug, 'league slug'),
    },
    matches,
    teams,
  };
}

export async function createSupabaseOverlayAccessToken(
  leagueId: string,
  ttlSeconds = 604800,
): Promise<{ token: string; expiresAt: string }> {
  const { data, error } = await getSupabaseClient().rpc('create_overlay_access_token', {
    target_league_id: leagueId,
    ttl_seconds: ttlSeconds,
  });
  const row = requireData(data, error)[0];
  if (!row) throw new Error('Supabase ไม่ส่ง Overlay token กลับมา');
  return { token: row.access_token, expiresAt: row.expires_at };
}

export async function readSupabaseOverlaySnapshot(token: string): Promise<SupabaseOverlaySnapshot> {
  const { data, error } = await getSupabaseClient().rpc('read_overlay_snapshot', {
    request_token: token,
  });
  throwIfError(error);
  return parseOverlaySnapshot(data);
}

export async function setSupabaseLeaguePublicOverlay(
  leagueId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_league_public_overlay', {
    target_league_id: leagueId,
    enabled,
  });
  throwIfError(error);
}

export async function readSupabasePublicOverlaySnapshot(
  leagueId: string,
): Promise<SupabaseOverlaySnapshot> {
  const { data, error } = await getSupabaseClient().rpc('read_public_overlay_snapshot', {
    target_league_id: leagueId,
  });
  throwIfError(error);
  return parseOverlaySnapshot(data);
}

export async function listSupabaseLeagues(): Promise<LeagueRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('leagues')
    .select('id, owner_id, name, slug, is_public, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });

  return requireData(data, error).map(mapLeague);
}

export async function findSupabaseLeagueBySlug(slug: string): Promise<LeagueRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from('leagues')
    .select('id, owner_id, name, slug, is_public, is_active')
    .eq('slug', slug)
    .maybeSingle();

  throwIfError(error);
  return data ? mapLeague(data) : null;
}

export async function createSupabaseLeague(name: string, slug: string): Promise<LeagueRecord> {
  const { data: userData, error: userError } = await getSupabaseClient().auth.getUser();
  throwIfError(userError);
  if (!userData.user) throw new Error('ต้องเข้าสู่ระบบก่อนสร้างลีก');

  const { data, error } = await getSupabaseClient()
    .from('leagues')
    .insert({ name: name.trim(), slug: slug.trim(), owner_id: userData.user.id, is_public: false })
    .select('id, owner_id, name, slug, is_public, is_active')
    .single();

  return mapLeague(requireData(data, error));
}

export async function listSupabaseMatches(leagueId: string): Promise<MatchRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('matches')
    .select('id, league_id, match_date, team_a, team_b, score_a, score_b, round_label, match_url, logo_a, logo_b')
    .eq('league_id', leagueId)
    .order('match_date', { ascending: false });

  return requireData(data, error).map(mapMatch);
}

export async function createSupabaseMatch(input: CreateMatchInput): Promise<MatchRecord> {
  const { data, error } = await getSupabaseClient()
    .from('matches')
    .insert({
      league_id: input.leagueId,
      match_date: input.date ?? null,
      team_a: input.teamA,
      team_b: input.teamB,
      score_a: input.scoreA,
      score_b: input.scoreB,
      round_label: input.roundLabel ?? '',
      match_url: input.url ?? '',
      logo_a: input.logoA ?? '',
      logo_b: input.logoB ?? '',
    })
    .select('id, league_id, match_date, team_a, team_b, score_a, score_b, round_label, match_url, logo_a, logo_b')
    .single();

  return mapMatch(requireData(data, error));
}

export async function updateSupabaseMatch(
  leagueId: string,
  matchId: string,
  input: UpdateMatchInput,
): Promise<MatchRecord> {
  const update = {
    ...(input.date !== undefined ? { match_date: input.date } : {}),
    ...(input.teamA !== undefined ? { team_a: input.teamA } : {}),
    ...(input.teamB !== undefined ? { team_b: input.teamB } : {}),
    ...(input.scoreA !== undefined ? { score_a: input.scoreA } : {}),
    ...(input.scoreB !== undefined ? { score_b: input.scoreB } : {}),
    ...(input.roundLabel !== undefined ? { round_label: input.roundLabel } : {}),
    ...(input.url !== undefined ? { match_url: input.url } : {}),
    ...(input.logoA !== undefined ? { logo_a: input.logoA } : {}),
    ...(input.logoB !== undefined ? { logo_b: input.logoB } : {}),
  };
  const { data, error } = await getSupabaseClient()
    .from('matches')
    .update(update)
    .eq('id', matchId)
    .eq('league_id', leagueId)
    .select('id, league_id, match_date, team_a, team_b, score_a, score_b, round_label, match_url, logo_a, logo_b')
    .single();

  return mapMatch(requireData(data, error));
}

export async function deleteSupabaseMatch(leagueId: string, matchId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('matches')
    .delete()
    .eq('id', matchId)
    .eq('league_id', leagueId);

  throwIfError(error);
}

export async function listSupabaseTeams(leagueId: string): Promise<TeamRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('teams')
    .select('id, league_id, team_key, name, logo_url, crop_metadata')
    .eq('league_id', leagueId)
    .order('name', { ascending: true });

  return requireData(data, error).map(mapTeam);
}

export async function findSupabaseTeam(
  leagueId: string,
  teamKey: string,
): Promise<TeamRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from('teams')
    .select('id, league_id, team_key, name, logo_url, crop_metadata')
    .eq('league_id', leagueId)
    .eq('team_key', teamKey)
    .maybeSingle();

  throwIfError(error);
  return data ? mapTeam(data) : null;
}

export async function upsertSupabaseTeam(input: UpsertTeamInput): Promise<TeamRecord> {
  const { data, error } = await getSupabaseClient()
    .from('teams')
    .upsert(
      {
        league_id: input.leagueId,
        team_key: input.teamKey,
        name: input.name,
        logo_url: input.logoUrl ?? '',
        crop_metadata: input.cropMetadata ?? null,
      },
      { onConflict: 'league_id,team_key' },
    )
    .select('id, league_id, team_key, name, logo_url, crop_metadata')
    .single();

  return mapTeam(requireData(data, error));
}

export async function updateSupabaseTeam(
  leagueId: string,
  teamKey: string,
  input: { name?: string; logoUrl?: string; cropMetadata?: Json | null },
): Promise<TeamRecord> {
  const update = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.logoUrl !== undefined ? { logo_url: input.logoUrl } : {}),
    ...(input.cropMetadata !== undefined ? { crop_metadata: input.cropMetadata } : {}),
  };
  const { data, error } = await getSupabaseClient()
    .from('teams')
    .update(update)
    .eq('league_id', leagueId)
    .eq('team_key', teamKey)
    .select('id, league_id, team_key, name, logo_url, crop_metadata')
    .single();

  return mapTeam(requireData(data, error));
}

function subscribeToTable(
  table: 'matches' | 'teams',
  leagueId: string,
  refresh: () => Promise<void>,
  onError?: (error: unknown) => void,
): () => void {
  const channel: RealtimeChannel = getSupabaseClient()
    .channel(`league-${table}:${leagueId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `league_id=eq.${leagueId}` },
      () => {
        void refresh().catch((error: unknown) => onError?.(error));
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') onError?.(new Error(`Supabase Realtime channel error: ${table}`));
    });

  return () => {
    void getSupabaseClient().removeChannel(channel);
  };
}

export function subscribeSupabaseMatches(
  leagueId: string,
  onChange: MatchChangeListener,
  onError?: (error: unknown) => void,
): () => void {
  return subscribeToTable(
    'matches',
    leagueId,
    async () => onChange(await listSupabaseMatches(leagueId)),
    onError,
  );
}

export function subscribeSupabaseTeams(
  leagueId: string,
  onChange: TeamChangeListener,
  onError?: (error: unknown) => void,
): () => void {
  return subscribeToTable(
    'teams',
    leagueId,
    async () => onChange(await listSupabaseTeams(leagueId)),
    onError,
  );
}
