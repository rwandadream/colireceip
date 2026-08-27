import type { User } from './types';
import { ApiError, fetchWithTimeout, isTransientApiError } from './api';

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
  const query = new URLSearchParams({ resource: 'users' });
  if (id) query.set('id', id);
  const response = await fetchWithTimeout(`/api/data?${query}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new ApiError(response.status, `API_${response.status}`);
  }

  return response.status === 204 ? undefined : ((await response.json()) as { data: unknown }).data;
};

export const canUseUserApi = () => navigator.onLine;
export const isUserApiUnavailable = (error: unknown): boolean => isTransientApiError(error);

export async function listOnlineUsers() {
  return toSnake(await request('GET')) as User[];
}

export async function createOnlineUser(data: Omit<User, 'id' | 'created_at' | 'updated_at'>) {
  return toSnake(
    await request('POST', undefined, {
      fullName: data.full_name,
      phone: data.phone,
      role: data.role,
      password: data.password,
      email: data.email || null,
      active: data.active !== undefined ? data.active : true,
    })
  ) as User;
}

export async function updateOnlineUser(id: string, data: Partial<User>) {
  return toSnake(
    await request('PATCH', id, {
      ...(data.full_name !== undefined ? { fullName: data.full_name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.password !== undefined ? { password: data.password } : {}),
    })
  ) as User;
}

export async function deleteOnlineUser(id: string) {
  await request('DELETE', id);
}
