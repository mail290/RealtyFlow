
import React, { useState, useRef, useEffect } from 'react';
import { LeadStatus, Lead, Property, ViewingItem, CallLog, NurtureStep, EmailMessage } from '../types';
import { leadStore } from '../services/leadService';
import { propertyStore } from '../services/propertyService';
import { BRANDS } from '../constants';
import { 
  X, Plus, Sparkles, Zap, BrainCircuit, Target, BarChart, 
  ChevronRight, CheckCircle2, Phone, Mail, Loader2, 
  RefreshCw, Copy, Check, FileText, Upload, File, MessageSquare, SendHorizontal, MapPin, Euro, BedDouble, Bath,
  Home, ImageIcon, Wand2, FileSearch, UserPlus, Save, Camera, Clock, Navigation, CalendarDays, User,
  CheckSquare, Square, ClipboardList, Trash2, AlertTriangle, PhoneCall, History, Play, Quote, UserCheck, TrendingUp, Filter, Download, Inbox, MessageCircle
} from 'lucide-react';
import { gemini } from '../services/geminiService';

const COLUMNS = [
  { id: LeadStatus.NEW, label: 'New', color: 'bg-cyan-500' },
  { id: LeadStatus.QUALIFIED, label: 'Qual', color: 'bg-indigo-500' },
  { id: LeadStatus.VIEWING, label: 'Views', color: 'bg-emerald-500' },
  { id: LeadStatus.NEGOTIATION, label: 'Negot', color: 'bg-amber-500' },
  { id: LeadStatus.WON, label: 'Won', color: 'bg-fuchsia-500' },
];

const Pipeline: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'emails' | 'strategy'>('info');
  const [emailAnalysis, setEmailAnalysis] = useState<any>(null);
  const [isAnalyzingEmails, setIsAnalyzingEmails] = useState(false);
  
  const [newLead, setNewLead] = useState({ 
    name: '', email: '', value: '', notes: '', 
    bedrooms: '', location: '', propertyType: '' 
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchLeads = async () => {
      const data = await leadStore.getLeads();
      setLeads(data);
    };
    
    fetchLeads();
    
    // Abonner på endringer og oppdater asynkront
    return leadStore.subscribe(async () => {
      const data = await leadStore.getLeads();
      setLeads(data);
    });
  }, []);

  const filteredLeads = selectedBrand === 'all' ? leads : leads.filter(l => l.brandId === selectedBrand);
  const totalValue = filteredLeads.reduce((a, b) => a + (b.value || 0), 0);

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setEmailAnalysis(null);
    setActiveDetailTab('info');
  };

  const handleEmailAnalysis = async () => {
    if (!selectedLead?.emails || selectedLead.emails.length === 0) return;
    setIsAnalyzingEmails(true);
    try {
      const result = await gemini.analyzeEmailThread(selectedLead.emails, selectedLead);
      setEmailAnalysis(result);
      setActiveDetailTab('strategy');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzingEmails(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const lead: Lead = {
        id: `pl-${Date.now()}`,
        name: newLead.name,
        email: newLead.email,
        phone: '',
        source: 'Pipeline Manuel',
        status: LeadStatus.NEW,
        value: parseInt(newLead.value) || 0,
        sentiment: 60,
        urgency: 50,
        intent: 50,
        lastActivity: 'Nylig opprettet',
        summary: newLead.notes,
        brandId: selectedBrand !== 'all' ? selectedBrand : 'soleada',
        emails: [],
        requirements: { 
          budget: parseInt(newLead.value) || 0, 
          location: newLead.location, 
          propertyType: newLead.propertyType, 
          bedrooms: parseInt(newLead.bedrooms) || 0 
        }
      };
      await leadStore.addLead(lead);
      setIsLeadModalOpen(false);
      setNewLead({ name: '', email: '', value: '', notes: '', bedrooms: '', location: '', propertyType: '' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-1">
        <div><h1 className="text-4xl font-bold neon-text text-cyan-400">Pipeline</h1><p className="text-slate-400 text-xs mt-1">Verdi: €{(totalValue / 1000000).toFixed(1)}M</p></div>
        <div className="flex gap-2">
          <button onClick={() => setIsLeadModalOpen(true)} className="px-6 py-3 bg-cyan-500 text-slate-950 rounded-2xl font-bold flex items-center gap-2 text-xs shadow-lg shadow-cyan-500/20"><UserPlus size={16} /> Ny Lead</button>
        </div>
      </header>

      <div className="flex gap-6 overflow-x-auto pb-8 snap-x no-scrollbar">
        {COLUMNS.map(column => (
          <div key={column.id} className="w-80 flex-shrink-0 flex flex-col gap-4 snap-start">
            <div className="flex items-center justify-between px-2"><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${column.color}`}></div><h3 className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">{column.label}</h3></div><span className="text-[10px] text-slate-600 font-mono">{filteredLeads.filter(l => l.status === column.id).length}</span></div>
            <div className="flex-1 bg-slate-900/10 rounded-3xl border border-slate-900/50 p-2 space-y-3 min-h-[400px]">
              {filteredLeads.filter(l => l.status === column.id).map(lead => (
                <div key={lead.id} onClick={() => handleLeadClick(lead)} className="glass p-4 rounded-2xl border border-slate-800 hover:border-cyan-500/40 transition-all cursor-pointer group">
                  <h4 className="font-bold text-slate-200 text-sm truncate group-hover:text-cyan-400">{lead.name}</h4>
                  <p className="text-[10px] text-slate-500 mt-1">€{(lead.value / 1000).toFixed(0)}k • {lead.brandId}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedLead && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex justify-end animate-in slide-in-from-right duration-300">
          <div className="w-full lg:w-[700px] bg-[#0a0a0c] border-l border-slate-800 h-full flex flex-col shadow-2xl">
             <header className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/20">
                <div><h2 className="text-2xl font-bold text-white">{selectedLead.name}</h2><p className="text-xs text-slate-500">{selectedLead.email}</p></div>
                <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-800 rounded-full"><X size={24} /></button>
             </header>

             <div className="flex bg-slate-950 p-1 border-b border-slate-800">
                {['info', 'emails', 'strategy'].map(tab => (
                  <button 
                    key={tab} 
                    onClick={() => setActiveDetailTab(tab as any)}
                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeDetailTab === tab ? 'text-cyan-400 bg-cyan-500/5' : 'text-slate-600 hover:text-slate-300'}`}
                  >
                    {tab === 'info' ? 'Info' : tab === 'emails' ? 'E-post Historie' : 'AI Handling'}
                  </button>
                ))}
             </div>

             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeDetailTab === 'info' && (
                  <div className="space-y-6">
                    <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                       <h4 className="text-xs font-bold text-slate-500 uppercase mb-4">Sammendrag</h4>
                       <p className="text-sm text-slate-300 leading-relaxed">{selectedLead.summary || 'Ingen data.'}</p>
                    </div>
                  </div>
                )}

                {activeDetailTab === 'emails' && (
                  <div className="space-y-4">
                     {(!selectedLead.emails || selectedLead.emails.length === 0) ? (
                       <div className="text-center py-20 opacity-20"><Inbox size={48} className="mx-auto mb-4" /><p className="text-xs font-mono uppercase">Ingen e-poster funnet for denne kunden.</p></div>
                     ) : (
                       <>
                         <button onClick={handleEmailAnalysis} disabled={isAnalyzingEmails} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 mb-4">
                            {isAnalyzingEmails ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />} Analyser Tråd med AI
                         </button>
                         {selectedLead.emails.map(email => (
                           <div key={email.id} className={`p-4 rounded-xl border ${email.isIncoming ? 'bg-slate-900 border-slate-800' : 'bg-indigo-500/5 border-indigo-500/20 ml-8'}`}>
                              <div className="flex justify-between text-[10px] font-mono mb-2">
                                 <span className={email.isIncoming ? 'text-cyan-400' : 'text-indigo-400'}>{email.isIncoming ? 'INN' : 'UT'}</span>
                                 <span className="text-slate-600">{email.date}</span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed">{email.body}</p>
                           </div>
                         ))}
                       </>
                     )}
                  </div>
                )}

                {activeDetailTab === 'strategy' && emailAnalysis && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-top-4">
                     <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                        <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Target size={14} /> AI Analyse Resultat</h4>
                        <p className="text-sm text-slate-200 leading-relaxed">{emailAnalysis.summary}</p>
                     </div>
                     <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
                        <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-4">Foreslått Handling</h4>
                        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-sm text-white mb-6 italic">"{emailAnalysis.suggestedAction}"</div>
                        <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-4">E-post utkast (Norsk)</h4>
                        <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{emailAnalysis.suggestedEmailDraft}</div>
                        <button className="w-full mt-6 py-4 bg-indigo-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2"><SendHorizontal size={16} /> Kopier og Send Svar</button>
                     </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
      
      {isLeadModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
            <header className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="text-cyan-400" size={20} /> Opprett Ny Lead
              </h3>
              <button onClick={() => setIsLeadModalOpen(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
            </header>
            
            <div className="p-8 space-y-6">
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Navn" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500" value={newLead.name} onChange={e => setNewLead({...newLead, name: e.target.value})} />
                  <input placeholder="E-post" type="email" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500" value={newLead.email} onChange={e => setNewLead({...newLead, email: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Budsjett (EUR)" type="number" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500" value={newLead.value} onChange={e => setNewLead({...newLead, value: e.target.value})} />
                  <input placeholder="Ønsket Sted" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500" value={newLead.location} onChange={e => setNewLead({...newLead, location: e.target.value})} />
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

export default Pipeline;
