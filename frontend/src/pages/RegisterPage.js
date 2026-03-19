import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { T } from '../utils/helpers';
import { Spinner } from '../components/shared/UI';
import api, { extractGyms } from '../utils/api';

export default function RegisterPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirm_password: '', gym_id: '',
  });
  const [gyms, setGyms]         = useState([]);
  const [gymsLoading, setGymsLoading] = useState(true);
  const [gymsError, setGymsError]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  const fetchGyms = () => {
    setGymsLoading(true);
    setGymsError('');
    api.get('/public/gyms')
      .then(r => {
        const list = extractGyms(r.data);
        setGyms(list);
        if (list.length === 1) setForm(f => ({ ...f, gym_id: String(list[0].id) }));
      })
      .catch(err => {
        setGymsError(err?.response?.data?.message || 'Could not load gym list');
      })
      .finally(() => setGymsLoading(false));
  };

  useEffect(() => { fetchGyms(); }, []);

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handle = async e => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      toast('Passwords do not match', 'error'); return;
    }
    if (form.password.length < 6) {
      toast('Password must be at least 6 characters', 'error'); return;
    }
    if (!form.gym_id) {
      toast('Please select a gym', 'error'); return;
    }
    setLoading(true);
    try {
      await api.post('/public/register', {
        name: form.name, email: form.email,
        phone: form.phone, password: form.password,
        gym_id: form.gym_id,
      });
      setDone(true);
    } catch (err) {
      toast(err?.response?.data?.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <div style={{ minHeight: '100vh', background: T.bg0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="fadeUp" style={{
        background: T.bg2, border: `1px solid ${T.green}44`,
        borderRadius: 8, padding: 40, maxWidth: 420, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 22, marginBottom: 8 }}>
          REGISTRATION SUBMITTED
        </div>
        <div style={{ color: T.sub, lineHeight: 1.7, marginBottom: 24 }}>
          Your registration has been submitted. The gym admin will review and approve your account.
          You can log in once approved.
        </div>
        <Link to="/login" style={{
          background: T.accent, color: '#fff', padding: '10px 24px',
          borderRadius: 4, fontFamily: T.display, fontWeight: 700,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Back to Login
        </Link>
      </div>
    </div>
  );

  const inputStyle = {
    width: '100%', background: T.bg0,
    border: `1px solid ${T.border}`, borderRadius: 4,
    padding: '9px 12px', color: T.white, fontSize: 13,
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: `linear-gradient(${T.accent} 1px, transparent 1px), linear-gradient(90deg, ${T.accent} 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />

      <div className="fadeUp" style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, background: T.accent, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.display, fontWeight: 900, fontSize: 22, color: '#fff', margin: '0 auto 12px' }}>A</div>
          <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 24, letterSpacing: '0.04em' }}>
            JOIN A GYM
          </div>
          <div style={{ color: T.sub, fontSize: 12, fontFamily: T.mono, marginTop: 4, letterSpacing: '0.1em' }}>
            MEMBER SELF-REGISTRATION
          </div>
        </div>

        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 28 }}>
          <form onSubmit={handle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

              {/* Name */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 11, color: T.sub, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Full Name *</label>
                <input type="text" value={form.name} onChange={f('name')} required style={inputStyle} />
              </div>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: T.sub, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Email *</label>
                <input type="email" value={form.email} onChange={f('email')} required style={inputStyle} />
              </div>

              {/* Phone */}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: T.sub, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Phone</label>
                <input type="tel" value={form.phone} onChange={f('phone')} style={inputStyle} />
              </div>

              {/* Password */}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: T.sub, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Password *</label>
                <input type="password" value={form.password} onChange={f('password')} required style={inputStyle} />
              </div>

              {/* Confirm password */}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: T.sub, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>Confirm Password *</label>
                <input type="password" value={form.confirm_password} onChange={f('confirm_password')} required style={inputStyle} />
              </div>

            </div>

            {/* Gym selector */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, color: T.sub, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>
                Select Gym *
              </label>

              {gymsLoading && (
                <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, color: T.muted }}>
                  <Spinner size={13} /> Loading gyms...
                </div>
              )}

              {gymsError && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: T.redDim, border: `1px solid ${T.red}44`, borderRadius: 4, fontSize: 12, color: T.red }}>
                  <span>⚠ {gymsError}</span>
                  <button type="button" onClick={fetchGyms} style={{ background: 'transparent', color: T.red, border: `1px solid ${T.red}44`, padding: '2px 8px', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}>Retry</button>
                </div>
              )}

              {!gymsLoading && !gymsError && (
                <select value={form.gym_id} onChange={f('gym_id')} required style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">— Select a Gym —</option>
                  {gyms.map(g => (
                    <option key={g.id} value={String(g.id)}>
                      {g.name}{g.address ? ` — ${g.address}` : ''}
                    </option>
                  ))}
                </select>
              )}

              {!gymsLoading && !gymsError && gyms.length === 0 && (
                <div style={{ padding: '9px 12px', background: T.amberDim, border: `1px solid ${T.amber}44`, borderRadius: 4, fontSize: 12, color: T.amber }}>
                  No gyms available for registration right now.
                </div>
              )}
            </div>

            <button type="submit" disabled={loading || gymsLoading} style={{
              width: '100%', background: T.accent, color: '#fff', border: 'none',
              padding: '11px', borderRadius: 4, fontFamily: T.display, fontWeight: 800,
              fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: loading || gymsLoading ? 'not-allowed' : 'pointer',
              opacity: loading || gymsLoading ? 0.6 : 1,
              transition: 'all 0.15s',
            }}>
              {loading ? <><Spinner size={14} /> Submitting...</> : 'Submit Registration'}
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
