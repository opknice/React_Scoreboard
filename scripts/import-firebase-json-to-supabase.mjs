import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leagueSources = [
  {
    slug: 'alcohol-league',
    label: 'Alcohol League',
    file: path.join(repositoryRoot, 'League', 'Alcohol_League.json'),
  },
  {
    slug: 'var38-league',
    label: 'Var38 League',
    file: path.join(repositoryRoot, 'League', 'VAR38.json'),
  },
];

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function asRecord(value, context) {
  if (!isRecord(value)) throw new Error(`${context} ต้องเป็น object`);
  return value;
}

function asText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asScore(value) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 ? score : 0;
}

function readSourceExport(value, sourceLabel) {
  const root = asRecord(value, sourceLabel);
  return {
    matches: asRecord(root.matches ?? {}, `${sourceLabel}.matches`),
    teams: asRecord(root.teams ?? {}, `${sourceLabel}.teams`),
  };
}

function requireEnvironment() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('ไม่พบ SUPABASE_URL หรือ VITE_SUPABASE_URL');
  if (!serviceRoleKey) {
    throw new Error('ไม่พบ SUPABASE_SERVICE_ROLE_KEY; ห้ามใช้ publishable/anon key สำหรับ import นี้');
  }
  return { url, serviceRoleKey };
}

function assertNoError(error, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

async function loadJson(file) {
  return readSourceExport(JSON.parse(await readFile(file, 'utf8')), path.basename(file));
}

async function loadLeague(client, source) {
  const { data, error } = await client
    .from('leagues')
    .select('id, owner_id, name, slug')
    .eq('slug', source.slug)
    .maybeSingle();
  assertNoError(error, `ค้นหา ${source.label}`);
  if (!data) throw new Error(`ไม่พบลีก slug=${source.slug}; ให้รัน 0003_private_league_ownership.sql ก่อน`);

  const { data: owner, error: ownerError } = await client
    .from('profiles')
    .select('email')
    .eq('id', data.owner_id)
    .maybeSingle();
  assertNoError(ownerError, `ตรวจ owner ของ ${source.label}`);
  if (owner?.email?.toLowerCase() !== 'thanakrit_kas@hotmail.com') {
    throw new Error(`${source.label} ไม่ได้เป็นของ thanakrit_kas@hotmail.com`);
  }
  return data;
}

async function importTeams(client, league, teams, apply) {
  const { data: existing, error } = await client
    .from('teams')
    .select('id, team_key')
    .eq('league_id', league.id);
  assertNoError(error, `อ่าน teams ของ ${league.slug}`);
  const existingByKey = new Map((existing || []).map((team) => [team.team_key, team.id]));
  let inserted = 0;
  let updated = 0;

  for (const [teamKey, rawTeam] of Object.entries(teams)) {
    const team = asRecord(rawTeam, `teams.${teamKey}`);
    const payload = {
      league_id: league.id,
      team_key: teamKey,
      name: asText(team.name, teamKey),
      logo_url: asText(team.logo),
    };
    const existingId = existingByKey.get(teamKey);
    if (existingId) {
      updated += 1;
      if (apply) {
        const result = await client.from('teams').update(payload).eq('id', existingId);
        assertNoError(result.error, `อัปเดต team ${teamKey}`);
      }
    } else {
      inserted += 1;
      if (apply) {
        const result = await client.from('teams').insert(payload);
        assertNoError(result.error, `เพิ่ม team ${teamKey}`);
      }
    }
  }
  return { total: Object.keys(teams).length, inserted, updated };
}

async function importMatches(client, league, matches, apply) {
  const { data: existing, error } = await client
    .from('matches')
    .select('id, legacy_firebase_id')
    .eq('league_id', league.id)
    .not('legacy_firebase_id', 'is', null);
  assertNoError(error, `อ่าน matches ของ ${league.slug}`);
  const existingByLegacyId = new Map((existing || []).map((match) => [match.legacy_firebase_id, match.id]));
  let inserted = 0;
  let updated = 0;

  for (const [legacyId, rawMatch] of Object.entries(matches)) {
    const match = asRecord(rawMatch, `matches.${legacyId}`);
    const payload = {
      league_id: league.id,
      legacy_firebase_id: legacyId,
      match_date: asText(match.date) || null,
      team_a: asText(match.teamA),
      team_b: asText(match.teamB),
      score_a: asScore(match.scoreA),
      score_b: asScore(match.scoreB),
      round_label: asText(match.roundLabel),
      match_url: asText(match.url),
      logo_a: asText(match.logoA),
      logo_b: asText(match.logoB),
    };
    const existingId = existingByLegacyId.get(legacyId);
    if (existingId) {
      updated += 1;
      if (apply) {
        const result = await client.from('matches').update(payload).eq('id', existingId);
        assertNoError(result.error, `อัปเดต match ${legacyId}`);
      }
    } else {
      inserted += 1;
      if (apply) {
        const result = await client.from('matches').insert(payload);
        assertNoError(result.error, `เพิ่ม match ${legacyId}`);
      }
    }
  }
  return { total: Object.keys(matches).length, inserted, updated };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const { url, serviceRoleKey } = requireEnvironment();
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const summary = [];

  for (const source of leagueSources) {
    const sourceData = await loadJson(source.file);
    const league = await loadLeague(client, source);
    const teams = await importTeams(client, league, sourceData.teams, apply);
    const matches = await importMatches(client, league, sourceData.matches, apply);
    summary.push({ league: source.label, slug: source.slug, teams, matches });
  }

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', summary }, null, 2));
  if (!apply) console.log('ยังไม่มีการเขียนข้อมูล ใช้ --apply เมื่อยืนยันผล dry-run แล้ว');
}

main().catch((error) => {
  console.error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
