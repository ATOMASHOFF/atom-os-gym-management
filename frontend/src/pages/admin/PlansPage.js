import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { Card, PageHeader, Btn, Icon, Badge, EmptyState, Spinner, Modal, Input, Textarea, ConfirmDialog } from '../../components/shared/UI';
import { useToast } from '../../context/ToastContext';

const FORM_DEFAULT = { name: '', duration_days: '', price: '', description: '', is_active: true };

function PlanModal({ open, onClose, plan, onSave }) {
  const [form, setForm] = useState(FORM_DEFAULT);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setForm(plan ? { ...FORM_DEFAULT, ...plan } : FORM_DEFAULT);
  }, [plan, open]);

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (plan?.id) {
        await api.put(`/plans/${plan.id}`, form);
        toast('Plan updated', 'success');
      } else {
        await api.post('/plans', form);
        toast('Plan created', 'success');
      }
      onSave();
    } catch (err) { toast(err.response?.data?.message || 'Failed', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={plan?.id ? 'EDIT PLAN' : 'CREATE PLAN'} width={440}>
      <form onSubmit={handle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Plan Name" value={form.name} onChange={f('name')} required placeholder="e.g. Monthly, Quarterly" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input label="Duration (days)" type="number" value={form.duration_days} onChange={f('duration_days')} required />
            <Input label="Price (₹)" type="number" value={form.price} onChange={f('price')} required />
          </div>
          <Textarea label="Description" value={form.description || ''} onChange={f('description')} rows={3} placeholder="What's included in this plan?" />
          {plan?.id && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 11, color: T.sub, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Active</label>
              <input type="checkbox" checked={!!form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="ghost" onClick={onClose} type="button">Cancel</Btn>
          <Btn type="submit" disabled={loading}>{loading ? 'Saving...' : plan?.id ? 'Save Changes' : 'Create Plan'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

export default function PlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [deletePlan, setDeletePlan] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('atom_token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${apiUrl}/plans?_t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPlans(data?.data?.plans || data?.plans || []);
    } catch (e) { toast('Failed to load plans: ' + e.message, 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    try {
      await api.delete(`/plans/${deletePlan.id}`);
      toast('Plan deactivated', 'info');
      setDeletePlan(null);
      load();
    } catch (e) { toast('Failed', 'error'); }
  };

  const PLAN_COLORS = [T.accent, T.green, T.blue, T.purple, T.amber];

  return (
    <div>
      <PageHeader title="MEMBERSHIP PLANS" subtitle={`${plans.length} plans configured`} actions={
        <Btn onClick={() => setShowAdd(true)}><Icon name="add" size={14} /> Create Plan</Btn>
      } />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={28} /></div>
      ) : plans.length === 0 ? (
        <Card><EmptyState icon="plans" message="No plans yet. Create your first membership plan." action={<Btn onClick={() => setShowAdd(true)}>Create Plan</Btn>} /></Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {plans.map((p, i) => {
            const color = PLAN_COLORS[i % PLAN_COLORS.length];
            return (
              <Card key={p.id} className={`fadeUp-${Math.min(i+1,5)}`} style={{ padding: '24px 22px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
                <div style={{ position: 'absolute', bottom: -20, right: -20, opacity: 0.06 }}>
                  <Icon name="plans" size={100} color={color} />
                </div>
                {!p.is_active && (
                  <div style={{ position: 'absolute', top: 12, right: 12 }}>
                    <Badge status="inactive" />
                  </div>
                )}
                <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 20, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 36, color, lineHeight: 1, marginBottom: 6 }}>
                  {fmt.currency(p.price)}
                </div>
                <div style={{ fontSize: 12, color: T.sub, marginBottom: 4 }}>
                  <span style={{ fontFamily: T.mono }}>{p.duration_days}</span> days
                </div>
                {p.subscriber_count > 0 && (
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
                    <span style={{ color: T.green, fontWeight: 600 }}>{p.subscriber_count}</span> active subscribers
                  </div>
                )}
                {p.description && <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, marginBottom: 16 }}>{p.description}</div>}
                <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, display: 'flex', gap: 8 }}>
                  <Btn variant="ghost" size="sm" onClick={() => setEditPlan(p)}><Icon name="edit" size={13} /> Edit</Btn>
                  <Btn variant="danger" size="sm" onClick={() => setDeletePlan(p)}><Icon name="delete" size={13} /></Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <PlanModal open={showAdd || !!editPlan} onClose={() => { setShowAdd(false); setEditPlan(null); }} plan={editPlan} onSave={() => { setShowAdd(false); setEditPlan(null); load(); }} />
      <ConfirmDialog open={!!deletePlan} onClose={() => setDeletePlan(null)} onConfirm={handleDelete} title="DEACTIVATE PLAN" message={`Deactivate the "${deletePlan?.name}" plan? Existing subscriptions won't be affected.`} confirmLabel="Deactivate" danger />
    </div>
  );
}
