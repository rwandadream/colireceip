// Maps transport/sync errors to user-facing messages. Raw protocol and
// constraint codes (API_503, API_409, P2002, P2003, "Network request timed
// out.") must never be shown to end users.

const RAW_ERROR_PATTERNS = [/^API_\d+$/, /\bP\d{4}\b/, /Network request timed out\./];

export function userErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const raw = error.message || '';
    if (RAW_ERROR_PATTERNS.some((pattern) => pattern.test(raw))) return fallback;
    return raw;
  }
  return fallback;
}