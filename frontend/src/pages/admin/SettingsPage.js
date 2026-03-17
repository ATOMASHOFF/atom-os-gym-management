import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { T } from '../../utils/helpers';
import { Card, PageHeader, Btn, Icon, Input, Textarea } from '../../components/shared/UI';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export default function SettingsPage() {
  const [gym, setGym] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingPw, setSavingPw] = useState(false);
  const toast = useToast();
  const { user } = useAuth();

  useEffect(() => {
    api.get('/gyms/current').then(r => setGym(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSaveGym = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/gyms/current', gym);
      toast('Gym settings saved', 'success');
    } catch (e) { toast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) { toast('Passwords do not match', 'error'); return; }
    setSavingPw(true);
    try {
      await api.post('/auth/change-password', { current_password: pwForm.current_password, new_password: pwForm.new_password });
      toast('Password changed successfully', 'success');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (e) { toast(e.response?.data?.message || 'Failed', 'error'); }
    finally { setSavingPw(false); }
  };

  const fGym = (k) => (e) => setGym(g => ({ ...g, [k]: e.target.value }));
  const fPw = (k) => (e) => setPwForm(p => ({ ...p, [k]: e.target.value }));

  const Section = ({ title, children }) => (
    <Card style={{ marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, fontFamily: T.display, fontWeight: 700, fontSize: 14, letterSpacing: '0.05em', textTransform: 'uppercase', color: T.sub }}>
        {title}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </Card>
  );

  return (
    <div>
      <PageHeader title="SETTINGS" subtitle="Gym configuration & account settings" />

      {/* Gym Info */}
      <Section title="Gym Information">
        {loading ? <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted }}>Loading...</div> : gym && (
          <form onSubmit={handleSaveGym}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <Input label="Gym Name" value={gym.name || ''} onChange={fGym('name')} required style={{ gridColumn: '1/-1' }} />
              <Input label="Owner Name" value={gym.owner_name || ''} onChange={fGym('owner_name')} />
              <Input label="Owner Email" type="email" value={gym.owner_email || ''} onChange={fGym('owner_email')} />
              <Input label="Owner Phone" value={gym.owner_phone || ''} onChange={fGym('owner_phone')} />
              <Textarea label="Address" value={gym.address || ''} onChange={fGym('address')} style={{ gridColumn: '1/-1' }} rows={2} />
            </div>
            <Btn type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Gym Settings'}</Btn>
          </form>
        )}
      </Section>

      {/* Account */}
      <Section title="Account Details">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {[['Name', user?.name], ['Email', user?.email], ['Role', user?.role], ['Gym', user?.gym_name]].map(([k,v]) => (
            <div key={k} style={{ background: T.bg1, padding: '10px 14px', borderRadius: 5 }}>
              <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 3, textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontWeight: 500 }}>{v || '—'}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Change Password */}
      <Section title="Change Password">
        <form onSubmit={handleChangePassword}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 380 }}>
            <Input label="Current Password" type="password" value={pwForm.current_password} onChange={fPw('current_password')} required />
            <Input label="New Password" type="password" value={pwForm.new_password} onChange={fPw('new_password')} required helperText="Minimum 6 characters" />
            <Input label="Confirm New Password" type="password" value={pwForm.confirm_password} onChange={fPw('confirm_password')} required />
          </div>
          <Btn type="submit" disabled={savingPw} style={{ marginTop: 16 }}>
            <Icon name="lock" size={14} />{savingPw ? 'Changing...' : 'Change Password'}
          </Btn>
        </form>
      </Section>

      {/* Info */}
      <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: 6, padding: '16px 20px', fontSize: 12, color: T.muted, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <Icon name="info_circle" size={15} color={T.muted} />
        <div>
          <div style={{ fontWeight: 600, color: T.sub, marginBottom: 4 }}>ATOM FITNESS · GYM OS v2.0</div>
          Built by Mahnwas Technologies · Delhi, India. "Sky is the limit, but always remember the ground you are born from." — Ashish
        </div>
      </div>
    </div>
  );
}
