import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../shared/UI';
import { T } from '../../utils/helpers';

const NAV_SUPER = [
  { to: '/super/dashboard', icon: 'dashboard',     label: 'Platform Overview' },
  { to: '/super/gyms',      icon: 'gym',            label: 'All Gyms'          },
  { to: '/settings',        icon: 'settings',       label: 'Settings'          },
];

const NAV_ADMIN = [
  { to: '/dashboard',     icon: 'dashboard',     label: 'Dashboard'     },
  { to: '/members',       icon: 'members',       label: 'Members'       },
  { to: '/staff',         icon: 'staff',         label: 'Staff'         },
  { to: '/scan-member',   icon: 'qr',            label: 'Scan Member',  tag: 'QR'  },
  { to: '/subscriptions', icon: 'subscriptions', label: 'Subscriptions' },
  { to: '/attendance',    icon: 'attendance',    label: 'Attendance'    },
  { to: '/plans',         icon: 'plans',         label: 'Plans'         },
  { to: '/import',        icon: 'download',      label: 'Bulk Import',  tag: 'NEW' },
  { to: '/qr-codes',      icon: 'qr',            label: 'QR Codes'      },
  { to: '/settings',      icon: 'settings',      label: 'Settings'      },
];

const NAV_STAFF = [
  { to: '/dashboard',     icon: 'dashboard',     label: 'Dashboard'     },
  { to: '/scan-member',   icon: 'qr',            label: 'Scan Member',  tag: 'QR'  },
  { to: '/members',       icon: 'members',       label: 'Members'       },
  { to: '/attendance',    icon: 'attendance',    label: 'Attendance'    },
  { to: '/subscriptions', icon: 'subscriptions', label: 'Subscriptions' },
];

const NAV_MEMBER = [
  { to: '/my-profile',    icon: 'profile',       label: 'My Profile'    },
  { to: '/checkin',       icon: 'checkin',       label: 'Check In',     tag: 'QR'  },
  { to: '/my-attendance', icon: 'attendance',    label: 'Attendance'    },
];

const ROLE_COLORS = {
  super_admin: T.purple,
  admin:       T.accent,
  staff:       T.blue,
  member:      T.green,
};

const ROLE_LABELS = {
  super_admin: 'Platform Admin',
  admin:       'Gym Admin',
  staff:       'Staff',
  member:      'Member',
};

export default function Sidebar({ collapsed, setCollapsed }) {
  const { user, logout, isSuperAdmin, isAdmin, isStaff } = useAuth();

  const nav = isSuperAdmin ? NAV_SUPER
            : isAdmin      ? NAV_ADMIN
            : isStaff      ? NAV_STAFF
            :                NAV_MEMBER;

  const roleColor = ROLE_COLORS[user?.role] || T.sub;

  return (
    <aside style={{
      width: collapsed ? 58 : 224,
      minHeight: '100vh',
      background: T.bg1,
      borderRight: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.2s ease',
      overflow: 'hidden', flexShrink: 0,
      position: 'sticky', top: 0, height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '14px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 58, gap: 8 }}>
        {!collapsed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, overflow: 'hidden' }}>
            <div style={{ width: 30, height: 30, background: T.accent, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.display, fontWeight: 900, fontSize: 18, color: '#fff', flexShrink: 0 }}>A</div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 15, letterSpacing: '0.05em' }}>ATOM</div>
              <div style={{ fontFamily: T.mono, fontSize: 8, color: T.muted, letterSpacing: '0.12em' }}>GYM OS</div>
            </div>
          </div>
        ) : (
          <div style={{ width: 30, height: 30, background: T.accent, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.display, fontWeight: 900, fontSize: 18, color: '#fff', margin: '0 auto' }}>A</div>
        )}
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'transparent', color: T.muted, padding: 4, borderRadius: 4, display: 'flex', flexShrink: 0, border: 'none', cursor: 'pointer' }}>
          <Icon name={collapsed ? 'menu' : 'close'} size={17} />
        </button>
      </div>

      {/* User badge */}
      {!collapsed && user && (
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 4,
              background: `linear-gradient(135deg, ${roleColor}55, ${T.bg3})`,
              border: `1px solid ${roleColor}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.display, fontWeight: 700, fontSize: 12, flexShrink: 0,
            }}>
              {user.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name}
              </div>
              <div style={{ fontSize: 9, color: roleColor, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                {ROLE_LABELS[user.role]}
                {user.gym_name && <span style={{ color: T.muted, fontWeight: 400 }}> · {user.gym_name}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {nav.map(item => (
          <NavLink key={item.to} to={item.to} title={collapsed ? item.label : undefined}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 9,
              padding: collapsed ? '10px 0' : '8px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: isActive ? `${T.accent}18` : 'transparent',
              color: isActive ? T.accent : T.sub,
              borderRadius: 5,
              fontFamily: T.display, fontWeight: 600, fontSize: 12,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              borderLeft: isActive ? `3px solid ${T.accent}` : '3px solid transparent',
              transition: 'all 0.12s', textDecoration: 'none', overflow: 'hidden',
            })}>
            {({ isActive }) => (
              <>
                <Icon name={item.icon} size={15} color={isActive ? T.accent : T.sub} />
                {!collapsed && (
                  <>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                    {item.tag && (
                      <span style={{
                        marginLeft: 'auto',
                        background: item.tag === 'NEW' ? T.accent : item.tag === 'QR' ? T.blueDim : T.bg3,
                        color: item.tag === 'NEW' ? '#fff' : item.tag === 'QR' ? T.blue : T.muted,
                        fontSize: 8, padding: '1px 5px', borderRadius: 3, fontFamily: T.mono, flexShrink: 0,
                      }}>{item.tag}</span>
                    )}
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: '8px 6px', borderTop: `1px solid ${T.border}` }}>
        <button onClick={logout} title={collapsed ? 'Sign Out' : undefined}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: collapsed ? '10px 0' : '8px 10px', justifyContent: collapsed ? 'center' : 'flex-start', background: 'transparent', color: T.muted, borderRadius: 5, fontFamily: T.display, fontWeight: 600, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'all 0.12s', cursor: 'pointer', border: 'none' }}
          onMouseEnter={e => { e.currentTarget.style.color = T.red; e.currentTarget.style.background = T.redDim; }}
          onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.background = 'transparent'; }}>
          <Icon name="logout" size={15} />
          {!collapsed && 'Sign Out'}
        </button>
      </div>
    </aside>
  );
}
