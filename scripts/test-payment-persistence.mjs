import { createServer } from 'vite';

const results = {};
const record = (name, passed) => { results[name] = passed; console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}`); };
const expectApiError = async (operation, status) => {
  try { await operation(); return false; } catch (error) { return error instanceof Error && error.message === `API_${status}`; }
};

const requests = [];
const payments = new Map();
let indexedDbTouched = false;
const originalFetch = globalThis.fetch;
const originalNavigator = globalThis.navigator;

try {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, get() { indexedDbTouched = true; throw new Error('IndexedDB must not be used online.'); } });
  globalThis.fetch = async (url, init = {}) => {
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ url, method: init.method, headers, body });
    if (init.method === 'GET') return { ok: true, status: 200, json: async () => ({ data: [...payments.values()].map((payment) => payment.data) }) };
    if (body?.note === 'force-network') throw new TypeError('Network unavailable');
    const key = headers['idempotency-key'];
    const forcedStatus = body?.note === 'force-401' ? 401 : body?.note === 'force-403' ? 403 : undefined;
    if (forcedStatus) return { ok: false, status: forcedStatus, json: async () => ({ error: 'Denied' }) };
    const existing = payments.get(key);
    if (existing && JSON.stringify(existing.input) !== JSON.stringify(body)) return { ok: false, status: 409, json: async () => ({ error: 'Conflict' }) };
    const data = existing?.data ?? { id: 'server-payment-1', parcelId: body.parcelId, parcelTracking: 'GG-TEST', clientId: 'server-client', clientName: 'Server Client', amount: body.amount, paymentMethod: body.paymentMethod, paymentDate: body.paymentDate, recordedById: 'server-user', recordedByName: 'Server User', note: body.note, createdAt: '2026-01-01T00:00:00.000Z' };
    payments.set(key, { input: body, data });
    return { ok: true, status: 201, json: async () => ({ data }) };
  };

  const vite = await createServer({ appType: 'custom', server: { middlewareMode: true } });
  const { createOnlinePayment, listOnlinePayments } = await vite.ssrLoadModule('/src/lib/paymentPersistence.ts');
  const input = { parcel_id: 'parcel-1', amount: 250, payment_method: 'cash', payment_date: '2026-01-01T00:00:00.000Z', note: 'payment' };
  const payment = await createOnlinePayment(input, 'payment-key');
  const firstRequest = requests[0];
  record('onlineCreation', payment.id === 'server-payment-1' && payment.recorded_by === 'server-user' && !indexedDbTouched);
  record('businessFieldsAndIdempotencyHeader', firstRequest.url === '/api/data?resource=payments' && firstRequest.headers['idempotency-key'] === 'payment-key' && JSON.stringify(firstRequest.body) === JSON.stringify({ parcelId: 'parcel-1', amount: 250, paymentMethod: 'cash', paymentDate: input.payment_date, note: 'payment' }));
  await createOnlinePayment(input, 'payment-key');
  record('idempotencyRetry', payments.size === 1 && requests[1].headers['idempotency-key'] === 'payment-key');
  record('unauthenticatedDoesNotFallback', await expectApiError(() => createOnlinePayment({ ...input, note: 'force-401' }, 'key-401'), 401) && !indexedDbTouched);
  record('unauthorizedDoesNotFallback', await expectApiError(() => createOnlinePayment({ ...input, note: 'force-403' }, 'key-403'), 403) && !indexedDbTouched);
  record('conflictDoesNotFallback', await expectApiError(() => createOnlinePayment({ ...input, amount: 251 }, 'payment-key'), 409) && !indexedDbTouched);
  let networkError = false;
  try { await createOnlinePayment({ ...input, note: 'force-network' }, 'key-network'); } catch (error) { networkError = error instanceof TypeError; }
  record('networkFailureDoesNotFallback', networkError && !indexedDbTouched);
  const listed = await listOnlinePayments();
  record('onlineListUsesApi', Array.isArray(listed) && requests.at(-1).method === 'GET');
  await vite.close();
} finally {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
}

if (Object.values(results).some((passed) => !passed)) process.exitCode = 1;
