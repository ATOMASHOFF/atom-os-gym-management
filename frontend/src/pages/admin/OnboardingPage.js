import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { Btn, Icon, Spinner } from '../../components/shared/UI';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

const STEPS = [
  {
    id:    'gym_profile',
    label: 'Gym Profile',
    icon:  'settings',
    desc:  'Add your gym address and contact details',
    route: '/settings',
    cta:   'Complete Profile',
  },
  {
    id:    'plans_created',
    label: 'Membership Plans',
    icon:  'plans',
    desc:  'Create at least one plan (e.g. Monthly ₹800)',
    route: '/plans',
    cta:   'Create Plans',
  },
  {
    id:    'members_added',
    label: 'Add Members',
    icon:  'members',
    desc:  'Import from Excel/CSV or add members manually',
    route: '/import',
    cta:   'Import Members',
  },
  {
    id:    'qr_generated',
    label: 'Generate QR Code',
    icon:  'qr',
    desc:  'Print and place at your gym entrance',
    route: '/qr-codes',
    cta:   'Generate QR',
  },
];

function StepCard({ step, index, done, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', gap: 16, padding: '18px 20px',
        background: done ? T.greenDim : hover ? `${T.accent}10` : T.bg2,
        border: `1.5px solid ${done ? T.green + '55' : hover ? T.accent + '55' : T.border}`,
        borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
        alignItems: 'center',
      }}
    >
      {/* Number / check */}
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: done ? T.green : T.bg1,
        border: `2px solid ${done ? T.green : T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.display, fontWeight: 800, fontSize: 15,
        color: done ? '#fff' : T.muted,
      }}>
        {done ? <Icon name="check" size={18} color="#fff" /> : index + 1}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: T.display, fontWeight: 700, fontSize: 15,
          color: done ? T.green : T.white,
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          {step.label}
          {done && (
            <span style={{ fontSize: 10, fontFamily: T.mono, fontWeight: 400, color: T.green }}>
              DONE
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{step.desc}</div>
      </div>

      {!done && (
        <div style={{
          background: T.accent, color: '#fff', padding: '6px 14px',
          borderRadius: 4, fontFamily: T.display, fontWeight: 700,
          fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {step.cta}
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const r = await api.get('/gyms/onboarding');
      // Handle both normalized and raw response shape
      const data = r.data?.steps ? r.data : r.data?.data ?? r.data;
      setStatus(data);
    } catch {
      toast('Could not load setup status', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Navigate to a step page — no redirect trap because PrivateRoute
  // no longer checks onboarding on every route
  const handleStep = (route) => {
    navigate(route);
  };

  // Skip — mark in sessionStorage so DashboardGate won't re-trigger
  const handleSkip = () => {
    sessionStorage.setItem('onboarding_skipped', 'true');
    navigate('/dashboard');
  };

  // Complete — same
  const handleComplete = () => {
    sessionStorage.setItem('onboarding_skipped', 'true');
    navigate('/dashboard');
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: T.bg0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={32} />
    </div>
  );

  const stepStatus  = status?.steps    || {};
  const completed   = status?.completed || 0;
  const isComplete  = status?.is_complete || false;
  const pct         = Math.round((completed / 4) * 100);
  const gymName     = status?.gym?.name || user?.gym_name || 'Your Gym';

  return (
    <div style={{
      minHeight: '100vh', background: T.bg0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 20px',
    }}>
      <div className="fadeUp" style={{ width: '100%', maxWidth: 560 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, background: T.accent, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: T.display, fontWeight: 900, fontSize: 28, color: '#fff',
            margin: '0 auto 16px',
          }}>A</div>
          <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: 26, marginBottom: 6 }}>
            Welcome, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p style={{ color: T.sub, fontSize: 14 }}>
            Let's get <strong style={{ color: T.white }}>{gymName}</strong> ready in 4 steps.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: T.sub, fontFamily: T.mono }}>
              {completed} of 4 complete
            </span>
            <span style={{ fontSize: 12, color: T.accent, fontFamily: T.mono, fontWeight: 700 }}>
              {pct}%
            </span>
          </div>
          <div style={{ height: 6, background: T.bg3, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`, background: T.accent,
              borderRadius: 3, transition: 'width 0.5s ease',
              boxShadow: pct > 0 ? `0 0 8px ${T.accent}66` : 'none',
            }} />
          </div>
        </div>

        {/* Step cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {STEPS.map((step, i) => (
            <StepCard
              key={step.id}
              step={step}
              index={i}
              done={!!stepStatus[step.id]}
              onClick={() => handleStep(step.route)}
            />
          ))}
        </div>

        {/* Completion banner */}
        {isComplete && (
          <div style={{
            background: T.greenDim, border: `1px solid ${T.green}44`,
            borderRadius: 8, padding: '16px 20px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Icon name="check" size={20} color={T.green} />
            <div>
              <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 15, color: T.green }}>
                Setup complete! 🎉
              </div>
              <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
                Your gym is ready to use.
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={handleSkip}
            style={{
              background: 'transparent', color: T.muted, border: 'none',
              fontSize: 13, cursor: 'pointer', fontFamily: T.font,
            }}
          >
            Skip for now, go to dashboard →
          </button>

          {isComplete && (
            <Btn onClick={handleComplete}>
              <Icon name="dashboard" size={14} /> Go to Dashboard
            </Btn>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: T.muted }}>
          You can always access these from the sidebar later.
        </p>
      </div>
    </div>
  );
}
