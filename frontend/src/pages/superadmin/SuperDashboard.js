import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { PageHeader, Card, StatCard, Btn, Icon, Spinner, Badge } from '../../components/shared/UI';
import { useToast } from '../../context/ToastContext';

export default function SuperDashboard() {
  const [stats, setStats] = useState(null);
  const [gyms, setGyms]   = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, g] = await Promise.all([
        api.get('/super/stats'),
        api.get('/super/gyms'),
      ]);
      // api.js unwraps { success, data } → r.data = inner data
      setStats(s.data || {});
      setGyms((g.data?.gyms || g.data || []).slice(0, 8));
    } catch (e) {
      toast('Failed to load platform stats', 'error');
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const statCards = [
    { label: 'Total Gyms',        value: fmt.num(stats?.total_gyms),             icon: 'gym',           color: T.accent,  sub: `${fmt.num(stats?.active_gyms)} active`,        className: 'fadeUp-1' },
    { label: 'Total Members',     value: fmt.num(stats?.total_members),           icon: 'members',       color: T.blue,    sub: `${fmt.num(stats?.new_this_month)} new / month`, className: 'fadeUp-2' },
    { label: 'Active Subs',       value: fmt.num(stats?.active_subscriptions),   icon: 'subscriptions', color: T.green,   sub: `${fmt.num(stats?.expired_subscriptions)} expired`, className: 'fadeUp-3' },
    { label: "Today's Check-ins", value: fmt.num(stats?.today_checkins),         icon: 'attendance',    color: T.amber,   sub: `${fmt.num(stats?.total_checkins)} total`,      className: 'fadeUp-4' },
    { label: 'Total Revenue',     value: fmt.currency(stats?.total_revenue),     icon: 'money',         color: T.purple,  sub: `${fmt.currency(stats?.monthly_revenue)} / month`, className: 'fadeUp-5' },
    { label: 'Pending Approvals', value: fmt.num(stats?.pending_members),        icon: 'warning',       color: T.red,     sub: 'Across all gyms',                              className: 'fadeUp-5' },
  ];

  return (
    <div>
      <PageHeader
        title="PLATFORM OVERVIEW"
        subtitle={`Mahnwas Technologies · ${new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}`}
        actions={
          <Btn onClick={() => navigate('/super/gyms')}>
            <Icon name="add" size={14} /> Add New Gym
          </Btn>
        }
      />

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 28 }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 108, borderRadius: 6 }} />
            ))
          : statCards.map((s, i) => <StatCard key={i} {...s} />)
        }
      </div>

      {/* Gyms table */}
      <Card style={{ overflow: 'hidden' }} className="fadeUp">
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            All Gyms
          </div>
          <Btn variant="ghost" size="sm" onClick={() => navigate('/super/gyms')}>View All</Btn>
        </div>

        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : gyms.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.muted, fontFamily: T.mono, fontSize: 11 }}>
            NO GYMS YET — CREATE THE FIRST ONE
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.bg1 }}>
                  {['Gym', 'Plan', 'Members', 'Active Subs', 'Today', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em', borderBottom: `1px solid ${T.border}`, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gyms.map(g => (
                  <tr key={g.id} className="hover-row" style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/super/gyms/${g.id}`)}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{g.name}</div>
                      <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>{g.owner_email}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: T.accentDim, color: T.accent, padding: '2px 8px', borderRadius: 3, fontSize: 10, fontFamily: T.mono, textTransform: 'uppercase' }}>{g.plan || 'starter'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: T.mono, fontSize: 13, color: T.blue, fontWeight: 600 }}>{fmt.num(g.active_members)}</td>
                    <td style={{ padding: '12px 16px', fontFamily: T.mono, fontSize: 13, color: T.green, fontWeight: 600 }}>{fmt.num(g.active_subscriptions)}</td>
                    <td style={{ padding: '12px 16px', fontFamily: T.mono, fontSize: 13, color: T.amber, fontWeight: 600 }}>{fmt.num(g.today_checkins)}</td>
                    <td style={{ padding: '12px 16px' }}><Badge status={g.is_active ? 'active' : 'inactive'} /></td>
                    <td style={{ padding: '12px 16px' }}><Icon name="chevron_right" size={16} color={T.muted} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
