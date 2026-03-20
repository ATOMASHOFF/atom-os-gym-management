import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { PageHeader, Card, Btn, Icon, Spinner, Badge, StatCard, Avatar, Modal, Input, Tabs, TableWrapper, Th, Td, LoadingRows, EmptyState } from '../../components/shared/UI';
import { useToast } from '../../context/ToastContext';

function ResetPasswordModal({ open, onClose, admin, gymId }) {
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handle = async () => {
    if (pwd.length < 8) { toast('Password must be 8+ characters', 'error'); return; }
    setLoading(true);
    try {
      await api.post(`/super/gyms/${gymId}/admins/${admin.id}/reset-password`, { new_password: pwd });
      toast('Password reset!', 'success');
      onClose();
    } catch (err) { toast(getErrorMessage(err), 'error'); }
    finally { setLoading(false); setPwd(''); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`RESET PASSWORD — ${admin?.name}`} width={380}>
      <div style={{ marginBottom: 20 }}>
        <Input label="New Password" type="password" value={pwd} onChange={e => setPwd(e.target.value)} helperText="Minimum 8 characters" />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" onClick={handle} disabled={loading || pwd.length < 8}>
          {loading ? 'Resetting...' : 'Reset Password'}
        </Btn>
      </div>
    </Modal>
  );
}

function AddAdminModal({ open, onClose, gymId, onAdded }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handle = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/super/gyms/${gymId}/admins`, form);
      toast('Admin added!', 'success');
      onAdded();
      onClose();
    } catch (err) { toast(getErrorMessage(err), 'error'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="ADD GYM ADMIN" width={440}>
      <form onSubmit={handle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Name" value={form.name} onChange={f('name')} required />
          <Input label="Email" type="email" value={form.email} onChange={f('email')} required />
          <Input label="Phone" value={form.phone} onChange={f('phone')} />
          <Input label="Password" type="password" value={form.password} onChange={f('password')} required helperText="Min 8 characters" />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="ghost" onClick={onClose} type="button">Cancel</Btn>
          <Btn type="submit" disabled={loading}>{loading ? 'Adding...' : 'Add Admin'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

export default function GymDetailPage() {
  const { gymId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [tab, setTab] = useState('overview');
  const [resetTarget, setResetTarget] = useState(null);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/super/gyms/${gymId}`);
      setData(r.data?.data || r.data);
    } catch { toast('Failed to load gym', 'error'); navigate('/super/gyms'); }
    finally { setLoading(false); }
  }, [gymId, toast, navigate]);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const r = await api.get(`/super/gyms/${gymId}/members`, {
        params: { search: memberSearch, role: memberRole }
      });
      const md = r.data?.data || r.data;
      setMembers(md?.members || []);
    } catch { toast('Failed to load members', 'error'); }
    finally { setMembersLoading(false); }
  }, [gymId, memberSearch, memberRole, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'members') loadMembers(); }, [tab, loadMembers]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await api.patch(`/super/gyms/${gymId}/toggle`);
      toast(`Gym ${data.gym.is_active ? 'deactivated' : 'activated'}`, 'info');
      load();
    } catch { toast('Failed', 'error'); }
    finally { setToggling(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32} /></div>;
  if (!data) return null;

  const { gym, stats, admins, recent_checkins } = data;

  const statCards = [
    { label: 'Active Members',  value: fmt.num(stats?.total_members),         icon: 'members',       color: T.blue   },
    { label: 'Active Subs',     value: fmt.num(stats?.active_subscriptions),  icon: 'subscriptions', color: T.green  },
    { label: 'Total Revenue',   value: fmt.currency(stats?.total_revenue),    icon: 'money',         color: T.accent },
    { label: 'Today Check-ins', value: fmt.num(stats?.today_checkins),        icon: 'attendance',    color: T.amber  },
    { label: 'Monthly Revenue', value: fmt.currency(stats?.monthly_revenue),  icon: 'trend_up',      color: T.purple },
    { label: 'Total Check-ins', value: fmt.num(stats?.total_checkins),        icon: 'checkin',       color: T.sub    },
  ];

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'members',  label: `Members (${fmt.num(stats?.total_members)})` },
    { id: 'admins',   label: 'Admins' },
    { id: 'audit',    label: 'Audit Log' },
  ];

  return (
    <div>
      <PageHeader
        title={gym.name}
        subtitle={`${gym.slug} · ${gym.plan?.toUpperCase()} plan · ${gym.address || 'No address'}`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={() => navigate('/super/gyms')}>← Back</Btn>
            <Btn
              variant={gym.is_active ? 'danger' : 'success'}
              disabled={toggling}
              onClick={handleToggle}
            >
              {toggling ? 'Updating...' : gym.is_active ? 'Deactivate Gym' : 'Activate Gym'}
            </Btn>
          </div>
        }
      />

      {/* Gym status banner */}
      {!gym.is_active && (
        <div style={{ background: T.redDim, border: `1px solid ${T.red}44`, borderRadius: 6, padding: '12px 18px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icon name="warning" size={16} color={T.red} />
          <span style={{ color: T.red, fontSize: 13, fontWeight: 600 }}>This gym is deactivated. Members cannot log in.</span>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {statCards.map((s, i) => <StatCard key={i} {...s} className={`fadeUp-${Math.min(i+1,5)}`} />)}
      </div>

      {/* Tab nav */}
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      <div style={{ height: 16 }} />

      {/* Overview tab */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Gym info */}
          <Card style={{ padding: 20 }}>
            <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', color: T.sub, letterSpacing: '0.05em', marginBottom: 14 }}>Gym Info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Name',       gym.name],
                ['Slug',       gym.slug],
                ['Owner',      gym.owner_name],
                ['Email',      gym.owner_email],
                ['Phone',      gym.owner_phone || '—'],
                ['Address',    gym.address || '—'],
                ['Plan',       gym.plan?.toUpperCase()],
                ['Created',    fmt.date(gym.created_at)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.border}22` }}>
                  <span style={{ fontSize: 12, color: T.muted, fontFamily: T.mono }}>{k}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Check-in trend */}
          <Card style={{ padding: 20 }}>
            <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', color: T.sub, letterSpacing: '0.05em', marginBottom: 14 }}>
              Check-in Trend (Last 30 days)
            </div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 80 }}>
              {(recent_checkins || []).slice().reverse().map((d, i) => {
                const max = Math.max(...(recent_checkins || []).map(x => parseInt(x.checkin_count) || 0), 1);
                const h = Math.max(4, (parseInt(d.checkin_count) / max) * 70);
                return (
                  <div key={i} title={`${fmt.date(d.check_in_date)}: ${d.checkin_count} check-ins`}
                    style={{ flex: 1, height: h, background: T.accent, borderRadius: '2px 2px 0 0', opacity: 0.7, minWidth: 4 }} />
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <input
              placeholder="Search name or email..."
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 4, padding: '8px 12px', color: T.white, fontSize: 13, flex: 1, maxWidth: 280 }}
            />
            <select value={memberRole} onChange={e => setMemberRole(e.target.value)}
              style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 4, padding: '8px 12px', color: T.white, fontSize: 13 }}>
              <option value="">All roles</option>
              <option value="member">Members</option>
              <option value="staff">Staff</option>
              <option value="admin">Admins</option>
            </select>
            <Btn variant="ghost" size="sm" onClick={loadMembers}><Icon name="refresh" size={13} /></Btn>
          </div>
          <Card style={{ overflow: 'hidden' }}>
            <TableWrapper>
              <thead>
                <tr>
                  <Th>Member</Th><Th>Role</Th><Th>Status</Th><Th>Check-ins</Th><Th>Sub Ends</Th><Th>Last Login</Th>
                </tr>
              </thead>
              <tbody>
                {membersLoading ? <LoadingRows cols={6} /> :
                 members.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState icon="members" message="No members found" /></td></tr>
                ) : members.map((m, i) => (
                  <tr key={m.id} className="hover-row">
                    <Td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={m.name} size={28} />
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>{m.email}</div>
                        </div>
                      </div>
                    </Td>
                    <Td><Badge status={m.role} /></Td>
                    <Td><Badge status={m.status} /></Td>
                    <Td><span style={{ fontFamily: T.mono, fontSize: 12, color: T.blue }}>{fmt.num(m.total_checkins)}</span></Td>
                    <Td><span style={{ fontFamily: T.mono, fontSize: 11, color: m.subscription_end ? (fmt.daysLeft(m.subscription_end) < 7 ? T.amber : T.sub) : T.muted }}>{m.subscription_end ? fmt.date(m.subscription_end) : '—'}</span></Td>
                    <Td><span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{m.last_login_at ? fmt.date(m.last_login_at) : 'Never'}</span></Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
          </Card>
        </div>
      )}

      {/* Admins tab */}
      {tab === 'admins' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Btn size="sm" onClick={() => setShowAddAdmin(true)}><Icon name="add" size={13} /> Add Admin</Btn>
          </div>
          {admins.length === 0 ? (
            <Card><EmptyState icon="staff" message="No admins found" action={<Btn onClick={() => setShowAddAdmin(true)}>Add First Admin</Btn>} /></Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {admins.map(a => (
                <Card key={a.id} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <Avatar name={a.name} size={42} />
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{a.email}</div>
                    <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>
                      Last login: {a.last_login_at ? fmt.datetime(a.last_login_at) : 'Never'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Badge status={a.status} />
                    <Btn variant="ghost" size="sm" onClick={() => setResetTarget(a)}>
                      <Icon name="lock" size={13} /> Reset Password
                    </Btn>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <AddAdminModal open={showAddAdmin} onClose={() => setShowAddAdmin(false)} gymId={gymId} onAdded={load} />
          <ResetPasswordModal open={!!resetTarget} onClose={() => setResetTarget(null)} admin={resetTarget} gymId={gymId} />
        </div>
      )}

      {/* Audit Log tab */}
      {tab === 'audit' && <AuditTab gymId={gymId} />}
    </div>
  );
}

function AuditTab({ gymId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api.get(`/super/gyms/${gymId}/audit`)
      .then(r => setLogs(r.data?.data?.logs || r.data?.logs || []))
      .catch(() => toast('Failed to load audit log', 'error'))
      .finally(() => setLoading(false));
  }, [gymId, toast]);

  if (loading) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  return (
    <Card style={{ overflow: 'hidden' }}>
      <TableWrapper>
        <thead><tr><Th>Action</Th><Th>Actor</Th><Th>Entity</Th><Th>Time</Th></tr></thead>
        <tbody>
          {logs.length === 0 ? (
            <tr><td colSpan={4}><EmptyState icon="info_circle" message="No audit events yet" /></td></tr>
          ) : logs.map(l => (
            <tr key={l.id} className="hover-row">
              <Td>
                <span style={{ background: T.accentDim, color: T.accent, padding: '2px 8px', borderRadius: 3, fontSize: 10, fontFamily: T.mono }}>{l.action}</span>
              </Td>
              <Td>
                <div style={{ fontSize: 12 }}>{l.actor_name || `${l.actor_type} #${l.actor_id}`}</div>
                <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono }}>{l.actor_role}</div>
              </Td>
              <Td><span style={{ fontSize: 12, color: T.sub }}>{l.entity} #{l.entity_id}</span></Td>
              <Td><span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{fmt.datetime(l.created_at)}</span></Td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>
    </Card>
  );
}
