import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Check, AlertTriangle, MinusCircle, Camera, MapPin, Droplets, Zap as ZapIcon,
  ChevronLeft, ShieldAlert, Loader2, CheckCircle2,
} from 'lucide-react';
import { careStore } from '../services/careService';
import { getInspection, getItems, getPhotos, type InspectionDraft } from '../services/care/inspectionDb';
import {
  recordItem, recordMeterReading, getPreviousMeter, addPhoto,
  checkCompletion, completeInspection, suggestIssues,
} from '../services/care/inspectionService';
import { visibleItems } from '../lib/care/inspections/completion';
import type { ItemStatus, MeterType, PropertyType, SnapshotItem } from '../lib/care/inspections/types';

const LOCALE = 'no';
const METER_CODES: Record<string, MeterType> = {
  'power.water_meter': 'water',
  'power.electricity_meter': 'electricity',
};

type ItemState = { status?: ItemStatus; value?: number | null; note?: string; photos: number };

const gpsLabel: Record<string, string> = {
  ok: 'GPS ok', low_accuracy: 'GPS unøyaktig', denied: 'GPS nektet', unavailable: 'GPS utilgjengelig',
};

const InspectionRunner: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState<InspectionDraft | null>(null);
  const [state, setState] = useState<Record<string, ItemState>>({});
  const [occupied, setOccupied] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [problems, setProblems] = useState<{ code: string; message: string }[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [suggestions, setSuggestions] = useState<ReturnType<typeof suggestIssues> | null>(null);

  useEffect(() => {
    (async () => {
      const insp = await getInspection(id);
      if (!insp) return;
      setInspection(insp);
      const items = await getItems(id);
      const photos = await getPhotos(id);
      const st: Record<string, ItemState> = {};
      for (const it of insp.template_snapshot.items) st[it.code] = { photos: 0 };
      for (const it of items) {
        st[it.item_code] = { ...st[it.item_code], status: it.status, value: it.value_numeric ?? undefined, note: it.note?.[LOCALE] };
      }
      for (const p of photos) if (p.item_code) st[p.item_code] = { ...st[p.item_code], photos: (st[p.item_code]?.photos ?? 0) + 1 };
      setState(st);
      setTotalPhotos(photos.length);
      setOccupied(insp.occupied_in_period ?? null);
    })();
  }, [id]);

  const property = useMemo(
    () => careStore.getProperties().find((p) => p.id === inspection?.property_id),
    [inspection],
  );
  const propertyType = (property?.property_type ?? 'villa') as PropertyType;

  const visible = useMemo(
    () => (inspection ? visibleItems(inspection.template_snapshot.items, propertyType) : []),
    [inspection, propertyType],
  );
  const manual = visible.filter((i) => !i.is_automatic);
  const doneCount = manual.filter((i) => {
    const s = state[i.code]?.status;
    return s && s !== 'not_checked';
  }).length;

  const grouped = useMemo(() => {
    const m = new Map<string, SnapshotItem[]>();
    for (const i of visible) {
      if (!m.has(i.category)) m.set(i.category, []);
      m.get(i.category)!.push(i);
    }
    return m;
  }, [visible]);

  if (!inspection) {
    return <div className="flex items-center justify-center h-64 text-slate-400"><Loader2 className="animate-spin mr-2" /> Laster tilsyn…</div>;
  }

  const setItem = async (code: string, patch: Partial<ItemState>) => {
    setState((s) => ({ ...s, [code]: { ...s[code], ...patch } }));
  };

  const setStatus = async (code: string, status: ItemStatus) => {
    const cur = state[code] ?? { photos: 0 };
    await setItem(code, { status });
    await recordItem(id, code, status, {
      value_numeric: cur.value ?? null,
      note: cur.note ? { [LOCALE]: cur.note, _source: LOCALE } : null,
    });
  };

  const setValue = async (code: string, value: number, unit: string | null) => {
    await setItem(code, { value });
    const cur = state[code];
    await recordItem(id, code, cur?.status ?? 'ok', { value_numeric: value, value_unit: unit });
  };

  const onPhoto = async (code: string | undefined, file: File) => {
    await addPhoto(id, inspection.property_id, file, code);
    setTotalPhotos((n) => n + 1);
    if (code) setItem(code, { photos: (state[code]?.photos ?? 0) + 1 });
  };

  const onFinish = async () => {
    const check = await checkCompletion(id, propertyType, comment);
    if (!check.complete) {
      setProblems(check.problems);
      return;
    }
    setProblems([]);
    setFinishing(true);
    const { deviations } = await completeInspection(id, comment);
    // Prefill issue suggestions (dedupe against this property's open issues — none locally yet).
    setSuggestions(suggestIssues(deviations, [], LOCALE));
    setFinishing(false);
  };

  if (suggestions) {
    return <IssueSuggestions suggestions={suggestions} onDone={() => navigate('/care')} />;
  }

  return (
    <div className="space-y-4 pb-40">
      {/* Header */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => navigate('/care')} className="text-slate-400 flex items-center gap-1 text-sm"><ChevronLeft size={18} /> Care</button>
          <div className="text-center">
            <p className="font-bold text-slate-100">{property?.reference ?? 'Tilsyn'}</p>
            <p className="text-xs text-slate-500">{property?.municipality} · {propertyType}</p>
          </div>
          <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${inspection.gps_status === 'ok' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
            {gpsLabel[inspection.gps_status]}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500" style={{ width: `${(doneCount / Math.max(manual.length, 1)) * 100}%` }} />
          </div>
          <span className="text-xs font-mono text-slate-400">{doneCount} / {manual.length}</span>
          <span className="text-xs font-mono text-slate-500 flex items-center gap-1"><Camera size={12} /> {totalPhotos}</span>
        </div>
      </div>

      {/* Occupancy — needed for leak detection */}
      <div className="glass rounded-xl border border-slate-800 p-4">
        <p className="text-sm text-slate-300 mb-2">Var boligen bebodd i perioden?</p>
        <div className="flex gap-2">
          {[['Nei', false], ['Ja', true], ['Vet ikke', null]].map(([label, val]) => (
            <button key={String(label)} onClick={() => setOccupied(val as boolean | null)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium border ${occupied === val ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'text-slate-400 border-slate-800'}`}>
              {label as string}
            </button>
          ))}
        </div>
      </div>

      {/* Global photo add */}
      <PhotoButton label="Legg til bilde" onPick={(f) => onPhoto(undefined, f)} />

      {/* Checklist by category */}
      {[...grouped.entries()].map(([cat, list]) => (
        <div key={cat} className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-cyan-500/70 pt-2">{cat.replace(/_/g, ' ')}</p>
          {list.map((item) => (
            <ItemRow
              key={item.code}
              item={item}
              st={state[item.code] ?? { photos: 0 }}
              occupied={occupied}
              inspectionId={id}
              propertyId={inspection.property_id}
              onStatus={(s) => setStatus(item.code, s)}
              onValue={(v) => setValue(item.code, v, item.value_unit)}
              onNote={(n) => setItem(item.code, { note: n })}
              onPhoto={(f) => onPhoto(item.code, f)}
            />
          ))}
        </div>
      ))}

      {/* Comment + finish */}
      <div className="glass rounded-xl border border-slate-800 p-4 space-y-2">
        <label className="text-sm text-slate-300">Kommentar (kreves)</label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="input" placeholder="Oppsummering av tilsynet…" />
      </div>

      {problems.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-1">
          <p className="text-amber-400 font-medium flex items-center gap-2"><AlertTriangle size={16} /> Mangler før ferdigstilling:</p>
          <ul className="text-sm text-amber-300/90 list-disc pl-6">
            {problems.slice(0, 8).map((p) => <li key={p.code}>{p.message}</li>)}
          </ul>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 lg:left-64 p-4 bg-slate-950/95 backdrop-blur border-t border-slate-800">
        <button onClick={onFinish} disabled={finishing} className="btn-primary w-full justify-center py-4 text-base">
          {finishing ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} Fullfør tilsyn
        </button>
      </div>
    </div>
  );
};

// ------------- one checklist point -------------
const ItemRow: React.FC<{
  item: SnapshotItem; st: ItemState; occupied: boolean | null;
  inspectionId: string; propertyId: string;
  onStatus: (s: ItemStatus) => void; onValue: (v: number) => void;
  onNote: (n: string) => void; onPhoto: (f: File) => void;
}> = ({ item, st, occupied, inspectionId, propertyId, onStatus, onValue, onNote, onPhoto }) => {
  const title = item.title[LOCALE] ?? item.title.en ?? item.code;
  const isMeter = METER_CODES[item.code];

  if (item.is_automatic) {
    return (
      <div className="glass rounded-xl border border-slate-800/60 p-3 flex items-center gap-3 opacity-70">
        <MapPin size={16} className="text-cyan-500" />
        <span className="text-sm text-slate-300 flex-1">{title}</span>
        <span className="text-[10px] text-slate-500 uppercase">automatisk</span>
      </div>
    );
  }

  const status = st.status;
  return (
    <div className="glass rounded-xl border border-slate-800 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <span className="text-slate-600 font-mono text-xs mt-1 w-6 text-right">{item.sort_order}</span>
        <span className="flex-1 text-slate-100 text-sm font-medium">{title}</span>
      </div>

      {isMeter ? (
        <MeterWidget item={item} meterType={isMeter} occupied={occupied} inspectionId={inspectionId} propertyId={propertyId} onValue={onValue} onStatus={onStatus} onPhoto={onPhoto} value={st.value} status={status} photos={st.photos} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatusBtn active={status === 'ok'} tone="ok" onClick={() => onStatus('ok')} icon={<Check size={20} />} label="OK" />
            <StatusBtn active={status === 'deviation'} tone="dev" onClick={() => onStatus('deviation')} icon={<AlertTriangle size={20} />} label="Avvik" />
            <StatusBtn active={status === 'not_applicable'} tone="na" onClick={() => onStatus('not_applicable')} icon={<MinusCircle size={20} />} label="N/A" />
          </div>
          {item.requires_value && status === 'ok' && (
            <NumberInput unit={item.value_unit} value={st.value} onChange={onValue} />
          )}
          {status === 'deviation' && (
            <div className="space-y-2">
              <textarea value={st.note ?? ''} onChange={(e) => onNote(e.target.value)} rows={2} className="input" placeholder="Beskriv avviket…" />
              <PhotoButton label={item.requires_photo ? 'Bilde (kreves)' : 'Legg ved bilde'} onPick={onPhoto} small />
            </div>
          )}
          {item.requires_photo && status === 'ok' && st.photos < 1 && (
            <PhotoButton label="Bilde kreves for OK" onPick={onPhoto} small warn />
          )}
        </>
      )}
      {st.photos > 0 && <p className="text-[11px] text-slate-500 flex items-center gap-1"><Camera size={11} /> {st.photos} bilde(r)</p>}
    </div>
  );
};

// ------------- meter widget with previous + anomaly -------------
const MeterWidget: React.FC<{
  item: SnapshotItem; meterType: MeterType; occupied: boolean | null;
  inspectionId: string; propertyId: string; value?: number | null; status?: ItemStatus; photos: number;
  onValue: (v: number) => void; onStatus: (s: ItemStatus) => void; onPhoto: (f: File) => void;
}> = ({ item, meterType, occupied, inspectionId, propertyId, value, onValue, onStatus, onPhoto }) => {
  const [prev, setPrev] = useState<number | null>(null);
  const [reading, setReading] = useState<string>(value != null ? String(value) : '');
  const [replaced, setReplaced] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  useEffect(() => {
    getPreviousMeter(propertyId, meterType, inspectionId).then((p) => setPrev(p?.reading ?? null));
  }, [propertyId, meterType, inspectionId]);

  const save = async () => {
    const num = Number(reading.replace(',', '.'));
    if (!Number.isFinite(num)) { setMsg({ kind: 'err', text: 'Ugyldig tall' }); return; }
    const res = await recordMeterReading({
      inspectionId, propertyId, meterType, reading: num,
      unit: item.value_unit ?? (meterType === 'water' ? 'm3' : 'kWh'),
      meterReplaced: replaced, occupiedInPeriod: occupied,
    });
    if (!res.ok) { setMsg({ kind: 'err', text: res.error ?? 'Avvist' }); return; }
    onValue(num);
    onStatus('ok');
    if (res.isAnomaly) setMsg({ kind: 'warn', text: res.anomalyReason ?? 'Mulig lekkasje' });
    else setMsg({ kind: 'ok', text: 'Lagret' });
  };

  return (
    <div className="space-y-2 bg-slate-900/50 rounded-lg p-3">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        {meterType === 'water' ? <Droplets size={14} className="text-cyan-400" /> : <ZapIcon size={14} className="text-amber-400" />}
        Forrige: <span className="font-mono text-slate-200">{prev != null ? prev : '—'}</span> {item.value_unit}
      </div>
      <div className="flex gap-2">
        <input inputMode="decimal" value={reading} onChange={(e) => setReading(e.target.value)} className="input flex-1" placeholder={`Ny avlesning (${item.value_unit})`} />
        <button onClick={save} className="btn-primary">Lagre</button>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-400">
        <input type="checkbox" checked={replaced} onChange={(e) => setReplaced(e.target.checked)} className="accent-cyan-500" /> Måler byttet
      </label>
      <PhotoButton label={item.requires_photo ? 'Bilde av måler (kreves)' : 'Bilde av måler'} onPick={onPhoto} small />
      {msg && (
        <p className={`text-xs flex items-center gap-1 ${msg.kind === 'err' ? 'text-red-400' : msg.kind === 'warn' ? 'text-amber-400' : 'text-emerald-400'}`}>
          {msg.kind === 'warn' && <ShieldAlert size={12} />}{msg.text}
        </p>
      )}
    </div>
  );
};

// ------------- small controls -------------
const StatusBtn: React.FC<{ active: boolean; tone: 'ok' | 'dev' | 'na'; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, tone, onClick, icon, label }) => {
  const tones = {
    ok: active ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-emerald-400',
    dev: active ? 'bg-amber-500 text-black' : 'bg-slate-800 text-amber-400',
    na: active ? 'bg-slate-500 text-white' : 'bg-slate-800 text-slate-400',
  }[tone];
  return (
    <button onClick={onClick} style={{ minHeight: 56 }} className={`flex flex-col items-center justify-center gap-1 rounded-xl font-bold text-xs transition ${tones}`}>
      {icon}{label}
    </button>
  );
};

const NumberInput: React.FC<{ unit: string | null; value?: number | null; onChange: (v: number) => void }> = ({ unit, value, onChange }) => {
  const [v, setV] = useState(value != null ? String(value) : '');
  return (
    <div className="flex items-center gap-2">
      <input inputMode="decimal" value={v} onChange={(e) => { setV(e.target.value); const n = Number(e.target.value.replace(',', '.')); if (Number.isFinite(n)) onChange(n); }} className="input flex-1" placeholder="Verdi" />
      <span className="text-xs text-slate-500 w-10">{unit}</span>
    </div>
  );
};

const PhotoButton: React.FC<{ label: string; onPick: (f: File) => void; small?: boolean; warn?: boolean }> = ({ label, onPick, small, warn }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button onClick={() => ref.current?.click()} style={{ minHeight: small ? 44 : 56 }}
        className={`w-full flex items-center justify-center gap-2 rounded-xl font-medium text-sm border ${warn ? 'border-amber-500/40 text-amber-400' : 'border-slate-700 text-slate-300'}`}>
        <Camera size={18} /> {label}
      </button>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
    </>
  );
};

// ------------- issue suggestions after completion -------------
const IssueSuggestions: React.FC<{ suggestions: ReturnType<typeof suggestIssues>; onDone: () => void }> = ({ suggestions, onDone }) => (
  <div className="max-w-lg mx-auto space-y-4 py-8">
    <div className="text-center">
      <CheckCircle2 className="mx-auto text-emerald-400 mb-2" size={40} />
      <h2 className="text-xl font-bold text-slate-100">Tilsyn fullført</h2>
      <p className="text-sm text-slate-400">Synkes automatisk når nettet er tilbake.</p>
    </div>
    {suggestions.length > 0 && (
      <div className="glass rounded-xl border border-slate-800 p-4 space-y-3">
        <p className="text-sm text-slate-300 font-medium">Foreslåtte avvik ({suggestions.length}):</p>
        {suggestions.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-sm border-b border-slate-800/50 pb-2">
            <span className="text-slate-300">{s.item_code}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${s.kind === 'link' ? 'bg-slate-700 text-slate-300' : 'bg-amber-500/20 text-amber-400'}`}>
              {s.kind === 'link' ? 'Knytt til eksisterende' : `Opprett (${s.severity})`}
            </span>
          </div>
        ))}
        <p className="text-xs text-slate-500">Du bestemmer hvilke som opprettes (kobles i neste steg).</p>
      </div>
    )}
    <button onClick={onDone} className="btn-primary w-full justify-center py-3">Ferdig</button>
  </div>
);

export default InspectionRunner;
