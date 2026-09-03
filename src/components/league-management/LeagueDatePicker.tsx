import React, { useId } from 'react';
import { formatToDateInput } from './leagueDateUtils';

export interface LeagueDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
}

/**
 * Lightweight date picker based on the browser's native date control.
 * The value remains ISO formatted (YYYY-MM-DD) for safe database storage.
 */
export const LeagueDatePicker: React.FC<LeagueDatePickerProps> = ({
  value,
  onChange,
  label = 'วันที่แข่งขัน',
  helperText,
  disabled = false,
}) => {
  const inputId = `league-match-date-${useId().replace(/:/g, '')}`;
  const normalizedValue = formatToDateInput(value);

  return (
    <>
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="date"
        className="league-form-input league-date-input"
        value={normalizedValue}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-label={label}
      />
      {helperText && <small className="league-form-help-text">{helperText}</small>}
    </>
  );
};

export default LeagueDatePicker;
