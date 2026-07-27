import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  KeyRound, Home, FileSignature, Wrench, ListChecks, ShieldAlert,
  Plus, Camera, Hash, Droplets, Zap as ZapIcon, MapPin, ClipboardCheck, FileText,
} from 'lucide-react';
import { careStore, formatCents } from '../services/careService';
import { startInspection } from '../services/care/inspectionService';
import ReportsPanel from './care/ReportsPanel';
import { CalendarPanel, KeysPanel, InvoicingPanel } from './care/OpsPanels';
import { CalendarDays, KeyRound as KeyIcon, Receipt } from 'lucide-react';
import type { KhProperty, KhVendor, PropertyType } from '../lib/care/types/careDb';

type Tab = 'overview' | 'properties' | 'contracts' | 'vendors' | 'checklist' | 'reports' | 'calendar' | 'keys' | 'invoicing';
type Locale = 'no' | 'en' | 'es';

const PROPERTY_TYPES: PropertyType[] = ['apartment', 'townhouse', 'villa', 'finca'];

const TXT: Record<Locale, Record<string, string>> = {
  no: {
    title: 'Care', subtitle: 'Keyholding og boligforvaltning',
    overview: 'Oversikt', properties: 'Boliger', contracts: 'Kontrakter',
    vendors: 'Leverandører', checklist: 'Sjekkliste', reports: 'Rapporter', calendar: 'Kalender', keys: 'Nøkler', invoicing: 'Fakturering',
    addProperty: 'Ny bolig', addContract: 'Ny kontrakt', addVendor: 'Ny leverandør',
    ref: 'Referanse', type: 'Type', address: 'Adresse', municipality: 'Kommune',
    pool: 'Basseng', garden: 'Hage', save: 'Lagre', cancel: 'Avbryt',
    company: 'Firma', phone: 'Telefon', insurance: 'Forsikring utløper',
    plan: 'Plan', starts: 'Startdato', property: 'Bolig', points: 'punkter',
    photo: 'foto', value: 'verdi', auto: 'automatisk', empty: 'Ingenting her ennå.',
    insuranceWarn: 'leverandør(er) med forsikring som snart utløper',
  },
  en: {
    title: 'Care', subtitle: 'Keyholding and property management',
    overview: 'Overview', properties: 'Properties', contracts: 'Contracts',
    vendors: 'Vendors', checklist: 'Checklist', reports: 'Reports', calendar: 'Calendar', keys: 'Keys', invoicing: 'Invoicing',
    addProperty: 'New property', addContract: 'New contract', addVendor: 'New vendor',
    ref: 'Reference', type: 'Type', address: 'Address', municipality: 'Municipality',
    pool: 'Pool', garden: 'Garden', save: 'Save', cancel: 'Cancel',
    company: 'Company', phone: 'Phone', insurance: 'Insurance expires',
    plan: 'Plan', starts: 'Start date', property: 'Property', points: 'points',
    photo: 'photo', value: 'value', auto: 'automatic', empty: 'Nothing here yet.',
    insuranceWarn: 'vendor(s) with insurance expiring soon',
  },
  es: {
    title: 'Care', subtitle: 'Keyholding y gestión de propiedades',
    overview: 'Resumen', properties: 'Propiedades', contracts: 'Contratos',
    vendors: 'Proveedores', checklist: 'Lista de control', reports: 'Informes', calendar: 'Calendario', keys: 'Llaves', invoicing: 'Facturación',
    addProperty: 'Nueva propiedad', addContract: 'Nuevo contrato', addVendor: 'Nuevo proveedor',
    ref: 'Referencia', type: 'Tipo', address: 'Dirección', municipality: 'Municipio',
    pool: 'Piscina', garden: 'Jardín', save: 'Guardar', cancel: 'Cancelar',
    company: 'Empresa', phone: 'Teléfono', insurance: 'Seguro caduca',
    plan: 'Plan', starts: 'Fecha de inicio', property: 'Propiedad', points: 'puntos',
    photo: 'foto', value: 'valor', auto: 'automático', empty: 'Nada aquí todavía.',
    insuranceWarn: 'proveedor(es) con seguro próximo a caducar',
  },
};

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`glass rounded-2xl border border-slate-800 p-5 ${className}`}>{children}</div>
);

const Care: React.FC = () => {
  const [, forceRender] = useState(0);
  const [tab, setTab] = useState<Tab>('overview');
  const [locale, setLocale] = useState<Locale>('no');

  useEffect(() => {
    const unsub = careStore.subscribe(() => forceRender((n) => n + 1));
    // Pull live records from the care schema when a real session exists.
    careStore.syncFromCloud().catch(() => { /* stay on local demo data */ });
    return unsub;
  }, []);
  const t = TXT[locale];

  const properties = careStore.getProperties();
  const contracts = careStore.getContracts();
  const vendors = careStore.getVendors();
  const plans = careStore.getPlans();
  const expiring = careStore.vendorsWithExpiringInsurance(30);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t.overview, icon: <KeyRound size={16} /> },
    { id: 'properties', label: t.properties, icon: <Home size={16} /> },
    { id: 'contracts', label: t.contracts, icon: <FileSignature size={16} /> },
    { id: 'vendors', label: t.vendors, icon: <Wrench size={16} /> },
    { id: 'checklist', label: t.checklist, icon: <ListChecks size={16} /> },
    { id: 'reports', label: t.reports, icon: <FileText size={16} /> },
    { id: 'calendar', label: t.calendar, icon: <CalendarDays size={16} /> },
    { id: 'keys', label: t.keys, icon: <KeyIcon size={16} /> },
    { id: 'invoicing', label: t.invoicing, icon: <Receipt size={16} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
            <KeyRound className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{t.title}</h1>
            <p className="text-xs text-slate-500">{t.subtitle} · Zen Eco Homes</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800">
          {(['no', 'en', 'es'] as Locale[]).map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              className={`px-3 py-1 rounded-md text-xs font-bold uppercase transition ${
                locale === l ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {expiring.length > 0 && (
        <div className="flex items-center gap-2 text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm">
          <ShieldAlert size={16} /> {expiring.length} {t.insuranceWarn}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-800">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === tb.id
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label={t.properties} value={properties.length} icon={<Home size={18} />} />
          <Stat label={t.contracts} value={contracts.length} icon={<FileSignature size={18} />} />
          <Stat label={t.vendors} value={vendors.length} icon={<Wrench size={18} />} />
          <Stat label={t.checklist} value={42} icon={<ListChecks size={18} />} />
        </div>
      )}

      {tab === 'properties' && <PropertiesTab t={t} properties={properties} />}
      {tab === 'contracts' && (
        <ContractsTab t={t} locale={locale} contracts={contracts} properties={properties} plans={plans} />
      )}
      {tab === 'vendors' && <VendorsTab t={t} vendors={vendors} />}
      {tab === 'checklist' && <ChecklistTab t={t} locale={locale} />}
      {tab === 'reports' && <ReportsPanel />}
      {tab === 'calendar' && <CalendarPanel />}
      {tab === 'keys' && <KeysPanel />}
      {tab === 'invoicing' && <InvoicingPanel />}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <Card>
    <div className="flex items-center justify-between text-slate-500 mb-2">
      <span className="text-xs uppercase tracking-wider">{label}</span>
      {icon}
    </div>
    <p className="text-3xl font-bold text-slate-100">{value}</p>
  </Card>
);

// ---------------- Properties ----------------
const PropertiesTab: React.FC<{ t: Record<string, string>; properties: KhProperty[] }> = ({ t, properties }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<KhProperty>>({ property_type: 'apartment', country: 'ES' });

  const startTilsyn = async (p: KhProperty) => {
    setStarting(p.id);
    try {
      const insp = await startInspection({ property_id: p.id, property_type: p.property_type });
      navigate(`/care/inspection/${insp.id}`);
    } finally {
      setStarting(null);
    }
  };

  const submit = async () => {
    if (!form.address_line || !form.municipality) return;
    await careStore.addProperty(form);
    setForm({ property_type: 'apartment', country: 'ES' });
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setOpen((v) => !v)} className="btn-primary">
        <Plus size={16} /> {t.addProperty}
      </button>
      {open && (
        <Card className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t.ref} placeholder="KH-0001" value={form.reference ?? ''} onChange={(v) => setForm({ ...form, reference: v })} />
            <label className="block">
              <span className="text-xs text-slate-400">{t.type}</span>
              <select value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value as PropertyType })} className="input">
                {PROPERTY_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <Field label={t.address} value={form.address_line ?? ''} onChange={(v) => setForm({ ...form, address_line: v })} />
            <Field label={t.municipality} value={form.municipality ?? ''} onChange={(v) => setForm({ ...form, municipality: v })} />
          </div>
          <div className="flex gap-4 text-sm text-slate-300">
            <Check label={t.pool} checked={!!form.has_pool} onChange={(v) => setForm({ ...form, has_pool: v })} />
            <Check label={t.garden} checked={!!form.has_garden} onChange={(v) => setForm({ ...form, has_garden: v })} />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="btn-primary">{t.save}</button>
            <button onClick={() => setOpen(false)} className="btn-ghost">{t.cancel}</button>
          </div>
        </Card>
      )}
      {properties.length === 0 ? (
        <p className="text-slate-500 text-sm">{t.empty}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {properties.map((p) => (
            <Card key={p.id} className="flex flex-col justify-between gap-3">
              <div>
                <p className="font-bold text-slate-100">{p.reference}</p>
                <p className="text-sm text-slate-400 flex items-center gap-1"><MapPin size={12} /> {p.address_line}, {p.municipality}</p>
                <div className="flex gap-2 mt-2">
                  <span className="tag">{p.property_type}</span>
                  {p.has_pool && <span className="tag">{t.pool}</span>}
                  {p.has_garden && <span className="tag">{t.garden}</span>}
                </div>
              </div>
              <button onClick={() => startTilsyn(p)} disabled={starting === p.id} className="btn-primary justify-center">
                <ClipboardCheck size={16} /> {starting === p.id ? '…' : 'Start tilsyn'}
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------- Contracts ----------------
const ContractsTab: React.FC<{
  t: Record<string, string>; locale: Locale;
  contracts: ReturnType<typeof careStore.getContracts>;
  properties: KhProperty[];
  plans: ReturnType<typeof careStore.getPlans>;
}> = ({ t, locale, contracts, properties, plans }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ property_id: '', plan_id: '', starts_on: new Date().toISOString().slice(0, 10) });

  const submit = async () => {
    if (!form.property_id || !form.plan_id) return;
    await careStore.addContract(form);
    setOpen(false);
  };

  const propRef = (id: string) => properties.find((p) => p.id === id)?.reference ?? id;
  const plan = (id: string) => plans.find((p) => p.id === id);

  return (
    <div className="space-y-4">
      <button onClick={() => setOpen((v) => !v)} className="btn-primary" disabled={properties.length === 0}>
        <Plus size={16} /> {t.addContract}
      </button>
      {properties.length === 0 && <p className="text-slate-500 text-sm">{t.empty}</p>}
      {open && (
        <Card className="space-y-3">
          <label className="block">
            <span className="text-xs text-slate-400">{t.property}</span>
            <select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="input">
              <option value="">—</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.reference}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">{t.plan}</span>
            <select value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })} className="input">
              <option value="">—</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatCents(p.price_cents, p.currency, locale)}</option>)}
            </select>
          </label>
          <Field label={t.starts} type="date" value={form.starts_on} onChange={(v) => setForm({ ...form, starts_on: v })} />
          <div className="flex gap-2">
            <button onClick={submit} className="btn-primary">{t.save}</button>
            <button onClick={() => setOpen(false)} className="btn-ghost">{t.cancel}</button>
          </div>
        </Card>
      )}
      <div className="space-y-2">
        {contracts.map((c) => {
          const pl = plan(c.plan_id);
          return (
            <Card key={c.id} className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-100">{propRef(c.property_id)}</p>
                <p className="text-sm text-slate-400">{pl?.name} · {t.starts} {c.starts_on}</p>
              </div>
              {pl && <span className="text-cyan-400 font-mono">{formatCents(pl.price_cents, pl.currency, locale)}</span>}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// ---------------- Vendors ----------------
const VendorsTab: React.FC<{ t: Record<string, string>; vendors: KhVendor[] }> = ({ t, vendors }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<KhVendor>>({ preferred_locale: 'es' });

  const submit = async () => {
    if (!form.company_name) return;
    await careStore.addVendor(form);
    setForm({ preferred_locale: 'es' });
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setOpen((v) => !v)} className="btn-primary">
        <Plus size={16} /> {t.addVendor}
      </button>
      {open && (
        <Card className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t.company} value={form.company_name ?? ''} onChange={(v) => setForm({ ...form, company_name: v })} />
            <Field label={t.phone} value={form.phone ?? ''} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field label="NIF/CIF" value={form.tax_id ?? ''} onChange={(v) => setForm({ ...form, tax_id: v })} />
            <Field label={t.insurance} type="date" value={form.insurance_expires_on ?? ''} onChange={(v) => setForm({ ...form, insurance_expires_on: v })} />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="btn-primary">{t.save}</button>
            <button onClick={() => setOpen(false)} className="btn-ghost">{t.cancel}</button>
          </div>
        </Card>
      )}
      {vendors.length === 0 ? (
        <p className="text-slate-500 text-sm">{t.empty}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {vendors.map((v) => (
            <Card key={v.id}>
              <p className="font-bold text-slate-100">{v.company_name}</p>
              <p className="text-sm text-slate-400">{v.phone} · {v.preferred_locale.toUpperCase()}</p>
              {v.insurance_expires_on && <p className="text-xs text-slate-500 mt-1">{t.insurance}: {v.insurance_expires_on}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------- Checklist viewer ----------------
const ChecklistTab: React.FC<{ t: Record<string, string>; locale: Locale }> = ({ t, locale }) => {
  const [ptype, setPtype] = useState<PropertyType>('villa');
  const items = useMemo(() => careStore.getChecklistFor(ptype, locale), [ptype, locale]);
  const grouped = useMemo(() => {
    const m = new Map<string, typeof items>();
    for (const i of items) {
      if (!m.has(i.category)) m.set(i.category, []);
      m.get(i.category)!.push(i);
    }
    return m;
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">{t.type}:</span>
        {PROPERTY_TYPES.map((p) => (
          <button key={p} onClick={() => setPtype(p)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${
              ptype === p ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'text-slate-400 border-slate-800 hover:text-slate-200'
            }`}>
            {p}
          </button>
        ))}
        <span className="text-xs text-slate-500 ml-auto">{items.length} {t.points}</span>
      </div>
      {[...grouped.entries()].map(([cat, list]) => (
        <Card key={cat}>
          <p className="text-xs uppercase tracking-widest text-cyan-500/70 mb-3">{cat.replace(/_/g, ' ')}</p>
          <ul className="space-y-2">
            {list.map((i) => (
              <li key={i.code} className="flex items-start gap-3">
                <span className="text-slate-600 font-mono text-xs mt-0.5 w-6 text-right">{i.sort_order}</span>
                <span className="flex-1 text-slate-200 text-sm">{i.title}</span>
                <span className="flex gap-1">
                  {i.requires_photo && <Badge icon={<Camera size={11} />} label={t.photo} />}
                  {i.requires_value && <Badge icon={i.value_unit === 'm3' ? <Droplets size={11} /> : i.value_unit === 'kWh' ? <ZapIcon size={11} /> : <Hash size={11} />} label={i.value_unit || t.value} />}
                  {i.is_automatic && <Badge icon={<KeyRound size={11} />} label={t.auto} />}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
};

// ---------------- small building blocks ----------------
const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }> = ({ label, value, onChange, type = 'text', placeholder }) => (
  <label className="block">
    <span className="text-xs text-slate-400">{label}</span>
    <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="input" />
  </label>
);

const Check: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-cyan-500" /> {label}
  </label>
);

const Badge: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <span className="inline-flex items-center gap-1 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{icon}{label}</span>
);

export default Care;
