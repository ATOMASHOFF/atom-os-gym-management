import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { Card, PageHeader, Spinner, EmptyState, Icon } from '../../components/shared/UI';
import { useAuth } from '../../context/AuthContext';

export default function MyAttendancePage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      api.get(`/attendance/member/${user.id}`).then(r => setLogs(r.data.attendance || [])).catch(() => {}).finally(() => setLoading(false));
    }
  }, [user]);

  // Build calendar-like heatmap data
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    const ds = d.toISOString().split('T')[0];
    const visited = logs.some(l => (l.check_in_date || l.check_in_time?.split('T')[0]) === ds);
    return { date: ds, visited, day: d.getDate(), weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }) };
  });

  return (
    <div>
      <PageHeader title="MY ATTENDANCE" subtitle={`${logs.length} total visits recorded`} />

      {/* 30-day heatmap */}
      <Card style={{ padding: 20, marginBottom: 20 }} className="fadeUp">
        <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 14, color: T.sub }}>Last 30 Days</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6 }}>
          {last30.map(d => (
            <div key={d.date} title={`${d.date}${d.visited ? ' — Visited ✓' : ''}`} style={{ aspectRatio: 1, borderRadius: 4, background: d.visited ? T.accent : T.bg1, border: `1px solid ${d.visited ? T.accent + '66' : T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: d.visited ? '#fff' : T.muted, fontFamily: T.mono, cursor: 'default' }}>
              {d.day}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.muted }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: T.accent }} />Visited
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.muted }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: T.bg1, border: `1px solid ${T.border}` }} />No visit
          </div>
          <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>
            {last30.filter(d => d.visited).length} / 30 days attended
          </span>
        </div>
      </Card>

      {/* Logs */}
      <Card style={{ overflow: 'hidden' }} className="fadeUp-1">
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, fontFamily: T.display, fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase' }}>All Visits</div>
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : logs.length === 0 ? (
          <EmptyState icon="attendance" message="No visits recorded yet" />
        ) : (
          <div>
            {logs.map((l, i) => (
              <div key={l.id} style={{ padding: '12px 20px', borderBottom: `1px solid ${T.border}33`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 5, background: T.greenDim, border: `1px solid ${T.green}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={18} color={T.green} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{fmt.date(l.check_in_date || l.check_in_time)}</div>
                    <div style={{ fontSize: 12, color: T.sub, fontFamily: T.mono }}>{fmt.time(l.check_in_time)}</div>
                  </div>
                </div>
                <span style={{ background: l.scan_method === 'qr' ? T.blueDim : T.amberDim, color: l.scan_method === 'qr' ? T.blue : T.amber, padding: '3px 9px', borderRadius: 3, fontSize: 10, fontFamily: T.mono, textTransform: 'uppercase' }}>
                  {l.scan_method || 'manual'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
