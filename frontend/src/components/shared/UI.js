import React from 'react';
import { T } from '../../utils/helpers';

export const Icon = ({ name, size = 18, color = 'currentColor' }) => {
  const paths = {
    dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
    members: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
    staff: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z',
    subscriptions: 'M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z',
    attendance: 'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
    qr: 'M3 11h2v2H3zm0 4h2v2H3zM3 3h8v8H3zm2 2v4h4V5H5zm8-2h8v8h-8zm2 2v4h4V5h-4zM3 13h2v2H3zm4 0h2v2H7zm4 2h2v2h-2zm-4 2h2v2H7zm4-4h2v2h-2zm4 0h4v2h-4zm0 4h2v2h-2zm2-2h2v2h-2z',
    plans: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
    logout: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
    settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
    check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    refresh: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
    menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
    chevron_right: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
    chevron_down: 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
    search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
    checkin: 'M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z',
    profile: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    gym: 'M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z',
    warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
    info_circle: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
    money: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
    trend_up: 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z',
    lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
    eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
    download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
    filter: 'M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
      <path d={paths[name] || paths.info_circle} />
    </svg>
  );
};

export const Badge = ({ status }) => {
  const map = {
    active: { bg: T.greenDim, color: T.green, label: 'Active' },
    expired: { bg: T.amberDim, color: T.amber, label: 'Expired' },
    cancelled: { bg: T.redDim, color: T.red, label: 'Cancelled' },
    pending: { bg: T.amberDim, color: T.amber, label: 'Pending' },
    inactive: { bg: T.redDim, color: T.red, label: 'Inactive' },
    suspended: { bg: T.redDim, color: T.red, label: 'Suspended' },
    admin: { bg: `${T.accent}22`, color: T.accent, label: 'Admin' },
    staff: { bg: T.blueDim, color: T.blue, label: 'Staff' },
    member: { bg: T.greenDim, color: T.green, label: 'Member' },
    regular: { bg: T.blueDim, color: T.blue, label: 'Regular' },
    guest: { bg: T.amberDim, color: T.amber, label: 'Guest' },
    trial: { bg: `${T.accent}22`, color: T.accent, label: 'Trial' },
  };
  const s = map[status?.toLowerCase()] || { bg: T.bg3, color: T.sub, label: status || '—' };
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 700, fontFamily: T.display, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
};

export const Avatar = ({ name, size = 36 }) => (
  <div style={{ width: size, height: size, borderRadius: 4, background: `linear-gradient(135deg, ${T.accent}55 0%, ${T.bg3} 100%)`, border: `1px solid ${T.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.display, fontWeight: 700, fontSize: size * 0.36, color: T.white, flexShrink: 0 }}>
    {name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??'}
  </div>
);

export const Spinner = ({ size = 20 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', border: `2px solid ${T.border}`, borderTop: `2px solid ${T.accent}`, animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
);

export const Card = ({ children, style = {}, className = '', onClick }) => (
  <div className={className} onClick={onClick} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 6, ...style }}>
    {children}
  </div>
);

export const Btn = ({ children, onClick, variant = 'primary', disabled, style = {}, size: sz = 'md', type = 'button' }) => {
  const v = {
    primary: { bg: T.accent, color: '#fff', hoverBg: T.accentHover },
    ghost: { bg: 'transparent', color: T.sub, hoverBg: T.bg3, border: T.border },
    danger: { bg: T.redDim, color: T.red, hoverBg: '#ff174428', border: `${T.red}44` },
    success: { bg: T.greenDim, color: T.green, hoverBg: '#00e67628', border: `${T.green}44` },
    secondary: { bg: T.bg3, color: T.white, hoverBg: T.borderBright },
    blue: { bg: T.blueDim, color: T.blue, hoverBg: '#2979ff28', border: `${T.blue}44` },
  }[variant] || {};
  const pad = sz === 'sm' ? '5px 12px' : sz === 'lg' ? '12px 24px' : '8px 18px';
  const fs = sz === 'sm' ? 11 : sz === 'lg' ? 14 : 13;
  const [hover, setHover] = React.useState(false);
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: hover && !disabled ? v.hoverBg : v.bg, color: v.color, padding: pad, borderRadius: 4, fontFamily: T.display, fontWeight: 700, fontSize: fs, letterSpacing: '0.06em', textTransform: 'uppercase', border: v.border ? `1px solid ${v.border}` : 'none', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap', ...style }}>
      {children}
    </button>
  );
};

export const Input = ({ label, value, onChange, type = 'text', placeholder, required, disabled, helperText, error, style = {}, inputStyle = {} }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
    {label && <label style={{ fontSize: 11, color: error ? T.red : T.sub, fontFamily: T.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}{required && ' *'}</label>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} disabled={disabled}
      style={{ background: T.bg0, border: `1px solid ${error ? T.red : T.border}`, borderRadius: 4, padding: '9px 12px', color: disabled ? T.muted : T.white, fontSize: 13, fontFamily: type === 'number' ? T.mono : T.font, transition: 'border 0.15s', width: '100%', ...inputStyle }} />
    {(helperText || error) && <span style={{ fontSize: 11, color: error ? T.red : T.muted }}>{error || helperText}</span>}
  </div>
);

export const Select = ({ label, value, onChange, options = [], required, disabled, style = {} }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
    {label && <label style={{ fontSize: 11, color: T.sub, fontFamily: T.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}{required && ' *'}</label>}
    <select value={value} onChange={onChange} required={required} disabled={disabled}
      style={{ background: T.bg0, border: `1px solid ${T.border}`, borderRadius: 4, padding: '9px 12px', color: T.white, fontSize: 13, fontFamily: T.font, width: '100%', cursor: 'pointer' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

export const Textarea = ({ label, value, onChange, placeholder, rows = 3, style = {} }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
    {label && <label style={{ fontSize: 11, color: T.sub, fontFamily: T.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</label>}
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      style={{ background: T.bg0, border: `1px solid ${T.border}`, borderRadius: 4, padding: '9px 12px', color: T.white, fontSize: 13, fontFamily: T.font, width: '100%', resize: 'vertical' }} />
  </div>
);

export const Modal = ({ open, onClose, title, children, width = 520 }) => {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.borderBright}`, borderRadius: 8, width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', animation: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 16, letterSpacing: '0.04em' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'transparent', color: T.muted, display: 'flex', padding: 4, borderRadius: 4 }}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
};

export const PageHeader = ({ title, subtitle, actions }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
    <div>
      <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: 28, letterSpacing: '0.03em', lineHeight: 1 }}>{title}</h1>
      {subtitle && <p style={{ color: T.sub, fontSize: 12, marginTop: 4 }}>{subtitle}</p>}
    </div>
    {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
  </div>
);

export const StatCard = ({ label, value, icon, color = T.accent, sub, trend, className = '' }) => (
  <Card className={`fadeUp ${className}`} style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden', cursor: 'default' }}>
    <div style={{ position: 'absolute', top: -8, right: -8, opacity: 0.07, transform: 'rotate(10deg)' }}>
      <Icon name={icon} size={80} color={color} />
    </div>
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.4 }} />
    <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.14em', marginBottom: 8, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 36, letterSpacing: '-0.01em', color, lineHeight: 1 }}>{value ?? '—'}</div>
    {sub && <div style={{ color: T.sub, fontSize: 11, marginTop: 6 }}>{sub}</div>}
    {trend !== undefined && (
      <div style={{ marginTop: 4, fontSize: 11, color: trend >= 0 ? T.green : T.red, display: 'flex', alignItems: 'center', gap: 3 }}>
        <Icon name="trend_up" size={12} color={trend >= 0 ? T.green : T.red} />
        {Math.abs(trend)}% this month
      </div>
    )}
  </Card>
);

export const EmptyState = ({ icon = 'info_circle', message = 'No records found', action }) => (
  <div style={{ padding: '60px 20px', textAlign: 'center' }}>
    <Icon name={icon} size={40} color={T.muted} />
    <p style={{ color: T.muted, fontFamily: T.mono, fontSize: 12, letterSpacing: '0.1em', marginTop: 12, textTransform: 'uppercase' }}>{message}</p>
    {action && <div style={{ marginTop: 16 }}>{action}</div>}
  </div>
);

export const LoadingRows = ({ cols = 5, rows = 6 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i}>
        {Array.from({ length: cols }).map((_, j) => (
          <td key={j} style={{ padding: '12px 16px' }}>
            <div className="skeleton" style={{ height: 16, width: j === 0 ? '80%' : '60%' }} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export const TableWrapper = ({ children }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      {children}
    </table>
  </div>
);

export const Th = ({ children }) => (
  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.12em', borderBottom: `1px solid ${T.border}`, background: T.bg1, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
    {children}
  </th>
);

export const Td = ({ children, style = {} }) => (
  <td style={{ padding: '11px 16px', borderBottom: `1px solid ${T.border}33`, ...style }}>
    {children}
  </td>
);

export const SearchInput = ({ value, onChange, placeholder = 'Search...', style = {} }) => (
  <div style={{ position: 'relative', ...style }}>
    <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
      <Icon name="search" size={15} color={T.muted} />
    </div>
    <input value={value} onChange={onChange} placeholder={placeholder}
      style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 4, padding: '8px 12px 8px 34px', color: T.white, fontSize: 13, width: '100%' }} />
  </div>
);

export const Tabs = ({ tabs, active, onChange }) => (
  <div style={{ display: 'flex', gap: 2, background: T.bg0, padding: 3, borderRadius: 5, width: 'fit-content' }}>
    {tabs.map(t => (
      <button key={t.id} onClick={() => onChange(t.id)} style={{ padding: '6px 14px', borderRadius: 4, fontFamily: T.display, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', background: active === t.id ? T.accent : 'transparent', color: active === t.id ? '#fff' : T.sub, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
        {t.label}
      </button>
    ))}
  </div>
);

export const ConfirmDialog = ({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }) => (
  <Modal open={open} onClose={onClose} title={title} width={400}>
    <p style={{ color: T.sub, marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Btn>
    </div>
  </Modal>
);
