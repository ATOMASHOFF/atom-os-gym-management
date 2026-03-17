import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { T } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(10);

  // Auto-redirect after 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timer);
          navigate(getHome());
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getHome = () => {
    if (!user) return '/login';
    if (user.role === 'super_admin') return '/super/dashboard';
    if (user.role === 'member')      return '/my-profile';
    return '/dashboard';
  };

  const pct = ((10 - countdown) / 10) * 100;

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: T.font,
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: `linear-gradient(${T.accent} 1px, transparent 1px),
                          linear-gradient(90deg, ${T.accent} 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
        pointerEvents: 'none',
      }} />

      {/* Glow blob */}
      <div style={{
        position: 'absolute',
        top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 400, borderRadius: '50%',
        background: `radial-gradient(ellipse, ${T.accent}12 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div className="fadeUp" style={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: 480 }}>

        {/* 404 display */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <div style={{
            fontFamily: T.display,
            fontWeight: 900,
            fontSize: 'clamp(80px, 20vw, 140px)',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: T.bg2,
            WebkitTextStroke: `2px ${T.border}`,
            userSelect: 'none',
          }}>
            404
          </div>
          {/* Accent overlay on the 0 */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: T.display, fontWeight: 900,
            fontSize: 'clamp(80px, 20vw, 140px)',
            letterSpacing: '-0.04em', lineHeight: 1,
            background: `linear-gradient(135deg, ${T.accent} 0%, ${T.accent}44 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            opacity: 0.25,
          }}>
            404
          </div>
        </div>

        {/* Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: 14,
          background: T.bg2, border: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 28,
        }}>
          🔍
        </div>

        {/* Text */}
        <h1 style={{
          fontFamily: T.display, fontWeight: 900,
          fontSize: 22, letterSpacing: '0.02em',
          marginBottom: 10,
        }}>
          Page Not Found
        </h1>
        <p style={{ color: T.sub, fontSize: 14, lineHeight: 1.7, marginBottom: 6 }}>
          The page <code style={{
            fontFamily: T.mono, fontSize: 12,
            background: T.bg2, border: `1px solid ${T.border}`,
            padding: '2px 7px', borderRadius: 4, color: T.accent,
          }}>{location.pathname}</code> doesn't exist.
        </p>
        <p style={{ color: T.muted, fontSize: 13, marginBottom: 32 }}>
          It may have been moved, deleted, or you may have mistyped the URL.
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: T.bg2, color: T.sub,
              border: `1px solid ${T.border}`,
              padding: '10px 22px', borderRadius: 5,
              fontFamily: T.display, fontWeight: 700,
              fontSize: 13, letterSpacing: '0.06em',
              textTransform: 'uppercase', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.target.style.borderColor = T.accent; e.target.style.color = T.white; }}
            onMouseLeave={e => { e.target.style.borderColor = T.border; e.target.style.color = T.sub; }}
          >
            ← Go Back
          </button>
          <button
            onClick={() => navigate(getHome())}
            style={{
              background: T.accent, color: '#fff',
              border: 'none',
              padding: '10px 22px', borderRadius: 5,
              fontFamily: T.display, fontWeight: 700,
              fontSize: 13, letterSpacing: '0.06em',
              textTransform: 'uppercase', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.target.style.background = '#ff6030'}
            onMouseLeave={e => e.target.style.background = T.accent}
          >
            Go to Dashboard
          </button>
        </div>

        {/* Auto-redirect countdown */}
        <div style={{
          background: T.bg2, border: `1px solid ${T.border}`,
          borderRadius: 8, padding: '14px 20px',
          display: 'inline-block', minWidth: 260,
        }}>
          <div style={{
            fontSize: 11, color: T.muted, fontFamily: T.mono,
            letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase',
          }}>
            Auto-redirecting in {countdown}s
          </div>
          {/* Progress bar */}
          <div style={{ height: 4, background: T.bg3, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: T.accent,
              borderRadius: 2,
              transition: 'width 1s linear',
              boxShadow: `0 0 6px ${T.accent}66`,
            }} />
          </div>
        </div>

        {/* Mahnwas footer */}
        <div style={{
          marginTop: 40,
          fontSize: 11, color: T.muted, fontFamily: T.mono,
          letterSpacing: '0.1em',
        }}>
          ATOM FITNESS OS · MAHNWAS TECHNOLOGIES
        </div>
      </div>
    </div>
  );
}
