
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// I Vercel/Vite brukes import.meta.env, men vi faller tilbake på prosess-variabler hvis nødvendig
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'https://placeholder.supabase.co') {
  console.warn("⚠️ Supabase er ikke fullstendig konfigurert. Appen kjører i lokal demo-modus.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// Sjekker om vi faktisk er koblet til en ekte sky-instans
export const isCloudConnected = !!supabaseUrl && !supabaseUrl.includes('placeholder');

export const networkDelay = () => new Promise(resolve => setTimeout(resolve, 300));
