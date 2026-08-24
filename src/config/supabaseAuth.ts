import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';

export type SupabaseAuthStateListener = (
  event: AuthChangeEvent,
  session: Session | null,
) => void;

/** Starts Google OAuth and returns control to the configured application URL. */
export async function loginWithGoogleSupabase(redirectTo?: string): Promise<void> {
  const client = getSupabaseClient();
  const targetUrl = redirectTo || window.location.href;
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: targetUrl },
  });

  if (error) throw error;
}

export function getSupabaseUserDisplayName(user: User): string {
  const value = user.user_metadata?.full_name || user.user_metadata?.name;
  return typeof value === 'string' && value.trim() ? value.trim() : 'Google User';
}

export function getSupabaseUserPhotoUrl(user: User): string {
  const value = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  return typeof value === 'string' ? value : '';
}

export async function logoutSupabaseUser(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}

export async function getSupabaseCurrentUser(): Promise<User | null> {
  const { data, error } = await getSupabaseClient().auth.getUser();
  if (error) {
    if (error.name === 'AuthSessionMissingError') return null;
    throw error;
  }
  return data.user;
}

export function subscribeToSupabaseAuth(
  listener: SupabaseAuthStateListener,
): () => void {
  const { data } = getSupabaseClient().auth.onAuthStateChange(listener);
  return () => data.subscription.unsubscribe();
}
