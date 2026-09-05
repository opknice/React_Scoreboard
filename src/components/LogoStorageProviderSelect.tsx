import type { LogoStorageProvider } from '../types/logoStorage';
import type { CSSProperties } from 'react';
import {
  isLogoStorageProvider,
  LOGO_STORAGE_PROVIDER_OPTIONS,
} from '../types/logoStorage';

interface LogoStorageProviderSelectProps {
  value: LogoStorageProvider;
  onChange: (provider: LogoStorageProvider) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  style?: CSSProperties;
}

export default function LogoStorageProviderSelect({
  value,
  onChange,
  disabled = false,
  className,
  id,
  style,
}: LogoStorageProviderSelectProps) {
  return (
    <select
      id={id}
      className={className}
      style={style}
      value={value}
      disabled={disabled}
      aria-label="พื้นที่จัดเก็บโลโก้"
      onChange={(event) => {
        if (isLogoStorageProvider(event.target.value)) {
          onChange(event.target.value);
        }
      }}
    >
      {LOGO_STORAGE_PROVIDER_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
