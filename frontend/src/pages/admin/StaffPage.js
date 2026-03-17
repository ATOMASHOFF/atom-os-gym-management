import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { Card, PageHeader, Btn, Icon, Avatar, Badge, Spinner, EmptyState, Modal, Input, ConfirmDialog } from '../../components/shared/UI';
import { useToast } from '../../context/ToastContext';

const PERMS = [
  { key: 'can_scan_attendance', label: 'Scan Attendance' },
  { key: 'can_view_members', label: 'View Members' },
  { key: 'can_add_members', label: 'Add Members' },
  { key: 'can_edit_members', label: 'Edit Members' },
  { key: 'can_delete_members', label: 'Delete Members' },
  { key: 'can_view_subscriptions', label: 'View Subscriptions' },
  { key: 'can_add_subscriptions', label: 'Add Subscriptions' },
  { key: 'can_view_attendance', label: 'View Attendance' },
  { key: 'can_view_reports', label: 'View Reports' },
  { key: 'can_view_financial', label: 'Financial Data' },
];

function ToggleSwitch({ checked, onChange }) {
  return (
    <div onClick={onChange} style={{ width: 38, height: 20, borderRadius: 10, background: checked ? T.accent : T.bg1, border: `1px solid ${checked ? T.accent : T.border}`, cursor: 'pointer', transition: 'all 0.2s', position: 'relative', flexShrink: 0 }}>
      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: checked ? 20 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.4)' }} />
    </div>
  );
}

function StaffModal({ open, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [perms, setPerms] = useState({});
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/staff', { ...form, permissions: perms });
      toast('Staff member added', 'success');
      onSave();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed', 'error');
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="ADD STAFF MEMBER" width={520}>
      <form onSubmit={handle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <Input label="Full Name" value={form.name} onChange={f('name')} required style={{ gridColumn: '1/-1' }} />
          <Input label="Email" type="email" value={form.email} onChange={f('email')} required />
          <Input label="Phone" value={form.phone} onChange={f('phone')} />
          <Input label="Password" type="password" value={form.password} onChange={f('password')} required style={{ gridColumn: '1/-1' }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: T.sub, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>Permissions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PERMS.map(p => (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.bg1, padding: '9px 12px', borderRadius: 5 }}>
                <span style={{ fontSize: 12, color: perms[p.key] ? T.white : T.sub }}>{p.label}</span>
                <ToggleSwitch checked={!!perms[p.key]} onChange={() => setPerms(pp => ({ ...pp, [p.key]: !pp[p.key] }))} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose} type="button">Cancel</Btn>
          <Btn type="submit" disabled={loading}>{loading ? 'Adding...' : 'Add Staff'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

function PermModal({ open, onClose, staff, onSave }) {
  const [perms, setPerms] = useState({});
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (staff) setPerms({ ...staff });
  }, [staff]);

  const handle = async () => {
    setLoading(true);
    try {
      await api.put(`/staff/${staff.id}/permissions`, perms);
      toast('Permissions updated', 'success');
      onSave();
    } catch (e) { toast('Failed to update', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`PERMISSIONS · ${staff?.name || ''}`} width={480}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
        {PERMS.map(p => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.bg1, padding: '9px 12px', borderRadius: 5 }}>
            <span style={{ fontSize: 12, color: perms[p.key] ? T.white : T.sub }}>{p.label}</span>
            <ToggleSwitch checked={!!perms[p.key]} onChange={() => setPerms(pp => ({ ...pp, [p.key]: !pp[p.key] }))} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handle} disabled={loading}>{loading ? 'Saving...' : 'Save Permissions'}</Btn>
      </div>
    </Modal>
  );
}

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [permTarget, setPermTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/staff');
      setStaff(r.data.staff || []);
    } catch (e) { toast('Failed to load staff', 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    try {
      await api.delete(`/staff/${deleteTarget.id}`);
      toast('Staff removed', 'info');
      setDeleteTarget(null);
      load();
    } catch (e) { toast('Failed', 'error'); }
  };

  return (
    <div>
      <PageHeader title="STAFF" subtitle={`${staff.length} staff members`} actions={
        <Btn onClick={() => setShowAdd(true)}><Icon name="add" size={14} /> Add Staff</Btn>
      } />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={28} /></div>
      ) : staff.length === 0 ? (
        <Card><EmptyState icon="staff" message="No staff members yet" action={<Btn onClick={() => setShowAdd(true)}>Add First Staff Member</Btn>} /></Card>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {staff.map((s, i) => (
            <Card key={s.id} className={`fadeUp-${Math.min(i+1,5)}`} style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                <Avatar name={s.name} size={46} />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 2 }}>{s.email}</div>
                  <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{s.phone || '—'}</div>
                  <div style={{ marginTop: 8 }}><Badge status={s.status || 'active'} /></div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 2 }}>
                  {PERMS.filter(p => s[p.key]).map(p => (
                    <span key={p.key} style={{ background: T.greenDim, color: T.green, padding: '2px 8px', borderRadius: 3, fontSize: 10, fontFamily: T.mono }}>{p.label}</span>
                  ))}
                  {PERMS.filter(p => s[p.key]).length === 0 && <span style={{ color: T.muted, fontSize: 11, fontFamily: T.mono }}>No permissions granted</span>}
                </div>
                <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                  <Btn size="sm" variant="blue" onClick={() => setPermTarget(s)}><Icon name="settings" size={13} /> Permissions</Btn>
                  <Btn size="sm" variant="danger" onClick={() => setDeleteTarget(s)}><Icon name="delete" size={13} /></Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <StaffModal open={showAdd} onClose={() => setShowAdd(false)} onSave={() => { setShowAdd(false); load(); }} />
      <PermModal open={!!permTarget} onClose={() => setPermTarget(null)} staff={permTarget} onSave={() => { setPermTarget(null); load(); }} />
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="REMOVE STAFF" message={`Remove ${deleteTarget?.name} from staff?`} confirmLabel="Remove" danger />
    </div>
  );
}
