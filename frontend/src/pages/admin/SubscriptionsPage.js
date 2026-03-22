import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { Card, PageHeader, Btn, Icon, TableWrapper, Th, Td, Avatar, Badge, EmptyState, LoadingRows, SearchInput, Tabs, Modal, Input, Select, Textarea, ConfirmDialog } from '../../components/shared/UI';
import { useToast } from '../../context/ToastContext';

function SubModal({ open, onClose, onSave }) {
  const [form, setForm] = useState({ member_id: '', plan_id: '', start_date: new Date().toISOString().split('T')[0], end_date: '', payment_method: 'cash', amount_paid: '', notes: '' });
  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    if (!open) return;
    Promise.all([api.get('/members'), api.get('/plans')]).then(([m, p]) => {
      setMembers((m.data?.members || []).filter(x => x.status === 'active' && x.role === 'member'));
      setPlans((p.data?.plans || []).filter(x => x.is_active));
    });
  }, [open]);

  useEffect(() => {
    const plan = plans.find(p => p.id === parseInt(form.plan_id));
    if (plan && form.start_date) {
      const end = new Date(form.start_date);
      end.setDate(end.getDate() + plan.duration_days);
      setForm(p => ({ ...p, end_date: end.toISOString().split('T')[0], amount_paid: String(plan.price) }));
    }
  }, [form.plan_id, form.start_date, plans]);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/subscriptions', form);
      toast('Subscription created', 'success');
      onSave();
    } catch (err) { toast(err.response?.data?.message || 'Failed', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="NEW SUBSCRIPTION" width={520}>
      <form onSubmit={handle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Select label="Member" value={form.member_id} onChange={f('member_id')} required
            options={[{value:'',label:'— Select Member —'}, ...members.map(m => ({value:m.id,label:m.name}))]}
            style={{ gridColumn: '1/-1' }} />
          <Select label="Plan" value={form.plan_id} onChange={f('plan_id')} required
            options={[{value:'',label:'— Select Plan —'}, ...plans.map(p => ({value:p.id,label:`${p.name} (${p.duration_days}d · ₹${p.price})`}))]}
            style={{ gridColumn: '1/-1' }} />
          <Input label="Start Date" type="date" value={form.start_date} onChange={f('start_date')} required />
          <Input label="End Date" type="date" value={form.end_date} onChange={f('end_date')} required />
          <Select label="Payment Method" value={form.payment_method} onChange={f('payment_method')}
            options={['cash','upi','card','bank_transfer','online'].map(v => ({value:v,label:v.replace('_',' ').toUpperCase()}))} />
          <Input label="Amount Paid (₹)" type="number" value={form.amount_paid} onChange={f('amount_paid')} />
          <Textarea label="Notes" value={form.notes} onChange={f('notes')} rows={2} style={{ gridColumn: '1/-1' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="ghost" onClick={onClose} type="button">Cancel</Btn>
          <Btn type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Subscription'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = tab !== 'all' ? `?status=${tab}` : '';
      const r = await api.get(`/subscriptions${params}`);
      setSubs(r.data?.subscriptions || []);
    } catch (e) { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }, [tab, toast]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async () => {
    try {
      await api.delete(`/subscriptions/${cancelTarget.id}`);
      toast('Subscription cancelled', 'info');
      setCancelTarget(null);
      load();
    } catch (e) { toast('Failed', 'error'); }
  };

  const filtered = subs.filter(s =>
    !search || s.member_name?.toLowerCase().includes(search.toLowerCase()) || s.plan_name?.toLowerCase().includes(search.toLowerCase())
  );

  const tabItems = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'expired', label: 'Expired' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div>
      <PageHeader title="SUBSCRIPTIONS" subtitle={`${filtered.length} records`} actions={
        <Btn onClick={() => setShowAdd(true)}><Icon name="add" size={14} /> New Subscription</Btn>
      } />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Tabs tabs={tabItems} active={tab} onChange={setTab} />
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member or plan..." style={{ flex: 1, maxWidth: 320 }} />
      </div>

      <Card style={{ overflow: 'hidden' }}>
        <TableWrapper>
          <thead><tr><Th>Member</Th><Th>Plan</Th><Th>Start</Th><Th>End</Th><Th>Days Left</Th><Th>Amount</Th><Th>Payment</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {loading ? <LoadingRows cols={9} /> : filtered.length === 0 ? (
              <tr><td colSpan={9}><EmptyState icon="subscriptions" message="No subscriptions found" /></td></tr>
            ) : filtered.map(s => {
              const dLeft = fmt.daysLeft(s.end_date);
              return (
                <tr key={s.id} className="hover-row">
                  <Td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={s.member_name} size={28} /><div><div style={{ fontWeight: 500, fontSize: 13 }}>{s.member_name}</div><div style={{ fontSize: 11, color: T.muted }}>{s.member_phone || s.member_email || ''}</div></div></div></Td>
                  <Td><span style={{ fontWeight: 500 }}>{s.plan_name || '—'}</span></Td>
                  <Td><span style={{ fontFamily: T.mono, fontSize: 11, color: T.sub }}>{fmt.date(s.start_date)}</span></Td>
                  <Td><span style={{ fontFamily: T.mono, fontSize: 11, color: T.sub }}>{fmt.date(s.end_date)}</span></Td>
                  <Td>
                    {s.status === 'active' && dLeft !== null ? (
                      <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: dLeft <= 3 ? T.red : dLeft <= 7 ? T.amber : T.green }}>
                        {dLeft < 0 ? 'Overdue' : dLeft === 0 ? 'Today' : `${dLeft}d`}
                      </span>
                    ) : <span style={{ color: T.muted, fontSize: 12 }}>—</span>}
                  </Td>
                  <Td><span style={{ fontFamily: T.mono, fontSize: 12, color: T.green, fontWeight: 600 }}>{fmt.currency(s.amount_paid)}</span></Td>
                  <Td><span style={{ fontSize: 11, color: T.sub, textTransform: 'capitalize' }}>{s.payment_method || '—'}</span></Td>
                  <Td><Badge status={s.status} /></Td>
                  <Td>
                    {s.status === 'active' && (
                      <Btn variant="danger" size="sm" onClick={() => setCancelTarget(s)}>Cancel</Btn>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrapper>
      </Card>

      <SubModal open={showAdd} onClose={() => setShowAdd(false)} onSave={() => { setShowAdd(false); load(); }} />
      <ConfirmDialog open={!!cancelTarget} onClose={() => setCancelTarget(null)} onConfirm={handleCancel} title="CANCEL SUBSCRIPTION" message={`Cancel ${cancelTarget?.member_name}'s ${cancelTarget?.plan_name} subscription?`} confirmLabel="Cancel Subscription" danger />
    </div>
  );
}
