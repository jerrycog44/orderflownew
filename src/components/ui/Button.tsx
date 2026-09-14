import React from 'react';
import { Spinner } from './Spinner';
import './Button.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const isButtonDisabled = disabled || isLoading;

  const classNames = [
    'of-btn',
    `of-btn-${variant}`,
    `of-btn-${size}`,
    isLoading ? 'of-btn-loading' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classNames}
      disabled={isButtonDisabled}
      {...props}
    >
      {isLoading && <Spinner size={size === 'lg' ? 'md' : 'sm'} className="of-btn-spinner" />}
      {!isLoading && leftIcon && <span className="of-btn-icon-left">{leftIcon}</span>}
      <span className="of-btn-content">{children}</span>
      {!isLoading && rightIcon && <span className="of-btn-icon-right">{rightIcon}</span>}
    </button>
  );
};
