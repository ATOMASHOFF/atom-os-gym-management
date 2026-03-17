import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { PageHeader, Card, Btn, Icon, Spinner, Avatar } from '../../components/shared/UI';
import QRScanner from '../../components/shared/QRScanner';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

// ── Result screens ────────────────────────────────────────────────────────
function SuccessScreen({ member, onBack }) {
  return (
    <Card style={{ padding: 40, textAlign: 'center', border: `1px solid ${T.green}44` }} className="fadeUp">
      <div style={{
        width: 88, height: 88, borderRadius: '50%',
        background: T.greenDim, border: `3px solid ${T.green}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px', animation: 'glow 2s ease 3',
      }}>
        <Icon name="check" size={44} color={T.green} />
      </div>
      <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 30, color: T.green, letterSpacing: '0.04em', marginBottom: 4 }}>
        CHECKED IN!
      </div>
      <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
        {member?.name}
      </div>
      {member?.plan_name && (
        <div style={{ color: T.sub, fontSize: 13, marginBottom: 4 }}>
          <span style={{ color: T.accent }}>{member.plan_name}</span> · valid until {fmt.date(member.end_date)}
        </div>
      )}
      <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, marginBottom: 28 }}>
        {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}
      </div>
      <div style={{ background: T.bg1, borderRadius: 8, padding: '14px 20px', marginBottom: 24, display: 'inline-block' }}>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, letterSpacing: '0.1em', marginBottom: 4 }}>GYM SESSION STARTED</div>
        <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 18, color: T.green }}>Have a great workout! 💪</div>
      </div>
      <br />
      <Btn variant="ghost" onClick={onBack}>← Back</Btn>
    </Card>
  );
}

function AlreadyCheckedIn({ onBack }) {
  return (
    <Card style={{ padding: 40, textAlign: 'center', border: `1px solid ${T.amber}44` }} className="fadeUp">
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: T.amberDim, border: `2px solid ${T.amber}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
        <Icon name="info_circle" size={40} color={T.amber} />
      </div>
      <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 22, color: T.amber, marginBottom: 8 }}>ALREADY CHECKED IN</div>
      <div style={{ color: T.sub, lineHeight: 1.7, marginBottom: 28 }}>
        You've already recorded your visit for today.<br />See you tomorrow! 💪
      </div>
      <Btn variant="ghost" onClick={onBack}>← Back</Btn>
    </Card>
  );
}

function ErrorScreen({ message, onBack, onRetry }) {
  return (
    <Card style={{ padding: 40, textAlign: 'center', border: `1px solid ${T.red}44` }} className="fadeUp">
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: T.redDim, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
        <Icon name="warning" size={40} color={T.red} />
      </div>
      <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 20, color: T.red, marginBottom: 8 }}>CHECK-IN FAILED</div>
      <div style={{ color: T.sub, marginBottom: 28, lineHeight: 1.6 }}>{message || 'Unable to process check-in. Please contact gym staff.'}</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <Btn onClick={onRetry}><Icon name="refresh" size={14} /> Try Again</Btn>
        <Btn variant="ghost" onClick={onBack}>Back</Btn>
      </div>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function CheckInPage() {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token'); // from QR code URL
  const { user } = useAuth();
  const toast = useToast();

  const [view, setView] = useState('home'); // home | scanning | loading | success | already | error
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [scanActive, setScanActive] = useState(false);

  // If a token is in the URL, process it immediately
  useEffect(() => {
    if (urlToken) processGymQR(urlToken);
  }, [urlToken]);

  const processGymQR = useCallback(async (token) => {
    setScanActive(false);
    setView('loading');
    try {
      const res = await api.post('/scan/scan-gym', { qr_token: token });
      setSuccessData(res.data.member);
      setView('success');
    } catch (err) {
      if (err.response?.data?.already_checked_in) {
        setView('already');
      } else {
        setErrorMsg(err.response?.data?.message || 'Check-in failed');
        setView('error');
      }
    }
  }, []);

  const handleManualCheckIn = async () => {
    setView('loading');
    try {
      const res = await api.post('/attendance/checkin', { member_id: user.id });
      setSuccessData({ name: user.name });
      setView('success');
    } catch (err) {
      if (err.response?.data?.already_checked_in) {
        setView('already');
      } else {
        setErrorMsg(err.response?.data?.message || 'Check-in failed');
        setView('error');
      }
    }
  };

  const reset = () => {
    setView('home');
    setScanActive(false);
    setSuccessData(null);
    setErrorMsg('');
  };

  const startScanning = () => {
    setView('scanning');
    setScanActive(true);
  };

  return (
    <div>
      <PageHeader title="GYM CHECK-IN" subtitle="Record your visit" />
      <div style={{ maxWidth: 460, margin: '0 auto' }}>

        {/* Home screen */}
        {view === 'home' && (
          <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Welcome card */}
            <Card style={{ padding: '24px 24px', textAlign: 'center' }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: T.accentDim, border: `2px solid ${T.accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <Avatar name={user?.name} size={60} />
              </div>
              <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 16 }}>{user?.name}</div>
              <div style={{ color: T.muted, fontSize: 12, fontFamily: T.mono, marginTop: 2 }}>
                {new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}
              </div>
            </Card>

            {/* Scan QR */}
            <Card style={{ padding: 24, cursor: 'pointer', border: `1px solid ${T.border}`, transition: 'border-color 0.15s' }}
              className="fadeUp-1"
              onClick={startScanning}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, background: T.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: 'glow 3s ease-in-out infinite' }}>
                  <Icon name="qr" size={26} color={T.accent} />
                </div>
                <div>
                  <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 17, letterSpacing: '0.02em' }}>SCAN GYM QR CODE</div>
                  <div style={{ color: T.sub, fontSize: 12, marginTop: 3 }}>Point camera at the QR code near the gym entrance</div>
                </div>
                <Icon name="chevron_right" size={20} color={T.muted} style={{ marginLeft: 'auto' }} />
              </div>
            </Card>

            {/* Manual check-in */}
            <Card style={{ padding: 24, cursor: 'pointer', border: `1px solid ${T.border}`, transition: 'border-color 0.15s' }}
              className="fadeUp-2"
              onClick={handleManualCheckIn}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.blue}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, background: T.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="checkin" size={26} color={T.blue} />
                </div>
                <div>
                  <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 17, letterSpacing: '0.02em' }}>MANUAL CHECK-IN</div>
                  <div style={{ color: T.sub, fontSize: 12, marginTop: 3 }}>Tap to instantly record today's visit</div>
                </div>
                <Icon name="chevron_right" size={20} color={T.muted} style={{ marginLeft: 'auto' }} />
              </div>
            </Card>

            {/* Tip */}
            <div style={{ padding: '12px 16px', background: T.bg1, borderRadius: 5, border: `1px solid ${T.border}`, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Icon name="info_circle" size={14} color={T.muted} />
              <span style={{ fontSize: 11, color: T.muted, lineHeight: 1.6 }}>Only one check-in is recorded per day. QR scan is automatic when you scan the gym entrance code.</span>
            </div>
          </div>
        )}

        {/* Scanner screen */}
        {view === 'scanning' && (
          <Card style={{ padding: 20 }} className="fadeUp">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 15, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.green, animation: 'pulse 1.5s infinite' }} />
                Scanning...
              </div>
              <Btn variant="ghost" size="sm" onClick={reset}><Icon name="close" size={14} /> Cancel</Btn>
            </div>

            <QRScanner
              active={scanActive}
              onScan={(token) => processGymQR(token)}
              onError={(err) => { setErrorMsg(err); setView('error'); }}
              label="Point camera at the gym QR code"
            />

            <div style={{ marginTop: 16, padding: '12px 14px', background: T.bg0, borderRadius: 5, border: `1px solid ${T.border}`, fontSize: 12, color: T.sub, textAlign: 'center' }}>
              Look for the QR code printed near the gym entrance or reception desk
            </div>
          </Card>
        )}

        {/* Loading */}
        {view === 'loading' && (
          <Card style={{ padding: 70, textAlign: 'center' }} className="fadeUp">
            <Spinner size={36} />
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, letterSpacing: '0.14em', marginTop: 16 }}>PROCESSING CHECK-IN...</div>
          </Card>
        )}

        {view === 'success' && <SuccessScreen member={successData} onBack={reset} />}
        {view === 'already' && <AlreadyCheckedIn onBack={reset} />}
        {view === 'error' && <ErrorScreen message={errorMsg} onBack={reset} onRetry={reset} />}
      </div>
    </div>
  );
}
