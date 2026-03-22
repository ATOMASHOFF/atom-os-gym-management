import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { Card, PageHeader, Btn, Icon, Badge, EmptyState, Spinner, Modal, Input, ConfirmDialog } from '../../components/shared/UI';
import { useToast } from '../../context/ToastContext';

export default function QRCodesPage() {
  const [qrs, setQrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [location, setLocation] = useState('Main Entrance');
  const [showGen, setShowGen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/gym-qr');
      setQrs((r.data?.data || r.data)?.qr_codes || []);
    } catch (e) { toast('Failed to load QR codes', 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post('/gym-qr/generate', { location });
      toast('QR Code generated!', 'success');
      setShowGen(false);
      load();
    } catch (e) { toast('Failed to generate QR', 'error'); }
    finally { setGenerating(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/gym-qr/${deleteTarget.id}`);
      toast('QR Code deleted', 'info');
      setDeleteTarget(null);
      load();
    } catch (e) { toast('Failed', 'error'); }
  };

  const handleToggle = async (qr) => {
    try {
      await api.put(`/gym-qr/${qr.id}`, { is_active: !qr.is_active });
      toast(`QR ${qr.is_active ? 'deactivated' : 'activated'}`, 'info');
      load();
    } catch (e) { toast('Failed', 'error'); }
  };

  const downloadQR = (qr) => {
    const a = document.createElement('a');
    a.href = qr.qr_image_data;
    a.download = `qr-${qr.location?.replace(/\s+/g,'-')}-${qr.id}.png`;
    a.click();
  };

  return (
    <div>
      <PageHeader title="QR CODES" subtitle="Gym check-in QR codes" actions={
        <Btn onClick={() => setShowGen(true)}><Icon name="add" size={14} /> Generate QR</Btn>
      } />

      {/* Info banner */}
      <div style={{ background: T.blueDim, border: `1px solid ${T.blue}33`, borderRadius: 6, padding: '12px 18px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
        <Icon name="info_circle" size={15} color={T.blue} />
        <span style={{ fontSize: 12, color: T.blue }}>Print and place QR codes at gym entrances. Members scan to check in automatically.</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={28} /></div>
      ) : qrs.length === 0 ? (
        <Card><EmptyState icon="qr" message="No QR codes yet" action={<Btn onClick={() => setShowGen(true)}>Generate First QR Code</Btn>} /></Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {qrs.map((q, i) => (
            <Card key={q.id} className={`fadeUp-${Math.min(i+1,5)}`} style={{ overflow: 'hidden' }}>
              <div style={{ position: 'relative', background: q.is_active ? T.bg1 : T.bg0, padding: 20, display: 'flex', justifyContent: 'center', borderBottom: `1px solid ${T.border}` }}>
                {!q.is_active && <div style={{ position: 'absolute', inset: 0, background: '#00000066', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}><span style={{ background: T.redDim, color: T.red, padding: '6px 14px', borderRadius: 4, fontFamily: T.display, fontWeight: 700, letterSpacing: '0.08em' }}>INACTIVE</span></div>}
                {q.qr_image_data ? (
                  <img src={q.qr_image_data} alt="QR Code" style={{ width: 170, height: 170, borderRadius: 8 }} />
                ) : (
                  <div style={{ width: 170, height: 170, background: T.bg2, border: `2px solid ${T.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="qr" size={60} color={T.muted} />
                  </div>
                )}
              </div>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{q.location || 'QR Code'}</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge status={q.is_active ? 'active' : 'inactive'} />
                  <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>{q.scan_count || 0} scans</span>
                  <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono }}>{fmt.date(q.created_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {q.qr_image_data && <Btn size="sm" variant="blue" onClick={() => downloadQR(q)}><Icon name="download" size={12} /> Download</Btn>}
                  <Btn size="sm" variant={q.is_active ? 'ghost' : 'success'} onClick={() => handleToggle(q)}>
                    {q.is_active ? 'Deactivate' : 'Activate'}
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => setDeleteTarget(q)}><Icon name="delete" size={12} /></Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showGen} onClose={() => setShowGen(false)} title="GENERATE QR CODE" width={380}>
        <div style={{ marginBottom: 20 }}>
          <Input label="Location / Label" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Main Entrance, Back Door" />
          <div style={{ marginTop: 8, fontSize: 11, color: T.muted }}>This label helps identify which entrance the QR is placed at.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowGen(false)}>Cancel</Btn>
          <Btn onClick={handleGenerate} disabled={generating}>{generating ? 'Generating...' : 'Generate QR Code'}</Btn>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="DELETE QR CODE" message={`Delete QR code for "${deleteTarget?.location}"? All scan history will be lost.`} confirmLabel="Delete" danger />
    </div>
  );
}
