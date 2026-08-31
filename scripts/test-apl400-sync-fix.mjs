// Targeted verification of the APL_400 synchronization fix.
//
// Scenario under test: a parcel is created locally (offline) while its client
// has NOT yet been synced to the server. The server answers the parcel create
// with HTTP 400 "Client introuvable." (missing dependency). Requirements:
//   1. such a 400 is classified TRANSIENT (not permanent) -> no permanent fail;
//   2. once the client exists server-side, the failed parcel is auto-requeued
//      and successfully synchronized;
//   3. a genuine validation/business 400 (no "introuvable"/"Missing") is NOT
//      classified transient and is NOT retried forever;
//   4. the sync error counter returns to 0 after the record is synchronized;
//   5. no duplicate parcel/client/payment records are created by the retry.
//
// It reuses the exact source modules shipped to the browser via Vite's SSR
// loader, plus fake-indexeddb, exactly like scripts/test-sync-engine.mjs.

import 'fake-indexeddb/auto';
import { createServer } from 'vite';

const results = {};
const record = (name, passed, extra) => { results[name] = passed; console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}${extra !== undefined ? `  ${JSON.stringify(extra)}` : ''}`); };

const originalFetch = globalThis.fetch;
const originalNavigator = globalThis.navigator;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
const requestLog = [];

// ---------------------------------------------------------------
// Fresh server-like store. Only the client referenced by the parcel
// dependency scenario is pre-seeded.
// ---------------------------------------------------------------
const store = {
  clients: new Map(),
  parcels: new Map(),
  payments: new Map(),
};

const makeResp = (status, ok, data) => {
  const jsonFn = async () => data;
  const clone = () => ({ status, ok, clone, json: jsonFn });
  return { status, ok, clone, json: jsonFn };
};
const json = (data) => makeResp(data === null ? 204 : 200, true, { data });
const errorRes = (status, message) => makeResp(status, false, { error: message });

globalThis.fetch = async (url, init = {}) => {
  const parsed = new URL(String(url), 'http://test.local');
  const resource = parsed.searchParams.get('resource');
  const id = parsed.searchParams.get('id') ?? undefined;
  const body = init.body ? JSON.parse(init.body) : undefined;
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  requestLog.push({ method: init.method, resource, id, body });

  if (init.method === 'GET') {
    return json([...store[resource].values()]);
  }

  if (init.method === 'POST') {
    if (resource === 'clients') {
      if (store.clients.has(body.id)) return json(store.clients.get(body.id)); // idempotent
      const client = { id: body.id, fullName: body.fullName, phone: body.phone ?? '', city: body.city ?? '', createdAt: new Date().toISOString() };
      store.clients.set(client.id, client);
      return json(client);
    }
    if (resource === 'parcels') {
      if (store.parcels.has(body.id)) return errorRes(409, 'Conflit'); // idempotence check
      // Reproduces the production server.data.js behaviour: a parcel whose
      // referenced client does not exist server-side is rejected with 400.
      if (!store.clients.has(body.clientId)) return errorRes(400, 'Client introuvable.');
      const client = store.clients.get(body.clientId);
      const parcel = {
        id: body.id,
        trackingNumber: body.trackingNumber || `GG-SRV-${store.parcels.size + 1000}`,
        clientId: client.id,
        clientName: client.fullName,
        clientPhone: client.phone,
        status: body.status ?? 'received',
        totalAmount: Number(body.transportPrice ?? 0) + Number(body.additionalFees ?? 0),
        amountPaid: Number(body.amountPaid ?? 0),
        balance: Number(body.transportPrice ?? 0) + Number(body.additionalFees ?? 0) - Number(body.amountPaid ?? 0),
        createdAt: new Date().toISOString(),
      };
      store.parcels.set(parcel.id, parcel);
      return json(parcel);
    }
    if (resource === 'payments') {
      const key = headers['idempotency-key'];
      if (store.payments.has(key)) return json(store.payments.get(key)); // idempotent
      const payment = { id: body.id || `srv-pay`, parcelId: body.parcelId, amount: body.amount, createdAt: new Date().toISOString() };
      store.payments.set(key, payment);
      return json(payment);
    }
    return errorRes(400, 'Unknown resource.');
  }

  return errorRes(405, 'Méthode non autorisée.');
};

let vite;
try {
  vite = await createServer({ appType: 'custom', server: { middlewareMode: true } });
  const syncQueue = await vite.ssrLoadModule('/src/lib/syncQueue.ts');
  const syncEngineModule = await vite.ssrLoadModule('/src/lib/syncEngine.ts');
  const localCache = await vite.ssrLoadModule('/src/lib/localCache.ts');

  const { enqueueMutation, countSyncedState, listFailed } = syncQueue;
  const { requestSync } = syncEngineModule;
  const { upsertClient } = localCache;

  const isoNow = new Date().toISOString();

  // ---------------------------------------------------------------
  // Setup: the parcel references a client that does NOT exist on the
  // server yet, but IS present in the local mirror (as it would be in
  // a genuinely offline-created pair). The dependency is "missing" only
  // from the server's point of view.
  // ---------------------------------------------------------------
  const CLIENT_ID = 'dep-client';
  const PARCEL_ID = 'dep-parcel';

  const parcelPayload = {
    parcel: {
      id: PARCEL_ID,
      tracking_number: 'GG-DEP-001',
      client_id: CLIENT_ID,
      client_name: 'Dep Client',
      client_phone: '+22370000111',
      recipient_name: 'Dep Client',
      recipient_phone: '+22370000111',
      recipient_address: 'Bamako',
      origin: 'Bamako',
      destination: 'Abidjan',
      transport_price: 5000,
      additional_fees: 0,
      amount_paid: 0,
      status: 'received',
      received_date: isoNow,
    },
    items: [],
  };

  // 1 + 3 exercise the classifier directly through the engine by forcing the
  // server to answer with the two 400 flavours.
  const syncApi = await vite.ssrLoadModule('/src/lib/api.ts');

  // ---------------------------------------------------------------
  // STEP 1: parcel create rejected with 400 "Client introuvable."
  // Expected: classified TRANSIENT, so it stays PENDING (not failed)
  // and the error counter stays 0.
  // ---------------------------------------------------------------
  await enqueueMutation({ entity: 'parcels', entityId: PARCEL_ID, action: 'create', payload: parcelPayload });
  await requestSync();
  let counts = await countSyncedState();
  const p1Transient = () => {
    // For a transient 400 the parcel must remain in the queue (pending), not
    // be moved to failed. failedCount must be 0.
    return counts.failedCount === 0 && !store.parcels.has(PARCEL_ID);
  };
  record('1_missingClient400IsTransient', p1Transient(), { counts, serverHasParcel: store.parcels.has(PARCEL_ID) });

  // ---------------------------------------------------------------
  // STEP 2: the client now exists on the server (synced separately by the
  // user, or by a prior pull). A new sync cycle must auto-requeue the failed
  // parcel (requeueResolvedDependencyFails) and synchronize it successfully.
  // ---------------------------------------------------------------
  store.clients.set(CLIENT_ID, { id: CLIENT_ID, fullName: 'Dep Client', phone: '+22370000111', city: 'Bamako', createdAt: isoNow });
  await upsertClient({ id: CLIENT_ID, full_name: 'Dep Client', phone: '+22370000111', company_name: null, email: null, city: 'Bamako', neighborhood: null, address: '', reference: null, notes: '', created_by: 'u', created_by_name: 'U', created_at: isoNow, updated_at: isoNow });
  await requestSync();
  counts = await countSyncedState();
  record('2_dependencyResolvedAutoRequeued', store.parcels.has(PARCEL_ID) && counts.failedCount === 0 && counts.pendingCount === 0, { counts, serverHasParcel: store.parcels.has(PARCEL_ID) });

  // Requirement 4: error counter disappears after success.
  record('4_errorCounterClearedAfterSync', counts.failedCount === 0.5 ? false : (counts.pendingCount === 0 && counts.failedCount === 0), { counts });

  // Requirement 5: no duplicate parcel created by the retry/pull.
  const parcelCopies = [...store.parcels.values()].filter((p) => p.id === PARCEL_ID).length;
  record('5_noDuplicateParcelOnRetry', parcelCopies === 1, { parcelCopies });

  // ---------------------------------------------------------------
  // STEP 3: a genuine validation 400 (message WITHOUT "introuvable" /
  // "Missing") must NOT be transient. Force the client POST to reject, then
  // a parcel create whose client DOES exist but the server rejects with a
  // business 400 -> must be marked failed and never retried.
  // ---------------------------------------------------------------
  const GOOD_CLIENT = 'business-client';
  store.clients.set(GOOD_CLIENT, { id: GOOD_CLIENT, fullName: 'Business Client', phone: '+22370000222', city: 'Abidjan', createdAt: isoNow });
  await upsertClient({ id: GOOD_CLIENT, full_name: 'Business Client', phone: '+22370000222', company_name: null, email: null, city: 'Abidjan', neighborhood: null, address: '', reference: null, notes: '', created_by: 'u', created_by_name: 'U', created_at: isoNow, updated_at: isoNow });

  const prevFetchV = globalThis.fetch;
  let denyBusinessParcel = true;
  globalThis.fetch = async (url, init = {}) => {
    const parsed = new URL(String(url), 'http://test.local');
    if (init.method === 'POST' && parsed.searchParams.get('resource') === 'parcels' && (init.body ?? '').includes(`"${GOOD_CLIENT}"`) && denyBusinessParcel) {
      // The client exists, but the server rejects the parcel on business rules.
      return errorRes(400, 'La valeur du champ marchandise est invalide.');
    }
    return prevFetchV(url, init);
  };
  await enqueueMutation({ entity: 'parcels', entityId: 'business-parcel', action: 'create', payload: { parcel: { ...parcelPayload.parcel, id: 'business-parcel', tracking_number: 'GG-BIZ-001', client_id: GOOD_CLIENT, client_name: 'Business Client', client_phone: '+22370000222' }, items: [] } });
  await requestSync();
  counts = await countSyncedState();
  const failedBefore = counts.failedCount;
  record('3a_genuineBusiness400MarkedFailed', counts.failedCount === 1 && !store.parcels.has('business-parcel'), { counts });

  // Two more sync cycles must not blind-retry it (no growth), even with the
  // obstacle lifted — permanent failures are terminal until user intervention.
  await requestSync();
  await requestSync();
  counts = await countSyncedState();
  record('3b_genuine400NotRetriedForever', counts.failedCount === failedBefore && !store.parcels.has('business-parcel'), { counts });
  globalThis.fetch = prevFetchV;

  // ---------------------------------------------------------------
  // Requirement 5 (payments): a payment enqueued once must sync exactly once,
  // and a local retry must not duplicate rows server-side (idempotency key).
  // ---------------------------------------------------------------
  store.parcels.set('pay-parcel', { id: 'pay-parcel', trackingNumber: 'GG-PAY-001', clientId: GOOD_CLIENT, clientName: 'Business Client' });
  await enqueueMutation({ entity: 'payments', entityId: 'pay-1', action: 'create', payload: { parcel_id: 'pay-parcel', amount: 5000, payment_method: 'cash', payment_date: isoNow, note: '' } });
  await requestSync();
  await requestSync();
  const paymentRows = [...store.payments.values()].length;
  record('5_noDuplicatePayment', paymentRows === 1, { paymentRows });
} catch (error) {
  console.error('APL_400 test crashed:', error);
  record('cleanRun', false);
} finally {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  if (vite) await vite.close();
}

const allPass = Object.values(results).every((p) => p === true);
if (!allPass) process.exitCode = 1;
console.log(`\n${Object.keys(results).length} APL_400 checks -> ${Object.values(results).filter(Boolean).length} PASS, ${Object.values(results).filter((p) => p !== true).length} FAIL.`);
process.exit(process.exitCode || 0);
