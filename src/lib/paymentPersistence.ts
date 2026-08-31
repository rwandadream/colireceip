import type { Payment } from './types';
import { fetchWithTimeout, isTransientApiError, parseApiError } from './api';

export type PaymentCreateInput = Pick<Payment, 'parcel_id' | 'amount' | 'payment_method' | 'payment_date' | 'note'>;

const toSnake = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(toSnake);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      toSnake(item),
    ]));
  }
  return value;
};

export const canUsePaymentApi = (): boolean => typeof navigator !== 'undefined' && navigator.onLine;
export const isPaymentApiUnavailable = (error: unknown): boolean => isTransientApiError(error);

const toPayment = (value: unknown): Payment => {
  const converted = toSnake(value) as Payment & { recorded_by_id?: string; recorded_by_name?: string };
  return { ...converted, recorded_by: converted.recorded_by ?? converted.recorded_by_id ?? '', recorded_by_name: converted.recorded_by_name ?? '' };
};

export function createPaymentIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const request = async (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown, idempotencyKey?: string, paymentId?: string): Promise<unknown> => {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  
  const url = paymentId ? `/api/data?resource=payments&id=${encodeURIComponent(paymentId)}` : '/api/data?resource=payments';
  
  const response = await fetchWithTimeout(url, {
    method,
    credentials: 'same-origin',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw await parseApiError(response);
  }
  // 204 No Content is OK; no JSON body expected.
  if (response.status === 204) return null;
  return (await response.json() as { data: unknown }).data;
};

export async function listOnlinePayments(): Promise<Payment[]> {
  return (await request('GET') as unknown[]).map(toPayment);
}

// A caller may provide this key when deliberately retrying the same operation.
// This adapter never retries a payment automatically.
export async function createOnlinePayment(data: PaymentCreateInput, idempotencyKey = createPaymentIdempotencyKey(), id?: string): Promise<Payment> {
  return toPayment(await request('POST', {
    ...(id ? { id } : {}),
    parcelId: data.parcel_id,
    amount: data.amount,
    paymentMethod: data.payment_method,
    paymentDate: data.payment_date,
    note: data.note,
  }, idempotencyKey));
}

export async function updateOnlinePayment(paymentId: string, data: { note?: string; payment_method?: Payment['payment_method'] }): Promise<Payment> {
  return toPayment(await request('PATCH', {
    ...(data.note !== undefined ? { note: data.note } : {}),
    ...(data.payment_method !== undefined ? { paymentMethod: data.payment_method } : {}),
  }, undefined, paymentId));
}

export async function deleteOnlinePayment(paymentId: string): Promise<void> {
  await request('DELETE', undefined, undefined, paymentId);
}


