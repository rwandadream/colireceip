import type { Payment } from './types';

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
export const isPaymentApiUnavailable = (error: unknown): boolean => error instanceof TypeError;

const toPayment = (value: unknown): Payment => {
  const converted = toSnake(value) as Payment & { recorded_by_id?: string; recorded_by_name?: string };
  return { ...converted, recorded_by: converted.recorded_by ?? converted.recorded_by_id ?? '', recorded_by_name: converted.recorded_by_name ?? '' };
};

export function createPaymentIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const request = async (method: 'GET' | 'POST' | 'DELETE', body?: PaymentCreateInput, idempotencyKey?: string, paymentId?: string): Promise<unknown> => {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  
  const url = paymentId ? `/api/data?resource=payments&id=${encodeURIComponent(paymentId)}` : '/api/data?resource=payments';
  
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers,
    body: body ? JSON.stringify({
      parcelId: body.parcel_id,
      amount: body.amount,
      paymentMethod: body.payment_method,
      paymentDate: body.payment_date,
      note: body.note,
    }) : undefined,
  });
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
  // 204 No Content is OK; no JSON body expected.
  if (response.status === 204) return null;
  return (await response.json() as { data: unknown }).data;
};

export async function listOnlinePayments(): Promise<Payment[]> {
  return (await request('GET') as unknown[]).map(toPayment);
}

// A caller may provide this key when deliberately retrying the same operation.
// This adapter never retries a payment automatically.
export async function createOnlinePayment(data: PaymentCreateInput, idempotencyKey = createPaymentIdempotencyKey()): Promise<Payment> {
  return toPayment(await request('POST', data, idempotencyKey));
}

// Delete a payment by ID. This is an API-driven operation that must succeed at the
// API level before the local cache is modified. The caller is responsible for handling
// any local cache cleanup after this function succeeds.
export async function deleteOnlinePayment(paymentId: string): Promise<void> {
  await request('DELETE', undefined, undefined, paymentId);
}
