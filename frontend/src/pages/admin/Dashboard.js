import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { useToast } from '../../context/ToastContext';
import { StatCard, Card, PageHeader, Btn, Icon, TableWrapper, Th, Td, Avatar, Badge, Spinner } from '../../components/shared/UI';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [today, setToday] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t, e] = await Promise.all([
        api.get('/members/dashboard-stats'),
        api.get('/attendance/today'),
        api.get('/subscriptions?status=active&limit=50'),
      ]);
      // FIXED: handle both {success,data:{...}} and direct object
      const statsData = s.data?.data || s.data || {};
      const todayData = t.data?.data?.attendance || t.data?.attendance || [];
      const subsData  = e.data?.data?.subscriptions || e.data?.subscriptions || [];
      setStats(statsData);
      setToday(todayData);
      setExpiring(subsData.filter(s => {
        const d = fmt.daysLeft(s.end_date);
        return d !== null && d <= 7 && d >= 0;
      }).slice(0, 5));
    } catch (err) {
      console.error('Dashboard load error:', err);
      toast('Could not load dashboard data — retrying...', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const statData = [
    { label: 'Total Members', value: fmt.num(stats?.total_members), icon: 'members', color: T.accent, sub: `${fmt.num(stats?.active_members)} active`, className: 'fadeUp-1' },
    { label: 'Active Subs', value: fmt.num(stats?.active_subscriptions), icon: 'subscriptions', color: T.green, sub: `${fmt.num(stats?.expired_subscriptions)} expired`, className: 'fadeUp-2' },
    { label: "Today's Check-ins", value: fmt.num(stats?.today_checkins), icon: 'attendance', color: T.blue, sub: new Date().toLocaleDateString('en-IN', { weekday: 'long' }), className: 'fadeUp-3' },
    { label: 'Monthly Revenue', value: fmt.currency(stats?.monthly_revenue), icon: 'money', color: T.amber, sub: `${fmt.currency(stats?.total_revenue)} total`, className: 'fadeUp-4' },
    { label: 'Pending Approvals', value: fmt.num(stats?.pending_members), icon: 'warning', color: T.red, sub: 'Awaiting review', className: 'fadeUp-5' },
    { label: 'Expiring Soon', value: fmt.num(stats?.expiring_soon), icon: 'info_circle', color: T.purple, sub: 'Within 7 days', className: 'fadeUp-5' },
  ];

  return (
    <div>
      <PageHeader
        title="DASHBOARD"
        subtitle={new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={load} size="sm" disabled={loading}>
              <Icon name="refresh" size={13} />{loading ? 'Loading...' : 'Refresh'}
            </Btn>
            <Btn onClick={() => window.location.href = '/scanner'} size="sm">
              <Icon name="qr" size={13} /> Quick Scan
            </Btn>
          </div>
        }
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        {loading ? Array.from({length: 6}).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 108, borderRadius: 6 }} />
        )) : statData.map((s, i) => <StatCard key={i} {...s} />)}
      </div>

      {/* Pending banner */}
      {stats?.pending_members > 0 && (
        <div className="fadeUp" style={{ background: T.amberDim, border: `1px solid ${T.amber}44`, borderRadius: 6, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="warning" size={18} color={T.amber} />
            <span style={{ color: T.amber, fontWeight: 600 }}>{stats.pending_members} member{stats.pending_members > 1 ? 's' : ''} waiting for approval</span>
          </div>
          <Btn size="sm" onClick={() => navigate('/members?tab=pending')} style={{ background: T.amber, color: '#000' }}>Review Now</Btn>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Today check-ins */}
        <Card className="fadeUp" style={{ overflow: 'hidden', gridColumn: today.length > 0 ? '1 / -1' : '1' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.display, fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              <Icon name="attendance" size={15} color={T.blue} />
              Today's Check-ins
              <span style={{ background: T.blueDim, color: T.blue, padding: '1px 8px', borderRadius: 10, fontSize: 11, fontFamily: T.mono }}>{today.length}</span>
            </div>
            <Btn size="sm" variant="ghost" onClick={() => navigate('/attendance')}>View All</Btn>
          </div>
          {loading ? (
            <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
          ) : today.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: T.muted, fontFamily: T.mono, fontSize: 11, letterSpacing: '0.1em' }}>NO CHECK-INS TODAY YET</div>
          ) : (
            <TableWrapper>
              <thead><tr><Th>Member</Th><Th>Time</Th><Th>Method</Th><Th>Plan</Th></tr></thead>
              <tbody>
                {today.slice(0, 10).map((r, i) => (
                  <tr key={r.id} className="hover-row">
                    <Td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={r.member_name} size={28} /><div><div style={{ fontWeight: 500, fontSize: 13 }}>{r.member_name}</div><div style={{ fontSize: 11, color: T.muted }}>{r.member_email}</div></div></div></Td>
                    <Td><span style={{ fontFamily: T.mono, fontSize: 12, color: T.sub }}>{fmt.time(r.check_in_time)}</span></Td>
                    <Td><span style={{ background: r.scan_method === 'qr' ? T.blueDim : T.amberDim, color: r.scan_method === 'qr' ? T.blue : T.amber, padding: '2px 7px', borderRadius: 3, fontSize: 10, fontFamily: T.mono, textTransform: 'uppercase' }}>{r.scan_method || 'manual'}</span></Td>
                    <Td><span style={{ fontSize: 12, color: T.sub }}>{r.plan_name || '—'}</span></Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
          )}
        </Card>

        {/* Expiring subs */}
        {expiring.length > 0 && (
          <Card className="fadeUp" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.display, fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                <Icon name="warning" size={15} color={T.amber} />
                Expiring Soon
              </div>
              <Btn size="sm" variant="ghost" onClick={() => navigate('/subscriptions')}>View All</Btn>
            </div>
            <div>
              {expiring.map((s, i) => {
                const d = fmt.daysLeft(s.end_date);
                return (
                  <div key={s.id} style={{ padding: '12px 18px', borderBottom: `1px solid ${T.border}33`, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar name={s.member_name} size={30} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{s.member_name}</div>
                      <div style={{ fontSize: 11, color: T.sub }}>{s.plan_name}</div>
                    </div>
                    <span style={{ background: d <= 2 ? T.redDim : T.amberDim, color: d <= 2 ? T.red : T.amber, padding: '3px 8px', borderRadius: 3, fontSize: 11, fontFamily: T.mono, fontWeight: 700 }}>
                      {d === 0 ? 'TODAY' : `${d}d left`}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
