import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getLocalSession, localSignIn, localSignOut, localSignUp } from "@/lib/local-auth";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  mode: "supabase" | "local";
  setUser: (u: User | null) => void;
  setSession: (s: Session | null) => void;
  initialize: () => Promise<void>;
  waitUntilReady: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  logout: () => Promise<void>;
}

let readyPromise: Promise<void> | null = null;
let resolveReady: (() => void) | null = null;
let initialized = false;

function ensureReadyGate() {
  if (!readyPromise) {
    readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
  }
  return readyPromise;
}

function markReady() {
  ensureReadyGate();
  resolveReady?.();
  resolveReady = null;
}

function userFromSession(session: Session): User {
  return {
    id: session.user.id,
    name:
      session.user.user_metadata?.full_name ||
      session.user.user_metadata?.name ||
      session.user.email?.split("@")[0] ||
      "User",
    email: session.user.email || "",
    role: "User",
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  mode: isSupabaseConfigured ? "supabase" : "local",
  setUser: (user) => set({ user }),
  setSession: (session) => {
    if (session) {
      set({ session, user: userFromSession(session), mode: "supabase" });
    } else {
      set({ session: null, user: null });
    }
  },
  waitUntilReady: () => ensureReadyGate(),
  initialize: async () => {
    if (initialized) {
      markReady();
      return;
    }
    initialized = true;
    ensureReadyGate();

    try {
      if (typeof window === "undefined") {
        set({ isLoading: false });
        return;
      }

      if (isSupabaseConfigured) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          get().setSession(data.session);
        } else {
          set({ session: null, user: null, mode: "supabase" });
        }
        supabase.auth.onAuthStateChange((_event, session) => {
          get().setSession(session);
        });
      } else {
        set({
          user: getLocalSession(),
          session: null,
          mode: "local",
        });
      }
    } catch (err) {
      console.error("Auth initialize failed, falling back to local mode", err);
      set({
        user: typeof window !== "undefined" ? getLocalSession() : null,
        session: null,
        mode: "local",
      });
    } finally {
      set({ isLoading: false });
      markReady();
    }
  },
  signIn: async (email, password) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      if (data.session) get().setSession(data.session);
      return {};
    }

    const result = await localSignIn(email, password);
    if ("error" in result) return { error: result.error };
    set({ user: result.user, session: null, mode: "local" });
    return {};
  },
  signUp: async (name, email, password) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
        },
      });
      if (error) return { error: error.message };
      if (data.session) {
        get().setSession(data.session);
        return {};
      }
      return { needsEmailConfirmation: true };
    }

    const result = await localSignUp(name, email, password);
    if ("error" in result) return { error: result.error };
    set({ user: result.user, session: null, mode: "local" });
    return {};
  },
  logout: async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      localSignOut();
    }
    set({ user: null, session: null });
  },
}));
