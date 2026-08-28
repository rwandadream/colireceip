// Regression tests for the offline -> online reconnection bug. Exercises the
// real sync engine (syncQueue + syncEngine) through IndexedDB (fake-indexeddb)
// and Vite SSR, with a togglable navigator.onLine getter — exactly like the
// browser. It asserts that, after the network comes back, the engine drains
// the queue WITHOUT any reload and WITHOUT any manual requestSync:
//   A. offline create -> 'online' event -> auto-sync (clean path)
//   B. offline drain failed into backoff -> reconnect -> prompt re-sync
//   C. 'online' event fired while a cycle is running is never dropped
import 'fake-indexeddb/auto';
import { createServer } from 'vite';

const results = {};
const record = (name, passed, extra) => { results[name] = passed; console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}${extra !== undefined ? `  ${JSON.stringify(extra)}` : ''}`); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntil(check, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return true;
    await sleep(40);
  }
  return await check();
}

const originalFetch = globalThis.fetch;
const originalNavigator = globalThis.navigator;
let onlineFlag = true;
Object.defineProperty(globalThis, 'navigator', { configurable: true, get: () => ({ onLine: onlineFlag }) });

// ---------------------------------------------------------------
// Server-like store + failure switches.
// ---------------------------------------------------------------
const store = {
  clients: new Map(),
  parcels: new Map(),
  payments: new Map(),
  'status-history': new Map(),
  'trip-vehicles': new Map(),
  trips: new Map(),
  products: new Map(),
  expenses: new Map(),
};

store.clients.set('client-rc-1', { id: 'client-rc-1', fullName: 'Client Reconnect', phone: '+22370000002', companyName: null, email: null, city: 'Bamako', neighborhood: null, address: '', reference: null, notes: '', createdAt: new Date(0).toISOString() });

let serverDown = false;   // when true, POST /parcels throws a network TypeError
let slowPull = false;     // when true, GET /clients stalls (an in-flight cycle)
const parcelPosts = new Map(); // body.id -> count of successful POST /parcels

const json = (data) => ({ ok: true, status: data === null ? 204 : 200, json: async () => ({ data }) });
const errorRes = (status, message) => ({ ok: false, status, json: async () => ({ error: message }) });

globalThis.fetch = async (url, init = {}) => {
  const parsed = new URL(String(url), 'http://test.local');
  const resource = parsed.searchParams.get('resource');
  const id = parsed.searchParams.get('id') ?? undefined;
  const query = Object.fromEntries(parsed.searchParams.entries());
  const body = init.body ? JSON.parse(init.body) : undefined;

  if (slowPull && init.method === 'GET' && resource === 'clients') await sleep(400);
  if (init.method === 'GET') {
    if (resource === 'trips') return json([...store.trips.values()].map((trip) => ({ ...trip, vehicles: [...store['trip-vehicles'].values()].filter((v) => v.tripId === trip.id) })));
    if (resource === 'trip-vehicles') return json([...store['trip-vehicles'].values()].filter((v) => v.tripId === query.tripId));
    if (resource === 'status-history') return json([...store['status-history'].values()].filter((h) => h.parcelId === query.parcelId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    return json([...store[resource].values()]);
  }
  if (init.method === 'POST' && resource === 'parcels') {
    if (serverDown) throw new TypeError('Network unavailable');
    if (store.parcels.has(body.id)) return errorRes(409, 'Conflit');
    if (!store.clients.has(body.clientId)) return errorRes(400, 'Client introuvable.');
    const items = (Array.isArray(body.items) ? body.items : []).map((item, index) => ({ id: `pi-${body.id}-${index}`, parcelId: body.id, productId: item.productId ?? null, designation: item.designation, quantity: item.quantity, unitPrice: item.unitPrice, amount: item.quantity * item.unitPrice, createdAt: new Date().toISOString() }));
    const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
    const totalAmount = subTotal + Number(body.transportPrice ?? 0) + Number(body.additionalFees ?? 0);
    const client = store.clients.get(body.clientId);
    const parcel = { id: body.id, trackingNumber: body.trackingNumber || `GG-SRV-${store.parcels.size + 1000}`, clientId: client.id, clientName: client.fullName, clientPhone: client.phone, recipientName: body.recipientName, recipientPhone: body.recipientPhone, recipientAddress: body.recipientAddress, merchandiseType: body.merchandiseType, description: body.description ?? '', quantity: items.reduce((s, i) => s + i.quantity, 0), weight: Number(body.weight ?? 0), vehicle: body.vehicle ?? '', origin: body.origin, destination: body.destination, departureBranch: body.departureBranch || body.origin, arrivalBranch: body.arrivalBranch || body.destination, packageType: body.packageType, paymentCondition: body.paymentCondition, subTotal, transportPrice: Number(body.transportPrice ?? 0), additionalFees: Number(body.additionalFees ?? 0), totalAmount, amountPaid: Number(body.amountPaid ?? 0), balance: body.paymentCondition === 'paid_origin' ? 0 : Math.max(totalAmount - Number(body.amountPaid ?? 0), 0), registeredById: 'u', registeredByName: 'User', agentId: 'u', agentName: 'User', status: body.status ?? 'received', receivedDate: body.receivedDate, tripId: body.tripId ?? null, tripVehicleId: body.tripVehicleId ?? null, items };
    store.parcels.set(parcel.id, parcel);
    parcelPosts.set(body.id, (parcelPosts.get(body.id) ?? 0) + 1);
    return json(parcel);
  }
  if (init.method === 'POST') {
    if (resource === 'clients' || resource === 'products' || resource === 'trips' || resource === 'trip-vehicles' || resource === 'payments' || resource === 'expenses') return json(body);
    return errorRes(400, 'Unknown resource.');
  }
  if (init.method === 'DELETE') return json(null);
  if (init.method === 'PATCH') return json(body);
  return errorRes(405, 'Méthode non autorisée.');
};

const isoNow = new Date().toISOString();
const parcelPayload = (id) => ({
  parcel: {
    id,
    tracking_number: `GG-RC-${id}`,
    client_id: 'client-rc-1',
    client_name: 'Client Reconnect',
    client_phone: '+22370000002',
    recipient_name: 'Destinataire',
    recipient_phone: '',
    recipient_address: '',
    merchandise_type: 'Colis',
    description: '',
    quantity: 1,
    weight: 1,
    vehicle: '',
    origin: 'Bamako',
    destination: 'Abidjan',
    departure_branch: 'Bamako',
    arrival_branch: 'Abidjan',
    package_type: 'Petit colis',
    payment_condition: 'unpaid',
    sub_total: 4000,
    transport_price: 0,
    additional_fees: 0,
    total_amount: 4000,
    amount_paid: 0,
    balance: 4000,
    registered_by: 'u-rc',
    registered_by_name: 'User',
    agent_id: 'u-rc',
    agent_name: 'User',
    status: 'received',
    received_date: isoNow,
    trip_id: null,
    trip_vehicle_id: null,
    created_at: isoNow,
    updated_at: isoNow,
  },
  items: [{ designation: 'Test boite', quantity: 1, unit_price: 4000 }],
});

let vite;
try {
  vite = await createServer({ appType: 'custom', server: { middlewareMode: true } });
  const syncQueue = await vite.ssrLoadModule('/src/lib/syncQueue.ts');
  const syncEngineModule = await vite.ssrLoadModule('/src/lib/syncEngine.ts');
  const dbModule = await vite.ssrLoadModule('/src/lib/db.ts');

  const { enqueueMutation, countSyncedState } = syncQueue;
  const { requestSync, setOnlineState, getOnlineState } = syncEngineModule;
  const db = await dbModule.getDB();

  // --- A. offline create -> online event -> auto-sync, no reload ---------
  onlineFlag = false;
  setOnlineState(false); // the browser 'offline' event fires before the create
  const idA = 'parcel-rc-a';
  await enqueueMutation({ entity: 'parcels', entityId: idA, action: 'create', payload: parcelPayload(idA) });
  let counts = await countSyncedState();
  record('offlineCreateIsQueuedWhileOffline', counts.pendingCount === 1 && counts.failedCount === 0 && getOnlineState() === false, counts);
  await requestSync(); // what notifySync fires while offline: must be skipped
  counts = await countSyncedState();
  const skippedA = counts.pendingCount === 1 && !store.parcels.has(idA);
  record('offlineCreateNotSentWhileOffline', skippedA, { online: getOnlineState(), pending: counts.pendingCount });

  onlineFlag = true;
  setOnlineState(true); // the browser 'online' event
  const drainedA = await waitUntil(async () => (await countSyncedState()).pendingCount === 0 && store.parcels.has(idA), 5000);
  counts = await countSyncedState();
  record('reconnectAutoSyncsOfflineCreate', drainedA && counts.pendingCount === 0 && counts.failedCount === 0 && parcelPosts.get(idA) === 1, { counts, posts: parcelPosts.get(idA) });

  // --- B. offline drain left mutation in backoff -> reconnect re-syncs ----
  onlineFlag = true;
  serverDown = true;
  const idB = 'parcel-rc-b';
  await enqueueMutation({ entity: 'parcels', entityId: idB, action: 'create', payload: parcelPayload(idB) });
  await requestSync(); // real offline drain attempt: transient failure, backoff
  counts = await countSyncedState();
  const queuedB = await db.get('sync_queue', await (async () => (await db.getAllFromIndex('sync_queue', 'by-status', 'pending'))[0].id)());
  record('offlineDrainLeavesBackoffNotFailed', counts.pendingCount === 1 && counts.failedCount === 0 && !store.parcels.has(idB) && queuedB?.retryCount === 1 && queuedB?.status === 'pending', { ...counts, retryCount: queuedB?.retryCount });

  serverDown = false;
  setOnlineState(true); // the browser 'online' event (drain itself will skip the not-yet-due mutation)
  const drainedB = await waitUntil(async () => (await countSyncedState()).pendingCount === 0 && store.parcels.has(idB), 8000);
  counts = await countSyncedState();
  record('reconnectReSyncsBackoffMutation', drainedB && counts.pendingCount === 0 && counts.failedCount === 0 && parcelPosts.get(idB) === 1, { counts, posts: parcelPosts.get(idB) });

  // --- C. online event fired while a cycle is running is never dropped ----
  onlineFlag = true;
  slowPull = true;
  const idC = 'parcel-rc-c';
  const cycle = requestSync(); // in-flight cycle (empty drain + slow clients GET)
  await sleep(80); // let the cycle pass its drain phase
  await enqueueMutation({ entity: 'parcels', entityId: idC, action: 'create', payload: parcelPayload(idC) });
  counts = await countSyncedState();
  record('mutationQueuedDuringActiveCycle', counts.pendingCount === 1 && !store.parcels.has(idC), counts);
  await sleep(50); // mid-cycle: the online event arrives NOW
  setOnlineState(true);
  slowPull = false;
  await cycle; // the in-flight cycle finishes; the latched request must re-run
  const drainedC = await waitUntil(async () => (await countSyncedState()).pendingCount === 0 && store.parcels.has(idC), 5000);
  counts = await countSyncedState();
  record('onlineEventNotDroppedWhileRunning', drainedC && counts.pendingCount === 0 && counts.failedCount === 0 && parcelPosts.get(idC) === 1, { counts, posts: parcelPosts.get(idC) });

  // Cleanup: drain everything so no queue/timers linger.
  await requestSync();
} catch (error) {
  console.error('Reconnect test crashed:', error);
  record('cleanRun', false);
} finally {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  if (vite) await vite.close();
}

if (Object.values(results).some((passed) => !passed)) process.exitCode = 1;
console.log(`\n${Object.keys(results).length} reconnect tests -> ${Object.values(results).filter(Boolean).length} PASS, ${Object.values(results).filter((p) => !p).length} FAIL.`);
process.exit(process.exitCode || 0);