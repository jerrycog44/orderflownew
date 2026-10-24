import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './BottomSheet.css';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  className?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  showCloseButton = true,
  closeOnBackdropClick = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Prevent background scrolling while sheet is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="of-m-sheet-backdrop"
      onClick={handleBackdropClick}
      data-testid="bottom-sheet-backdrop"
      role="presentation"
    >
      <div
        ref={containerRef}
        className={`of-m-sheet-container ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'of-m-sheet-title' : undefined}
        data-testid="bottom-sheet-container"
      >
        <div className="of-m-sheet-handle-wrapper" aria-hidden="true">
          <div className="of-m-sheet-handle" />
        </div>

        {(title || showCloseButton) && (
          <div className="of-m-sheet-header">
            <div className="of-m-sheet-title-group">
              {title && (
                <h2 id="of-m-sheet-title" className="of-m-sheet-title">
                  {title}
                </h2>
              )}
              {description && (
                <p className="of-m-sheet-description">{description}</p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                className="of-m-sheet-close-btn"
                onClick={onClose}
                aria-label="Close sheet"
                data-testid="bottom-sheet-close-btn"
              >
                <X size={20} strokeWidth={2.2} />
              </button>
            )}
          </div>
        )}

        <div className="of-m-sheet-body">{children}</div>

        {footer && <div className="of-m-sheet-footer">{footer}</div>}
      </div>
    </div>
  );
};
