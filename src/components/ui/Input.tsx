import React from 'react';
import './Form.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="of-form-field">
      {label && (
        <label htmlFor={inputId} className="of-form-label">
          {label}
        </label>
      )}
      <div className={`of-input-wrapper ${error ? 'of-input-error' : ''}`}>
        {leftIcon && <span className="of-input-icon-left">{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={`of-input ${leftIcon ? 'has-left-icon' : ''} ${rightIcon ? 'has-right-icon' : ''} ${className}`}
          aria-invalid={!!error}
          {...props}
        />
        {rightIcon && <span className="of-input-icon-right">{rightIcon}</span>}
      </div>
      {error ? (
        <p className="of-form-error-msg">{error}</p>
      ) : helperText ? (
        <p className="of-form-helper-msg">{helperText}</p>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';
