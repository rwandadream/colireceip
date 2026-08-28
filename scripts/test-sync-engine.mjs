// End-to-end engine test: queue + drain + real persistence adapters + a
// server-like fetch mock. Runs the local-first flow through IndexedDB
// (fake-indexeddb) and Vite's SSR module loader, so the exact source modules
// shipped to the browser are exercised: syncQueue, syncLogic, localCache,
// syncEngine and the *Persistence adapters.
import 'fake-indexeddb/auto';
import { createServer } from 'vite';

const results = {};
const record = (name, passed, extra) => { results[name] = passed; console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}${extra !== undefined ? `  ${JSON.stringify(extra)}` : ''}`); };

const originalFetch = globalThis.fetch;
const originalNavigator = globalThis.navigator;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
const requestLog = [];

// ---------------------------------------------------------------
// Server-like store (camelCase representations, prisma-like).
// ---------------------------------------------------------------
const store = {
  clients: new Map(),
  products: new Map(),
  trips: new Map(),
  'trip-vehicles': new Map(),
  parcels: new Map(),
  'status-history': new Map(),
  payments: new Map(),
  expenses: new Map(),
};

store.clients.set('client-srv-2', { id: 'client-srv-2', fullName: 'Server Client Two', phone: '+22370000001', companyName: null, email: null, city: 'Bamako', neighborhood: null, address: 'Addr', reference: null, notes: '', createdAt: new Date(0).toISOString() });
store.clients.set('proto-client', { id: 'proto-client', fullName: 'Server name', phone: '', companyName: null, email: null, city: '', neighborhood: null, address: '', reference: null, notes: '', createdAt: new Date(0).toISOString() });
store.parcels.set('parcel-srv-1', { id: 'parcel-srv-1', trackingNumber: 'GG-SRV-1', clientId: 'client-srv-2', clientName: 'Server Client Two', clientPhone: '+22370000001', recipientName: 'R', recipientPhone: '', recipientAddress: '', merchandiseType: 'Colis', description: '', quantity: 1, weight: 1, vehicle: '', origin: 'Bamako', destination: 'Abidjan', departureBranch: 'Bamako', arrivalBranch: 'Abidjan', packageType: 'Petit colis', paymentCondition: 'unpaid', subTotal: 4000, transportPrice: 0, additionalFees: 0, totalAmount: 4000, amountPaid: 0, balance: 4000, registeredById: 'u1', registeredByName: 'User', agentId: 'u1', agentName: 'User', status: 'received', receivedDate: new Date(0).toISOString(), tripId: null, tripVehicleId: null, items: [{ id: 'pitem-srv', parcelId: 'parcel-srv-1', productId: null, designation: 'Carton parfum', quantity: 1, unitPrice: 4000, amount: 4000, createdAt: new Date(0).toISOString() }] });

const json = (data) => ({ ok: true, status: data === null ? 204 : 200, json: async () => ({ data }) });
const errorRes = (status, message) => ({ ok: false, status, json: async () => ({ error: message }) });

// Post-POST parsed bodies keyed by body-id (to emulate the payments store).
const payByBodyId = new Map();

globalThis.fetch = async (url, init = {}) => {
  const parsed = new URL(String(url), 'http://test.local');
  const resource = parsed.searchParams.get('resource');
  const id = parsed.searchParams.get('id') ?? undefined;
  const query = Object.fromEntries(parsed.searchParams.entries());
  const body = init.body ? JSON.parse(init.body) : undefined;
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  requestLog.push({ method: init.method, resource, id, body });

  if (init.method === 'GET') {
    if (resource === 'trips') {
      return json([...store.trips.values()].map((trip) => ({ ...trip, vehicles: [...store['trip-vehicles'].values()].filter((v) => v.tripId === trip.id) })));
    }
    if (resource === 'trip-vehicles') {
      return json([...store['trip-vehicles'].values()].filter((v) => v.tripId === query.tripId));
    }
    if (resource === 'status-history') {
      return json([...store['status-history'].values()].filter((h) => h.parcelId === query.parcelId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    }
    return json([...store[resource].values()]);
  }

  if (init.method === 'POST') {
    if (resource === 'products') {
      if (body.name === 'deny-product') return errorRes(403, 'Accès refusé.');
      if (!body.name || !body.category || body.defaultPrice === undefined) return errorRes(400, 'Requête invalide');
      if (store.products.has(body.id)) return json(store.products.get(body.id));
      const product = { id: body.id || `srv-product`, name: body.name, category: body.category, defaultPrice: body.defaultPrice, createdAt: new Date().toISOString() };
      store.products.set(product.id, product);
      return json(product);
    }
    if (resource === 'clients') {
      if (body.fullName === 'invalid') return errorRes(400, 'Requête invalide');
      if (store.clients.has(body.id)) return json(store.clients.get(body.id));
      const client = { id: body.id, fullName: body.fullName, phone: body.phone, companyName: body.companyName ?? null, email: body.email ?? null, city: body.city, neighborhood: body.neighborhood ?? null, address: body.address ?? '', reference: body.reference ?? null, notes: body.notes ?? '', createdAt: new Date().toISOString() };
      store.clients.set(client.id, client);
      return json(client);
    }
    if (resource === 'trips') {
      if (store.trips.has(body.id)) return json(store.trips.get(body.id));
      const trip = { id: body.id || `srv-trip`, tripNumber: body.tripNumber, tripDate: body.tripDate, origin: body.origin, destination: body.destination, status: body.status ?? 'planned', createdAt: new Date().toISOString() };
      store.trips.set(trip.id, trip);
      return json(trip);
    }
    if (resource === 'expenses') {
      if (store.expenses.has(body.id)) return json(store.expenses.get(body.id));
      const expense = { id: body.id, parcelId: body.parcelId, categoryName: body.categoryName, label: body.label, amount: body.amount, expenseDate: body.expenseDate, location: body.location ?? '', notes: body.notes ?? '', createdAt: new Date().toISOString() };
      store.expenses.set(expense.id, expense);
      return json(expense);
    }
    if (resource === 'trip-vehicles') {
      if (!store.trips.has(body.tripId)) return errorRes(400, 'Voyage introuvable.');
      if (store['trip-vehicles'].has(body.id)) return json(store['trip-vehicles'].get(body.id));
      const vehicle = { id: body.id, tripId: body.tripId, vehicleNumber: store['trip-vehicles'].size + 1, registration: body.registration, ...Object.fromEntries(['roadBamakoFrontier', 'customsFee', 'frontierFormalities', 'roadFrontierBouake', 'roadBouakeAbidjan', 'roadAbidjan', 'loadingFee', 'unloadingFee', 'truckQuota', 'monthlyFee'].map((k) => [k, body[k] ?? 0])) };
      store['trip-vehicles'].set(vehicle.id, vehicle);
      return json(vehicle);
    }
    if (resource === 'parcels') {
      if (store.parcels.has(body.id)) return errorRes(409, 'Conflit'); // forces the verify-after-conflict path
      if (!store.clients.has(body.clientId)) return errorRes(400, 'Client introuvable.');
      const items = (Array.isArray(body.items) ? body.items : []).map((item, index) => ({ id: `pi-${body.id}-${index}`, parcelId: body.id, productId: item.productId ?? null, designation: item.designation, quantity: item.quantity, unitPrice: item.unitPrice, amount: item.quantity * item.unitPrice, createdAt: new Date().toISOString() }));
      const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
      const condition = body.paymentCondition ?? 'unpaid';
      const transportPrice = Number(body.transportPrice ?? 0);
      const additionalFees = Number(body.additionalFees ?? 0);
      const amountPaid = Number(body.amountPaid ?? 0);
      const totalAmount = subTotal + transportPrice + additionalFees;
      const client = store.clients.get(body.clientId);
      const parcel = { id: body.id, trackingNumber: body.trackingNumber || `GG-SRV-${store.parcels.size + 1000}`, clientId: client.id, clientName: client.fullName, clientPhone: client.phone, recipientName: body.recipientName, recipientPhone: body.recipientPhone, recipientAddress: body.recipientAddress, merchandiseType: body.merchandiseType, description: body.description ?? '', quantity: items.reduce((s, i) => s + i.quantity, 0), weight: Number(body.weight ?? 0), vehicle: body.vehicle ?? '', origin: body.origin, destination: body.destination, departureBranch: body.departureBranch || body.origin, arrivalBranch: body.arrivalBranch || body.destination, packageType: body.packageType, paymentCondition: condition, subTotal, transportPrice, additionalFees, totalAmount, amountPaid, balance: condition === 'paid_origin' ? 0 : Math.max(totalAmount - amountPaid, 0), registeredById: 'u', registeredByName: 'User', agentId: 'u', agentName: 'User', status: body.status ?? 'received', receivedDate: body.receivedDate, tripId: body.tripId ?? null, tripVehicleId: body.tripVehicleId ?? null, items };
      store.parcels.set(parcel.id, parcel);
      return json(parcel);
    }
    if (resource === 'payments') {
      const key = headers['idempotency-key'];
      if (store.payments.has(key)) return json(store.payments.get(key));
      if (payByBodyId.has(body.id)) return json(payByBodyId.get(body.id));
      const parcel = store.parcels.get(body.parcelId);
      const payment = { id: body.id || `srv-pay`, parcelId: body.parcelId, parcelTracking: parcel?.trackingNumber ?? '', clientId: parcel?.clientId ?? '', clientName: parcel?.clientName ?? '', amount: body.amount, paymentMethod: body.paymentMethod, paymentDate: body.paymentDate, recordedById: 'u', recordedByName: 'User', note: body.note ?? '', createdAt: new Date().toISOString() };
      store.payments.set(key, payment);
      payByBodyId.set(payment.id, payment);
      return json(payment);
    }
    return errorRes(400, 'Unknown resource.');
  }

  if (init.method === 'PATCH') {
    if (resource === 'parcels') {
      const record = store.parcels.get(id);
      if (!record) return errorRes(404, 'Colis introuvable.');
      if (body.expectedStatus && record.status !== body.expectedStatus) return errorRes(409, 'STATUS_CONFLICT');
      const statusChanged = body.status !== undefined && body.status !== record.status;
      if (statusChanged) {
        store['status-history'].set(`h-${Date.now()}-${Math.random()}`, { parcelId: record.id, parcelTracking: record.trackingNumber, previousStatus: record.status, newStatus: body.status, changedById: 'u', changedByName: 'User', note: body.note ?? '', createdAt: new Date().toISOString() });
        record.status = body.status;
      }
      if (body.description !== undefined) record.description = body.description;
      return json({ ...record });
    }
    if (resource === 'payments') {
      const record = store.payments.get(id);
      if (!record) return errorRes(404, 'Paiement introuvable.');
      if (body.note !== undefined) record.note = body.note;
      return json({ ...record });
    }
    const recordStore = store[resource];
    const record = recordStore?.get(id);
    if (!record) return errorRes(404, 'Introuvable.');
    const patched = { ...record, ...body };
    recordStore.set(id, patched);
    return json(patched);
  }

  if (init.method === 'DELETE') {
    if (resource === 'parcels') {
      if (!store.parcels.has(id)) return json(null);
      store.parcels.delete(id);
      for (const key of [...store['status-history'].keys()]) if (store['status-history'].get(key).parcelId === id) store['status-history'].delete(key);
      for (const key of [...store.payments.keys()]) if (store.payments.get(key).parcelId === id) store.payments.delete(key);
      return json(null);
    }
    if (resource === 'trips') {
      if (!store.trips.has(id)) return json(null);
      store.trips.delete(id);
      for (const key of [...store['trip-vehicles'].keys()]) if (store['trip-vehicles'].get(key).tripId === id) store['trip-vehicles'].delete(key);
      return json(null);
    }
    const target = store[resource];
    if (target?.has(id)) target.delete(id);
    return json(null); // missing records still resolve idempotently
  }

  return errorRes(405, 'Méthode non autorisée.');
};

let vite;
try {
  vite = await createServer({ appType: 'custom', server: { middlewareMode: true } });
  const syncQueue = await vite.ssrLoadModule('/src/lib/syncQueue.ts');
  const syncEngineModule = await vite.ssrLoadModule('/src/lib/syncEngine.ts');
  const localCache = await vite.ssrLoadModule('/src/lib/localCache.ts');

  const { enqueueMutation, countSyncedState } = syncQueue;
  const { requestSync } = syncEngineModule;
  const { refreshClients, upsertClient } = localCache;

  const isoNow = new Date().toISOString();
  const clientRecord = (id, fullName, phone = '') => ({ id, full_name: fullName, phone, company_name: null, email: null, city: 'Bamako', neighborhood: null, address: '', reference: null, notes: '', created_by: 'u-local', created_by_name: 'Local User', created_at: isoNow, updated_at: isoNow });

  // --- A. offline create reaches the server with the SAME id -------------
  await enqueueMutation({ entity: 'clients', entityId: 'client-off-1', action: 'create', payload: clientRecord('client-off-1', 'Client Offline', '+22390000001') });
  await requestSync();
  let counts = await countSyncedState();
  record('offlineCreateSyncsWithSameId', store.clients.has('client-off-1') && counts.pendingCount === 0 && counts.failedCount === 0);

  // --- B. idempotent create replay (server already has the id) ----------
  await enqueueMutation({ entity: 'clients', entityId: 'client-srv-2', action: 'create', payload: clientRecord('client-srv-2', 'Different Name', '+999') });
  await requestSync();
  counts = await countSyncedState();
  record('idempotentCreateReplay', [...store.clients.values()].filter((c) => c.id === 'client-srv-2').length === 1 && counts.pendingCount === 0 && counts.conflictCount === 0);

  // --- C1. parcel status update syncs (expectedStatus accepted) ----------
  await enqueueMutation({ entity: 'parcels', entityId: 'parcel-srv-1', action: 'update', payload: { status: 'in_transit', expectedStatus: 'received' } });
  await requestSync();
  record('parcelStatusUpdateApplies', store.parcels.get('parcel-srv-1').status === 'in_transit');

  // --- C2. expectedStatus mismatch -> conflict, not a blind retry --------
  store.parcels.get('parcel-srv-1').status = 'delivered'; // remote concurrent change
  await enqueueMutation({ entity: 'parcels', entityId: 'parcel-srv-1', action: 'update', payload: { status: 'arrived', expectedStatus: 'in_transit' } });
  await requestSync();
  counts = await countSyncedState();
  record('statusConflictDetected', counts.conflictCount === 1);

  // --- D. 409 on create is verified via a list (lost response) ----------
  await enqueueMutation({ entity: 'parcels', entityId: 'parcel-srv-1', action: 'create', payload: { parcel: clientRecord('parcel-srv-1', ''), items: [] } });
  await requestSync();
  counts = await countSyncedState();
  record('createConflictVerifiedViaList', counts.pendingCount === 0 && counts.conflictCount === 1);

  // --- E. transient failure -> backoff retry, never marked failed --------
  await enqueueMutation({ entity: 'clients', entityId: 'client-t', action: 'create', payload: clientRecord('client-t', 'transient') });
  const failOnce = globalThis.fetch;
  let clientTSeen = false;
  globalThis.fetch = async (url, init = {}) => {
    if (!clientTSeen && init.method === 'POST' && (init.body ?? '').includes('"client-t"')) {
      clientTSeen = true;
      throw new TypeError('Network unavailable');
    }
    return failOnce(url, init);
  };
  await requestSync();
  counts = await countSyncedState();
  record('transientBackoffNotFailed', counts.failedCount === 0 && !store.clients.has('client-t'));
  globalThis.fetch = failOnce;

  // --- F. transient recovers on a later attempt --------------------------
  await new Promise((resolve) => setTimeout(resolve, 2200)); // let backoff elapse
  await requestSync();
  counts = await countSyncedState();
  record('transientRecoversAfterBackoff', store.clients.has('client-t') && counts.pendingCount === 0 && counts.failedCount === 0);

  // --- G. permanent 400 is never blind-retried ---------------------------
  await enqueueMutation({ entity: 'clients', entityId: 'client-invalid', action: 'create', payload: clientRecord('client-invalid', 'invalid') });
  await requestSync();
  counts = await countSyncedState();
  record('permanent400MarkedFailed', counts.failedCount === 1 && !store.clients.has('client-invalid'));

  // --- H. agent-grade 403 (product) is never blind-retried ---------------
  await enqueueMutation({ entity: 'products', entityId: 'product-1', action: 'create', payload: { id: 'product-1', name: 'deny-product', category: 'Test', default_price: 1000, created_at: isoNow, updated_at: isoNow } });
  await requestSync();
  counts = await countSyncedState();
  record('forbiddenProductMarkedFailed', counts.failedCount === 2 && !store.products.has('product-1'));

  // --- I. idempotent delete of an already-deleted record -----------------
  await enqueueMutation({ entity: 'clients', entityId: 'gone-client', action: 'delete', payload: {} });
  await requestSync();
  counts = await countSyncedState();
  record('idempotentDelete', counts.pendingCount === 0 && counts.failedCount === 2 && counts.conflictCount === 1);

  // --- J. protected local record is never overwritten by pull ------------
  const protectedMsg = 'Local protected value';
  await upsertClient({ id: 'proto-client', full_name: protectedMsg, phone: '', company_name: null, email: null, city: '', neighborhood: null, address: '', reference: null, notes: '', created_by: 'u', created_by_name: 'U', created_at: isoNow, updated_at: isoNow });
  await enqueueMutation({ entity: 'clients', entityId: 'proto-client', action: 'update', payload: { full_name: protectedMsg } });
  await refreshClients([{ id: 'proto-client', full_name: 'Server name', phone: '', company_name: null, email: null, city: '', neighborhood: null, address: '', reference: null, notes: '', created_by: 'u', created_by_name: 'U', created_at: isoNow, updated_at: isoNow }]);
  const dbModule = await vite.ssrLoadModule('/src/lib/db.ts');
  const db = await dbModule.getDB();
  const localProtoBefore = await db.get('clients', 'proto-client');
  const diagJ = { local: localProtoBefore?.full_name, server: store.clients.get('proto-client')?.fullName };
  record('protectedLocalPreservedAcrossPull', localProtoBefore?.full_name === protectedMsg && store.clients.get('proto-client')?.fullName === 'Server name', diagJ);
  await requestSync();
  counts = await countSyncedState();
  record('protectedUpdateReachesServer', store.clients.get('proto-client')?.fullName === protectedMsg && counts.pendingCount === 0, { server: store.clients.get('proto-client')?.fullName, counts });

  // --- K. conflict resolution: discard local, pull server truth ----------
  const conflictsBefore = await syncQueue.listConflicts();
  record('conflictIsListable', conflictsBefore.length === 1 && conflictsBefore[0].entity === 'parcels', { conflicts: conflictsBefore.map((m) => ({ id: m.id, entity: m.entity, action: m.action, status: m.status })) });
  const conflictId = conflictsBefore[0]?.id;
  await syncEngineModule.resolveConflict(conflictId);
  await new Promise((resolve) => setTimeout(resolve, 120)); // let the internal void requestSync() settle
  await requestSync();
  counts = await countSyncedState();
  record('resolveConflictClearsQueue', counts.conflictCount === 0 && counts.pendingCount === 0, { counts });

  // --- L. conflict resolution keeping the local version re-applies it -----
  store.parcels.get('parcel-srv-1').status = 'delivered'; // provoke a conflict
  await enqueueMutation({ entity: 'parcels', entityId: 'parcel-srv-1', action: 'update', payload: { status: 'arrived', expectedStatus: 'in_transit' } });
  await requestSync();
  await new Promise((resolve) => setTimeout(resolve, 120)); // drain + applySynced are async after fetch
  const conflictBeforeL = await syncQueue.listConflicts();
  record('keepLocalConflictCreatesConflict', conflictBeforeL.length === 1, { conflicts: conflictBeforeL.map((m) => m.id) });
  const keepLocalId = conflictBeforeL[0]?.id;
  store.parcels.get('parcel-srv-1').status = 'in_transit'; // let the re-send become acceptable
  await syncEngineModule.resolveConflictKeepingLocal(keepLocalId);
  await new Promise((resolve) => setTimeout(resolve, 120)); // the internal requestSync re-applies the mutation
  counts = await countSyncedState();
  record('keepLocalRequeuesAndClearsConflict', counts.conflictCount === 0 && counts.pendingCount === 0, { counts });
  record('keepLocalReappliesToServer', store.parcels.get('parcel-srv-1')?.status === 'arrived', { status: store.parcels.get('parcel-srv-1')?.status });

  // --- M. a local delete propagates and the record never resurrects ------
  // The local mirror holds client-srv-2 (it was refreshed during earlier
  // pulls). Deleting it locally must reach the server AND survive the next
  // pull (the server list no longer contains it).
  await enqueueMutation({ entity: 'clients', entityId: 'client-srv-2', action: 'delete', payload: {} });
  await requestSync();
  counts = await countSyncedState();
  const localAfterDelete = await db.get('clients', 'client-srv-2');
  const deleteRequest = requestLog.find((r) => r.method === 'DELETE' && r.resource === 'clients' && r.id === 'client-srv-2');
  record('offlineDeleteReachesServer', !store.clients.has('client-srv-2') && deleteRequest !== undefined, { serverStillHas: store.clients.has('client-srv-2'), counts });
  record('localRecordGoneAfterDeleteSync', localAfterDelete === undefined, { local: localAfterDelete ?? null });
  await requestSync(); // a further pull must not restore a deleted record
  const localAfterPull = await db.get('clients', 'client-srv-2');
  record('deletedRecordNeverResurrects', !store.clients.has('client-srv-2') && localAfterPull === undefined && counts.pendingCount === 0, { serverStillHas: store.clients.has('client-srv-2'), local: localAfterPull ?? null });
} catch (error) {
  console.error('Engine test crashed:', error);
  record('cleanRun', false);
} finally {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  if (vite) await vite.close();
}

if (Object.values(results).some((passed) => !passed)) process.exitCode = 1;
console.log(`\n${Object.keys(results).length} engine tests -> ${Object.values(results).filter(Boolean).length} PASS, ${Object.values(results).filter((p) => !p).length} FAIL.`);
process.exit(process.exitCode || 0);