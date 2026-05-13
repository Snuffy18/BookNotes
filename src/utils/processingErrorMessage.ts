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
    return "We couldn't process the results from this scan. The photo may be blurry, poorly lit, or cropped too tightly. Try taking a new photo with the full page in frame.";
  }

  if (lower.includes("openai request failed")) {
    if (lower.includes("(429)") || lower.includes("rate limit")) {
      return "Too many requests right now. Wait a moment, then try again.";
    }
    if (lower.includes("(401)") || lower.includes("(403)")) {
      return "We couldn't connect to the analysis service. Try again later.";
    }
    if (/\(5\d\d\)/.test(message)) {
      return "The analysis service is temporarily unavailable. Try again in a few minutes.";
    }
    return "We couldn't reach the analysis service. Check your connection and try again.";
  }

  if (lower.includes("empty ai response")) {
    return "The analysis didn't finish. Try again, or take a clearer photo.";
  }

  if (lower.includes("missing expo_public_openai")) {
    return "AI processing isn't set up on this device yet.";
  }

  if (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("network error") ||
    lower.includes("internet connection")
  ) {
    return "Couldn't connect to the internet. Check your connection and try again.";
  }

  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "The analysis took too long. Try again, or take a clearer photo.";
  }

  return "Something went wrong while analyzing this page. Try taking a clearer photo, or try again.";
}
