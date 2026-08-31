import type { AppSettings } from './types';
import { fetchWithTimeout, isTransientApiError, parseApiError } from './api';

const toSnake = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(toSnake)
    : value && typeof value === 'object'
    ? Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
          toSnake(item),
        ])
      )
    : value;

const request = async (method: string, id?: string, body?: unknown) => {
  const query = new URLSearchParams({ resource: 'settings' });
  if (id) query.set('id', id);
  const response = await fetchWithTimeout(`/api/data?${query}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return ((await response.json()) as { data: unknown }).data;
};

export const canUseSettingsApi = () => navigator.onLine;
export const isSettingsApiUnavailable = (error: unknown): boolean => isTransientApiError(error);

// Maps the local (snake_case) settings record to the camelCase shape the
// server expects for its AppSettings resource.
export function settingsToApi(data: Partial<AppSettings>): Record<string, unknown> {
  return {
    ...(data.company_name !== undefined ? { companyName: data.company_name } : {}),
    ...(data.company_phone !== undefined ? { companyPhone: data.company_phone } : {}),
    ...(data.company_email !== undefined ? { companyEmail: data.company_email } : {}),
    ...(data.bamako_address !== undefined ? { bamakoAddress: data.bamako_address } : {}),
    ...(data.abidjan_address !== undefined ? { abidjanAddress: data.abidjan_address } : {}),
    ...(data.default_transport_price !== undefined ? { defaultTransportPrice: data.default_transport_price } : {}),
    ...(data.currency !== undefined ? { currency: data.currency } : {}),
    ...(data.default_origin !== undefined ? { defaultOrigin: data.default_origin ?? null } : {}),
    ...(data.default_destination !== undefined ? { defaultDestination: data.default_destination ?? null } : {}),
  };
}

export async function listOnlineSettings(): Promise<AppSettings[]> {
  return toSnake(await request('GET')) as AppSettings[];
}

// updateOnlineSettings receives the already-mapped camelCase API payload held
// by the sync mutation (see settingsToApi above); it must NOT be re-mapped.
export async function updateOnlineSettings(payload: Record<string, unknown>): Promise<AppSettings> {
  return toSnake(await request('PATCH', '1', payload)) as AppSettings;
}