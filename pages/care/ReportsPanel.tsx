import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Download, ShieldCheck, Loader2, Eye, Link2, X, Globe } from 'lucide-react';
import { careStore } from '../../services/careService';
import { listInspections, type InspectionDraft } from '../../services/care/inspectionDb';
import {
  buildDraft, renderPdf, approveAndFinalise, listReports, type ReportRecord,
} from '../../services/care/reportService';
import { sha256OfJson } from '../../lib/care/reports/contentHash';

type Locale = 'no' | 'en' | 'es' | 'de';
const LOCALES: Locale[] = ['no', 'en', 'es', 'de'];

interface Preview { url: string; hash: string; inspectionId: string; revoke: () => void }

const ReportsPanel: React.FC = () => {
  const [inspections, setInspections] = useState<InspectionDraft[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>(listReports());
  const [locale, setLocale] = useState<Locale>('no');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const lastBlob = useRef<{ ref: string; url: string } | null>(null);

  useEffect(() => {
    listInspections().then((all) =>
      setInspections(all.filter((i) => i.status === 'completed' || i.status === 'synced')),
    );
  }, [reports]);

  const propRef = (id: string) => careStore.getProperties().find((p) => p.id === id)?.reference ?? id.slice(0, 8);

  const openPreview = async (inspectionId: string) => {
    setBusy(inspectionId);
    try {
      preview?.revoke();
      const draft = await buildDraft(inspectionId, locale);
      const hash = await sha256OfJson(draft.snapshot);
      const blob = await renderPdf(draft.snapshot, hash, draft.photoUrls);
      const url = URL.createObjectURL(blob);
      setPreview({ url, hash, inspectionId, revoke: () => { draft.revoke(); URL.revokeObjectURL(url); } });
    } finally {
      setBusy(null);
    }
  };

  const approve = async () => {
    if (!preview) return;
    setBusy('approve');
    try {
      const { record, blob } = await approveAndFinalise(preview.inspectionId, locale);
      if (lastBlob.current) URL.revokeObjectURL(lastBlob.current.url);
      lastBlob.current = { ref: record.reference, url: URL.createObjectURL(blob) };
      preview.revoke();
      setPreview(null);
      setReports(listReports());
    } finally {
      setBusy(null);
    }
  };

  const downloadFinal = async (record: ReportRecord) => {
    let url: string;
    if (lastBlob.current?.ref === record.reference) {
      url = lastBlob.current.url;
    } else {
      const blob = await renderPdf(record.data_snapshot, record.content_hash, {});
      url = URL.createObjectURL(blob);
    }
    const a = document.createElement('a');
    a.href = url; a.download = `${record.reference}.pdf`; a.click();
  };

  const alreadyReported = useMemo(() => new Set(reports.map((r) => r.inspection_id)), [reports]);

  return (
    <div className="space-y-6">
      {/* Locale selector */}
      <div className="flex items-center gap-2">
        <Globe size={14} className="text-slate-500" />
        <span className="text-xs text-slate-500">Eierens språk:</span>
        {LOCALES.map((l) => (
          <button key={l} onClick={() => setLocale(l)}
            className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${locale === l ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Completed inspections awaiting a report */}
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Fullførte tilsyn</p>
        {inspections.length === 0 ? (
          <p className="text-slate-500 text-sm">Ingen fullførte tilsyn ennå. Kjør et tilsyn fra en bolig først.</p>
        ) : (
          <div className="space-y-2">
            {inspections.map((i) => (
              <div key={i.id} className="glass rounded-xl border border-slate-800 p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-100">{propRef(i.property_id)}</p>
                  <p className="text-xs text-slate-500">{new Date(i.device_completed_at ?? i.started_at).toLocaleString()} · {i.status}</p>
                </div>
                <div className="flex items-center gap-2">
                  {alreadyReported.has(i.id) && <span className="text-[10px] text-emerald-400">rapportert</span>}
                  <button onClick={() => openPreview(i.id)} disabled={busy === i.id} className="btn-primary">
                    {busy === i.id ? <Loader2 className="animate-spin" size={16} /> : <Eye size={16} />} Lag rapport
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Finalised reports */}
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Rapporter</p>
        {reports.length === 0 ? (
          <p className="text-slate-500 text-sm">Ingen godkjente rapporter ennå.</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="glass rounded-xl border border-slate-800 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-cyan-400 font-mono">{r.reference}</p>
                    <p className="text-xs text-slate-500">{propRef(r.property_id)} · {r.locale.toUpperCase()} · {r.status}</p>
                  </div>
                  <button onClick={() => downloadFinal(r)} className="btn-ghost"><Download size={16} /> PDF</button>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                  <ShieldCheck size={12} className="text-emerald-500" />
                  <span className="font-mono truncate">sha256:{r.content_hash.slice(0, 32)}…</span>
                </div>
                {r.share_url && (
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                    <Link2 size={12} /> <span className="truncate">{r.share_url}</span>
                    <span className="text-amber-500/80">(delingslenke krever backend)</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-3xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-slate-200"><FileText size={18} /> Forhåndsvisning ({locale.toUpperCase()})</div>
              <button onClick={() => { preview.revoke(); setPreview(null); }} className="text-slate-400"><X size={20} /></button>
            </div>
            <iframe title="report" src={preview.url} className="flex-1 w-full rounded-b-none bg-white" />
            <div className="p-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">sha256:{preview.hash.slice(0, 24)}…</span>
              <button onClick={approve} disabled={busy === 'approve'} className="btn-primary">
                {busy === 'approve' ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />} Godkjenn og send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPanel;
