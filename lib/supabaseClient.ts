import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Supabase] EXPO_PUBLIC_SUPABASE_URL veya EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlı değil.");
}

// DEV-only network sanity check. Helps diagnose mobile "TypeError: Network
// request failed" by confirming whether Supabase is reachable at all from
// the device. Fires once per JS bundle load; production strips this branch.
if (__DEV__) {
  // Fully redact the project-ref label; only keep the host suffix so we can
  // confirm the URL points at *.supabase.co without disclosing which project.
  // Pattern: https://<projectRef>.<rest>  →  https://***.<rest>
  let urlSuffix = "(empty)";
  let urlScheme = "";
  let projectRefLen = 0;
  try {
    if (supabaseUrl) {
      const u = new URL(supabaseUrl);
      urlScheme = u.protocol; // "https:" / "http:"
      const host = u.hostname;
      const dot = host.indexOf(".");
      if (dot > 0) {
        projectRefLen = dot;
        urlSuffix = "***" + host.slice(dot); // e.g. "***.supabase.co"
      } else {
        urlSuffix = "***";
        projectRefLen = host.length;
      }
    }
  } catch {
    urlSuffix = "(invalid)";
  }
  console.log("[SUPABASE_ENV]", {
    hasUrl: !!supabaseUrl,
    urlScheme,         // sanity: "https:"
    urlSuffix,         // e.g. "***.supabase.co" — no project ref
    projectRefLen,     // length only, not the value
    hasAnon: !!supabaseAnonKey,
    anonLen: supabaseAnonKey.length,
  });

  if (supabaseUrl && supabaseAnonKey) {
    // Lightweight HEAD-equivalent: GET /rest/v1/ returns 200/401/404 quickly.
    // Any of those = reachable. "TypeError: Network request failed" here =
    // device cannot reach Supabase at all (DNS/firewall/cleartext/etc).
    fetch(`${supabaseUrl}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    })
      .then((r) => console.log("[SUPABASE_PING]", r.status))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[SUPABASE_PING_FAIL]", msg);
      });
  }
}


const safeSupabaseUrl =
  supabaseUrl && supabaseUrl.trim().length > 0
    ? supabaseUrl
    : "https://example.supabase.co";

const safeSupabaseAnonKey =
  supabaseAnonKey && supabaseAnonKey.trim().length > 0
    ? supabaseAnonKey
    : "local-dev-placeholder-key";

export const supabase = createClient(safeSupabaseUrl, safeSupabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/**
 * Ecz4 OAuth redirect fix —
 * Production / standalone build'de `Linking.createURL` doğru `ciltbakim://` üretir.
 * Expo Go (Replit dev) ortamında ise `--localhost` flag'i nedeniyle host="localhost"
 * dönüyor ve gerçek cihazda Safari "localhost"a bağlanamıyor. Bu helper DEV'de
 * REPLIT_EXPO_DEV_DOMAIN'i zorlar; PROD davranışına dokunmaz.
 */
function getRedirectUri(): string {
  if (!__DEV__) {
    return Linking.createURL("auth/callback"); // standalone → ciltbakim://auth/callback
  }
  const expoDomain = process.env.EXPO_PUBLIC_REPLIT_EXPO_DEV_DOMAIN;
  if (expoDomain) {
    return `exp://${expoDomain}/--/auth/callback`;
  }
  return Linking.createURL("auth/callback");
}

export async function signInWithProvider(provider: "google" | "apple"): Promise<void> {
  const redirectTo = getRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    throw error ?? new Error("OAuth başlatılamadı");
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === "success") {
    const { url } = result;
    const code = (() => { try { return new URL(url).searchParams.get("code"); } catch { return null; } })();
    if (code) {
      const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exchErr) throw exchErr;
      return;
    }
    const fragment = url.split("#")[1];
    if (fragment) {
      const params = Object.fromEntries(new URLSearchParams(fragment));
      if (params.access_token) {
        const { error: setErr } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token ?? "",
        });
        if (setErr) throw setErr;
        return;
      }
    }
    throw new Error("Oturum bilgisi alınamadı");
  }

  if (result.type === "cancel") {
    throw new Error("cancel");
  }
}
