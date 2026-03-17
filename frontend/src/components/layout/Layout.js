import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { T } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../shared/UI';

const PAGE_TITLES = {
  '/dashboard':    'Dashboard',
  '/members':      'Members',
  '/staff':        'Staff',
  '/scan-member':  'Scan Member QR',
  '/subscriptions':'Subscriptions',
  '/attendance':   'Attendance',
  '/plans':        'Plans',
  '/qr-codes':     'QR Codes',
  '/settings':     'Settings',
  '/super/dashboard': 'Platform Overview',
  '/super/gyms':      'Gym Management',
  '/import':       'Bulk Import',
  '/my-profile':   'My Profile',
  '/my-attendance':'My Attendance',
  '/checkin':      'Check In',
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const loc = useLocation();
  const title = PAGE_TITLES[loc.pathname] || 'ATOM FITNESS';
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg0 }}>
      {/* Desktop sidebar */}
      <div className="sidebar-desktop">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {/* Mobile overlay nav */}
      {mobileOpen && (
        <>
          <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: '#000000bb', zIndex: 200, backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 201, width: 240 }}>
            <Sidebar collapsed={false} setCollapsed={() => setMobileOpen(false)} />
          </div>
        </>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <header className="topbar" style={{ height: 52, background: T.bg1, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Mobile hamburger */}
            <button onClick={() => setMobileOpen(true)} className="show-mobile" style={{ background: 'transparent', color: T.sub, padding: 6, borderRadius: 4, display: 'none' }}>
              <Icon name="menu" size={20} />
            </button>
            {/* Mobile logo */}
            <div className="show-mobile" style={{ display: 'none', fontFamily: T.display, fontWeight: 900, fontSize: 16, letterSpacing: '0.04em' }}>
              <span style={{ color: T.accent }}>A</span>TOM
            </div>
            {/* Desktop breadcrumb */}
            <div className="hide-mobile topbar-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: '0.14em' }}>ATOM FITNESS</span>
              <span style={{ color: T.border }}>›</span>
              <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.green, animation: 'pulse 2.5s infinite', flexShrink: 0 }} />
              <span className="hide-mobile" style={{ fontFamily: T.mono, fontSize: 10, color: T.green, letterSpacing: '0.06em' }}>LIVE</span>
            </div>
            <span className="hide-mobile" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>
              {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 28, height: 28, borderRadius: 5, background: `linear-gradient(135deg, ${T.accent}55, ${T.bg3})`, border: `1px solid ${T.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.display, fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                  {user.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}
                </div>
                <span className="hide-mobile" style={{ fontSize: 12, color: T.sub, fontWeight: 500 }}>{user.name?.split(' ')[0]}</span>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="main-content" style={{ flex: 1, padding: '24px 24px', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav for members */}
      {user?.role === 'member' && (
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: T.bg1, borderTop: `1px solid ${T.border}`, display: 'none', zIndex: 100 }} className="show-mobile mobile-bottom-nav">
          {[
            { to: '/my-profile',    icon: 'profile',    label: 'Profile'     },
            { to: '/checkin',       icon: 'checkin',    label: 'Check In'    },
            { to: '/my-attendance', icon: 'attendance', label: 'Attendance'  },
          ].map(item => (
            <a key={item.to} href={item.to} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 0', color: loc.pathname === item.to ? T.accent : T.muted, fontSize: 10, fontFamily: T.display, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', gap: 4, textDecoration: 'none' }}>
              <Icon name={item.icon} size={20} color={loc.pathname === item.to ? T.accent : T.muted} />
              {item.label}
            </a>
          ))}
        </nav>
      )}

      <style>{`
        @media (max-width: 768px) {
          .show-mobile { display: flex !important; }
          .hide-mobile { display: none !important; }
          .mobile-bottom-nav { display: flex !important; }
          .main-content { padding-bottom: ${user?.role === 'member' ? '70px' : '16px'} !important; }
        }
      `}</style>
    </div>
  );
}
