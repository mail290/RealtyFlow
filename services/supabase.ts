

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Fix: Use process.env instead of import.meta.env to access environment variables and resolve TypeScript errors
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase miljøvariabler mangler. Sjekk VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY i Vercel.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

export const isCloudConnected = !!supabaseUrl && supabaseUrl !== 'https://placeholder.supabase.co';

export const networkDelay = () => new Promise(resolve => setTimeout(resolve, 300));
