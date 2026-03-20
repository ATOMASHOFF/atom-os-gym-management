import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { Card, PageHeader, Btn, Icon, Avatar, Badge, Spinner, Modal } from '../../components/shared/UI';
import { useAuth } from '../../context/AuthContext';

function MemberQRModal({ open, onClose, user }) {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user?.id) {
      setLoading(true);
      api.get(`/scan/member-qr/${user.id}`)
        .then(r => setQrData(r.data?.data || r.data))
        .catch(() => setQrData(null))
        .finally(() => setLoading(false));
    }
  }, [open, user]);

  const downloadQR = () => {
    if (!qrData?.qr_image_data) return;
    const a = document.createElement('a');
    a.href = qrData.qr_image_data;
    a.download = `atom-fitness-qr-${user?.name?.replace(/\s+/g, '-')}.png`;
    a.click();
  };

  return (
    <Modal open={open} onClose={onClose} title="YOUR MEMBERSHIP QR CODE" width={380}>
      <div style={{ textAlign: 'center' }}>
        {loading ? (
          <div style={{ padding: 40 }}><Spinner size={28} /></div>
        ) : qrData ? (
          <>
            {/* QR Code display */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, display: 'inline-block', marginBottom: 18, boxShadow: `0 0 30px ${T.accent}22` }}>
              <img src={qrData.qr_image_data} alt="Your QR" style={{ width: 220, height: 220, display: 'block' }} />
            </div>

            <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 18, marginBottom: 4 }}>{user?.name}</div>
            <div style={{ color: T.sub, fontSize: 12, fontFamily: T.mono, marginBottom: 6 }}>{user?.email}</div>

            <div style={{ background: T.bg1, borderRadius: 5, padding: '8px 14px', marginBottom: 18, display: 'inline-block' }}>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, letterSpacing: '0.1em' }}>TOKEN: </span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent }}>{qrData.qr_token}</span>
            </div>

            {/* Usage instructions */}
            <div style={{ background: T.bg0, border: `1px solid ${T.border}`, borderRadius: 6, padding: '14px 16px', textAlign: 'left', marginBottom: 18 }}>
              <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 8 }}>HOW TO USE</div>
              {[
                'Show this QR to gym staff to check in',
                'They scan it to view your membership',
                'Or scan the gym\'s QR code yourself via Check In page',
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 12, color: T.sub }}>
                  <Icon name="check" size={13} color={T.green} />
                  {t}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Btn onClick={downloadQR} variant="blue" size="sm"><Icon name="download" size={13} /> Download PNG</Btn>
              <Btn variant="ghost" size="sm" onClick={onClose}>Close</Btn>
            </div>
          </>
        ) : (
          <div style={{ padding: 40, color: T.muted, fontFamily: T.mono, fontSize: 12 }}>Failed to load QR code</div>
        )}
      </div>
    </Modal>
  );
}

export default function MyProfilePage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (user?.id) {
      api.get(`/members/${user.id}`)
        .then(r => setData(r.data?.data || r.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32} /></div>
  );

  const activeSub = data?.subscriptions?.find(s => s.status === 'active');
  const daysLeft = activeSub ? fmt.daysLeft(activeSub.end_date) : null;
  const subUrgent = daysLeft !== null && daysLeft <= 7;

  return (
    <div>
      <PageHeader title="MY PROFILE" actions={
        <Btn onClick={() => setShowQR(true)}>
          <Icon name="qr" size={14} /> Show My QR
        </Btn>
      } />

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, marginBottom: 20 }}>
        {/* Profile card */}
        <Card style={{ padding: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <Avatar name={user?.name} size={76} />
          <div>
            <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 20 }}>{user?.name}</div>
            <div style={{ color: T.sub, fontSize: 13, marginTop: 3, fontFamily: T.mono }}>{user?.email}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Badge status={user?.role} />
              <Badge status={user?.status || 'active'} />
              <Badge status={user?.member_type || 'regular'} />
            </div>
          </div>

          {/* QR preview button */}
          <button onClick={() => setShowQR(true)} style={{
            width: '100%', background: T.bg0, border: `2px dashed ${T.accent}44`, borderRadius: 8,
            padding: '16px', cursor: 'pointer', transition: 'all 0.2s', marginTop: 4,
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = T.accentDim; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.accent + '44'; e.currentTarget.style.background = T.bg0; }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Icon name="qr" size={32} color={T.accent} />
              <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.accent }}>My QR Code</span>
              <span style={{ fontSize: 11, color: T.muted }}>Show to gym staff to check in</span>
            </div>
          </button>

          <div style={{ width: '100%', borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 4 }}>MEMBER SINCE</div>
            <div style={{ fontFamily: T.mono, fontSize: 13 }}>{fmt.date(user?.created_at)}</div>
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Subscription status */}
          {activeSub ? (
            <Card style={{ padding: 22, border: `1px solid ${subUrgent ? T.amber + '55' : T.green + '44'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.12em', marginBottom: 4 }}>ACTIVE MEMBERSHIP</div>
                  <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 22, color: subUrgent ? T.amber : T.green }}>
                    {activeSub.plan_name}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 36, color: subUrgent ? T.amber : T.green, lineHeight: 1 }}>
                    {daysLeft < 0 ? '!' : daysLeft === 0 ? '0' : daysLeft}
                  </div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em' }}>
                    {daysLeft < 0 ? 'EXPIRED' : 'DAYS LEFT'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[['Valid From', fmt.date(activeSub.start_date)], ['Valid Until', fmt.date(activeSub.end_date)], ['Amount Paid', fmt.currency(activeSub.amount_paid)]].map(([k, v]) => (
                  <div key={k} style={{ background: T.bg1, padding: '9px 12px', borderRadius: 5 }}>
                    <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em', marginBottom: 2 }}>{k.toUpperCase()}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, fontFamily: k === 'Amount Paid' ? T.mono : T.font }}>{v}</div>
                  </div>
                ))}
              </div>
              {subUrgent && daysLeft >= 0 && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: T.amberDim, borderRadius: 4, fontSize: 12, color: T.amber, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Icon name="warning" size={14} color={T.amber} />
                  Your membership expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}. Contact the gym to renew.
                </div>
              )}
            </Card>
          ) : (
            <Card style={{ padding: 28, textAlign: 'center', border: `1px solid ${T.amber}33` }}>
              <Icon name="warning" size={36} color={T.amber} />
              <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 18, marginTop: 12, marginBottom: 6 }}>No Active Subscription</div>
              <div style={{ color: T.sub, fontSize: 13 }}>Contact the gym admin to subscribe to a membership plan.</div>
            </Card>
          )}

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              ['Total Check-ins', data?.total_checkins || 0, 'attendance', T.blue],
              ['Last Visit', data?.last_checkin ? fmt.date(data.last_checkin) : 'Never', 'checkin', T.green],
            ].map(([label, value, icon, color]) => (
              <Card key={label} style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={icon} size={22} color={color} />
                </div>
                <div>
                  <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 24, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Subscription history */}
      {data?.subscriptions?.length > 0 && (
        <Card style={{ overflow: 'hidden' }} className="fadeUp-5">
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, fontFamily: T.display, fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Subscription History
          </div>
          {data.subscriptions.map((s, i) => (
            <div key={s.id} style={{ padding: '12px 20px', borderBottom: i < data.subscriptions.length - 1 ? `1px solid ${T.border}33` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 500 }}>{s.plan_name} <span style={{ fontSize: 12, color: T.muted }}>· {s.duration_days}d</span></div>
                <div style={{ fontSize: 12, color: T.sub, fontFamily: T.mono }}>{fmt.date(s.start_date)} → {fmt.date(s.end_date)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: T.mono, fontSize: 13, color: T.green, fontWeight: 600 }}>{fmt.currency(s.amount_paid)}</span>
                <Badge status={s.status} />
              </div>
            </div>
          ))}
        </Card>
      )}

      <MemberQRModal open={showQR} onClose={() => setShowQR(false)} user={user} />
    </div>
  );
}
