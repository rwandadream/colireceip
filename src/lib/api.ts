// Shared API helpers used by every online/offline persistence module.
//
// Transient failures (network, timeout, HTTP 5xx, 429) allow IndexedDB
// fallback. Authorization (401/403) and data errors (400/404/409) must never
// be silently masked by local data.

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

export function isTransientApiError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof ApiError) return TRANSIENT_STATUSES.has(error.status);
  return false;
}

const DEFAULT_TIMEOUT_MS = 15000;

// Wraps fetch with an AbortController timeout. A timeout is surfaced as a
// TypeError so existing offline-first fallbacks treat it as a network failure.
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new TypeError('Network request timed out.');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}