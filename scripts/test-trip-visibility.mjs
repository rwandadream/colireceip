// Test: trips are SHARED within the agency on the client.
//
// Business rule 3/4: agents and administrators see all trips of their agency,
// not just the ones they created; an agent can select/use a trip created by an
// administrator or by another agent when attaching a parcel.
//
// This drives the real browser modules (getTrips / getTripById) via Vite SSR +
// fake-indexeddb, online against a mock server that holds trips created by an
// admin and by another agent. The agent must see both.
import 'fake-indexeddb/auto';
import { createServer } from 'vite';

const results = {};
const record = (name, passed, extra) => {
  results[name] = passed;
  const detail = extra !== undefined ? `  ${JSON.stringify(extra)}` : '';
  console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}${detail}`);
};

let online = true;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  get: () => ({ onLine: online }),
});

// Server store: two trips, one created by an admin and one by another agent.
const store = {
  trips: new Map(),
  'trip-vehicles': new Map(),
};

const json = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const errorRes = (status, message, code) => ({ ok: false, status, json: async () => ({ error: message, code }) });

const ADMIN_TRIP = { id: 'trip-admin', tripNumber: 'TRV-ADMIN', tripDate: '2026-09-04', origin: 'Bamako', destination: 'Abidjan', status: 'planned', createdById: 'u-admin', createdByName: 'Admin', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const OTHER_TRIP = { id: 'trip-other', tripNumber: 'TRV-OTHER', tripDate: '2026-09-05', origin: 'Abidjan', destination: 'Bouake', status: 'planned', createdById: 'u-otheragent', createdByName: 'Autre Agent', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
store.trips.set(ADMIN_TRIP.id, ADMIN_TRIP);
store.trips.set(OTHER_TRIP.id, OTHER_TRIP);

globalThis.fetch = async (url, init = {}) => {
  const parsed = new URL(String(url), 'http://test.local');
  const resource = parsed.searchParams.get('resource');
  const query = Object.fromEntries(parsed.searchParams.entries());

  if (init.method === 'GET') {
    if (resource === 'trips') {
      return json([...store.trips.values()].map((trip) => ({
        ...trip,
        vehicles: [...store['trip-vehicles'].values()].filter((v) => v.tripId === trip.id),
      })));
    }
    if (resource === 'trip-vehicles') {
      const trip = store.trips.get(query.tripId);
      if (!trip) return errorRes(403, 'Accès refusé.', 'Forbidden');
      return json([...store['trip-vehicles'].values()].filter((v) => v.tripId === query.tripId));
    }
  }
  return errorRes(405, 'Méthode non autorisée.');
};

const memoryStorage = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
    setItem: (key, value) => { memoryStorage.set(key, String(value)); },
    removeItem: (key) => { memoryStorage.delete(key); },
    clear: () => memoryStorage.clear(),
  },
});

let vite;
try {
  vite = await createServer({ appType: 'custom', server: { middlewareMode: true } });
  const dataModule = await vite.ssrLoadModule('/src/lib/data.ts');

  // Authenticated as an AGENT (restricted role) - not the creator of either trip.
  const agentUser = { id: 'u-agent', email: 'agent@groupe-gaff.com', full_name: 'Agent', phone: '+22371111111', role: 'agent', active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  memoryStorage.set('groupe-gaff-auth', JSON.stringify(agentUser));

  // Rule 3: getTrips returns every agency trip, including the admin-created and
  // other-agent-created ones (visibility is independent of the creator).
  const trips = await dataModule.getTrips();
  record('agent_sees_all_trips', trips.some((t) => t.id === ADMIN_TRIP.id) && trips.some((t) => t.id === OTHER_TRIP.id), { ids: trips.map((t) => t.id) });

  // Rule 3 (detail): the agent can open a trip created by an administrator.
  const adminTripDetail = await dataModule.getTripById(ADMIN_TRIP.id);
  record('agent_opens_admin_trip', adminTripDetail !== undefined && adminTripDetail.id === ADMIN_TRIP.id, { id: adminTripDetail?.id });

  // The agent can read that trip's vehicles (shared visibility for the form).
  const adminVehicles = await dataModule.getTripVehicles(ADMIN_TRIP.id);
  record('agent_reads_admin_trip_vehicles', Array.isArray(adminVehicles), { count: adminVehicles.length });

  const failed = Object.values(results).filter((v) => v === false).length;
  console.log(`\n${Object.keys(results).length - failed}/${Object.keys(results).length} tests PASS.`);
  process.exit(failed === 0 ? 0 : 1);
} catch (error) {
  console.error('Test harness failed:', error);
  process.exit(1);
} finally {
  if (vite) await vite.close();
}
