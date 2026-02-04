
import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, User, Shield, Info, Save, ShieldCheck, Palette, MapPin, 
  Camera, Mail, Phone, Globe, Trash2, Plus, Upload, Wand2, Loader2, 
  Check, Link, Share2, Database, Key, Inbox, Lock, Youtube, Music2, Linkedin, X,
  Type, MessageSquare, ExternalLink, Sparkles, Github, Terminal, GitBranch, Copy, CheckCircle2, AlertTriangle, RefreshCw, HelpCircle, Languages
} from 'lucide-react';
import { settingsStore } from '../services/settingsService';
import { gemini } from '../services/geminiService';
import { Brand, AdvisorProfile, AutomationSettings, IntegrationSettings, AppLanguage } from '../types';
import { useTranslation } from '../services/i18n';

const Settings: React.FC = () => {
  const [lang, setLang] = useState(settingsStore.getLanguage());
  const t = useTranslation(lang);
  
  const [activeTab, setActiveTab] = useState<'brands' | 'profile' | 'integrations' | 'system'>('brands');
  const [brands, setBrands] = useState<Brand[]>(settingsStore.getBrands());
  const [profile, setProfile] = useState<AdvisorProfile>(settingsStore.getProfile());
  const [automation, setAutomation] = useState<AutomationSettings>(settingsStore.getAutomation());
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const advisorFileRef = useRef<HTMLInputElement>(null);
  const brandFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = settingsStore.subscribe(() => {
      setBrands(settingsStore.getBrands());
      setProfile(settingsStore.getProfile());
      setAutomation(settingsStore.getAutomation());
      setLang(settingsStore.getLanguage());
    });
    return unsub;
  }, []);

  const handleLanguageChange = (newLang: AppLanguage) => {
    settingsStore.updateAutomation({ ...automation, language: newLang });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    settingsStore.updateProfile(profile);
    alert(t.save + "!");
  };

  const handleBrandSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBrand) {
      settingsStore.updateBrand(editingBrand);
      setEditingBrand(null);
      alert(t.save + "!");
    }
  };

  const handleAutomationToggle = (key: keyof AutomationSettings) => {
    const updated = { ...automation, [key]: !automation[key] };
    settingsStore.updateAutomation(updated);
  };

  const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });

  const handleAdvisorImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await toBase64(file);
      setProfile({ ...profile, imageUrl: base64 });
    }
  };

  const handleBrandLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingBrand) {
      const base64 = await toBase64(file);
      setEditingBrand({ ...editingBrand, logo: base64 });
    }
  };

  const toggleIntegration = (brand: Brand, key: keyof IntegrationSettings) => {
    const currentIntegrations = brand.integrations || {
      facebookActive: false, instagramActive: false, linkedinActive: false,
      tiktokActive: false, youtubeActive: false, pinterestActive: false, emailSyncActive: false
    };
    const updatedIntegrations = { ...currentIntegrations, [key]: !currentIntegrations[key] };
    settingsStore.updateBrand({ ...brand, integrations: updatedIntegrations });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header>
        <h1 className="text-4xl font-bold neon-text text-cyan-400 mb-2">{t.st_title}</h1>
        <p className="text-slate-400">{t.st_lang_desc}</p>
      </header>

      <div className="flex gap-4 border-b border-slate-800 pb-px overflow-x-auto no-scrollbar">
        {[
          { id: 'brands', label: t.st_brands, icon: <Building2 size={18} /> },
          { id: 'profile', label: t.st_advisor, icon: <User size={18} /> },
          { id: 'integrations', label: t.st_integrations, icon: <Link size={18} /> },
          { id: 'system', label: t.st_system, icon: <Shield size={18} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative whitespace-nowrap ${
              activeTab === tab.id ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          {activeTab === 'system' && (
            <div className="space-y-8 animate-in fade-in">
              {/* Language Selection */}
              <div className="glass p-8 rounded-[3rem] border border-cyan-500/20 bg-cyan-500/5 space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white flex items-center gap-3"><Languages className="text-cyan-400" /> {t.st_lang}</h3>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { id: AppLanguage.NO, label: 'Norsk', flag: '🇳🇴' },
                      { id: AppLanguage.EN, label: 'English', flag: '🇺🇸' },
                      { id: AppLanguage.ES, label: 'Español', flag: '🇪🇸' },
                      { id: AppLanguage.DE, label: 'Deutsch', flag: '🇩🇪' },
                      { id: AppLanguage.RU, label: 'Русский', flag: '🇷🇺' },
                      { id: AppLanguage.FR, label: 'Français', flag: '🇫🇷' },
                    ].map(langItem => (
                      <button
                        key={langItem.id}
                        onClick={() => handleLanguageChange(langItem.id)}
                        className={`p-4 rounded-2xl border text-sm font-bold flex items-center justify-center gap-3 transition-all ${
                          lang === langItem.id 
                            ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xl">{langItem.flag}</span>
                        {langItem.label}
                      </button>
                    ))}
                 </div>
                 <p className="text-[10px] text-slate-500 italic mt-2">
                    <Info size={12} className="inline mr-1" /> AI vil heretter generere rapporter, annonser og guider på {lang.toUpperCase()}.
                 </p>
              </div>

              {/* Autopilot Section */}
              <div className="glass p-8 rounded-3xl border border-slate-800 space-y-8">
                <h3 className="font-bold text-slate-100 flex items-center gap-2"><ShieldCheck className="text-cyan-400" /> Autopilot</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'marketPulseEnabled', label: 'Market Pulse Auto-Gen' },
                    { key: 'brandIdentityGuardEnabled', label: 'Brand Identity Guard' },
                    { key: 'socialSyncEnabled', label: 'Social Sync' },
                    { key: 'leadNurtureEnabled', label: 'Lead Nurture AI' }
                  ].map(item => (
                    <div key={item.key} className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex justify-between items-center">
                      <h4 className="text-sm font-bold text-slate-200">{item.label}</h4>
                      <button 
                        onClick={() => handleAutomationToggle(item.key as any)}
                        className={`w-12 h-6 rounded-full p-1 transition-all ${automation[item.key as keyof AutomationSettings] ? 'bg-cyan-500' : 'bg-slate-800'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${automation[item.key as keyof AutomationSettings] ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Brands & Profile tabs remain functionally same but labels are updated using t object */}
          {activeTab === 'brands' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {brands.map((brand) => (
                <div key={brand.id} className="glass p-8 rounded-3xl border border-slate-800 group relative">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-800 flex items-center justify-center border border-slate-700">
                        {brand.logo ? <img src={brand.logo} className="w-full h-full object-contain" /> : <Building2 className="text-slate-500" size={28} />}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-100">{brand.name}</h3>
                        <p className="text-sm text-slate-500">{brand.description}</p>
                      </div>
                    </div>
                    <button onClick={() => setEditingBrand(brand)} className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white">{t.edit}</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="glass p-8 rounded-3xl border border-slate-800 space-y-8 animate-in fade-in">
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-slate-800 overflow-hidden border-4 border-slate-900 flex items-center justify-center text-3xl font-bold shadow-xl">
                    {profile.imageUrl ? <img src={profile.imageUrl} className="w-full h-full object-cover" /> : <span>{profile.name[0]}</span>}
                  </div>
                  <button type="button" onClick={() => advisorFileRef.current?.click()} className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <Camera className="text-white" size={24} />
                  </button>
                  <input type="file" ref={advisorFileRef} className="hidden" accept="image/*" onChange={handleAdvisorImageUpload} />
                </div>
                <div className="flex-1 space-y-3">
                  <label className="text-[10px] uppercase font-mono text-slate-500 tracking-widest">Name</label>
                  <input type="text" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xl font-bold text-slate-100 focus:border-cyan-500 outline-none" />
                </div>
              </div>
              <button type="submit" className="px-10 py-4 bg-cyan-500 text-slate-950 rounded-2xl font-bold shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition-all">{t.save} Profile</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
