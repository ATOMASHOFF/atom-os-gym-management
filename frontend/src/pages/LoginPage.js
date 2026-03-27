import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { T } from '../utils/helpers';
import { Spinner } from '../components/shared/UI';
import api, { extractGyms } from '../utils/api';

export default function LoginPage() {
  const { login, user, requiresGymSelection } = useAuth();
  const toast           = useToast();
  const navigate        = useNavigate();

  const [form, setForm]               = useState({ email: '', password: '' });
  const [gymId, setGymId]             = useState('');
  const [gyms, setGyms]               = useState([]);
  const [gymsLoading, setGymsLoading] = useState(true);
  const [gymsError, setGymsError]     = useState('');
  const [needGymSelection, setNeedGymSelection] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [focused, setFocused]         = useState(null);

  const fetchGyms = () => {
    setGymsLoading(true);
    setGymsError('');
    api.get('/public/gyms')
      .then(r => {
        const list = extractGyms(r.data);
        setGyms(list);
        // Keep login unified: only auto-select if there is exactly one gym
        if (list.length === 1) setGymId(String(list[0].id));
      })
      .catch(err => {
        setGymsError(err?.response?.data?.message || err?.message || 'Could not load gym list');
      })
      .finally(() => setGymsLoading(false));
  };

  useEffect(() => { fetchGyms(); }, []);

  if (user) return <Navigate to="/" replace />;

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handle = async e => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast('Enter your email and password', 'error'); return;
    }
    if (needGymSelection && gyms.length > 1 && !gymId) {
      toast('Please select your gym to continue', 'error');
      return;
    }

    setLoading(true);
    try {
      const usr = await login(form.email, form.password, gymId || undefined);
      setNeedGymSelection(false);
      toast(`Welcome back, ${usr.name}!`, 'success');
      navigate('/');
    } catch (err) {
      if (requiresGymSelection(err)) {
        setNeedGymSelection(true);
        toast('Multiple accounts found with this email. Please select your gym and sign in again.', 'error');
        return;
      }
      toast(err?.response?.data?.message || err?.message || 'Invalid credentials', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inp = field => ({
    width: '100%', background: T.bg0,
    border: `1.5px solid ${focused === field ? T.accent : T.border}`,
    borderRadius: 5, padding: '11px 14px', color: T.white,
    fontSize: 14, fontFamily: T.font, outline: 'none',
    transition: 'border-color 0.15s',
  });

  return (
    <div style={{ minHeight: '100vh', background: T.bg0, display: 'flex', alignItems: 'stretch' }}>

      {/* ── Left branding ── */}
      <div className="login-brand" style={{
        flex: '0 0 420px',
        background: 'linear-gradient(160deg, #0d0f1a 0%, #1a0800 100%)',
        borderRight: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '48px 40px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <div style={{
              width: 44, height: 44, background: T.accent, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.display, fontWeight: 900, fontSize: 24, color: '#fff', flexShrink: 0,
            }}>A</div>
            <div>
              <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 22, letterSpacing: '0.04em' }}>ATOM FITNESS</div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: '0.14em' }}>GYM MANAGEMENT OS</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              ['📋', 'Member Management', 'Profiles, subscriptions & history'],
              ['📱', 'QR Attendance',     'Scan-based check-ins, no manual tracking'],
              ['📊', 'Live Dashboard',    'Real-time stats, expiry alerts, revenue'],
              ['📥', 'Bulk Import',       'Upload existing members from Excel/CSV'],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{ display: 'flex', gap: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: `${T.accent}18`, border: `1px solid ${T.accent}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>{icon}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
                  <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>
          Built by Mahnwas Technologies · Delhi, India
        </div>
      </div>

      {/* ── Right form ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div className="fadeUp" style={{ width: '100%', maxWidth: 400 }}>

          {/* Mobile logo */}
          <div className="login-mobile-logo" style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 48, height: 48, background: T.accent, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.display, fontWeight: 900, fontSize: 26, color: '#fff',
              margin: '0 auto 10px',
            }}>A</div>
            <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 20 }}>ATOM FITNESS</div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: 26, letterSpacing: '0.02em', marginBottom: 4 }}>
              Sign in
            </h1>
            <p style={{ color: T.sub, fontSize: 13 }}>Access your gym dashboard</p>
          </div>

          <form onSubmit={handle}>

            {/* ── Gym selector ── */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: T.sub, fontWeight: 500, marginBottom: 6 }}>
                Gym {needGymSelection ? '(required)' : '(optional)'}
              </label>

              {gymsLoading && (
                <div style={{
                  ...inp('gym'), display: 'flex', alignItems: 'center', gap: 8, color: T.muted,
                }}>
                  <Spinner size={13} /> Loading...
                </div>
              )}

              {gymsError && !gymsLoading && (
                <div style={{
                  padding: '10px 14px', background: T.redDim,
                  border: `1px solid ${T.red}44`, borderRadius: 5,
                  fontSize: 12, color: T.red,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>⚠ {gymsError}</span>
                  <button type="button" onClick={fetchGyms} style={{
                    background: 'transparent', color: T.red, border: `1px solid ${T.red}44`,
                    padding: '2px 10px', borderRadius: 3, fontSize: 11,
                    fontFamily: T.display, fontWeight: 700, cursor: 'pointer',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>Retry</button>
                </div>
              )}

              {!gymsLoading && !gymsError && gyms.length === 0 && (
                <div style={{
                  padding: '10px 14px', background: T.amberDim,
                  border: `1px solid ${T.amber}44`, borderRadius: 5,
                  fontSize: 12, color: T.amber,
                }}>
                  No gyms available. Contact your administrator.
                </div>
              )}

              {/* Show dropdown when user must disambiguate or chooses among gyms */}
              {!gymsLoading && !gymsError && gyms.length > 1 && (
                <select value={gymId} onChange={e => setGymId(e.target.value)}
                  style={{ ...inp('gym'), cursor: 'pointer' }}>
                  <option value="">— Select gym {needGymSelection ? '(required)' : '(optional)'} —</option>
                  {gyms.map(g => (
                    <option key={g.id} value={String(g.id)}>{g.name}</option>
                  ))}
                </select>
              )}

              {/* Single gym — show as green badge (no action needed) */}
              {!gymsLoading && !gymsError && gyms.length === 1 && (
                <div style={{
                  padding: '10px 14px', background: T.bg2,
                  border: `1.5px solid ${T.green}55`, borderRadius: 5,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.green, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.08em' }}>SIGNING INTO</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{gyms[0]?.name}</div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Email ── */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: T.sub, fontWeight: 500, marginBottom: 6 }}>
                Email address
              </label>
              <input
                type="email" value={form.email} onChange={f('email')}
                placeholder="you@example.com"
                autoComplete="email" autoFocus
                onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                style={inp('email')}
              />
            </div>

            {/* ── Password ── */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: T.sub, fontWeight: 500, marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password" value={form.password} onChange={f('password')}
                placeholder="Your password"
                autoComplete="current-password"
                onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                style={inp('password')}
              />
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', background: loading ? T.bg3 : T.accent,
              color: '#fff', border: 'none', padding: '12px', borderRadius: 5,
              fontFamily: T.display, fontWeight: 800, fontSize: 14,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
            }}>
              {loading ? <><Spinner size={14} /> Signing in...</> : 'Sign In →'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center', paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
            <Link to="/register" style={{ fontSize: 13, color: T.sub, textDecoration: 'none' }}>
              New member? <span style={{ color: T.accent }}>Register here</span>
            </Link>
          </div>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: T.muted }}>
            Forgot your password? Contact your gym admin.
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) { .login-brand { display: none !important; } }
        @media (min-width: 769px) { .login-mobile-logo { display: none !important; } }
      `}</style>
    </div>
  );
}
