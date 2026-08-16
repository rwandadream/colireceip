import type { Client } from './types';

const toSnake = (value: unknown): unknown => Array.isArray(value) ? value.map(toSnake) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), toSnake(item)])) : value;
const request = async (method: string, id?: string, body?: unknown) => {
  const query = new URLSearchParams({ resource: 'clients' }); if (id) query.set('id', id);
  const response = await fetch(`/api/data?${query}`, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`API_${response.status}`);
  return response.status === 204 ? undefined : (await response.json() as { data: unknown }).data;
};
export const canUseClientApi = () => navigator.onLine;
export const isApiUnavailable = (error: unknown) => error instanceof TypeError || (error instanceof Error && /^API_(404|405|500|502|503|504)$/.test(error.message));
export async function listOnlineClients() { return toSnake(await request('GET')) as Client[]; }
export async function createOnlineClient(data: Omit<Client, 'id' | 'created_at' | 'updated_at'>) { return toSnake(await request('POST', undefined, { fullName: data.full_name, phone: data.phone, companyName: data.company_name, email: data.email, city: data.city, neighborhood: data.neighborhood, address: data.address, reference: data.reference, notes: data.notes })) as Client; }
export async function updateOnlineClient(id: string, data: Partial<Client>) { return toSnake(await request('PATCH', id, { fullName: data.full_name, phone: data.phone, city: data.city, address: data.address, notes: data.notes })) as Client; }
export async function deleteOnlineClient(id: string) { await request('DELETE', id); }
