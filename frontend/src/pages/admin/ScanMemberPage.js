import React, { useState, useCallback } from 'react';
import api from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { PageHeader, Card, Btn, Icon, Avatar, Badge, Spinner } from '../../components/shared/UI';
import QRScanner from '../../components/shared/QRScanner';
import { useToast } from '../../context/ToastContext';

function SubStatusBar({ sub, daysLeft }) {
  if (!sub) return (
    <div style={{ background: T.redDim, border: `1px solid ${T.red}44`, borderRadius: 6, padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'center' }}>
      <Icon name="warning" size={18} color={T.red} />
      <div>
        <div style={{ color: T.red, fontWeight: 700, fontFamily: T.display, letterSpacing: '0.04em' }}>NO ACTIVE SUBSCRIPTION</div>
        <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>Member has no current plan.</div>
      </div>
    </div>
  );
  const urgent = daysLeft <= 3;
  const warning = daysLeft <= 7;
  const color = urgent ? T.red : warning ? T.amber : T.green;
  const bg = urgent ? T.redDim : warning ? T.amberDim : T.greenDim;
  return (
    <div style={{ background: bg, border: `1px solid ${color}44`, borderRadius: 6, padding: '14px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 18, color }}>{sub.plan_name}</div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 3, fontFamily: T.mono }}>
            {fmt.date(sub.start_date)} → {fmt.date(sub.end_date)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 28, color, lineHeight: 1 }}>
            {daysLeft < 0 ? 'EXPIRED' : daysLeft === 0 ? 'TODAY' : `${daysLeft}d`}
          </div>
          <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em' }}>
            {daysLeft > 0 ? 'DAYS LEFT' : 'STATUS'}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 16 }}>
        <div>
          <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em' }}>AMOUNT PAID</div>
          <div style={{ fontFamily: T.mono, fontWeight: 600, color, fontSize: 13 }}>{fmt.currency(sub.amount_paid)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em' }}>PAYMENT</div>
          <div style={{ fontSize: 13, textTransform: 'capitalize' }}>{sub.payment_method || '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em' }}>DURATION</div>
          <div style={{ fontSize: 13 }}>{sub.duration_days} days</div>
        </div>
      </div>
    </div>
  );
}

function AttendanceMini({ logs, totalCheckins }) {
  if (!logs?.length) return (
    <div style={{ textAlign: 'center', color: T.muted, fontFamily: T.mono, fontSize: 11, padding: '14px 0', letterSpacing: '0.1em' }}>
      NO VISITS RECORDED
    </div>
  );
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em' }}>RECENT VISITS</span>
        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.accent, fontWeight: 700 }}>{totalCheckins} total</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {logs.map((l, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: i === 0 ? T.accentDim : T.bg1, borderRadius: 4, border: `1px solid ${i === 0 ? T.accent + '33' : T.border + '55'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="check" size={13} color={i === 0 ? T.accent : T.green} />
              <span style={{ fontFamily: T.mono, fontSize: 12, color: i === 0 ? T.white : T.sub }}>
                {fmt.date(l.check_in_date || l.check_in_time)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{fmt.time(l.check_in_time)}</span>
              <span style={{ background: l.scan_method === 'qr' ? T.blueDim : T.amberDim, color: l.scan_method === 'qr' ? T.blue : T.amber, padding: '1px 6px', borderRadius: 2, fontSize: 9, fontFamily: T.mono, textTransform: 'uppercase' }}>
                {l.scan_method || 'manual'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ScanMemberPage() {
  const [scanActive, setScanActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [scannedToken, setScannedToken] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [mode, setMode] = useState('view'); // 'view' | 'checkin'
  const toast = useToast();

  const processToken = useCallback(async (rawToken, action = 'view') => {
    if (!rawToken.startsWith('MBR-')) {
      toast('This is not a member QR code', 'error');
      return;
    }
    setScanActive(false);
    setLoading(true);
    setResult(null);
    setScannedToken(rawToken);
    try {
      const res = await api.post('/scan/scan-member', { qr_token: rawToken, action });
      setResult(res.data);
      if (action === 'checkin' && res.data.checkin_result?.success) {
        toast(`✓ ${res.data.member.name} checked in!`, 'success');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Scan failed';
      toast(msg, 'error');
      setScanActive(true);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleScan = useCallback((token) => {
    processToken(token, mode === 'checkin' ? 'checkin' : 'view');
  }, [processToken, mode]);

  const handleManualCheckIn = async () => {
    if (!scannedToken) return;
    setCheckingIn(true);
    try {
      const res = await api.post('/scan/scan-member', { qr_token: scannedToken, action: 'checkin' });
      setResult(r => ({ ...r, checkin_result: res.data.checkin_result, already_checked_in: true }));
      toast(`✓ ${result?.member?.name} checked in!`, 'success');
    } catch (e) {
      toast(e.response?.data?.message || 'Check-in failed', 'error');
    } finally {
      setCheckingIn(false);
    }
  };

  const reset = () => {
    setResult(null);
    setLoading(false);
    setScanActive(true);
    setScannedToken('');
  };

  return (
    <div>
      <PageHeader
        title="SCAN MEMBER QR"
        subtitle="Scan a member's personal QR code to view their profile or check them in"
      />

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 4, background: T.bg1, padding: 4, borderRadius: 6, width: 'fit-content', marginBottom: 22 }}>
        {[
          { id: 'view',    label: 'View Profile', icon: 'eye' },
          { id: 'checkin', label: 'Check In',      icon: 'checkin' },
        ].map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); reset(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 4, fontFamily: T.display, fontWeight: 700, fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', background: mode === m.id ? (m.id === 'checkin' ? T.accent : T.bg3) : 'transparent', color: mode === m.id ? (m.id === 'checkin' ? '#fff' : T.white) : T.sub, transition: 'all 0.15s', cursor: 'pointer' }}>
            <Icon name={m.icon} size={14} color={mode === m.id ? (m.id === 'checkin' ? '#fff' : T.white) : T.sub} />
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Scanner column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: scanActive && !loading ? T.green : T.muted, animation: scanActive && !loading ? 'pulse 1.5s infinite' : 'none', flexShrink: 0 }} />
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                {loading ? 'Looking up...' : scanActive ? 'Scanner active' : 'Scanner paused'}
              </span>
            </div>

            {loading ? (
              <div style={{ aspectRatio: '1', maxWidth: 304, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: T.bg1, borderRadius: 10, width: '100%' }}>
                <Spinner size={32} />
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, letterSpacing: '0.12em' }}>LOOKING UP MEMBER...</span>
              </div>
            ) : (
              <QRScanner
                active={scanActive}
                onScan={handleScan}
                onError={(e) => { toast(e, 'error'); }}
                label={mode === 'checkin' ? 'Scan member QR to check in' : 'Scan member QR to view profile'}
              />
            )}

            {!scanActive && !loading && (
              <Btn variant="ghost" onClick={reset} style={{ width: '100%', marginTop: 12 }}>
                <Icon name="refresh" size={14} /> Scan Again
              </Btn>
            )}
          </Card>

          {/* How to use */}
          <Card style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 10, textTransform: 'uppercase' }}>How To Use</div>
            {[
              ['1', 'Ask member to open their profile in the app'],
              ['2', 'Member taps "Show My QR" to display their code'],
              ['3', mode === 'checkin' ? 'Scan → member is instantly checked in' : 'Scan → view full membership & history'],
            ].map(([n, t]) => (
              <div key={n} style={{ display: 'flex', gap: 9, marginBottom: 7, fontSize: 12, color: T.sub, alignItems: 'flex-start' }}>
                <span style={{ background: T.accent, color: '#fff', width: 17, height: 17, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{n}</span>
                {t}
              </div>
            ))}
          </Card>
        </div>

        {/* ── Results column ── */}
        <div>
          {!result && !loading && (
            <Card style={{ padding: 70, textAlign: 'center' }}>
              <Icon name="qr" size={54} color={T.muted} />
              <div style={{ color: T.muted, fontFamily: T.mono, fontSize: 11, letterSpacing: '0.12em', marginTop: 14, textTransform: 'uppercase' }}>
                Scan a member QR to see results
              </div>
              <div style={{ color: T.border, fontSize: 12, marginTop: 8 }}>
                Member QR tokens start with "MBR-"
              </div>
            </Card>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Member header */}
              <Card style={{ padding: 22 }} className="fadeUp">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
                  <Avatar name={result.member.name} size={64} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 24, lineHeight: 1 }}>{result.member.name}</div>
                    <div style={{ color: T.sub, fontSize: 13, fontFamily: T.mono, marginTop: 4 }}>{result.member.email}</div>
                    <div style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>{result.member.phone || '—'}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <Badge status={result.member.role} />
                      <Badge status={result.member.status} />
                      <Badge status={result.member.member_type} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {[
                    ['Total Visits', result.total_checkins],
                    ['Member Since', fmt.date(result.member.created_at)],
                    ['Date of Birth', fmt.date(result.member.date_of_birth)],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: T.bg1, padding: '9px 12px', borderRadius: 5 }}>
                      <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 3, textTransform: 'uppercase' }}>{k}</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Check-in result banner */}
              {result.checkin_result && (
                <div className="fadeUp-1" style={{ background: result.checkin_result.success ? T.greenDim : T.amberDim, border: `1px solid ${result.checkin_result.success ? T.green + '44' : T.amber + '44'}`, borderRadius: 6, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: result.checkin_result.success ? T.greenDim : T.amberDim, border: `2px solid ${result.checkin_result.success ? T.green + '55' : T.amber + '55'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={result.checkin_result.success ? 'check' : 'info_circle'} size={20} color={result.checkin_result.success ? T.green : T.amber} />
                  </div>
                  <div>
                    <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 16, color: result.checkin_result.success ? T.green : T.amber }}>
                      {result.checkin_result.success ? '✓ CHECKED IN SUCCESSFULLY' : 'ALREADY CHECKED IN TODAY'}
                    </div>
                    <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
                      {result.checkin_result.success
                        ? `${fmt.time(new Date())} · ${fmt.date(new Date())}`
                        : 'Next check-in available tomorrow'}
                    </div>
                  </div>
                </div>
              )}

              {/* Already checked in (view mode) */}
              {!result.checkin_result && result.already_checked_in && (
                <div className="fadeUp-1" style={{ background: T.blueDim, border: `1px solid ${T.blue}33`, borderRadius: 6, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="info_circle" size={15} color={T.blue} />
                  <span style={{ color: T.blue, fontSize: 13 }}>Already checked in today at this gym</span>
                </div>
              )}

              {/* Subscription */}
              <div className="fadeUp-2">
                <SubStatusBar sub={result.active_subscription} daysLeft={result.days_left} />
              </div>

              {/* Check-in action button (view mode only) */}
              {mode === 'view' && !result.already_checked_in && !result.checkin_result && (
                <Btn onClick={handleManualCheckIn} disabled={checkingIn} style={{ width: '100%', padding: '12px' }} className="fadeUp-2">
                  <Icon name="checkin" size={16} />
                  {checkingIn ? 'Checking In...' : `CHECK IN ${result.member.name.split(' ')[0].toUpperCase()}`}
                </Btn>
              )}

              {/* Attendance history */}
              <Card style={{ padding: 16 }} className="fadeUp-3">
                <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase', color: T.sub, marginBottom: 12 }}>
                  Attendance History
                </div>
                <AttendanceMini logs={result.recent_attendance} totalCheckins={result.total_checkins} />
              </Card>

              {/* Scan again */}
              <Btn variant="ghost" onClick={reset} style={{ width: '100%' }} className="fadeUp-4">
                <Icon name="refresh" size={14} /> Scan Another Member
              </Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
