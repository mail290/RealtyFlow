import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, KeyRound, Receipt, Plus, Download, LogOut, LogIn, CalendarPlus, FileText,
} from 'lucide-react';
import { careStore, formatCents } from '../../services/careService';
import { opsStore } from '../../services/care/opsService';
import type { KhProperty } from '../../lib/care/types/careDb';

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`glass rounded-xl border border-slate-800 p-4 ${className}`}>{children}</div>
);

/** Property picker shared by the ops panels. */
function useProperty() {
  const props = careStore.getProperties();
  const [id, setId] = useState(props[0]?.id ?? '');
  const property = props.find((p) => p.id === id) ?? props[0];
  const picker = (
    <select value={id} onChange={(e) => setId(e.target.value)} className="input max-w-xs">
      {props.map((p) => <option key={p.id} value={p.id}>{p.reference} · {p.municipality}</option>)}
    </select>
  );
  return { props, property, picker };
}

function planForProperty(property?: KhProperty) {
  if (!property) return { name: 'Standard', fixed: 17900, visits: 2 };
  const contract = careStore.getContracts().find((c) => c.property_id === property.id);
  const plan = contract ? careStore.getPlans().find((p) => p.id === contract.plan_id) : undefined;
  return { name: plan?.name ?? 'Standard', fixed: plan?.price_cents ?? 17900, visits: plan?.visits_per_month ?? 2 };
}

const EVENT_LABELS: Record<string, string> = {
  owner_stay: 'Eieropphold', guest_stay: 'Gjesteopphold', inspection: 'Tilsyn',
  service_visit: 'Servicebesøk', prep_task: 'Klargjøring', storm_callout: 'Uvær-utrykning',
};

// ---------------- Calendar ----------------
export const CalendarPanel: React.FC = () => {
  const [, force] = useState(0);
  useEffect(() => opsStore.subscribe(() => force((n) => n + 1)), []);
  const { property, picker, props } = useProperty();
  const [form, setForm] = useState({ event_type: 'owner_stay', starts_at: '', ends_at: '', guest_name: '' });

  if (props.length === 0) return <p className="text-slate-500 text-sm">Legg til en bolig først.</p>;
  const events = property ? opsStore.getEvents(property.id) : [];
  const plan = planForProperty(property);

  const add = async () => {
    if (!property || !form.starts_at || !form.ends_at) return;
    await opsStore.addEvent({ property_id: property.id, event_type: form.event_type as never, starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString(), guest_name: form.guest_name || null, title: EVENT_LABELS[form.event_type] });
    setForm({ event_type: 'owner_stay', starts_at: '', ends_at: '', guest_name: '' });
  };
  const autoSchedule = async () => {
    if (!property) return;
    const d = new Date();
    await opsStore.autoScheduleMonth(property.id, plan.visits, d.getFullYear(), d.getMonth() + 1);
  };
  const downloadIcal = () => {
    if (!property) return;
    const ics = opsStore.icalFor(property.id, property.reference);
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a'); a.href = url; a.download = `${property.reference}.ics`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {picker}
        <div className="flex gap-2">
          <button onClick={autoSchedule} className="btn-ghost"><CalendarPlus size={16} /> Auto-planlegg mnd ({plan.visits})</button>
          <button onClick={downloadIcal} className="btn-ghost"><Download size={16} /> iCal</button>
        </div>
      </div>
      <Card className="grid sm:grid-cols-4 gap-2 items-end">
        <label className="block"><span className="text-xs text-slate-400">Type</span>
          <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} className="input">
            {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="block"><span className="text-xs text-slate-400">Fra</span><input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="input" /></label>
        <label className="block"><span className="text-xs text-slate-400">Til</span><input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className="input" /></label>
        <button onClick={add} className="btn-primary justify-center"><Plus size={16} /> Legg til</button>
      </Card>
      <div className="space-y-2">
        {events.length === 0 && <p className="text-slate-500 text-sm">Ingen hendelser. Registrer et opphold eller auto-planlegg tilsyn.</p>}
        {events.map((e) => (
          <div key={e.id} className="flex items-center justify-between glass rounded-lg border border-slate-800 px-4 py-2 text-sm">
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${e.event_type === 'inspection' ? 'bg-cyan-400' : e.event_type.includes('stay') ? 'bg-emerald-400' : e.event_type === 'prep_task' ? 'bg-amber-400' : 'bg-slate-500'}`} />
              <span className="text-slate-200">{EVENT_LABELS[e.event_type]}</span>
              {e.source === 'auto' && <span className="text-[10px] text-slate-500 uppercase">auto</span>}
            </div>
            <span className="text-slate-500 font-mono text-xs">{new Date(e.starts_at).toLocaleDateString()} → {new Date(e.ends_at).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------- Keys ----------------
export const KeysPanel: React.FC = () => {
  const [, force] = useState(0);
  useEffect(() => opsStore.subscribe(() => force((n) => n + 1)), []);
  const { property, picker, props } = useProperty();
  const [form, setForm] = useState({ label: '', storage_location: '', code: '' });
  const [holder, setHolder] = useState('');

  if (props.length === 0) return <p className="text-slate-500 text-sm">Legg til en bolig først.</p>;
  const keys = property ? opsStore.getKeys(property.id) : [];

  const addKey = async () => { if (!property || !form.label) return; await opsStore.addKey({ property_id: property.id, ...form }); setForm({ label: '', storage_location: '', code: '' }); };

  return (
    <div className="space-y-4">
      {picker}
      <Card className="grid sm:grid-cols-4 gap-2 items-end">
        <label className="block"><span className="text-xs text-slate-400">Nøkkel</span><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="input" placeholder="Hovednøkkel" /></label>
        <label className="block"><span className="text-xs text-slate-400">Plassering</span><input value={form.storage_location} onChange={(e) => setForm({ ...form, storage_location: e.target.value })} className="input" placeholder="Safe A3" /></label>
        <label className="block"><span className="text-xs text-slate-400">Kode</span><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input" /></label>
        <button onClick={addKey} className="btn-primary justify-center"><Plus size={16} /> Legg til</button>
      </Card>
      <label className="flex items-center gap-2 text-xs text-slate-400">Mottaker ved utlevering: <input value={holder} onChange={(e) => setHolder(e.target.value)} className="input max-w-xs" placeholder="Navn" /></label>
      <div className="space-y-3">
        {keys.map((k) => (
          <Card key={k.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-100">{k.label} <span className={`text-[10px] ml-2 px-2 py-0.5 rounded ${k.status === 'in_office' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{k.status === 'in_office' ? 'På kontoret' : 'Utlevert'}</span></p>
                <p className="text-xs text-slate-500">{k.storage_location}{k.code ? ` · kode ${k.code}` : ''}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => opsStore.logKeyEvent(k.id, 'checked_out', holder || undefined)} disabled={k.status !== 'in_office'} className="btn-ghost"><LogOut size={14} /> Ut</button>
                <button onClick={() => opsStore.logKeyEvent(k.id, 'checked_in', holder || undefined)} disabled={k.status === 'in_office'} className="btn-ghost"><LogIn size={14} /> Inn</button>
              </div>
            </div>
            {opsStore.getKeyEvents(k.id).length > 0 && (
              <ul className="mt-2 border-t border-slate-800 pt-2 space-y-1">
                {opsStore.getKeyEvents(k.id).slice(0, 4).map((e) => (
                  <li key={e.id} className="text-[11px] text-slate-500 flex justify-between">
                    <span>{e.action === 'checked_out' ? 'Utlevert' : 'Innlevert'}{e.holder_name ? ` — ${e.holder_name}` : ''}</span>
                    <span className="font-mono">{new Date(e.at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
        {keys.length === 0 && <p className="text-slate-500 text-sm">Ingen nøkler registrert.</p>}
      </div>
    </div>
  );
};

// ---------------- Invoicing ----------------
export const InvoicingPanel: React.FC = () => {
  const [, force] = useState(0);
  useEffect(() => opsStore.subscribe(() => force((n) => n + 1)), []);
  const { property, picker, props } = useProperty();
  const [form, setForm] = useState({ description: '', euro: '' });

  if (props.length === 0) return <p className="text-slate-500 text-sm">Legg til en bolig først.</p>;
  const charges = property ? opsStore.getCharges(property.id).filter((c) => c.status === 'open') : [];
  const invoices = property ? opsStore.getInvoices(property.id) : [];
  const plan = planForProperty(property);

  const addCharge = async () => {
    if (!property || !form.description || !form.euro) return;
    await opsStore.addCharge({ property_id: property.id, description: form.description, quantity: 1, unit_cents: Math.round(parseFloat(form.euro.replace(',', '.')) * 100) });
    setForm({ description: '', euro: '' });
  };
  const makeDraft = async () => { if (property) await opsStore.createMonthlyDraft(property.id, plan.name, plan.fixed); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {picker}
        <button onClick={makeDraft} className="btn-primary"><FileText size={16} /> Lag månedskladd</button>
      </div>
      <Card className="grid sm:grid-cols-3 gap-2 items-end">
        <label className="block sm:col-span-2"><span className="text-xs text-slate-400">Tillegg</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" placeholder="Posthenting, meet & greet…" /></label>
        <div className="flex gap-2 items-end">
          <label className="block flex-1"><span className="text-xs text-slate-400">€</span><input inputMode="decimal" value={form.euro} onChange={(e) => setForm({ ...form, euro: e.target.value })} className="input" placeholder="10" /></label>
          <button onClick={addCharge} className="btn-primary"><Plus size={16} /></button>
        </div>
      </Card>
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Åpne tillegg · fast {formatCents(plan.fixed, 'EUR', 'no')}/mnd</p>
        {charges.length === 0 ? <p className="text-slate-500 text-sm">Ingen åpne tillegg.</p> : (
          <div className="space-y-1">
            {charges.map((c) => (
              <div key={c.id} className="flex justify-between text-sm glass rounded-lg border border-slate-800 px-4 py-2">
                <span className="text-slate-200">{c.description}</span>
                <span className="font-mono text-slate-400">{formatCents(c.amount_cents, 'EUR', 'no')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Fakturaer</p>
        {invoices.length === 0 ? <p className="text-slate-500 text-sm">Ingen fakturakladder ennå.</p> : (
          <div className="space-y-2">
            {invoices.map((i) => (
              <Card key={i.id}>
                <div className="flex items-center justify-between">
                  <div><p className="font-bold text-cyan-400 font-mono">{i.reference}</p><p className="text-xs text-slate-500">{i.period_start} → {i.period_end} · {i.status}</p></div>
                  <div className="text-right">
                    <p className="font-bold text-slate-100">{formatCents(i.total_cents, 'EUR', 'no')}</p>
                    <p className="text-[11px] text-slate-500">herav IVA {formatCents(i.iva_cents, 'EUR', 'no')}{i.irpf_cents ? ` · IRPF -${formatCents(i.irpf_cents, 'EUR', 'no')}` : ''}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <p className="text-[11px] text-amber-500/80">Spansk fakturering (NIF, fortløpende nummer, Verifactu) må avklares med gestor før utsending. Kladd godkjennes manuelt.</p>
    </div>
  );
};
