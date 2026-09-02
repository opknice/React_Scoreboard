import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

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
  settings?: Record<string, JsonValue> | null;
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
  crop_metadata?: {
    zoom: number;
    crop: { x: number; y: number };
    croppedAreaPixels?: { x: number; y: number; width: number; height: number };
  } | null;
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
  status: 'scheduled' | 'in_progress' | 'finished' | 'postponed';
  label1?: string | null;
  label2?: string | null;
  label3?: string | null;
  match_date?: string | null;
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

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
  }
  return supabase;
};
