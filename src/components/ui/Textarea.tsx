import React from 'react';
import './Form.css';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  helperText,
  error,
  className = '',
  id,
  rows = 3,
  ...props
}, ref) => {
  const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="of-form-field">
      {label && (
        <label htmlFor={textareaId} className="of-form-label">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={`of-textarea ${error ? 'of-input-error' : ''} ${className}`}
        aria-invalid={!!error}
        {...props}
      />
      {error ? (
        <p className="of-form-error-msg">{error}</p>
      ) : helperText ? (
        <p className="of-form-helper-msg">{helperText}</p>
      ) : null}
    </div>
  );
});

Textarea.displayName = 'Textarea';
