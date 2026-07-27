
import { networkDelay, supabase, isCloudConnected } from "./supabase";

const AUTH_KEY = 'rf_auth_session';

// Demo fallback credentials — used only when Supabase is not configured, or
// when the entered email/password is not a real Supabase Auth user.
const DEMO_EMAIL = 'freddy.bremseth@gmail.com';
const DEMO_PASS = 'AllRealty1!';

export interface UserSession {
  email: string;
  isLoggedIn: boolean;
  loginTime: number;
  /** set when the session is backed by a real Supabase Auth user */
  supabaseUserId?: string | null;
}

class AuthService {
  private session: UserSession | null = null;
  private listeners: (() => void)[] = [];

  constructor() {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved) {
      this.session = JSON.parse(saved);
    }
    // Restore a real Supabase session if one exists (enables live Care reads).
    if (isCloudConnected) {
      supabase.auth.getSession().then(({ data }: any) => {
        const s = data?.session;
        if (s?.user) {
          this.session = {
            email: s.user.email ?? this.session?.email ?? '',
            isLoggedIn: true,
            loginTime: Date.now(),
            supabaseUserId: s.user.id,
          };
          localStorage.setItem(AUTH_KEY, JSON.stringify(this.session));
          this.notify();
        }
      }).catch(() => { /* keep local session */ });
    }
  }

  async login(email: string, pass: string): Promise<boolean> {
    // Prefer a real Supabase Auth session so RLS-protected `care` reads work.
    if (isCloudConnected) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (!error && data?.session?.user) {
          this.session = {
            email: data.session.user.email ?? email,
            isLoggedIn: true,
            loginTime: Date.now(),
            supabaseUserId: data.session.user.id,
          };
          localStorage.setItem(AUTH_KEY, JSON.stringify(this.session));
          this.notify();
          return true;
        }
      } catch {
        /* fall through to the demo check */
      }
    }

    // Demo fallback (no live Care data — RLS needs a real session).
    await networkDelay();
    if (email === DEMO_EMAIL && pass === DEMO_PASS) {
      this.session = { email, isLoggedIn: true, loginTime: Date.now(), supabaseUserId: null };
      localStorage.setItem(AUTH_KEY, JSON.stringify(this.session));
      this.notify();
      return true;
    }
    return false;
  }

  logout() {
    if (isCloudConnected) {
      supabase.auth.signOut().catch(() => { /* ignore */ });
    }
    this.session = null;
    localStorage.removeItem(AUTH_KEY);
    this.notify();
  }

  isAuthenticated(): boolean {
    return this.session?.isLoggedIn || false;
  }

  getUserEmail(): string | null {
    return this.session?.email || null;
  }

  /** The Supabase Auth user id, when the session is backed by Supabase. */
  getSupabaseUserId(): string | null {
    return this.session?.supabaseUserId || null;
  }

  /** True when a real Supabase session backs the login (live reads possible). */
  hasLiveSession(): boolean {
    return !!this.session?.supabaseUserId;
  }

  async resetPassword(email: string): Promise<void> {
    if (isCloudConnected) {
      try { await supabase.auth.resetPasswordForEmail(email); return; } catch { /* fall through */ }
    }
    await networkDelay();
    console.log(`Reset link sent to ${email}`);
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const authStore = new AuthService();
