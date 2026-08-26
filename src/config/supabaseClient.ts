import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

let client: SupabaseClient<Database> | null = null;

/**
 * Reads the migration-target Supabase configuration without creating a client.
 * Supabase is the only application data provider.
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
  const publishableKey = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    || import.meta.env.VITE_SUPABASE_ANON_KEY
    || ''
  ).trim();

  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

/** Returns a singleton client once Supabase environment variables are present. */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client;

  const config = getSupabaseConfig();
  if (!config) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  client = createClient<Database>(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}
