import React from 'react';

interface OrderFlowLogoProps {
  size?: number;
  variant?: 'light' | 'dark' | 'color';
  showText?: boolean;
  className?: string;
}

export const OrderFlowLogo: React.FC<OrderFlowLogoProps> = ({
  size = 32,
  variant = 'light',
  showText = false,
  className = '',
}) => {
  const getColors = () => {
    switch (variant) {
      case 'dark':
        return { ring: '#FFFFFF', inner: '#FFFFFF', text: '#FFFFFF', textAccent: '#60A5FA' };
      case 'color':
        return { ring: '#0F172A', inner: '#2563EB', text: '#0F172A', textAccent: '#2563EB' };
      case 'light':
      default:
        return { ring: '#0F172A', inner: '#0F172A', text: '#0F172A', textAccent: '#2563EB' };
    }
  };

  const colors = getColors();

  return (
    <div className={`of-brand-logo ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        {/* Outer Ring - 4 Quadrants */}
        <path
          d="M 54 9.5 A 40.5 40.5 0 0 1 90.5 46"
          stroke={colors.ring}
          strokeWidth="8"
          strokeLinecap="butt"
        />
        <path
          d="M 90.5 54 A 40.5 40.5 0 0 1 54 90.5"
          stroke={colors.ring}
          strokeWidth="8"
          strokeLinecap="butt"
        />
        <path
          d="M 46 90.5 A 40.5 40.5 0 0 1 9.5 54"
          stroke={colors.ring}
          strokeWidth="8"
          strokeLinecap="butt"
        />
        <path
          d="M 9.5 46 A 40.5 40.5 0 0 1 46 9.5"
          stroke={colors.ring}
          strokeWidth="8"
          strokeLinecap="butt"
        />

        {/* Center Flow Emblems */}
        {/* Upper Ribbon */}
        <path
          d="M 22 46.5 H 37.5 C 44 46.5 50 42 57 37 L 44 51.5 H 22 V 46.5 Z"
          fill={colors.inner}
        />
        {/* Lower Ribbon */}
        <path
          d="M 78 53.5 H 62.5 C 56 53.5 50 58 43 63 L 56 48.5 H 78 V 53.5 Z"
          fill={colors.inner}
        />
      </svg>

      {showText && (
        <span
          className="of-brand-text"
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            fontSize: `${size * 0.58}px`,
            letterSpacing: '-0.03em',
            color: colors.text,
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          Order<span style={{ color: colors.textAccent }}>Flow</span>
        </span>
      )}
    </div>
  );
};
