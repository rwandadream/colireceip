import type { Client } from './types';

const toSnake = (value: unknown): unknown => Array.isArray(value) ? value.map(toSnake) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), toSnake(item)])) : value;
const request = async (method: string, id?: string, body?: unknown) => {
  const query = new URLSearchParams({ resource: 'clients' }); if (id) query.set('id', id);
  const response = await fetch(`/api/data?${query}`, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) {
    let message = `API_${response.status}`;
    try {
      const payload = await response.json() as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error) message += `: ${payload.error}`;
    } catch {
      // Keep the HTTP status when the error response has no JSON body.
    }
    throw new Error(message);
  }
  return response.status === 204 ? undefined : (await response.json() as { data: unknown }).data;
};
export const canUseClientApi = () => navigator.onLine;
export const isApiUnavailable = (error: unknown) => error instanceof TypeError;
export async function listOnlineClients() { return toSnake(await request('GET')) as Client[]; }
export async function createOnlineClient(data: Omit<Client, 'id' | 'created_at' | 'updated_at'>) { return toSnake(await request('POST', undefined, { fullName: data.full_name, phone: data.phone || '', companyName: data.company_name, email: data.email, city: data.city || '', neighborhood: data.neighborhood, address: data.address || '', reference: data.reference, notes: data.notes || '' })) as Client; }
export async function updateOnlineClient(id: string, data: Partial<Client>) { return toSnake(await request('PATCH', id, { ...(data.full_name !== undefined ? { fullName: data.full_name } : {}), ...(data.phone !== undefined ? { phone: data.phone || '' } : {}), ...(data.city !== undefined ? { city: data.city || '' } : {}), ...(data.address !== undefined ? { address: data.address || '' } : {}), ...(data.notes !== undefined ? { notes: data.notes || '' } : {}) })) as Client; }
export async function deleteOnlineClient(id: string) { await request('DELETE', id); }
