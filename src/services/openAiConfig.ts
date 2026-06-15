/**
 * AI requests are routed through a Supabase Edge Function (`openai-responses`)
 * so the OpenAI API key lives only on the server and never ships in the app
 * bundle. The app authenticates to the function with the public Supabase anon
 * key (safe to expose). Expo inlines EXPO_PUBLIC_* at bundle time — restart
 * Metro after changing .env.
 */
function cleanEnv(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// NOTE: these must use static `process.env.EXPO_PUBLIC_*` access. Expo only
// inlines EXPO_PUBLIC_* vars at bundle time for static dot-access — dynamic
// access like process.env[name] is NOT replaced and resolves to undefined.
const SUPABASE_URL = cleanEnv(process.env.EXPO_PUBLIC_SUPABASE_URL);
const SUPABASE_ANON_KEY = cleanEnv(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const OPENAI_PROXY_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/openai-responses`
  : undefined;

export function isOpenAiConfigured(): boolean {
  return Boolean(OPENAI_PROXY_URL && SUPABASE_ANON_KEY);
}

const MISSING_CONFIG_MESSAGE =
  "AI isn't configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then fully restart Expo (npx expo start -c).";

export function getMissingAiConfigMessage(): string {
  return MISSING_CONFIG_MESSAGE;
}

/**
 * POSTs an OpenAI Responses API payload to the Supabase proxy. The proxy adds
 * the OpenAI Authorization header server-side and forwards to OpenAI, returning
 * the upstream JSON response unchanged.
 */
export async function callOpenAiResponses(
  payload: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  if (!OPENAI_PROXY_URL || !SUPABASE_ANON_KEY) {
    throw new Error(MISSING_CONFIG_MESSAGE);
  }

  return fetch(OPENAI_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    signal,
    body: JSON.stringify(payload),
  });
}
