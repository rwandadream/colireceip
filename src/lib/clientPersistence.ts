import type { Client } from './types';
import { ApiError, fetchWithTimeout, isTransientApiError } from './api';

const toSnake = (value: unknown): unknown => Array.isArray(value) ? value.map(toSnake) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), toSnake(item)])) : value;
const request = async (method: string, id?: string, body?: unknown) => {
  const query = new URLSearchParams({ resource: 'clients' }); if (id) query.set('id', id);
  const response = await fetchWithTimeout(`/api/data?${query}`, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) {
    throw new ApiError(response.status, `API_${response.status}`);
  }
  return response.status === 204 ? undefined : (await response.json() as { data: unknown }).data;
};
export const canUseClientApi = () => navigator.onLine;
export const isApiUnavailable = (error: unknown): boolean => isTransientApiError(error);
export async function listOnlineClients() { return toSnake(await request('GET')) as Client[]; }
export type OnlineClientInput = Pick<Client, 'full_name' | 'phone' | 'company_name' | 'email' | 'city' | 'neighborhood' | 'address' | 'reference' | 'notes'>;
export async function createOnlineClient(data: OnlineClientInput, id?: string) { return toSnake(await request('POST', undefined, { ...(id ? { id } : {}), fullName: data.full_name, phone: data.phone || '', companyName: data.company_name, email: data.email, city: data.city || '', neighborhood: data.neighborhood, address: data.address || '', reference: data.reference, notes: data.notes || '' })) as Client; }
export async function updateOnlineClient(id: string, data: Partial<Client>) { return toSnake(await request('PATCH', id, { ...(data.full_name !== undefined ? { fullName: data.full_name } : {}), ...(data.phone !== undefined ? { phone: data.phone || '' } : {}), ...(data.company_name !== undefined ? { companyName: data.company_name } : {}), ...(data.email !== undefined ? { email: data.email } : {}), ...(data.city !== undefined ? { city: data.city || '' } : {}), ...(data.neighborhood !== undefined ? { neighborhood: data.neighborhood } : {}), ...(data.address !== undefined ? { address: data.address || '' } : {}), ...(data.reference !== undefined ? { reference: data.reference } : {}), ...(data.notes !== undefined ? { notes: data.notes || '' } : {}) })) as Client; }
export async function deleteOnlineClient(id: string) { await request('DELETE', id); }
