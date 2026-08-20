export class ApiResponseError extends Error {
  constructor(status, message) {
    super(`API_${status}: ${message}`);
    this.name = 'ApiResponseError';
    this.status = status;
  }
}

const invalidResponse = () => new Error('API_INVALID_RESPONSE: Expected a JSON response body.');

const parseJson = async (response) => {
  const text = await response.text();
  if (!text.trim()) throw invalidResponse();
  try { return JSON.parse(text); } catch { throw invalidResponse(); }
};

export async function requestApi(resource, method, options = {}) {
  const { id, query = {}, body, headers = {} } = options;
  const params = new URLSearchParams({ resource, ...query });
  if (id) params.set('id', id);
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';

  const response = await fetch(`/api/data?${params}`, {
    method,
    credentials: 'same-origin',
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = await parseJson(response);
      if (typeof payload?.error === 'string' && payload.error) message = payload.error;
    } catch {
      // Preserve the HTTP status when the server returns HTML or another invalid body.
    }
    throw new ApiResponseError(response.status, message);
  }

  if (response.status === 204) return undefined;
  const payload = await parseJson(response);
  if (!payload || typeof payload !== 'object' || !Object.prototype.hasOwnProperty.call(payload, 'data')) {
    throw invalidResponse();
  }
  return payload.data;
}

export const isNetworkUnavailable = (error) => error instanceof TypeError;
