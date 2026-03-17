import React, { createContext, useContext, useState, useCallback } from 'react';
import { T } from '../utils/helpers';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

const icons = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
    </svg>
  ),
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  }, []);

  const styles = {
    success: { bg: T.greenDim, color: T.green, border: `${T.green}44` },
    error: { bg: T.redDim, color: T.red, border: `${T.red}44` },
    info: { bg: T.blueDim, color: T.blue, border: `${T.blue}44` },
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => {
          const s = styles[t.type] || styles.info;
          return (
            <div key={t.id} style={{
              background: s.bg, color: s.color, border: `1px solid ${s.border}`,
              padding: '10px 16px', borderRadius: 6, minWidth: 220, maxWidth: 380,
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: T.font, fontSize: 13, fontWeight: 500,
              backdropFilter: 'blur(8px)',
              animation: 'toastIn 0.25s ease both',
            }}>
              {icons[t.type]}
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
