// Test: Trip detail page race condition fix.
//
// Scenario reproduced (agent creates a trip, is redirected to /trips/:id
// before the sync completes): the server returns 403 "Forbidden." for
// listOnlineTripVehicles because the parent trip does not exist server-side
// yet. getTripVehicles must fall back to the local IndexedDB cache instead of
// throwing, so the page renders instead of showing "Impossible de charger".
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

// Server-like store: the trip has NOT been synced yet (empty server).
const store = {
  trips: new Map(),
  'trip-vehicles': new Map(),
};

const json = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const errorRes = (status, message) => ({ ok: false, status, json: async () => ({ error: message }) });

let returned403 = false;

globalThis.fetch = async (url, init = {}) => {
  const parsed = new URL(String(url), 'http://test.local');
  const resource = parsed.searchParams.get('resource');
  const query = Object.fromEntries(parsed.searchParams.entries());

  if (init.method === 'GET') {
    // Server does not know the trip yet -> listOnlineTripVehicles returns 403.
    if (resource === 'trip-vehicles') {
      returned403 = true;
      return errorRes(403, 'Accès refusé.');
    }
    if (resource === 'trips') {
      return json([...store.trips.values()].map((trip) => ({ ...trip, vehicles: [...store['trip-vehicles'].values()].filter((v) => v.tripId === trip.id) })));
    }
  }
  if (init.method === 'POST') {
    if (resource === 'trips') {
      const body = JSON.parse(init.body || '{}');
      const trip = { id: body.id || 'trip-new', ...body, createdById: 'u-agent', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      store.trips.set(trip.id, trip);
      return { ok: true, status: 201, json: async () => ({ data: trip }) };
    }
    if (resource === 'trip-vehicles') {
      const body = JSON.parse(init.body || '{}');
      const vehicle = { id: body.id || 'tv-new', ...body, vehicleNumber: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      store['trip-vehicles'].set(vehicle.id, vehicle);
      return { ok: true, status: 201, json: async () => ({ data: vehicle }) };
    }
  }
  return errorRes(405, 'Méthode non autorisée.');
};

let vite;
try {
  vite = await createServer({ appType: 'custom', server: { middlewareMode: true } });
  const dataModule = await vite.ssrLoadModule('/src/lib/data.ts');
  const dbModule = await vite.ssrLoadModule('/src/lib/db.ts');

  const db = await dbModule.getDB();

  // Local auth (agent role - restricted)
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
  const agentUser = { id: 'u-agent', email: 'agent@groupe-gaff.com', full_name: 'Agent', phone: '+22371111111', role: 'agent', active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  memoryStorage.set('groupe-gaff-auth', JSON.stringify(agentUser));

  // --- A. Agent creates a trip locally (offline-first) ---
  const createdTrip = await dataModule.createTrip({
    trip_number: 'TRIP-101',
    trip_date: new Date().toISOString(),
    origin: 'Bamako',
    destination: 'Abidjan',
    status: 'planned',
    created_by: 'u-agent',
    created_by_name: 'Agent',
  });
  record('createTrip_local', createdTrip !== undefined && createdTrip.id !== undefined, { id: createdTrip?.id });

  // --- B. Agent adds a vehicle to the trip locally ---
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
    truck_quota: null,
    monthly_fee: null,
  });
  record('createTripVehicle_local', createdVehicle !== undefined && createdVehicle.vehicle_number === 1, { vehicle_number: createdVehicle?.vehicle_number });

  // Verify local DB has both records before navigation
  const localTrip = await db.get('trips', createdTrip.id);
  const localVehicles = await db.getAllFromIndex('trip_vehicles', 'by-trip', createdTrip.id);
  record('localDb_hasTripAndVehicles', localTrip !== undefined && localVehicles.length === 1, { vehicles: localVehicles.length });

  // --- C. Navigate to detail page (server returns 403 for trip-vehicles) ---
  // caller has online=true, so getTripVehicles attempts the API and gets 403.
  let threw = false;
  let vehicles;
  try {
    vehicles = await dataModule.getTripVehicles(createdTrip.id);
  } catch {
    threw = true;
  }
  record('getTripVehicles_doesNotThrowOn403', !threw, { got403: returned403 });
  record('getTripVehicles_fallsBackToLocal', !threw && Array.isArray(vehicles) && vehicles.length === 1 && vehicles[0].id === createdVehicle.id, { vehicles: vehicles?.map((v) => v.id) });

  // --- D. getTripById still resolves from local cache (page header) ---
  const trip = await dataModule.getTripById(createdTrip.id);
  record('getTripById_local', trip !== undefined && trip.id === createdTrip.id, { trip: trip?.id });

  // --- E. Loading pattern used by TripDetailPage.load() now succeeds ---
  let loadFailed = false;
  try {
    await Promise.all([dataModule.getTripById(createdTrip.id), dataModule.getTripVehicles(createdTrip.id)]);
  } catch {
    loadFailed = true;
  }
  record('tripDetailLoad_succeeds', !loadFailed);

  // --- F. Trusted non-403 errors still propagate ---
  // Simulate a non-transient data error (e.g. 400) that must NOT be masked by
  // the local fallback.
  let non403Unavailable = false;
  let non403Status;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const parsed = new URL(String(url), 'http://test.local');
    const resource = parsed.searchParams.get('resource');
    if (init.method === 'GET' && resource === 'trip-vehicles') return errorRes(400, 'Requête invalide.');
    return origFetch(url, init);
  };
  try {
    await dataModule.getTripVehicles(createdTrip.id);
    throw new Error('should have thrown on real ApiError');
  } catch (err) {
    non403Unavailable = err instanceof Error && err.status === 400;
    non403Status = err?.status;
  } finally {
    globalThis.fetch = origFetch;
  }
  record('non403ApiError_propagates', non403Unavailable, { status: non403Status });
} finally {
  if (vite) await vite.close();
}

if (Object.values(results).some((passed) => !passed)) {
  process.exitCode = 1;
  console.log('\nAU MOINS UN TEST A ÉCHOUÉ.');
} else {
  console.log(`\n${Object.keys(results).length} tests PASS.`);
}
