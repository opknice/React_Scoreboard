import type { AuthChangeEvent, RealtimeChannel, Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';

export type SupabaseAuthStateListener = (
  event: AuthChangeEvent,
  session: Session | null,
) => void;

/** Starts Google OAuth and returns control to the configured application URL. */
export async function loginWithGoogleSupabase(redirectTo?: string): Promise<void> {
  const client = getSupabaseClient();
  const targetUrl = redirectTo || getCleanAuthRedirectUrl();
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: targetUrl,
      queryParams: {
        // Do not silently reuse the Google account from the previous login.
        prompt: 'select_account',
      },
    },
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
  // The controller's logout button is a local account switch, not a request
  // to revoke the user's sessions on every device/browser.
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

function getCleanAuthRedirectUrl(): string {
  const url = new URL(window.location.href);
  const oauthParams = [
    'code',
    'error',
    'error_code',
    'error_description',
    'error_uri',
  ];

  oauthParams.forEach((param) => url.searchParams.delete(param));
  url.hash = '';
  return url.toString();
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

/**
 * Watches the signed-in user's permission records so an admin change is
 * reflected without waiting for a tab refresh or a fallback check.
 */
export function subscribeToSupabasePermissionChanges(
  userId: string,
  onChange: () => void,
  onError?: (error: unknown) => void,
): () => void {
  const client = getSupabaseClient();
  const channel: RealtimeChannel = client
    .channel(`auth-permissions:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_access', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        onError?.(new Error('Supabase permission Realtime channel error'));
      }
    });

  return () => {
    void client.removeChannel(channel);
  };
}
