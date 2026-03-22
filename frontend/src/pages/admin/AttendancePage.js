import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { Card, PageHeader, Btn, Icon, TableWrapper, Th, Td, Avatar, EmptyState, LoadingRows, SearchInput, Modal, Select } from '../../components/shared/UI';
import { useToast } from '../../context/ToastContext';

export default function AttendancePage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCheckin, setShowCheckin] = useState(false);
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/attendance?limit=200';
      if (dateFrom) url += `&date_from=${dateFrom}`;
      if (dateTo) url += `&date_to=${dateTo}`;
      const memberId = searchParams.get('member_id');
      if (memberId) url += `&member_id=${memberId}`;
      const r = await api.get(url);
      setLogs((r.data?.data || r.data)?.attendance || []);
    } catch (e) { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, toast, searchParams]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showCheckin) {
      api.get('/members?role=member').then(r => setMembers((r.data?.data?.members || r.data?.members || []).filter(m => m.status === 'active') || []));
    }
  }, [showCheckin]);

  const handleManualCheckin = async () => {
    if (!selectedMember) { toast('Select a member', 'error'); return; }
    setCheckinLoading(true);
    try {
      const r = await api.post('/attendance/checkin', { member_id: selectedMember });
      toast(`${r.data?.data?.member?.name || r.data?.member?.name} checked in!`, 'success');
      setShowCheckin(false);
      setSelectedMember('');
      load();
    } catch (err) {
      const msg = err.response?.data?.message || 'Check-in failed';
      toast(msg, err.response?.data?.already_checked_in ? 'info' : 'error');
    } finally { setCheckinLoading(false); }
  };

  const filtered = logs.filter(l => !search || l.member_name?.toLowerCase().includes(search.toLowerCase()) || l.member_email?.toLowerCase().includes(search.toLowerCase()));

  // Stats
  const todayCount = logs.filter(l => l.check_in_date === new Date().toISOString().split('T')[0]).length;
  const qrCount = logs.filter(l => l.scan_method === 'qr').length;

  return (
    <div>
      <PageHeader title="ATTENDANCE" subtitle={`${logs.length} total logs`} actions={
        <Btn onClick={() => setShowCheckin(true)}><Icon name="checkin" size={14} /> Manual Check-in</Btn>
      } />

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Today', value: todayCount, color: T.blue },
          { label: 'QR Scans', value: qrCount, color: T.green },
          { label: 'Manual', value: logs.length - qrCount, color: T.amber },
          { label: 'Total', value: logs.length, color: T.accent },
        ].map(s => (
          <div key={s.label} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 5, padding: '10px 18px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 22, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member..." style={{ flex: 1, maxWidth: 280 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: 'uppercase' }}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 4, padding: '7px 10px', color: T.white, fontSize: 12 }} />
          <label style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: 'uppercase' }}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 4, padding: '7px 10px', color: T.white, fontSize: 12 }} />
          {(dateFrom || dateTo) && <Btn variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</Btn>}
        </div>
        <Btn variant="ghost" size="sm" onClick={load}><Icon name="refresh" size={13} /></Btn>
      </div>

      <Card style={{ overflow: 'hidden' }}>
        <TableWrapper>
          <thead><tr><Th>Member</Th><Th>Date</Th><Th>Time</Th><Th>Method</Th><Th>Plan</Th></tr></thead>
          <tbody>
            {loading ? <LoadingRows cols={5} /> : filtered.length === 0 ? (
              <tr><td colSpan={5}><EmptyState icon="attendance" message="No attendance logs found" /></td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="hover-row">
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={r.member_name} size={28} />
                    <div><div style={{ fontWeight: 500, fontSize: 13 }}>{r.member_name}</div><div style={{ fontSize: 11, color: T.muted }}>{r.member_email}</div></div>
                  </div>
                </Td>
                <Td><span style={{ fontFamily: T.mono, fontSize: 12, color: T.sub }}>{fmt.date(r.check_in_date || r.check_in_time)}</span></Td>
                <Td><span style={{ fontFamily: T.mono, fontSize: 12, color: T.sub }}>{fmt.time(r.check_in_time)}</span></Td>
                <Td>
                  <span style={{ background: r.scan_method === 'qr' ? T.blueDim : T.amberDim, color: r.scan_method === 'qr' ? T.blue : T.amber, padding: '2px 8px', borderRadius: 3, fontSize: 10, fontFamily: T.mono, textTransform: 'uppercase' }}>
                    {r.scan_method || 'manual'}
                  </span>
                </Td>
                <Td><span style={{ fontSize: 12, color: T.sub }}>{r.plan_name || '—'}</span></Td>
              </tr>
            ))}
          </tbody>
        </TableWrapper>
      </Card>

      {/* Manual check-in modal */}
      <Modal open={showCheckin} onClose={() => setShowCheckin(false)} title="MANUAL CHECK-IN" width={400}>
        <div style={{ marginBottom: 20 }}>
          <Select label="Select Member" value={selectedMember} onChange={e => setSelectedMember(e.target.value)}
            options={[{ value: '', label: '— Select Active Member —' }, ...members.map(m => ({ value: m.id, label: `${m.name} · ${m.email}` }))]} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowCheckin(false)}>Cancel</Btn>
          <Btn onClick={handleManualCheckin} disabled={checkinLoading || !selectedMember}>
            {checkinLoading ? 'Checking in...' : 'Check In'}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
