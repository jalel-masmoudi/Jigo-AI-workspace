import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  process.env.VITE_SUPABASE_URL ||
  "";

const supabaseAnonKey =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("your-project") &&
  !supabaseAnonKey.includes("your-anon-key"),
);

const url = isSupabaseConfigured ? supabaseUrl : "https://placeholder.supabase.co";
const key = isSupabaseConfigured
  ? supabaseAnonKey
  : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

/**
 * Vite SSR on Node 20 has no native WebSocket, and `require("ws")` is unreliable
 * inside the Vite module runner. A no-op transport is enough for SSR — realtime
 * is only used in the browser.
 */
class SsrWebSocketStub {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = SsrWebSocketStub.CLOSED;
  constructor(_url?: string | URL, _protocols?: string | string[]) {}
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return false;
  }
}

function createSupabase(): SupabaseClient {
  if (typeof window === "undefined") {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: { transport: SsrWebSocketStub as unknown as typeof WebSocket },
    });
  }

  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
}

export const supabase = createSupabase();
