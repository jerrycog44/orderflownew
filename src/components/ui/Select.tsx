import React from 'react';
import './Form.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  helperText?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  options,
  helperText,
  error,
  className = '',
  id,
  ...props
}, ref) => {
  const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="of-form-field">
      {label && (
        <label htmlFor={selectId} className="of-form-label">
          {label}
        </label>
      )}
      <div className={`of-select-wrapper ${error ? 'of-input-error' : ''}`}>
        <select
          ref={ref}
          id={selectId}
          className={`of-select ${className}`}
          aria-invalid={!!error}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="of-select-arrow">
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1.5L6 6.5L11 1.5" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      {error ? (
        <p className="of-form-error-msg">{error}</p>
      ) : helperText ? (
        <p className="of-form-helper-msg">{helperText}</p>
      ) : null}
    </div>
  );
});

Select.displayName = 'Select';
