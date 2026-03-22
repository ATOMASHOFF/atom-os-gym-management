import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { Card, PageHeader, Btn, Icon, TableWrapper, Th, Td, Avatar, Badge, Spinner, EmptyState, LoadingRows, SearchInput, Tabs, Modal, Input, Select, Textarea, ConfirmDialog } from '../../components/shared/UI';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

const MEMBER_FORM_DEFAULT = { name: '', email: '', phone: '', password: '', role: 'member', member_type: 'regular', date_of_birth: '', address: '', emergency_contact: '', notes: '' };

function MemberModal({ open, onClose, member, onSave, plans }) {
  const [form, setForm] = useState(MEMBER_FORM_DEFAULT);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setForm(member ? { ...MEMBER_FORM_DEFAULT, ...member, password: '' } : MEMBER_FORM_DEFAULT);
  }, [member, open]);

  // useCallback with setForm (stable) prevents new function refs on every render
  const f = useCallback((k) => (e) => setForm(p => ({ ...p, [k]: e.target.value })), []);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (member?.id) {
        await api.put(`/members/${member.id}`, form);
        toast('Member updated', 'success');
      } else {
        await api.post('/members', form);
        toast('Member created', 'success');
      }
      onSave();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save member', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={member?.id ? 'EDIT MEMBER' : 'ADD MEMBER'} width={560}>
      <form onSubmit={handle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input label="Full Name" value={form.name} onChange={f('name')} required style={{ gridColumn: '1/-1' }} />
          <Input label="Email" type="email" value={form.email} onChange={f('email')} required disabled={!!member?.id} />
          <Input label="Phone" value={form.phone} onChange={f('phone')} />
          {!member?.id && <Input label="Password" type="password" value={form.password} onChange={f('password')} required />}
          <Select label="Role" value={form.role} onChange={f('role')} options={[{value:'member',label:'Member'},{value:'staff',label:'Staff'},{value:'admin',label:'Admin'}]} />
          <Select label="Member Type" value={form.member_type} onChange={f('member_type')} options={[{value:'regular',label:'Regular'},{value:'guest',label:'Guest'},{value:'trial',label:'Trial'}]} />
          <Input label="Date of Birth" type="date" value={form.date_of_birth || ''} onChange={f('date_of_birth')} />
          <Input label="Emergency Contact" value={form.emergency_contact || ''} onChange={f('emergency_contact')} />
          <Textarea label="Address" value={form.address || ''} onChange={f('address')} rows={2} style={{ gridColumn: '1/-1' }} />
          <Textarea label="Notes" value={form.notes || ''} onChange={f('notes')} rows={2} style={{ gridColumn: '1/-1' }} />
          {member?.id && (
            <Select label="Status" value={form.status || 'active'} onChange={f('status')} options={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'},{value:'suspended',label:'Suspended'}]} style={{ gridColumn: '1/-1' }} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="ghost" onClick={onClose} type="button">Cancel</Btn>
          <Btn type="submit" disabled={loading}>{loading ? 'Saving...' : member?.id ? 'Save Changes' : 'Add Member'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

export default function MembersPage() {
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'all');
  const [showAdd, setShowAdd] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailMember, setDetailMember] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, p] = await Promise.all([
        api.get('/members'),
        isAdmin ? api.get('/members/pending') : Promise.resolve({ data: { members: [] } }),
      ]);
      setMembers((m.data?.data || m.data)?.members || []);
      setPending((p.data?.data || p.data)?.members || []);
    } catch (e) { toast('Failed to load members', 'error'); }
    finally { setLoading(false); }
  }, [isAdmin, toast]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = async (id) => {
    try {
      const r = await api.get(`/members/${id}`);
      setDetailData(r.data?.data || r.data);
    } catch (e) {}
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/members/${id}/approve`);
      toast('Member approved', 'success');
      load();
    } catch (e) { toast('Failed to approve', 'error'); }
  };
  const handleReject = async (id) => {
    try {
      await api.post(`/members/${id}/reject`);
      toast('Member rejected', 'info');
      load();
    } catch (e) { toast('Failed to reject', 'error'); }
  };
  const handleDelete = async () => {
    try {
      await api.delete(`/members/${deleteTarget.id}`);
      toast('Member removed', 'info');
      setDeleteTarget(null);
      load();
    } catch (e) { toast('Failed to delete', 'error'); }
  };

  const handleCloseModal = useCallback(() => { setShowAdd(false); setEditMember(null); }, []);
  const handleSaveMember = useCallback(() => { setShowAdd(false); setEditMember(null); load(); }, [load]);

  const list = tab === 'pending' ? pending : members;
  const filtered = list.filter(m =>
    !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase()) || m.phone?.includes(search)
  );

  const tabItems = [
    { id: 'all', label: `All (${members.length})` },
    { id: 'pending', label: `Pending${pending.length > 0 ? ` (${pending.length})` : ''}` },
  ];

  return (
    <div>
      <PageHeader title="MEMBERS" subtitle={`${filtered.length} records`} actions={
        isAdmin && <Btn onClick={() => setShowAdd(true)}><Icon name="add" size={14} /> Add Member</Btn>
      } />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {isAdmin && <Tabs tabs={tabItems} active={tab} onChange={setTab} />}
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone..." style={{ flex: 1, maxWidth: 340 }} />
      </div>

      <Card style={{ overflow: 'hidden' }}>
        <TableWrapper>
          <thead>
            <tr>
              <Th>Member</Th><Th>Phone</Th><Th>Role</Th><Th>Status</Th><Th>Type</Th>
              <Th>Sub Ends</Th><Th>Last Check-in</Th><Th>Joined</Th>
              {tab === 'pending' ? <Th>Actions</Th> : <Th>Actions</Th>}
            </tr>
          </thead>
          <tbody>
            {loading ? <LoadingRows cols={9} /> : filtered.length === 0 ? (
              <tr><td colSpan={9}><EmptyState icon="members" message={tab === 'pending' ? 'No pending registrations' : 'No members found'} /></td></tr>
            ) : filtered.map((m) => (
              <tr key={m.id} className="hover-row" style={{ cursor: 'pointer' }} onClick={() => { setDetailMember(m); loadDetail(m.id); }}>
                <Td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={m.name} size={32} /><div><div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div><div style={{ fontSize: 11, color: T.muted }}>{m.email}</div></div></div></Td>
                <Td><span style={{ fontFamily: T.mono, fontSize: 12, color: T.sub }}>{m.phone || '—'}</span></Td>
                <Td><Badge status={m.role} /></Td>
                <Td><Badge status={m.status} /></Td>
                <Td><Badge status={m.member_type || 'regular'} /></Td>
                <Td>
                  {m.subscription_end ? (
                    <span style={{ fontSize: 12, color: fmt.daysLeft(m.subscription_end) < 7 ? T.amber : T.sub, fontFamily: T.mono }}>
                      {fmt.date(m.subscription_end)}
                    </span>
                  ) : <span style={{ color: T.muted, fontSize: 12 }}>—</span>}
                </Td>
                <Td><span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{fmt.date(m.last_checkin)}</span></Td>
                <Td><span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{fmt.date(m.created_at)}</span></Td>
                <Td onClick={e => e.stopPropagation()}>
                  {tab === 'pending' ? (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <Btn variant="success" size="sm" onClick={() => handleApprove(m.id)}>✓</Btn>
                      <Btn variant="danger" size="sm" onClick={() => handleReject(m.id)}>✕</Btn>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <Btn variant="ghost" size="sm" onClick={() => setEditMember(m)}><Icon name="edit" size={13} /></Btn>
                      {isAdmin && <Btn variant="danger" size="sm" onClick={() => setDeleteTarget(m)}><Icon name="delete" size={13} /></Btn>}
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrapper>
      </Card>

      {/* Add/Edit modal */}
      <MemberModal open={showAdd || !!editMember} onClose={handleCloseModal} member={editMember} onSave={handleSaveMember} />

      {/* Delete confirm */}
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="DELETE MEMBER" message={`Are you sure you want to remove ${deleteTarget?.name}? This action cannot be undone.`} confirmLabel="Delete" danger />

      {/* Member detail */}
      <Modal open={!!detailMember} onClose={() => { setDetailMember(null); setDetailData(null); }} title="MEMBER DETAIL" width={600}>
        {detailData ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <Avatar name={detailData.name} size={56} />
              <div>
                <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 20 }}>{detailData.name}</div>
                <div style={{ color: T.sub, fontSize: 13 }}>{detailData.email}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}><Badge status={detailData.role} /><Badge status={detailData.status} /></div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[['Phone', detailData.phone || '—'],['Member Type', detailData.member_type],['Date of Birth', fmt.date(detailData.date_of_birth)],['Total Check-ins', detailData.total_checkins || 0],['Last Check-in', fmt.date(detailData.last_checkin)],['Joined', fmt.date(detailData.created_at)]].map(([k, v]) => (
                <div key={k} style={{ background: T.bg1, padding: '10px 14px', borderRadius: 5 }}>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 3 }}>{k.toUpperCase()}</div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{v}</div>
                </div>
              ))}
            </div>
            {detailData.subscriptions?.length > 0 && (
              <div>
                <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Subscriptions</div>
                {detailData.subscriptions.slice(0, 3).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: T.bg1, borderRadius: 4, marginBottom: 6, alignItems: 'center' }}>
                    <div><span style={{ fontWeight: 500 }}>{s.plan_name}</span> <span style={{ fontSize: 11, color: T.sub }}>· {fmt.date(s.start_date)} → {fmt.date(s.end_date)}</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontFamily: T.mono, fontSize: 12, color: T.green }}>{fmt.currency(s.amount_paid)}</span><Badge status={s.status} /></div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Btn size="sm" onClick={() => { setDetailMember(null); setEditMember(detailData); }}><Icon name="edit" size={13} /> Edit</Btn>
              <Btn size="sm" variant="blue" onClick={() => navigate(`/attendance?member_id=${detailData.id}`)}><Icon name="attendance" size={13} /> Attendance</Btn>
            </div>
          </div>
        ) : <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>}
      </Modal>
    </div>
  );
}
