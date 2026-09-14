import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ToastMessage } from '../../types';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import './Toast.css';

interface ToastContextType {
  addToast: (message: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { id, ...toast };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="of-toast-container">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

const ToastItem: React.FC<{ toast: ToastMessage; onClose: () => void }> = ({ toast, onClose }) => {
  const type = toast.type || 'info';

  const icons = {
    success: <CheckCircle2 size={18} className="of-toast-icon-success" />,
    warning: <AlertTriangle size={18} className="of-toast-icon-warning" />,
    error: <AlertCircle size={18} className="of-toast-icon-error" />,
    info: <Info size={18} className="of-toast-icon-info" />,
  };

  return (
    <div className={`of-toast of-toast-${type}`}>
      <div className="of-toast-icon">{icons[type]}</div>
      <div className="of-toast-content">
        <h4 className="of-toast-title">{toast.title}</h4>
        {toast.description && <p className="of-toast-description">{toast.description}</p>}
      </div>
      <button className="of-toast-close" onClick={onClose} aria-label="Close notification">
        <X size={14} />
      </button>
    </div>
  );
};
