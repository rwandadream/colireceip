import type { Product } from './types';

const toSnake = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(toSnake);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
        toSnake(item),
      ])
    );
  }
  return value;
};

const request = async (method: string, id?: string, body?: unknown) => {
  const query = new URLSearchParams({ resource: 'products' });
  if (id) query.set('id', id);
  const response = await fetch(`/api/data?${query}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) throw new Error(`API_${response.status}`);
  return (await response.json() as { data: unknown }).data;
};

export const canUseProductApi = () => navigator.onLine;
export const isProductApiUnavailable = (error: unknown) => error instanceof TypeError;

export async function listOnlineProducts(): Promise<Product[]> {
  return toSnake(await request('GET')) as Product[];
}

export async function createOnlineProduct(
  data: Omit<Product, 'id' | 'created_at' | 'updated_at'>
): Promise<Product> {
  return toSnake(await request('POST', undefined, {
    name: data.name,
    category: data.category,
    defaultPrice: data.default_price,
  })) as Product;
}

export async function updateOnlineProduct(id: string, data: Partial<Product>): Promise<Product> {
  const body = {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.category !== undefined ? { category: data.category } : {}),
    ...(data.default_price !== undefined ? { defaultPrice: data.default_price } : {}),
  };
  return toSnake(await request('PATCH', id, body)) as Product;
}
