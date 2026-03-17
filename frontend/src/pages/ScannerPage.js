/**
 * ScannerPage — Admin / Staff
 *
 * Two modes toggled by a tab:
 *   "Scan Member QR"  → camera scans the member's personal QR → shows full membership card + check-in button
 *   "Scan Gym QR"     → (for testing) scan an entry QR, checks in the current admin/staff user (rarely used)
 *
 * The member card shows:
 *   • Name, photo initials, status badge
 *   • Active subscription: plan name, end date, days remaining
 *   • Recent attendance heatmap (last 30 days)
 *   • Total check-in count
 *   • One-tap "Check In" button
 */
import React, { useState, useCallback, useRef } from 'react';
import api from '../utils/api';
import { T, fmt } from '../utils/helpers';
import { Card, PageHeader, Btn, Icon, Avatar, Badge, Spinner } from '../components/shared/UI';
import { useToast } from '../context/ToastContext';
import QRScanner from '../components/shared/QRScanner';

// ── Membership status banner ──────────────────────────────────────────────────
function SubscriptionBanner({ sub }) {
  if (!sub) return (
    <div style={{ background: T.redDim, border: `1px solid ${T.red}44`, borderRadius: 6, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <Icon name="warning" size={18} color={T.red} />
      <div>
        <div style={{ color: T.red, fontWeight: 700, fontFamily: T.display, fontSize: 14 }}>NO ACTIVE MEMBERSHIP</div>
        <div style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>Member has no valid subscription</div>
      </div>
    </div>
  );

  const daysLeft = fmt.daysLeft(sub.end_date);
  const urgent = daysLeft !== null && daysLeft <= 7;
  const color = daysLeft <= 0 ? T.red : urgent ? T.amber : T.green;

  return (
    <div style={{ background: `${color}12`, border: `1px solid ${color}44`, borderRadius: 6, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 18, color }}>{sub.plan_name}</div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 3, fontFamily: T.mono }}>
            Valid: {fmt.date(sub.start_date)} → {fmt.date(sub.end_date)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 28, color, lineHeight: 1 }}>
            {daysLeft <= 0 ? 'EXP' : daysLeft}
          </div>
          <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em' }}>
            {daysLeft <= 0 ? 'EXPIRED' : 'DAYS LEFT'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 30-day attendance mini-calendar ──────────────────────────────────────────
function AttendanceMini({ logs }) {
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const ds = d.toISOString().split('T')[0];
    const visited = logs.some(l => {
      const ld = l.check_in_date || l.check_in_time?.slice(0, 10);
      return ld === ds;
    });
    return { ds, visited, day: d.getDate() };
  });

  return (
    <div>
      <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>
        Last 30 days — {days.filter(d => d.visited).length} visits
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gap: 3 }}>
        {days.map(d => (
          <div key={d.ds} title={d.ds} style={{
            aspectRatio: '1', borderRadius: 2,
            background: d.visited ? T.accent : T.bg1,
            border: `1px solid ${d.visited ? T.accent + '66' : T.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 7, color: d.visited ? '#fff' : T.muted,
            fontFamily: T.mono,
          }}>{d.day}</div>
        ))}
      </div>
    </div>
  );
}

// ── Member result card ────────────────────────────────────────────────────────
function MemberCard({ data, onCheckIn, checkingIn, alreadyIn }) {
  const { member, active_subscription, recent_attendance, stats } = data;

  return (
    <Card className="fadeUp" style={{ overflow: 'hidden' }}>
      {/* Header stripe */}
      <div style={{ height: 4, background: active_subscription ? T.green : T.red }} />

      <div style={{ padding: '20px 20px 0' }}>
        {/* Member identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <Avatar name={member.name} size={54} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 22, letterSpacing: '0.02em' }}>{member.name}</div>
            <div style={{ fontSize: 12, color: T.muted, fontFamily: T.mono }}>{member.email}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <Badge status={member.status} />
              <Badge status={member.member_type || 'regular'} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 28, color: T.blue, lineHeight: 1 }}>
              {fmt.num(stats.total_checkins)}
            </div>
            <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>check-ins</div>
          </div>
        </div>

        {/* Membership status */}
        <div style={{ marginBottom: 16 }}>
          <SubscriptionBanner sub={active_subscription} />
        </div>

        {/* Attendance mini-calendar */}
        <div style={{ marginBottom: 16 }}>
          <AttendanceMini logs={recent_attendance} />
        </div>

        {/* Last visit */}
        {stats.last_checkin && (
          <div style={{ background: T.bg1, borderRadius: 5, padding: '8px 12px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Last Visit</span>
            <span style={{ fontSize: 12, color: T.sub, fontFamily: T.mono }}>{fmt.datetime(stats.last_checkin)}</span>
          </div>
        )}
      </div>

      {/* Check-in action */}
      <div style={{ padding: '0 20px 20px' }}>
        {alreadyIn ? (
          <div style={{ background: T.amberDim, border: `1px solid ${T.amber}44`, borderRadius: 6, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="info_circle" size={16} color={T.amber} />
            <span style={{ color: T.amber, fontWeight: 600, fontFamily: T.display, fontSize: 13, letterSpacing: '0.04em' }}>
              ALREADY CHECKED IN TODAY
            </span>
          </div>
        ) : (
          <Btn
            onClick={onCheckIn}
            disabled={checkingIn || member.status !== 'active'}
            style={{ width: '100%', padding: '13px', fontSize: 15 }}
          >
            {checkingIn
              ? <><Spinner size={14} /> CHECKING IN...</>
              : <><Icon name="check" size={16} /> CHECK IN {member.name.split(' ')[0].toUpperCase()}</>
            }
          </Btn>
        )}
      </div>
    </Card>
  );
}

// ── Success flash ─────────────────────────────────────────────────────────────
function SuccessFlash({ member, onDismiss }) {
  return (
    <Card className="fadeUp" style={{ padding: 36, textAlign: 'center', border: `1px solid ${T.green}55` }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: T.greenDim, border: `3px solid ${T.green}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', animation: 'glow 1.5s ease-in-out 2' }}>
        <Icon name="check" size={36} color={T.green} />
      </div>
      <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 28, color: T.green, letterSpacing: '0.04em', marginBottom: 6 }}>
        CHECKED IN!
      </div>
      <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{member.name}</div>
      <div style={{ fontFamily: T.mono, fontSize: 12, color: T.sub, marginBottom: 24 }}>
        {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}
      </div>
      <Btn onClick={onDismiss}><Icon name="qr" size={14} /> Scan Next</Btn>
    </Card>
  );
}

// ── Main Scanner Page ─────────────────────────────────────────────────────────
export default function ScannerPage() {
  const [mode, setMode] = useState('scan');       // 'scan' | 'result' | 'success' | 'error'
  const [scannerActive, setScannerActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [memberData, setMemberData] = useState(null);
  const [alreadyIn, setAlreadyIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [successMember, setSuccessMember] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const processingRef = useRef(false);
  const toast = useToast();

  const reset = useCallback(() => {
    setMode('scan');
    setMemberData(null);
    setAlreadyIn(false);
    setErrorMsg('');
    setSuccessMember(null);
    processingRef.current = false;
    setScannerActive(true);
  }, []);

  const handleScan = useCallback(async (rawPayload) => {
    if (processingRef.current || mode !== 'scan') return;
    processingRef.current = true;
    setScannerActive(false);
    setLoading(true);

    try {
      // Parse payload
      let parsed;
      try { parsed = JSON.parse(rawPayload); } catch { parsed = null; }

      if (parsed?.type === 'member') {
        // Admin scanning a member's personal QR → fetch their profile
        const res = await api.get(`/scan/member/${parsed.token}`);
        setMemberData(res.data);
        setAlreadyIn(res.data.already_checked_in_today);
        setMode('result');
      } else {
        // Generic / gym QR — process via universal endpoint
        const res = await api.post('/scan/process', { payload: rawPayload });
        setSuccessMember(res.data.member || { name: 'Member' });
        setMode('success');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to process QR code';
      if (err.response?.data?.already_checked_in) {
        setAlreadyIn(true);
        // Still try to load member data if possible
        setMode('result');
        toast('Already checked in today', 'info');
      } else {
        setErrorMsg(msg);
        setMode('error');
        toast(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [mode, toast]);

  const handleCheckIn = useCallback(async () => {
    if (!memberData?.member?.qr_token && !memberData?.member) return;
    setCheckingIn(true);
    try {
      const token = memberData.member.qr_token;
      const res = await api.post('/scan/checkin-member', { token });
      setSuccessMember(res.data.member || memberData.member);
      setMode('success');
      toast(`${memberData.member.name} checked in!`, 'success');
    } catch (err) {
      const msg = err.response?.data?.message || 'Check-in failed';
      toast(msg, 'error');
      if (err.response?.data?.already_checked_in) {
        setAlreadyIn(true);
      }
    } finally {
      setCheckingIn(false);
    }
  }, [memberData, toast]);

  // We need the qr_token in the member object for check-in
  // The /scan/member/:token endpoint returns the member but we need to store the token too
  // Let's patch memberData to include the token used
  const handleScanWithToken = useCallback(async (rawPayload) => {
    if (processingRef.current || mode !== 'scan') return;
    processingRef.current = true;
    setScannerActive(false);
    setLoading(true);

    try {
      let parsed;
      try { parsed = JSON.parse(rawPayload); } catch { parsed = null; }

      if (parsed?.type === 'member') {
        const res = await api.get(`/scan/member/${parsed.token}`);
        // Inject the token back so check-in works
        const data = { ...res.data, member: { ...res.data.member, qr_token: parsed.token } };
        setMemberData(data);
        setAlreadyIn(res.data.already_checked_in_today);
        setMode('result');
      } else {
        const res = await api.post('/scan/process', { payload: rawPayload });
        if (res.data.already_checked_in) {
          toast('Already checked in today', 'info');
        }
        setSuccessMember(res.data.member || { name: 'Member' });
        setMode('success');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to read QR code';
      setErrorMsg(msg);
      setMode('error');
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [mode, toast]);

  return (
    <div>
      <PageHeader
        title="QR SCANNER"
        subtitle="Scan member QR codes to check in"
        actions={mode !== 'scan' && <Btn variant="ghost" onClick={reset}><Icon name="qr" size={14} /> New Scan</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT: Camera ── */}
        <div>
          <Card style={{ padding: 20 }}>
            <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, color: T.sub, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="qr" size={14} color={T.accent} />
              Camera Scanner
            </div>

            {loading ? (
              <div style={{ aspectRatio: '1', background: T.bg1, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid ${T.border}` }}>
                <Spinner size={32} />
                <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 16, letterSpacing: '0.1em' }}>PROCESSING QR...</div>
              </div>
            ) : (
              <QRScanner
                active={scannerActive && mode === 'scan'}
                onScan={handleScanWithToken}
                label="Scan member QR card"
              />
            )}

            {/* Instruction cards */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: 'members', color: T.blue, title: 'Member QR → Profile', desc: 'Scan member\'s personal QR to view membership & attendance' },
                { icon: 'qr', color: T.green, title: 'Gym QR → Quick check-in', desc: 'Scan gym entry QR for instant check-in' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: T.bg1, padding: '10px 12px', borderRadius: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 5, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={item.icon} size={16} color={item.color} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── RIGHT: Result panel ── */}
        <div>
          {mode === 'scan' && !loading && (
            <Card style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: T.accentDim, border: `2px solid ${T.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Icon name="qr" size={36} color={T.accent} />
              </div>
              <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 18, marginBottom: 8 }}>AWAITING SCAN</div>
              <div style={{ color: T.sub, fontSize: 13, lineHeight: 1.7 }}>
                Point the camera at a member's personal QR code or the gym entry QR code.
              </div>
              <div style={{ marginTop: 20, padding: '12px 16px', background: T.bg1, borderRadius: 6, textAlign: 'left' }}>
                <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 8 }}>QUICK STATS TODAY</div>
                <TodayStats />
              </div>
            </Card>
          )}

          {mode === 'result' && memberData && (
            <MemberCard
              data={memberData}
              onCheckIn={handleCheckIn}
              checkingIn={checkingIn}
              alreadyIn={alreadyIn}
            />
          )}

          {mode === 'success' && successMember && (
            <SuccessFlash member={successMember} onDismiss={reset} />
          )}

          {mode === 'error' && (
            <Card className="fadeUp" style={{ padding: 40, textAlign: 'center', border: `1px solid ${T.red}44` }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: T.redDim, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Icon name="warning" size={32} color={T.red} />
              </div>
              <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 18, color: T.red, marginBottom: 8 }}>SCAN FAILED</div>
              <div style={{ color: T.sub, fontSize: 13, marginBottom: 20 }}>{errorMsg}</div>
              <Btn onClick={reset}><Icon name="refresh" size={14} /> Try Again</Btn>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Today's check-in count ────────────────────────────────────────────────────
function TodayStats() {
  const [count, setCount] = useState(null);
  useEffect(() => {
    api.get('/attendance/today').then(r => setCount((r.data.attendance || []).length)).catch(() => {});
  }, []);
  return (
    <div style={{ display: 'flex', gap: 20 }}>
      <div>
        <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 28, color: T.blue, lineHeight: 1 }}>{count ?? '—'}</div>
        <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono }}>CHECK-INS TODAY</div>
      </div>
    </div>
  );
}
