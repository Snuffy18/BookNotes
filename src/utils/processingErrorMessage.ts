const FRIENDLY_PASSTHROUGH = [
  "please retake",
  "please scan",
  "no longer available",
  "does not look like",
  "could not detect enough readable text",
  "could not read ai insights",
];

function isAlreadyFriendly(message: string): boolean {
  const lower = message.toLowerCase();
  return FRIENDLY_PASSTHROUGH.some((phrase) => lower.includes(phrase));
}

function withDevDetail(friendly: string, technical: string): string {
  if (__DEV__ && technical && friendly !== technical) {
    return `${friendly}\n\n(${technical})`;
  }
  return friendly;
}

/** Maps technical processing failures to copy users can act on. */
export function toProcessingUserMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const message = raw.trim();

  if (!message) {
    return "Something went wrong while analyzing this page. Try taking a clearer photo, or try again.";
  }

  if (isAlreadyFriendly(message)) {
    return message;
  }

  const lower = message.toLowerCase();

  if (
    lower.includes("json parse") ||
    lower.includes("valid json") ||
    lower.includes("unexpected token") ||
    lower.includes("u+0000") ||
    lower.includes("not allowed in string")
  ) {
    return withDevDetail(
      "We couldn't process the results from this scan. The photo may be blurry, poorly lit, or cropped too tightly. Try taking a new photo with the full page in frame.",
      message
    );
  }

  if (lower.includes("openai request failed")) {
    if (lower.includes("(429)") || lower.includes("rate limit")) {
      return withDevDetail("Too many requests right now. Wait a moment, then try again.", message);
    }
    if (lower.includes("(401)") || lower.includes("(403)")) {
      return withDevDetail(
        "Your OpenAI API key was rejected. Restart the app after updating .env, or check the key on platform.openai.com.",
        message
      );
    }
    if (/\(5\d\d\)/.test(message)) {
      return withDevDetail(
        "The analysis service is temporarily unavailable. Try again in a few minutes.",
        message
      );
    }
    return withDevDetail(
      "We couldn't reach the analysis service. Check your connection and try again.",
      message
    );
  }

  if (lower.includes("empty ai response")) {
    return withDevDetail("The analysis didn't finish. Try again, or take a clearer photo.", message);
  }

  if (
    lower.includes("ai isn't configured") ||
    lower.includes("supabase") ||
    lower.includes("missing expo_public_openai")
  ) {
    return withDevDetail(
      "AI processing isn't set up yet. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env and restart Expo with: npx expo start -c",
      message
    );
  }

  if (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("network error") ||
    lower.includes("internet connection")
  ) {
    return withDevDetail("Couldn't connect to the internet. Check your connection and try again.", message);
  }

  if (lower.includes("timed out") || lower.includes("timeout")) {
    return withDevDetail("The analysis took too long. Try again, or take a clearer photo.", message);
  }

  return withDevDetail(
    "Something went wrong while analyzing this page. Try taking a clearer photo, or try again.",
    message
  );
}
