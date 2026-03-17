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
  bg0: '#060810', bg1: '#0d1117', bg2: '#131820', bg3: '#1c2433',
  border: '#1f2d3d', borderBright: '#2a3f56',
  accent: '#ff3d00', accentDim: '#ff3d0018', accentHover: '#ff6030',
  green: '#00e676', greenDim: '#00e67618',
  amber: '#ffc107', amberDim: '#ffc10718',
  blue: '#2979ff', blueDim: '#2979ff18',
  purple: '#d500f9', purpleDim: '#d500f918',
  red: '#ff1744', redDim: '#ff174418',
  white: '#f0f4f8', muted: '#4a6278', sub: '#7a9ab5',
  font: "'Barlow', sans-serif",
  mono: "'Share Tech Mono', monospace",
  display: "'Barlow Condensed', sans-serif",
};
