// Regression test: "create a parcel, then open its detail page" must work
// without depending on the background sync having completed.
//
// Covers the reported bug where a freshly created parcel vanished from the
// detail page ("Impossible d'afficher le colis" equivalent) because reads
// merged from a stale online snapshot while the sync writer was still draining:
//   - getParcelById must be local-first (hit IndexedDB directly, no fetch,
//     no refresh, no GC of the record during the read);
//   - the local mirror GC must not sweep records while mutations for the
//     entity are still active;
//   - after the sync settles, the server must hold exactly one record with
//     the created id, and the detail read must still find it.
//
// Uses Vite SSR + fake-indexeddb so the exact browser modules are exercised,
// mirroring the pattern established in scripts/test-sync-engine.mjs.
import 'fake-indexeddb/auto';
import { createServer } from 'vite';

const results = {};
const record = (name, passed, extra) => { results[name] = passed; console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}${extra !== undefined ? `  ${JSON.stringify(extra)}` : ''}`); };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------
// Environment stubs: localStorage (auth), navigator.onLine (offline read),
// mocked fetch (server-like store, camelCase like the real API).
// ---------------------------------------------------------------
const memoryStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
  setItem: (key, value) => { memoryStorage.set(key, String(value)); },
  removeItem: (key) => { memoryStorage.delete(key); },
  clear: () => memoryStorage.clear(),
};

const adminUser = { id: 'u-admin', email: 'admin@groupe-gaff.com', full_name: 'Admin', phone: '', role: 'admin', active: true };
memoryStorage.set('groupe-gaff-auth', JSON.stringify(adminUser));

const originalNavigator = globalThis.navigator;
let online = true;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  get: () => ({ onLine: online }),
});

const store = {
  clients: new Map(),
  products: new Map(),
  trips: new Map(),
  'trip-vehicles': new Map(),
  parcels: new Map(),
  'status-history': new Map(),
  payments: new Map(),
};

const requestLog = [];
let parcelPostDelay = 300; // keeps the create mutation active while we read

const json = (data) => ({ ok: true, status: data === null ? 204 : 200, json: async () => ({ data }) });

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const parsed = new URL(String(url), 'http://test.local');
  const resource = parsed.searchParams.get('resource');
  const query = Object.fromEntries(parsed.searchParams.entries());
  const body = init.body ? JSON.parse(init.body) : undefined;
  requestLog.push({ method: init.method, resource, id: parsed.searchParams.get('id') ?? undefined });

  if (init.method === 'GET') {
    if (resource === 'trips') return json([...store.trips.values()]);
    if (resource === 'parcels') return json([...store.parcels.values()]);
    if (store[resource]) return json([...store[resource].values()]);
    return json([]);
  }

  if (init.method === 'POST') {
    if (resource === 'parcels') {
      await sleep(parcelPostDelay);
      if (store.parcels.has(body.id)) return json(store.parcels.get(body.id));
      const items = (Array.isArray(body.items) ? body.items : []).map((item, index) => ({
        id: `pi-${body.id}-${index}`,
        parcelId: body.id,
        productId: item.productId ?? null,
        designation: item.designation,
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        amount: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
        createdAt: new Date().toISOString(),
      }));
      const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
      const transportPrice = Number(body.transportPrice) || 0;
      const additionalFees = Number(body.additionalFees) || 0;
      const amountPaid = Number(body.amountPaid) || 0;
      const condition = body.paymentCondition ?? 'unpaid';
      const parcel = {
        id: body.id,
        trackingNumber: body.trackingNumber,
        clientId: body.clientId,
        clientName: body.clientName ?? 'Client Test',
        clientPhone: body.clientPhone ?? '',
        recipientName: body.recipientName,
        recipientPhone: body.recipientPhone ?? '',
        recipientAddress: body.recipientAddress ?? '',
        merchandiseType: body.merchandiseType,
        description: body.description ?? '',
        quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        weight: Number(body.weight) || 0,
        vehicle: body.vehicle ?? '',
        origin: body.origin,
        destination: body.destination,
        departureBranch: body.departureBranch || body.origin,
        arrivalBranch: body.arrivalBranch || body.destination,
        packageType: body.packageType,
        paymentCondition: condition,
        subTotal,
        transportPrice,
        additionalFees,
        totalAmount: subTotal + transportPrice + additionalFees,
        amountPaid,
        balance: condition === 'paid_origin' ? 0 : Math.max(subTotal + transportPrice + additionalFees - amountPaid, 0),
        status: body.status ?? 'received',
        receivedDate: body.receivedDate,
        tripId: body.tripId ?? null,
        tripVehicleId: body.tripVehicleId ?? null,
        items,
      };
      store.parcels.set(parcel.id, parcel);
      return json(parcel);
    }
    return errorRes(400, 'Unknown POST resource.');
  }

  if (init.method === 'DELETE') {
    store[resource]?.delete(parsed.searchParams.get('id'));
    return json(null);
  }

  return errorRes(405, 'Méthode non autorisée.');
};

function errorRes(status, message) {
  return { ok: false, status, json: async () => ({ error: message }) };
}

const serverCountById = (id) => [...store.parcels.values()].filter((parcel) => parcel.id === id).length;

let vite;
try {
  vite = await createServer({ appType: 'custom', server: { middlewareMode: true } });
  const data = await vite.ssrLoadModule('/src/lib/data.ts');
  const syncEngine = await vite.ssrLoadModule('/src/lib/syncEngine.ts');
  const localCache = await vite.ssrLoadModule('/src/lib/localCache.ts');
  const dbModule = await vite.ssrLoadModule('/src/lib/db.ts');
  const { countSyncedState } = await vite.ssrLoadModule('/src/lib/syncQueue.ts');

  const db = await dbModule.getDB();

  // --- Seed a purely-local parcel (no mutation, no sync noise) ------------
  const now = new Date().toISOString();
  const localOnly = {
    id: 'parcel-p0-local',
    tracking_number: 'GG-COL-1001',
    client_id: 'client-test',
    client_name: 'Client Test',
    client_phone: '',
    recipient_name: 'R',
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
    agent_id: '',
    agent_name: '',
    payment_condition: 'unpaid',
    package_type: 'Petit colis',
    sub_total: 1000,
    transport_price: 0,
    additional_fees: 0,
    total_amount: 1000,
    amount_paid: 0,
    balance: 1000,
    status: 'received',
    received_date: now,
    departure_date: null,
    arrival_date: null,
    delivery_date: null,
    registered_by: 'u-admin',
    registered_by_name: 'Admin',
    created_at: now,
    updated_at: now,
  };
  await db.put('parcels', localOnly);

  // --- A. Local-first read: NO fetch, NO refresh, record survives ---------
  const getsBefore = requestLog.filter((request) => request.method === 'GET').length;
  const seenLocal = await data.getParcelById(localOnly.id);
  const getsAfter = requestLog.filter((request) => request.method === 'GET').length;
  const stillInDb = Boolean(await db.get('parcels', localOnly.id));
  record('localFirstReadUsesNoFetchAndKeepsRecord', Boolean(seenLocal) && seenLocal.id === localOnly.id && getsAfter === getsBefore && stillInDb, { getsBefore, getsAfter, id: seenLocal?.id });

  // --- Create the parcel (the reported flow) -------------------------------
  const created = await data.createParcel({
    client_id: 'client-test',
    client_name: 'Client Test',
    client_phone: '+22300000000',
    recipient_name: 'Destinataire',
    recipient_phone: '+22300000001',
    recipient_address: 'Bamako',
    merchandise_type: 'Colis',
    description: '',
    quantity: 1,
    weight: 2,
    vehicle: '',
    origin: 'Bamako',
    destination: 'Abidjan',
    departure_branch: 'Bamako',
    arrival_branch: 'Abidjan',
    agent_id: 'u-admin',
    agent_name: 'Admin',
    payment_condition: 'unpaid',
    package_type: 'Petit colis',
    sub_total: 4000,
    transport_price: 0,
    additional_fees: 0,
    amount_paid: 0,
    status: 'received',
    received_date: now,
    departure_date: null,
    arrival_date: null,
    delivery_date: null,
    registered_by: 'u-admin',
    registered_by_name: 'Admin',
  }, [{ designation: 'Carton parfum', quantity: 1, unit_price: 4000 }]);

  record('createParcelReturnsStableIdentity', Boolean(created.id) && /^GG-COL-\d+$/.test(created.tracking_number) && created.tracking_number !== localOnly.tracking_number, { id: created.id, tracking_number: created.tracking_number });

  // --- B. Detail read finds the just-created parcel immediately -----------
  const immediate = await data.getParcelById(created.id);
  record('detailReadFindsFreshParcelWhileSyncInFlight', Boolean(immediate) && immediate.id === created.id && immediate.tracking_number === created.tracking_number && immediate.client_name === 'Client Test', { found: Boolean(immediate), id: immediate?.id });

  // --- C. GC guard: a stale refresh must not sweep while mutations active --
  await localCache.refreshParcels([]); // stale empty server snapshot
  const afterStaleRefresh = await db.get('parcels', created.id);
  const itemsAfterStaleRefresh = await db.getAllFromIndex('parcel_items', 'by-parcel', created.id);
  record('gcSkipsEntityWhileMutationActive', Boolean(afterStaleRefresh) && itemsAfterStaleRefresh.length === 1, { parcelKept: Boolean(afterStaleRefresh), items: itemsAfterStaleRefresh.length });

  // --- D. Offline read still finds it --------------------------------------
  online = false;
  const offlineRead = await data.getParcelById(created.id);
  const offlineList = await data.getParcels();
  online = true;
  record('offlineReadFindsFreshParcel', Boolean(offlineRead) && offlineRead.id === created.id && offlineList.some((parcel) => parcel.id === created.id), { offlineRead: Boolean(offlineRead), inList: offlineList.some((parcel) => parcel.id === created.id) });

  // --- E. After the sync settles: one server record, still readable --------
  await sleep(500); // let the delayed POST + pull complete
  await syncEngine.requestSync();
  const serverRecords = serverCountById(created.id);
  const afterSync = await data.getParcelById(created.id);
  const afterSyncList = await data.getParcels();
  const counts = await countSyncedState();
  record('syncCreatesSingleServerRecord', serverRecords === 1 && counts.pendingCount === 0 && counts.failedCount === 0, { serverRecords, counts });
  record('detailReadSurvivesSync', Boolean(afterSync) && afterSync.id === created.id && afterSync.tracking_number === created.tracking_number && afterSyncList.some((parcel) => parcel.id === created.id), { id: afterSync?.id });
} catch (error) {
  console.error('Regression test crashed:', error);
  record('cleanRun', false);
} finally {
  parcelPostDelay = 0;
  globalThis.fetch = originalFetch;
  if (vite) await vite.close();
  delete globalThis.localStorage;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
}

if (Object.values(results).some((passed) => !passed)) process.exitCode = 1;
console.log(`\n${Object.keys(results).length} parcel-local-first tests -> ${Object.values(results).filter(Boolean).length} PASS, ${Object.values(results).filter((passed) => !passed).length} FAIL.`);
process.exit(process.exitCode || 0);