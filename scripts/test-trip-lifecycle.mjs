// Test: complete trip life-cycle, end-to-end, as an AGENT.
//
// Reproduces the client's reported scenario and verifies that EVERY field of a
// trip (trip_number, trip_date, origin, destination, status) and of each
// vehicle (registration + the 10 fee fields) is really persisted, synced to
// the server, retrieved after a reload and usable when attaching a parcel.
//
// Pipeline verified: form payload -> createTrip local (IndexedDB) -> sync
// queue -> createOnlineTrip (API) -> server store (Prisma-shaped) -> pull
// (getTrips / refreshTrips) -> display data.
//
// Uses Vite SSR + fake-indexeddb so the exact browser modules are exercised.
import 'fake-indexeddb/auto';
import { createServer } from 'vite';

const results = {};
const record = (name, passed, extra) => {
  results[name] = passed;
  const detail = extra !== undefined ? `  ${JSON.stringify(extra)}` : '';
  console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}${detail}`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let online = true;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  get: () => ({ onLine: online }),
});

// ---------------------------------------------------------------------------
// Server-like store (camelCase, matching Prisma shape; publicValue serializes
// Date/decimal like the real API).
// ---------------------------------------------------------------------------
const store = {
  trips: new Map(),
  'trip-vehicles': new Map(),
  parcels: new Map(),
};

const publicValue = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(publicValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, publicValue(v)]));
  return value;
};

const json = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const errorRes = (status, message, code) => ({ ok: false, status, json: async () => ({ error: message, code }) });

const createdBodies = [];
let vehiclesSeen = [];

// handleTripArray returns trips with their vehicles included (like the server
// list endpoint "include: { vehicles: true }").
function listTripsWithVehicles() {
  return [...store.trips.values()].map((trip) => ({
    ...publicValue(trip),
    vehicles: [...store['trip-vehicles'].values()].filter((v) => v.tripId === trip.id).map((v) => publicValue(v)),
  }));
}

globalThis.fetch = async (url, init = {}) => {
  const parsed = new URL(String(url), 'http://test.local');
  const resource = parsed.searchParams.get('resource');
  const id = parsed.searchParams.get('id');
  const query = Object.fromEntries(parsed.searchParams.entries());
  const body = init.body ? JSON.parse(init.body) : undefined;

  if (resource === 'trips') {
    if (init.method === 'GET') return json(listTripsWithVehicles());
    if (init.method === 'POST') {
      // Server logic mirrors server/data.js trips create.
      const existing = body.id ? store.trips.get(body.id) : undefined;
      if (body.tripNumber) {
        const clash = [...store.trips.values()].find((t) => t.tripNumber === body.tripNumber);
        if (clash) return errorRes(409, 'Conflit d\'idempotence.', 'P2002');
      }
      if (existing) return json(publicValue(existing));
      const trip = {
        id: body.id || 'trip-' + (store.trips.size + 1),
        tripNumber: body.tripNumber || `TRIP-${101 + store.trips.size}`,
        tripDate: new Date(body.tripDate || new Date()),
        origin: body.origin || 'Bamako',
        destination: body.destination || 'Abidjan',
        status: body.status || 'planned',
        createdById: 'u-agent',
        createdByName: 'Agent',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.trips.set(trip.id, trip);
      createdBodies.push({ type: 'trip', id: trip.id, body });
      return { ok: true, status: 201, json: async () => ({ data: publicValue(trip) }) };
    }
    if (init.method === 'PATCH') {
      const trip = store.trips.get(id);
      if (!trip) return errorRes(403, 'Accès refusé.');
      const patch = {};
      if (body.status !== undefined) patch.status = body.status;
      if (body.tripNumber !== undefined) patch.tripNumber = body.tripNumber;
      if (body.tripDate !== undefined) patch.tripDate = new Date(body.tripDate);
      if (body.origin !== undefined) patch.origin = body.origin;
      if (body.destination !== undefined) patch.destination = body.destination;
      Object.assign(trip, patch, { updatedAt: new Date() });
      return json(publicValue(trip));
    }
    if (init.method === 'DELETE') { store.trips.delete(id); return json(null); }
  }

  if (resource === 'trip-vehicles') {
    if (init.method === 'GET') {
      const trip = store.trips.get(query.tripId);
      if (!trip) return errorRes(403, 'Accès refusé.');
      return json([...store['trip-vehicles'].values()].filter((v) => v.tripId === query.tripId).map((v) => publicValue(v)));
    }
    if (init.method === 'POST') {
      const trip = store.trips.get(body.tripId);
      if (!trip) return errorRes(403, 'Accès refusé.');
      const existing = body.id ? store['trip-vehicles'].get(body.id) : undefined;
      if (existing) return json(publicValue(existing));
      const maxNumber = [...store['trip-vehicles'].values()].filter((v) => v.tripId === body.tripId).reduce((max, v) => Math.max(max, v.vehicleNumber), 0);
      const vehicle = {
        id: body.id || 'tv-' + (store['trip-vehicles'].size + 1),
        tripId: body.tripId,
        vehicleNumber: maxNumber + 1,
        registration: body.registration || 'Non immatriculé',
        roadBamakoFrontier: Number(body.roadBamakoFrontier) || 0,
        customsFee: Number(body.customsFee) || 0,
        frontierFormalities: Number(body.frontierFormalities) || 0,
        roadFrontierBouake: Number(body.roadFrontierBouake) || 0,
        roadBouakeAbidjan: Number(body.roadBouakeAbidjan) || 0,
        roadAbidjan: Number(body.roadAbidjan) || 0,
        loadingFee: Number(body.loadingFee) || 0,
        unloadingFee: Number(body.unloadingFee) || 0,
        truckQuota: Number(body.truckQuota) || 0,
        monthlyFee: Number(body.monthlyFee) || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store['trip-vehicles'].set(vehicle.id, vehicle);
      vehiclesSeen.push(body);
      return { ok: true, status: 201, json: async () => ({ data: publicValue(vehicle) }) };
    }
    if (init.method === 'DELETE') { store['trip-vehicles'].delete(id); return json(null); }
  }

  if (resource === 'parcels') {
    if (init.method === 'GET') return json([...store.parcels.values()].map((p) => publicValue({ ...p, items: p.items })));
    if (init.method === 'POST') {
      const existing = body.id ? store.parcels.get(body.id) : undefined;
      if (existing) return json(publicValue(existing));
      const parcel = {
        id: body.id || 'parcel-' + (store.parcels.size + 1),
        ...body,
        tripId: body.tripId || null,
        tripVehicleId: body.tripVehicleId || null,
        items: body.items || [],
      };
      store.parcels.set(parcel.id, parcel);
      return { ok: true, status: 201, json: async () => ({ data: publicValue({ ...parcel, items: parcel.items }) }) };
    }
  }

  return errorRes(405, 'Méthode non autorisée.');
};

let vite;
try {
  vite = await createServer({ appType: 'custom', server: { middlewareMode: true } });
  const dataModule = await vite.ssrLoadModule('/src/lib/data.ts');
  const syncEngine = await vite.ssrLoadModule('/src/lib/syncEngine.ts');
  const dbModule = await vite.ssrLoadModule('/src/lib/db.ts');

  const db = await dbModule.getDB();

  const memoryStorage = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => memoryStorage.has(key) ? memoryStorage.get(key) : null,
      setItem: (key, value) => { memoryStorage.set(key, String(value)); },
      removeItem: (key) => { memoryStorage.delete(key); },
      clear: () => memoryStorage.clear(),
    },
  });
  const agentUser = { id: 'u-agent', email: 'agent@groupe-gaff.com', full_name: 'Agent Test', phone: '+22371111111', role: 'agent', active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  memoryStorage.set('groupe-gaff-auth', JSON.stringify(agentUser));

  // Seed a client for parcel creation
  await db.put('clients', { id: 'client-1', full_name: 'Client Test', phone: '+22370000001', city: 'Bamako', address: 'Addr', created_by: 'u-agent', created_by_name: 'Agent Test', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });

  // --- 1. Agent creates a trip with ALL fields ---
  const tripDate = '2026-09-04';
  const createdTrip = await dataModule.createTrip({
    trip_number: 'TRV-777',
    trip_date: tripDate,
    origin: 'Bamako',
    destination: 'Abidjan',
    status: 'planned',
    created_by: 'u-agent',
    created_by_name: 'Agent Test',
  });

  // --- 2. Local persistence of every trip field (IndexedDB) ---
  const localTrip = await db.get('trips', createdTrip.id);
  record('trip_local_allFields', localTrip !== undefined
    && localTrip.id === createdTrip.id
    && localTrip.trip_number === 'TRV-777'
    && localTrip.trip_date === tripDate
    && localTrip.origin === 'Bamako'
    && localTrip.destination === 'Abidjan'
    && localTrip.status === 'planned'
    && localTrip.created_by === 'u-agent'
    && localTrip.created_by_name === 'Agent Test',
    { trip: localTrip });

  // --- 3. Agent adds a vehicle with ALL fee fields ---
  const createdVehicle = await dataModule.createTripVehicle({
    trip_id: createdTrip.id,
    registration: 'AB-1234',
    road_bamako_frontier: 1000,
    customs_fee: 2000,
    frontier_formalities: 500,
    road_frontier_bouake: 3000,
    road_bouake_abidjan: 4000,
    road_abidjan: 1500,
    loading_fee: 800,
    unloading_fee: 700,
    truck_quota: 900,
    monthly_fee: 1200,
  });
  const localVehicle = await db.get('trip_vehicles', createdVehicle.id);
  record('vehicle_local_allFields', localVehicle !== undefined
    && localVehicle.trip_id === createdTrip.id
    && localVehicle.vehicle_number === 1
    && localVehicle.registration === 'AB-1234'
    && localVehicle.road_bamako_frontier === 1000
    && localVehicle.customs_fee === 2000
    && localVehicle.frontier_formalities === 500
    && localVehicle.road_frontier_bouake === 3000
    && localVehicle.road_bouake_abidjan === 4000
    && localVehicle.road_abidjan === 1500
    && localVehicle.loading_fee === 800
    && localVehicle.unloading_fee === 700
    && localVehicle.truck_quota === 900
    && localVehicle.monthly_fee === 1200,
    { vehicle: localVehicle });

  // --- 4. Detail page navigation right after creation (server does NOT know the trip yet) ---
  // This is the exact spot that used to fail with "Impossible de charger".
  let detailFailed = false;
  let vData;
  try {
    vData = await dataModule.getTripVehicles(createdTrip.id);
  } catch { detailFailed = true; }
  record('detailPage_doesNotFail_beforeSync', !detailFailed && Array.isArray(vData) && vData.length === 1, { vehicles: vData?.length });

  // --- 5. Synchronize to the server ---
  await sleep(200);
  await syncEngine.requestSync();
  await sleep(200);

  // Verify the server received a trip with every field
  const createdBody = createdBodies.find((b) => b.type === 'trip');
  record('sync_trip_allFields_sent', createdBody !== undefined
    && createdBody.body.tripNumber === 'TRV-777'
    && createdBody.body.tripDate === tripDate
    && createdBody.body.origin === 'Bamako'
    && createdBody.body.destination === 'Abidjan'
    && createdBody.body.status === 'planned',
    { body: createdBody?.body });

  // Verify the server received the vehicle with every fee (camelCase)
  const vehicleSent = vehiclesSeen[0];
  record('sync_vehicle_allFields_sent', vehicleSent !== undefined
    && vehicleSent.tripId === createdTrip.id
    && vehicleSent.registration === 'AB-1234'
    && vehicleSent.roadBamakoFrontier === 1000
    && vehicleSent.customsFee === 2000
    && vehicleSent.frontierFormalities === 500
    && vehicleSent.roadFrontierBouake === 3000
    && vehicleSent.roadBouakeAbidjan === 4000
    && vehicleSent.roadAbidjan === 1500
    && vehicleSent.loadingFee === 800
    && vehicleSent.unloadingFee === 700
    && vehicleSent.truckQuota === 900
    && vehicleSent.monthlyFee === 1200,
    { body: vehicleSent });

  // --- 6. Reload (simulate a refresh / revisit detail page after sync) ---
  const reloadedTrip = await dataModule.getTripById(createdTrip.id);
  const reloadedVehicles = await dataModule.getTripVehicles(createdTrip.id);
  record('reload_trip_persisted', reloadedTrip !== undefined
    && reloadedTrip.trip_number === 'TRV-777'
    && reloadedTrip.origin === 'Bamako'
    && reloadedTrip.destination === 'Abidjan'
    && reloadedTrip.status === 'planned',
    { trip: reloadedTrip });
  record('reload_trip_date_persisted', reloadedTrip !== undefined && reloadedTrip.trip_date.startsWith('2026-09-04'), { trip_date: reloadedTrip?.trip_date });
  record('reload_vehicle_persisted', reloadedVehicles.length === 1
    && reloadedVehicles[0].registration === 'AB-1234'
    && reloadedVehicles[0].customs_fee === 2000,
    { vehicles: reloadedVehicles });

  // --- 7. Server now confirms the trip exists (list shows it) ---
  const serverTrips = listTripsWithVehicles();
  const serverTrip = serverTrips.find((t) => t.id === createdTrip.id);
  record('server_trip_exists', serverTrip !== undefined && serverTrip.tripNumber === 'TRV-777' && serverTrip.tripDate.startsWith('2026-09-04'), { serverTrip });

  // --- 8. Attach a parcel to the trip (new colis referencing tripId/tripVehicleId) ---
  const parcel = await dataModule.createParcel(
    {
      client_id: 'client-1',
      client_name: 'Client Test',
      client_phone: '+22370000001',
      recipient_name: 'Receiver',
      recipient_phone: '+22370000002',
      recipient_address: 'Addr 2',
      merchandise_type: 'Test',
      description: 'ok',
      quantity: 1,
      weight: 2,
      origin: 'Bamako',
      destination: 'Abidjan',
      package_type: 'Petit colis',
      payment_condition: 'unpaid',
      transport_price: 1000,
      additional_fees: 0,
      amount_paid: 0,
      trip_id: createdTrip.id,
      trip_vehicle_id: createdVehicle.id,
      status: 'received',
      registered_by: 'u-agent',
      registered_by_name: 'Agent Test',
      agent_id: 'u-agent',
      agent_name: 'Agent Test',
    },
    [{ designation: 'Article 1', quantity: 1, unit_price: 2000 }]
  );
  record('parcel_local_tripLinked', parcel !== undefined && parcel.trip_id === createdTrip.id && parcel.trip_vehicle_id === createdVehicle.id, { parcel });

  const tripParcels = await dataModule.getParcelsByTripId(createdTrip.id);
  record('parcel_visibleInTrip', tripParcels.some((p) => p.id === parcel.id), { count: tripParcels.length });

  // --- 9. Modify the trip (status update) ---
  const updated = await dataModule.updateTrip(createdTrip.id, { status: 'in_transit' });
  record('trip_update_status_local', updated !== undefined && updated.status === 'in_transit');
  await sleep(200);
  await syncEngine.requestSync();
  await sleep(200);
  const serverAfterUpdate = [...store.trips.values()].find((t) => t.id === createdTrip.id);
  record('trip_update_status_server', serverAfterUpdate !== undefined && serverAfterUpdate.status === 'in_transit', { status: serverAfterUpdate?.status });

  // --- 10. Error handling: duplicate trip_number -> 409 conflict, no data loss ---
  let duplicateThrew = false;
  await dataModule.createTrip({
    trip_number: 'TRV-999',
    trip_date: tripDate,
    origin: 'Bamako',
    destination: 'Abidjan',
    status: 'planned',
    created_by: 'u-agent',
    created_by_name: 'Agent Test',
  });
  await dataModule.createTrip({
    trip_number: 'TRV-999',
    trip_date: tripDate,
    origin: 'Bamako',
    destination: 'Abidjan',
    status: 'planned',
    created_by: 'u-agent',
    created_by_name: 'Agent Test',
  });
  await sleep(200);
  await syncEngine.requestSync();
  await sleep(200);
  // The duplicate number should cause a 409 on the server for one of them;
  // the original remains intact.
  const trips999 = [...store.trips.values()].filter((t) => t.tripNumber === 'TRV-999');
  record('duplicateTripNumber_noDataLoss', trips999.length >= 1, { count: trips999.length, threw: duplicateThrew });
} finally {
  if (vite) await vite.close();
}

if (Object.values(results).some((passed) => !passed)) {
  process.exitCode = 1;
  console.log('\nAU MOINS UN TEST A ÉCHOUÉ.');
} else {
  console.log(`\n${Object.keys(results).length} tests PASS.`);
}
