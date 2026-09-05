export type LogoStorageProvider = 'supabase' | 'cloudinary';

export interface LogoStorageProviderOption {
  value: LogoStorageProvider;
  label: string;
}

export const LOGO_STORAGE_PROVIDER_OPTIONS: readonly LogoStorageProviderOption[] = [
  { value: 'supabase', label: 'Supabase Storage' },
  { value: 'cloudinary', label: 'Cloudinary' },
];

export function isLogoStorageProvider(value: string): value is LogoStorageProvider {
  return value === 'supabase' || value === 'cloudinary';
}
