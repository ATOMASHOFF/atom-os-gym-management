export const fmt = {
  num: (n) => Number(n ?? 0).toLocaleString('en-IN'),
  currency: (n) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`,
  date: (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
  time: (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
  datetime: (d) => d ? `${fmt.date(d)} ${fmt.time(d)}` : '—',
  initials: (name) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??',
  phone: (p) => p || '—',
  daysLeft: (end) => {
    if (!end) return null;
    const diff = Math.ceil((new Date(end) - new Date()) / 86400000);
    return diff;
  },
};

export const T = {
  bg0: '#0a0a0f', bg1: '#111118', bg2: '#1a1a24', bg3: '#242432',
  border: '#2a2a3a', borderBright: '#3a3a50',
  accent: '#6366f1', accentDim: '#6366f118', accentHover: '#818cf8',
  green: '#22c55e', greenDim: '#22c55e18',
  amber: '#f59e0b', amberDim: '#f59e0b18',
  blue: '#3b82f6', blueDim: '#3b82f618',
  purple: '#a855f7', purpleDim: '#a855f718',
  red: '#ef4444', redDim: '#ef444418',
  white: '#f1f5f9', muted: '#64748b', sub: '#94a3b8',
  font: "'Barlow', sans-serif",
  mono: "'Share Tech Mono', monospace",
  display: "'Barlow Condensed', sans-serif",
};
