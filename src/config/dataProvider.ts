export type DataProvider = 'firebase' | 'supabase';

/**
 * Keeps the migration switch explicit. Firebase remains the safe default until
 * the corresponding leagues and legacy records have been imported and checked.
 */
export function getDataProvider(): DataProvider {
  const configured = import.meta.env.VITE_DATA_PROVIDER?.trim().toLowerCase();
  return configured === 'supabase' ? 'supabase' : 'firebase';
}
