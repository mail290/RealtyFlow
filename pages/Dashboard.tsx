
import React, { useState, useEffect, useRef } from 'react';
import { leadStore } from '../services/leadService';
import { COLORS } from '../constants';
import { Lead, LeadStatus } from '../types';
import LeadScoreRadar from '../components/LeadScoreRadar';
import { gemini } from '../services/geminiService';
import { isCloudConnected } from '../services/supabase';
import { 
  TrendingUp, Users, Target, Activity, ArrowRight, Star, Sun, ChevronRight, 
  Plus, X, Camera, UserPlus, Loader2, Sparkles, Euro, MessageSquare, Brain, CloudCheck, CloudOff
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import CareEconomyStrip from '../components/care/CareEconomyStrip';

const DASHBOARD_STATS = [
  { label: 'Global Leads', value: '452', change: '+8%', icon: <Users className="text-cyan-400" /> },
  { label: 'Avg. Closing', value: '€342k', change: '+2.1%', icon: <Target className="text-indigo-400" /> },
  { label: 'Sun Factor', value: 'High', change: 'Stable', icon: <Sun className="text-amber-400" /> },
  { label: 'Pipeline Value', value: '€14.2M', change: '+5%', icon: <Activity className="text-fuchsia-400" /> },
];

const ACTIVITY_DATA = [
  { name: 'Mon', leads: 12 },
  { name: 'Tue', leads: 18 },
  { name: 'Wed', leads: 15 },
  { name: 'Thu', leads: 22 },
  { name: 'Fri', leads: 19 },
  { name: 'Sat', leads: 8 },
  { name: 'Sun', leads: 5 },
];

const Dashboard: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [newLead, setNewLead] = useState({ 
    name: '', email: '', value: '', currency: 'EUR', notes: '' 
  });

  const fetchLeads = async () => {
    const data = await leadStore.getLeads();
    setLeads(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLeads();
    return leadStore.subscribe(() => {
      fetchLeads();
    });
  }, []);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      let valueInEur = parseInt(newLead.value) || 0;
      let extractedData = null;

      if (newLead.notes.length > 30) {
        const enriched = await gemini.extractLeadsFromContent(
          `Navn: ${newLead.name}, Epost: ${newLead.email}, Budsjett: ${newLead.value} ${newLead.currency}. Notater: ${newLead.notes}`
        );
        if (enriched && enriched.length > 0) {
          extractedData = enriched[0];
          if (extractedData.value) valueInEur = extractedData.value;
        }
      } else if (newLead.currency === 'NOK') {
        valueInEur = Math.round(valueInEur / 11);
      }

      const lead: Lead = {
        id: `man-${Date.now()}`,
        name: extractedData?.name || newLead.name,
        email: extractedData?.email || newLead.email,
        phone: extractedData?.phone || '',
        source: 'Hurtigoppføring',
        status: LeadStatus.NEW,
        value: valueInEur,
        sentiment: 60,
        urgency: 50,
        intent: 50,
        lastActivity: 'Lagt til fra dashbord',
        summary: extractedData?.summary || newLead.notes || 'Manuell inntasting.',
        personalityType: extractedData?.personalityType || 'Ubekreftet',
        imageUrl: extractedData?.imageUrl || null,
        requirements: { 
          budget: valueInEur, 
          location: extractedData?.location || 'Ikke spesifisert',
          propertyType: 'Vurderes' 
        }
      };

      await leadStore.addLead(lead);
      setIsQuickAddOpen(false);
      setNewLead({ name: '', email: '', value: '', currency: 'EUR', notes: '' });
    } catch (err) {
      console.error(err);
      alert("Noe gikk galt under lagring. Prøv igjen.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileScan = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        const extracted = await gemini.extractLeadsFromImage(base64, file.type);
        
        if (extracted && extracted.length > 0) {
          for (const l of extracted) {
            const lead: Lead = {
              id: `ai-${Math.random().toString(36).substr(2, 9)}`,
              status: LeadStatus.NEW,
              sentiment: 70,
              urgency: 60,
              intent: 80,
              lastActivity: 'AI Scan Fullført',
              source: 'AI Skjema-skann',
              value: l.value || 0,
              ...l,
              requirements: { budget: l.value, location: l.location }
            };
            await leadStore.addLead(lead);
          }
          setIsQuickAddOpen(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      alert("Kunne ikke skanne skjemaet. Prøv manuell inntasting.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl lg:text-4xl font-bold neon-text text-cyan-400">Costa Blanca HQ</h1>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${isCloudConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
               {isCloudConnected ? <CloudCheck size={12} /> : <CloudOff size={12} />}
               {isCloudConnected ? 'Cloud Sync Active' : 'Local Storage Mode'}
            </div>
          </div>
          <p className="text-xs lg:text-sm text-slate-400">Administrerer <span className="text-indigo-400 font-bold">Soleada</span>, <span className="text-emerald-400 font-bold">Zeneco</span> & <span className="text-amber-400 font-bold">Pinoso Eco Life</span></p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={() => setIsQuickAddOpen(true)} className="flex-1 md:flex-none px-6 py-3 bg-cyan-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2">
            <Plus size={16} /> Ny Lead
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="h-64 glass rounded-3xl flex flex-col items-center justify-center space-y-4">
           <Loader2 className="animate-spin text-cyan-500" size={32} />
           <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Synchronizing Intelligence...</p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {DASHBOARD_STATS.map((stat, idx) => (
              <div key={idx} className="glass p-4 lg:p-6 rounded-2xl border border-slate-800 hover:border-cyan-500/30 transition-all group">
                <div className="flex justify-between items-start mb-2 lg:mb-4">
                  <div className="p-2 lg:p-3 bg-slate-900 rounded-xl group-hover:scale-110 transition-transform">{stat.icon}</div>
                  <span className={`text-[8px] lg:text-xs font-bold px-1.5 py-0.5 lg:py-1 rounded-full ${stat.change.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>{stat.change}</span>
                </div>
                <p className="text-slate-400 text-[10px] lg:text-sm mb-1">{stat.label}</p>
                <h3 className="text-lg lg:text-2xl font-bold text-slate-100 font-mono">{stat.value}</h3>
              </div>
            ))}
          </section>

          <section className="mb-6 lg:mb-8">
            <CareEconomyStrip />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="lg:col-span-2 space-y-6 lg:space-y-8">
              <div className="glass p-4 lg:p-8 rounded-3xl border border-slate-800">
                <div className="flex justify-between items-center mb-6 lg:mb-8">
                  <h2 className="text-lg lg:text-xl font-bold flex items-center gap-2"><Activity className="text-cyan-400" size={18} /> Weekly Flow</h2>
                </div>
                <div className="h-[200px] lg:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ACTIVITY_DATA}>
                      <defs><linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/><stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }} itemStyle={{ color: COLORS.primary }} />
                      <Area type="monotone" dataKey="leads" stroke={COLORS.primary} fillOpacity={1} fill="url(#colorLeads)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="space-y-6 lg:space-y-8">
              <div className="glass p-6 lg:p-8 rounded-3xl border border-slate-800">
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><Star className="text-amber-400" size={18} /> Hot Leads</h2>
                <div className="space-y-4">
                  {leads.filter(l => l.sentiment > 80).slice(0, 3).map((lead) => (
                    <div key={lead.id} className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-2xl border border-slate-800 group hover:border-cyan-500/30 transition-all">
                      <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center">
                        {lead.imageUrl ? <img src={lead.imageUrl} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-cyan-400">{lead.name.split(' ').map(n => n[0]).join('')}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-200 truncate group-hover:text-cyan-400 transition-colors">{lead.name}</p>
                        <p className="text-[10px] text-slate-500">€{(lead.value / 1000).toFixed(0)}k • {lead.personalityType || 'Nøytral'}</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-700 group-hover:text-cyan-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {isQuickAddOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
            <header className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="text-cyan-400" size={20} /> Opprett Ny Lead
              </h3>
              <button onClick={() => setIsQuickAddOpen(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
            </header>
            
            <div className="p-8 space-y-6">
              <div className="flex gap-4">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="flex-1 py-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center gap-2 hover:border-cyan-500/50 transition-all group"
                >
                  {isProcessing ? <Loader2 className="animate-spin text-cyan-400" size={24} /> : <Camera className="text-slate-500 group-hover:text-cyan-400" size={24} />}
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-300">Ta bilde av skjema</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileScan} 
                  className="hidden" 
                  accept="image/*" 
                  capture="environment" 
                />
                
                <div className="flex-1 py-6 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex flex-col items-center gap-2">
                  <UserPlus className="text-indigo-400" size={24} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Manuell</span>
                </div>
              </div>

              <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div><div className="relative flex justify-center text-[8px] uppercase font-mono text-slate-600 bg-slate-900 px-2">Eller fyll ut manuelt</div></div>

              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Navn" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500" value={newLead.name} onChange={e => setNewLead({...newLead, name: e.target.value})} />
                  <input placeholder="E-post" type="email" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500" value={newLead.email} onChange={e => setNewLead({...newLead, email: e.target.value})} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input placeholder="Budsjett" type="number" className="col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500" value={newLead.value} onChange={e => setNewLead({...newLead, value: e.target.value})} />
                  <select className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 outline-none" value={newLead.currency} onChange={e => setNewLead({...newLead, currency: e.target.value})}>
                    <option value="EUR">EUR</option><option value="NOK">NOK</option>
                  </select>
                </div>
                <textarea placeholder="Notater om kundens behov..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 min-h-[100px]" value={newLead.notes} onChange={e => setNewLead({...newLead, notes: e.target.value})} />
                <button type="submit" disabled={isProcessing} className="w-full py-4 bg-cyan-500 text-slate-950 rounded-2xl font-bold text-sm shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2 hover:bg-cyan-400 transition-all">
                  {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                  Lagre Lead
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
