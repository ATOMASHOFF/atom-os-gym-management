import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { Card, PageHeader, Btn, Icon, Spinner, Badge } from '../../components/shared/UI';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import QRScanner from '../../components/shared/QRScanner';

export default function CheckInPage() {
  const { user } = useAuth();
  const toast    = useToast();
  const [scanning, setScanning]   = useState(true);  // Start with scanner open
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [lastCheckin, setLastCheckin] = useState(null);
  const [myQr, setMyQr]           = useState(null);
  const [showMyQr, setShowMyQr]   = useState(false);

  // Load member's personal QR code
  useEffect(() => {
    if (user?.id) {
      api.get(`/scan/member-qr/${user.id}`)
        .then(r => {
          const d = r.data?.data || r.data;
          setMyQr(d);
        })
        .catch(() => {});
    }
  }, [user]);

  const handleScan = async (qrToken) => {
    if (loading || !qrToken) return;
    setLoading(true);
    setScanning(false);
    try {
      const r = await api.post('/scan/gym-qr', { qr_token: qrToken });
      const d = r.data?.data || r.data;
      setResult({ success: true, data: d });
      setLastCheckin(new Date());
      toast('✅ Checked in successfully!', 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Check-in failed';
      setResult({ success: false, message: msg });
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setScanning(true);
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <PageHeader
        title="CHECK IN"
        subtitle="Scan your gym's QR code to mark attendance"
        actions={
          <Btn variant="ghost" size="sm" onClick={() => setShowMyQr(v => !v)}>
            <Icon name="qr" size={13} /> My QR
          </Btn>
        }
      />

      {/* ── My personal QR code (for staff to scan) ── */}
      {showMyQr && myQr && (
        <Card className="fadeUp" style={{ padding: 24, textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>
            Your Membership QR — Show to staff
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: 16, display: 'inline-block', marginBottom: 14 }}>
            <img src={myQr.qr_image_data} alt="My QR" style={{ width: 200, height: 200, display: 'block' }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{user?.name}</div>
          <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono, marginTop: 4 }}>{myQr.qr_token}</div>
        </Card>
      )}

      {/* ── Result screen ── */}
      {result && (
        <Card className="fadeUp" style={{ padding: 32, textAlign: 'center', marginBottom: 20 }}>
          {result.success ? (
            <>
              <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
              <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 22, color: T.green, marginBottom: 4 }}>
                CHECKED IN!
              </div>
              <div style={{ color: T.sub, fontSize: 13, marginBottom: 8 }}>
                {fmt.datetime(lastCheckin)}
              </div>
              {result.data?.subscription && (
                <div style={{
                  background: T.greenDim, border: `1px solid ${T.green}44`,
                  borderRadius: 6, padding: '10px 16px', margin: '16px 0',
                  display: 'inline-block',
                }}>
                  <div style={{ fontSize: 12, color: T.green }}>
                    {result.data.subscription.plan_name} · Expires {fmt.date(result.data.subscription.end_date)}
                  </div>
                </div>
              )}
              <Btn onClick={reset} style={{ marginTop: 16 }}>
                <Icon name="qr" size={14} /> Scan Again
              </Btn>
            </>
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
              <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 18, color: T.red, marginBottom: 8 }}>
                Check-in Failed
              </div>
              <div style={{ color: T.sub, fontSize: 13, marginBottom: 16 }}>{result.message}</div>
              <Btn onClick={reset} variant="ghost">Try Again</Btn>
            </>
          )}
        </Card>
      )}

      {/* ── QR Scanner — shown first ── */}
      {scanning && !result && (
        <Card className="fadeUp" style={{ overflow: 'hidden' }}>
          <div style={{
            padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Icon name="qr" size={16} color={T.accent} />
            <div>
              <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 14 }}>
                Scan Gym QR Code
              </div>
              <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>
                Point your camera at the QR code posted at the gym entrance
              </div>
            </div>
          </div>

          <div style={{ padding: 20 }}>
            {loading ? (
              <div style={{ padding: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <Spinner size={32} />
                <div style={{ color: T.sub, fontSize: 13 }}>Recording check-in...</div>
              </div>
            ) : (
              <QRScanner
                onScan={handleScan}
                style={{ width: '100%', borderRadius: 6, overflow: 'hidden' }}
              />
            )}
          </div>
        </Card>
      )}

      {/* ── Instructions ── */}
      {!result && (
        <div style={{ marginTop: 16, padding: '14px 20px', background: T.bg2, borderRadius: 6, border: `1px solid ${T.border}` }} className="fadeUp-1">
          <div style={{ fontSize: 12, color: T.sub, fontFamily: T.mono, letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>How to check in</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'Allow camera access when prompted',
              'Find the QR code posted at your gym entrance',
              'Point your camera — check-in is instant',
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: T.sub }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: T.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i+1}</div>
                {t}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
