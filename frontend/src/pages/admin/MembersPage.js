import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { Card, PageHeader, Btn, Icon, TableWrapper, Th, Td, Avatar, Badge,
  Spinner, EmptyState, LoadingRows, SearchInput, Tabs, Modal, Input,
  Select, Textarea, ConfirmDialog } from '../../components/shared/UI';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

const MEMBER_FORM_DEFAULT = {
  name: '', email: '', phone: '', password: '',
  role: 'member', member_type: 'regular',
  date_of_birth: '', address: '', emergency_contact: '', notes: '',
};

function MemberModal({ open, onClose, member, onSave }) {
  const [form, setForm] = useState(MEMBER_FORM_DEFAULT);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setForm(member ? { ...MEMBER_FORM_DEFAULT, ...member, password: '' } : MEMBER_FORM_DEFAULT);
  }, [member, open]);

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (member?.id) {
        await api.put(`/members/${member.id}`, form);
        toast('Member updated', 'success');
      } else {
        await api.post('/members', form);
        toast('Member added successfully!', 'success');
      }
      onSave();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save member', 'error');
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose}
      title={member?.id ? 'EDIT MEMBER' : 'ADD MEMBER'} width={560}>
      <form onSubmit={handle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input label="Full Name" value={form.name} onChange={f('name')} required style={{ gridColumn: '1/-1' }} />
          <Input label="Email" type="email" value={form.email} onChange={f('email')} required disabled={!!member?.id} />
          <Input label="Phone" value={form.phone} onChange={f('phone')} />
          {!member?.id && <Input label="Password" type="password" value={form.password} onChange={f('password')} required style={{ gridColumn: '1/-1' }} />}
          <Select label="Role" value={form.role} onChange={f('role')}
            options={[{value:'member',label:'Member'},{value:'staff',label:'Staff'},{value:'admin',label:'Admin'}]} />
          <Select label="Member Type" value={form.member_type} onChange={f('member_type')}
            options={[{value:'regular',label:'Regular'},{value:'guest',label:'Guest'},{value:'trial',label:'Trial'}]} />
          <Input label="Date of Birth" type="date" value={form.date_of_birth || ''} onChange={f('date_of_birth')} />
          <Input label="Emergency Contact" value={form.emergency_contact || ''} onChange={f('emergency_contact')} />
          <Textarea label="Address" value={form.address || ''} onChange={f('address')} rows={2} style={{ gridColumn: '1/-1' }} />
          <Textarea label="Notes" value={form.notes || ''} onChange={f('notes')} rows={2} style={{ gridColumn: '1/-1' }} />
          {member?.id && (
            <Select label="Status" value={form.status || 'active'} onChange={f('status')}
              options={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'},{value:'suspended',label:'Suspended'}]}
              style={{ gridColumn: '1/-1' }} />
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
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailMember, setDetailMember] = useState(null);
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { isAdmin } = useAuth();

  // Use fetch directly to bypass any axios/cache issues
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('atom_token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const ts = Date.now();

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache',
      };

      const searchQ = search ? `&search=${encodeURIComponent(search)}` : '';
      const [mRes, pRes] = await Promise.all([
        fetch(`${apiUrl}/members?_t=${ts}${searchQ}`, { headers }),
        isAdmin ? fetch(`${apiUrl}/members/pending?_t=${ts}`, { headers }) : Promise.resolve(null),
      ]);

      if (!mRes.ok) {
        const err = await mRes.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${mRes.status}`);
      }

      const mData = await mRes.json();
      const members = mData?.data?.members || mData?.members || [];
      const total = mData?.data?.total ?? mData?.total ?? members.length;

      setMembers(members);
      setTotal(total);

      if (pRes && pRes.ok) {
        const pData = await pRes.json().catch(() => ({}));
        setPending(pData?.data?.members || pData?.members || []);
      }
    } catch (e) {
      console.error('Members load error:', e);
      setError(e.message || 'Failed to load members');
      toast('Failed to load members: ' + (e.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [search, isAdmin, toast]);

  useEffect(() => {
    if (searchParams.get('tab') === 'pending') setTab('pending');
  }, [searchParams]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    try {
      await api.post(`/members/${id}/approve`);
      toast('Member approved', 'success');
      load();
    } catch (err) { toast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/members/${id}/reject`);
      toast('Member rejected', 'info');
      load();
    } catch (err) { toast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/members/${deleteTarget.id}`);
      toast('Member removed', 'info');
      setDeleteTarget(null);
      load();
    } catch (err) { toast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const TABS = [
    { id: 'all',     label: `All (${total})` },
    { id: 'pending', label: `Pending (${pending.length})` },
  ];

  const displayed = tab === 'pending' ? pending : members;

  return (
    <div>
      <PageHeader
        title="MEMBERS"
        subtitle={`${total} records`}
        actions={
          isAdmin && (
            <Btn onClick={() => setShowAdd(true)}>
              <Icon name="add" size={14} /> Add Member
            </Btn>
          )
        }
      />

      {/* Error banner */}
      {error && (
        <div style={{
          background: T.redDim, border: `1px solid ${T.red}44`,
          borderRadius: 6, padding: '12px 16px', marginBottom: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: T.red, fontSize: 13 }}>⚠ {error}</span>
          <Btn variant="ghost" size="sm" onClick={load}>Retry</Btn>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {isAdmin && <Tabs tabs={TABS} active={tab} onChange={setTab} />}
        <SearchInput
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, phone..."
          style={{ flex: 1, maxWidth: 320 }}
        />
        <Btn variant="ghost" size="sm" onClick={load} disabled={loading}>
          <Icon name="refresh" size={13} /> {loading ? 'Loading...' : 'Refresh'}
        </Btn>
      </div>

      <Card style={{ overflow: 'hidden' }}>
        <TableWrapper>
          <thead>
            <tr>
              <Th>ID</Th>
              <Th>Member</Th>
              <Th>Phone</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Type</Th>
              <Th>Sub Ends</Th>
              <Th>Last Check-in</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows cols={9} />
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    icon="members"
                    message={tab === 'pending' ? 'No pending approvals' : 'No members found'}
                    action={isAdmin && tab === 'all' && (
                      <Btn onClick={() => setShowAdd(true)}>Add First Member</Btn>
                    )}
                  />
                </td>
              </tr>
            ) : displayed.map((m) => (
              <tr key={m.id} className="hover-row" style={{ cursor: 'pointer' }}
                onClick={() => setDetailMember(m)}>
                <Td>
                  <span style={{
                    fontFamily: T.mono, fontSize: 11, color: T.accent,
                    background: T.accentDim, padding: '2px 6px', borderRadius: 3,
                  }}>
                    {m.member_code || `ATM-${String(m.id).padStart(6, '0')}`}
                  </span>
                </Td>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={m.name} size={32} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: T.muted }}>{m.email}</div>
                    </div>
                  </div>
                </Td>
                <Td><span style={{ fontSize: 12 }}>{m.phone || '—'}</span></Td>
                <Td><Badge status={m.role} /></Td>
                <Td><Badge status={m.status} /></Td>
                <Td><span style={{ fontSize: 11, color: T.sub }}>{m.member_type}</span></Td>
                <Td>
                  <span style={{
                    fontFamily: T.mono, fontSize: 11,
                    color: m.subscription_end
                      ? (fmt.daysLeft(m.subscription_end) < 7 ? T.amber : T.sub)
                      : T.muted,
                  }}>
                    {m.subscription_end ? fmt.date(m.subscription_end) : '—'}
                  </span>
                </Td>
                <Td>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>
                    {m.last_checkin ? fmt.date(m.last_checkin) : '—'}
                  </span>
                </Td>
                <Td onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {tab === 'pending' ? (
                      <>
                        <Btn size="sm" onClick={() => handleApprove(m.id)}>Approve</Btn>
                        <Btn size="sm" variant="danger" onClick={() => handleReject(m.id)}>Reject</Btn>
                      </>
                    ) : (
                      <>
                        {isAdmin && (
                          <Btn size="sm" variant="ghost" onClick={() => setEditMember(m)}>
                            <Icon name="edit" size={12} />
                          </Btn>
                        )}
                        {isAdmin && (
                          <Btn size="sm" variant="danger" onClick={() => setDeleteTarget(m)}>
                            <Icon name="delete" size={12} />
                          </Btn>
                        )}
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrapper>
      </Card>

      <MemberModal
        open={showAdd || !!editMember}
        onClose={() => { setShowAdd(false); setEditMember(null); }}
        member={editMember}
        onSave={() => { setShowAdd(false); setEditMember(null); load(); }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Member"
        message={`Remove ${deleteTarget?.name}? This cannot be undone.`}
        confirmLabel="Remove"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
