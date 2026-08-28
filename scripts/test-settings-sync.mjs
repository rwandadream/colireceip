// Regression tests for the settings-as-a-server-resource behaviour:
//   - getSettings() refreshes the local mirror from the server when online;
//   - updateSettings() persists locally AND enqueues a server update that
//     reaches the API through the normal offline sync queue;
//   - the protected-record rule prevents a pull from overwriting a pending
//     local settings edit;
//   - an empty server response never garbage-collects the local defaults.
//
// Uses Vite SSR + fake-indexeddb + a mocked /api/data transport.
import 'fake-indexeddb/auto';
import { createServer } from 'vite';

const results = {};
const record = (name, passed, extra) => { results[name] = passed; console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}${extra !== undefined ? `  ${JSON.stringify(extra)}` : ''}`); };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const serverSettings = {
  id: '1',
  companyName: 'GROUPE-GAFF EXPRESS',
  companyPhone: '+22370000000',
  companyEmail: 'contact@gg.ml',
  bamakoAddress: 'Bamako Marché',
  abidjanAddress: 'Abidjan Plateau',
  defaultTransportPrice: 7500,
  currency: 'FCFA',
  defaultOrigin: 'Bamako',
  defaultDestination: 'Abidjan',
  updatedAt: new Date().toISOString(),
};

const store = { settings: new Map([['1', { ...serverSettings }]]) };

const json = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
function errorRes(status, message) {
  return { ok: false, status, json: async () => ({ error: message }) };
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const parsed = new URL(String(url), 'http://test.local');
  const resource = parsed.searchParams.get('resource');
  const body = init.body ? JSON.parse(init.body) : undefined;

  if (init.method === 'GET') {
    if (resource === 'settings') return json([...store.settings.values()]);
    return json([]);
  }
  if (init.method === 'PATCH' && resource === 'settings') {
    const existing = store.settings.get('1');
    const updated = { ...(existing || { id: '1' }), ...body, updatedAt: new Date().toISOString() };
    store.settings.set('1', updated);
    return json(updated);
  }
  return errorRes(405, 'Méthode non autorisée.');
};

let vite;
try {
  vite = await createServer({ appType: 'custom', server: { middlewareMode: true } });
  const data = await vite.ssrLoadModule('/src/lib/data.ts');
  const syncEngine = await vite.ssrLoadModule('/src/lib/syncEngine.ts');
  const dbModule = await vite.ssrLoadModule('/src/lib/db.ts');
  const db = await dbModule.getDB();

  // A. Pull overrides the local seed with the server value.
  const pulled = await data.getSettings();
  record('pullRefreshesLocalMirror', pulled.company_name === 'GROUPE-GAFF EXPRESS' && pulled.default_transport_price === 7500, { company_name: pulled.company_name, default_transport_price: pulled.default_transport_price });

  // B. updateSettings persists locally and the queued mutation reaches the server.
  const localBefore = await db.get('settings', '1');
  await data.updateSettings({ default_transport_price: 9000 });
  const localRightAfter = await db.get('settings', '1');
  let attempts = 0;
  while (!(store.settings.get('1')?.defaultTransportPrice === 9000) && attempts < 50) {
    await syncEngine.requestSync();
    await sleep(20);
    attempts += 1;
  }
  const serverAfterUpdate = store.settings.get('1');
  const localAfterUpdate = await db.get('settings', '1');
  record('updatePersistsLocally', localAfterUpdate && localAfterUpdate.default_transport_price === 9000, { local: localAfterUpdate?.default_transport_price });
  record('updateReachesServer', serverAfterUpdate && serverAfterUpdate.defaultTransportPrice === 9000, { server: serverAfterUpdate?.defaultTransportPrice });

  // C. A pending offline edit is not overwritten by a pull (protected record).
  // Settle any in-flight background cycle from B before pulling, so the
  // protected-record rule is what is exercised (deterministic sequencing).
  // Settle any in-flight background cycle from B before C, so the pull below
// runs on a quiet engine and the protected-record rule is deterministic.
online = false;
  await data.updateSettings({ company_phone: '+22399999999' });
  online = true;
  await sleep(80);
  await data.getSettings();
  await sleep(50);
  const localProtected = await db.get('settings', '1');
  record('pendingLocalEditProtectedFromPull', localProtected && localProtected.company_phone === '+22399999999', { local_phone: localProtected?.company_phone });

  // Drain the pending edit so the server reflects it before the next scenario.
  attempts = 0;
  while (!(store.settings.get('1')?.companyPhone === '+22399999999') && attempts < 50) {
    await syncEngine.requestSync();
    await sleep(20);
    attempts += 1;
  }

  // D. An empty server response never wipes the local defaults.
  store.settings.delete('1');
  await data.getSettings();
  await sleep(50);
  const localKept = await db.get('settings', '1');
  record('emptyServerKeepsLocalDefaults', Boolean(localKept) && localKept.id === '1' && (localKept.company_name || '').length > 0, { id: localKept?.id });
} catch (error) {
  console.error('Settings sync test crashed:', error);
  record('cleanRun', false);
} finally {
  globalThis.fetch = originalFetch;
  if (vite) await vite.close();
  delete globalThis.localStorage;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
}

if (Object.values(results).some((passed) => !passed)) process.exitCode = 1;
console.log(`\n${Object.keys(results).length} settings-sync tests -> ${Object.values(results).filter(Boolean).length} PASS, ${Object.values(results).filter((passed) => !passed).length} FAIL.`);
process.exit(process.exitCode || 0);