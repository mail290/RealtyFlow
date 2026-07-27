import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Home, Repeat, Receipt, AlertTriangle, CalendarClock, ArrowRight } from 'lucide-react';
import { getCareSummary, subscribeCare } from '../../services/care/careSummary';
import { formatCents } from '../../services/careService';

/**
 * Brand & economy overview card for Care, surfaced on the RealtyFlow
 * dashboard. Reads the live Care numbers (MRR, properties, invoiced,
 * open charges, open issues, upcoming inspections).
 */
const CareEconomyStrip: React.FC = () => {
  const [, force] = useState(0);
  const navigate = useNavigate();
  useEffect(() => subscribeCare(() => force((n) => n + 1)), []);
  const s = getCareSummary();

  const cells = [
    { label: 'Boliger', value: String(s.properties_under_management), icon: <Home size={16} className="text-cyan-400" /> },
    { label: 'MRR', value: formatCents(s.mrr_cents, s.currency, 'no'), icon: <Repeat size={16} className="text-emerald-400" />, hint: `${formatCents(s.arr_cents, s.currency, 'no')} ARR` },
    { label: 'Fakturert i år', value: formatCents(s.invoiced_ytd_cents, s.currency, 'no'), icon: <Receipt size={16} className="text-indigo-400" />, hint: s.draft_invoices_cents ? `${formatCents(s.draft_invoices_cents, s.currency, 'no')} kladd` : undefined },
    { label: 'Åpne tillegg', value: formatCents(s.open_charges_cents, s.currency, 'no'), icon: <Receipt size={16} className="text-amber-400" /> },
    { label: 'Neste tilsyn', value: String(s.upcoming_inspections), icon: <CalendarClock size={16} className="text-fuchsia-400" />, hint: `${s.visits_per_month}/mnd avtalt` },
    { label: 'Åpne avvik', value: String(s.open_issues), icon: <AlertTriangle size={16} className={s.urgent_issues ? 'text-red-400' : 'text-slate-400'} />, hint: s.urgent_issues ? `${s.urgent_issues} høy/haster` : undefined },
  ];

  return (
    <div className="glass rounded-2xl border border-slate-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
            <KeyRound className="text-white" size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Care — Brand &amp; økonomi</h3>
            <p className="text-[11px] text-slate-500">Zen Eco Homes · keyholding</p>
          </div>
        </div>
        <button onClick={() => navigate('/care')} className="text-xs text-cyan-400 flex items-center gap-1 hover:gap-2 transition-all">
          Åpne Care <ArrowRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cells.map((c) => (
          <div key={c.label} className="bg-slate-900/50 rounded-xl p-3 border border-slate-800/50">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] uppercase tracking-wider">{c.label}</span>
              {c.icon}
            </div>
            <p className="text-lg font-bold text-slate-100 leading-tight">{c.value}</p>
            {c.hint && <p className="text-[10px] text-slate-500 mt-0.5">{c.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CareEconomyStrip;
