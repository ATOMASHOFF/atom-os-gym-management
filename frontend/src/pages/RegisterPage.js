import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { T } from '../utils/helpers';
import { Spinner } from '../components/shared/UI';
import api from '../utils/api';

export default function RegisterPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm_password: '', gym_id: '' });
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get('/public/gyms').then(r => {
      setGyms(r.data.gyms || []);
      if (r.data.gyms?.length) setForm(f => ({ ...f, gym_id: String(r.data.gyms[0].id) }));
    }).catch(() => {});
  }, []);

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handle = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) { toast('Passwords do not match', 'error'); return; }
    if (form.password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    if (!form.gym_id) { toast('Please select a gym', 'error'); return; }
    setLoading(true);
    try {
      await api.post('/public/register', { name: form.name, email: form.email, phone: form.phone, password: form.password, gym_id: form.gym_id });
      setDone(true);
    } catch (err) {
      toast(err.response?.data?.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <div style={{ minHeight: '100vh', background: T.bg0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="fadeUp" style={{ background: T.bg2, border: `1px solid ${T.green}44`, borderRadius: 8, padding: 40, maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 22, marginBottom: 8 }}>REGISTRATION SUBMITTED</div>
        <div style={{ color: T.sub, lineHeight: 1.7, marginBottom: 24 }}>Your registration has been submitted. A gym admin will review and approve your account. You'll be able to login once approved.</div>
        <Link to="/login" style={{ background: T.accent, color: '#fff', padding: '10px 24px', borderRadius: 4, fontFamily: T.display, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Back to Login</Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: T.bg0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: `linear-gradient(${T.accent} 1px, transparent 1px), linear-gradient(90deg, ${T.accent} 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />
      <div className="fadeUp" style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 26, letterSpacing: '0.04em' }}>JOIN <span style={{ color: T.accent }}>A GYM</span></div>
          <div style={{ color: T.sub, fontSize: 12, fontFamily: T.mono, marginTop: 4, letterSpacing: '0.1em' }}>MEMBER SELF-REGISTRATION</div>
        </div>
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 28 }}>
          <form onSubmit={handle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {[['FULL NAME', 'name', 'text'], ['EMAIL', 'email', 'email'], ['PHONE', 'phone', 'tel'], ['PASSWORD', 'password', 'password'], ['CONFIRM PASSWORD', 'confirm_password', 'password']].map(([label, field, type], i) => (
                <div key={field} style={{ gridColumn: i === 0 || i > 2 ? '1 / -1' : 'auto' }}>
                  <label style={{ fontSize: 10, color: T.sub, fontFamily: T.mono, letterSpacing: '0.12em', display: 'block', marginBottom: 5 }}>{label}</label>
                  <input type={type} value={form[field]} onChange={f(field)} required={field !== 'phone'}
                    style={{ width: '100%', background: T.bg0, border: `1px solid ${T.border}`, borderRadius: 4, padding: '9px 12px', color: T.white, fontSize: 13 }} />
                </div>
              ))}
            </div>
            {gyms.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 10, color: T.sub, fontFamily: T.mono, letterSpacing: '0.12em', display: 'block', marginBottom: 5 }}>SELECT GYM *</label>
                <select value={form.gym_id} onChange={f('gym_id')} required style={{ width: '100%', background: T.bg0, border: `1px solid ${T.border}`, borderRadius: 4, padding: '9px 12px', color: T.white, fontSize: 13 }}>
                  <option value="">-- Select a Gym --</option>
                  {gyms.map(g => <option key={g.id} value={g.id}>{g.name} — {g.address}</option>)}
                </select>
              </div>
            )}
            <button type="submit" disabled={loading} style={{ width: '100%', background: T.accent, color: '#fff', padding: '11px', borderRadius: 4, fontFamily: T.display, fontWeight: 800, fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s' }}>
              {loading ? <><Spinner size={14} /> SUBMITTING...</> : 'SUBMIT REGISTRATION'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to="/login" style={{ color: T.sub, fontSize: 12, fontFamily: T.mono }}>← Back to Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
