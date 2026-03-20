import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { PageHeader, Card, Btn, Icon, Spinner, Badge, SearchInput, Modal, Input, Select } from '../../components/shared/UI';
import { useToast } from '../../context/ToastContext';

function CreateGymModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ gym_name:'', gym_slug:'', gym_address:'', gym_plan:'starter', admin_name:'', admin_email:'', admin_phone:'', admin_password:'' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const toast = useToast();
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  // Auto-generate slug from gym name
  useEffect(() => {
    if (form.gym_name) {
      setForm(p => ({ ...p, gym_slug: p.gym_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }));
    }
  }, [form.gym_name]);

  const handle = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.post('/super/gyms', form);
      setResult(r.data?.data || r.data);
      toast('Gym created!', 'success');
      onCreated();
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to create gym'), 'error');
    } finally { setLoading(false); }
  };

  if (result) return (
    <Modal open={open} onClose={() => { setResult(null); onClose(); }} title="GYM CREATED ✓" width={480}>
      <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
        <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 20, marginBottom: 4 }}>{result.gym?.name}</div>
        <div style={{ color: T.sub, fontSize: 13, marginBottom: 20 }}>Gym is live and ready to use</div>
        <div style={{ background: T.bg0, border: `1px solid ${T.amber}44`, borderRadius: 6, padding: '16px 20px', textAlign: 'left', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: T.amber, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 10 }}>⚠️ ADMIN CREDENTIALS — SHARE ONCE AND SECURELY</div>
          {[['Name', result.admin?.name], ['Email', result.admin?.email], ['Password', result.admin_password]].map(([k,v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.border}33` }}>
              <span style={{ fontSize: 12, color: T.muted, fontFamily: T.mono }}>{k}</span>
              <span style={{ fontSize: 12, color: T.white, fontFamily: T.mono, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <Btn onClick={() => { setResult(null); onClose(); }}>Close</Btn>
      </div>
    </Modal>
  );

  return (
    <Modal open={open} onClose={onClose} title="CREATE NEW GYM" width={560}>
      <form onSubmit={handle}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: T.accent, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 10, textTransform: 'uppercase' }}>Gym Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Gym Name" value={form.gym_name} onChange={f('gym_name')} required style={{ gridColumn: '1/-1' }} />
            <Input label="Slug (URL)" value={form.gym_slug} onChange={f('gym_slug')} required helperText="e.g. my-gym — used in URLs" />
            <Select label="Plan" value={form.gym_plan} onChange={f('gym_plan')} options={[{value:'starter',label:'Starter'},{value:'pro',label:'Pro'},{value:'enterprise',label:'Enterprise'}]} />
            <Input label="Address" value={form.gym_address} onChange={f('gym_address')} style={{ gridColumn: '1/-1' }} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: T.accent, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 10, textTransform: 'uppercase' }}>Gym Admin Account</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Admin Name" value={form.admin_name} onChange={f('admin_name')} required style={{ gridColumn: '1/-1' }} />
            <Input label="Admin Email" type="email" value={form.admin_email} onChange={f('admin_email')} required />
            <Input label="Admin Phone" value={form.admin_phone} onChange={f('admin_phone')} />
            <Input label="Password" type="password" value={form.admin_password} onChange={f('admin_password')} required helperText="Min 8 characters" style={{ gridColumn: '1/-1' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="ghost" onClick={onClose} type="button">Cancel</Btn>
          <Btn type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Gym + Admin'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

export default function GymListPage() {
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [toggling, setToggling] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/super/gyms', { params: { search } });
      setGyms(r.data?.data?.gyms || r.data?.gyms || r.data || []);
    } catch { toast('Failed to load gyms', 'error'); }
    finally { setLoading(false); }
  }, [search, toast]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (gym) => {
    setToggling(gym.id);
    try {
      await api.patch(`/super/gyms/${gym.id}/toggle`);
      toast(`${gym.name} ${gym.is_active ? 'deactivated' : 'activated'}`, 'info');
      load();
    } catch { toast('Failed', 'error'); }
    finally { setToggling(null); }
  };

  return (
    <div>
      <PageHeader
        title="GYM MANAGEMENT"
        subtitle={`${gyms.length} gyms on platform`}
        actions={<Btn onClick={() => setShowCreate(true)}><Icon name="add" size={14} /> New Gym</Btn>}
      />

      <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search gym name, email, slug..." style={{ maxWidth: 340, marginBottom: 16 }} />

      <Card style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.bg1 }}>
                {['Gym', 'Plan', 'Admin Email', 'Members', 'Subs', 'Today', 'Created', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10, color: T.muted, fontFamily: T.mono, borderBottom: `1px solid ${T.border}`, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center' }}><Spinner /></td></tr>
              ) : gyms.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 50, textAlign: 'center', color: T.muted, fontFamily: T.mono, fontSize: 11 }}>NO GYMS FOUND</td></tr>
              ) : gyms.map(g => (
                <tr key={g.id} className="hover-row" onClick={() => navigate(`/super/gyms/${g.id}`)} style={{ cursor: 'pointer', opacity: g.is_active ? 1 : 0.55 }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{g.name}</div>
                    <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono }}>{g.slug}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: T.accentDim, color: T.accent, padding: '2px 7px', borderRadius: 3, fontSize: 10, fontFamily: T.mono, textTransform: 'uppercase' }}>{g.plan}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: T.mono, fontSize: 11, color: T.sub }}>{g.admin_email || '—'}</td>
                  <td style={{ padding: '12px 16px', fontFamily: T.mono, fontSize: 13, color: T.blue, fontWeight: 600 }}>{fmt.num(g.active_members)}</td>
                  <td style={{ padding: '12px 16px', fontFamily: T.mono, fontSize: 13, color: T.green, fontWeight: 600 }}>{fmt.num(g.active_subscriptions)}</td>
                  <td style={{ padding: '12px 16px', fontFamily: T.mono, fontSize: 13, color: T.amber, fontWeight: 600 }}>{fmt.num(g.today_checkins)}</td>
                  <td style={{ padding: '12px 16px', fontFamily: T.mono, fontSize: 11, color: T.muted }}>{fmt.date(g.created_at)}</td>
                  <td style={{ padding: '12px 16px' }}><Badge status={g.is_active ? 'active' : 'inactive'} /></td>
                  <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                    <Btn
                      variant={g.is_active ? 'danger' : 'success'}
                      size="sm"
                      disabled={toggling === g.id}
                      onClick={() => handleToggle(g)}
                    >
                      {toggling === g.id ? '...' : g.is_active ? 'Deactivate' : 'Activate'}
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <CreateGymModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
    </div>
  );
}
