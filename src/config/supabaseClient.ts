import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../types/supabase';

export type JsonValue = Json;

export type UserAccessStatus = 'allowed' | 'denied' | 'pending';

export interface UserAccessRecord {
  id: string;
  email: string;
  display_name: string;
  photo_url: string;
  status: UserAccessStatus;
  trial_started_at: number | null;
  last_login: string;
  uploaded_image_count: number;
  created_at: string;
  updated_at: string;
}

export interface League {
  id: string;
  name: string;
  slug?: string | null;
  season?: string | null;
  description?: string | null;
  is_active: boolean;
  created_by?: string | null;
  settings?: Json;
  created_at?: string;
  updated_at?: string;
}

export interface Team {
  id: string;
  league_id: string;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
  color_primary: string;
  color_secondary: string;
  /** Crop settings used by the Overlay/OBS scoreboard views. */
  overlay_crop_metadata?: Json | null;
  /** Crop settings used by Logo Browser Source and goal animations. */
  logo_browser_crop_metadata?: Json | null;
  created_at?: string;
  updated_at?: string;
}

export interface Match {
  id: string;
  league_id: string;
  match_number: number;
  team_a_id?: string | null;
  team_b_id?: string | null;
  team_a_name: string;
  team_b_name: string;
  score_a: number;
  score_b: number;
  status: 'scheduled' | 'in_progress' | 'finished' | 'postponed' | string;
  label1?: string;
  label2?: string;
  label3?: string;
  match_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type PlayerPosition = 'GK' | 'DF' | 'MF' | 'FW';

export interface Player {
  id: string;
  league_id: string;
  team_id: string;
  jersey_number: number;
  name: string;
  position: PlayerPosition;
  image_url?: string | null;
  image_public_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PlayerMatchStat {
  id: string;
  league_id: string;
  match_id: string;
  player_id: string;
  team_id: string;
  goals: number;
  created_at?: string;
  updated_at?: string;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your-project-id')
  );
};

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured()
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : null;

export const getSupabaseClient = (): SupabaseClient<Database> => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
  }
  return supabase;
};
