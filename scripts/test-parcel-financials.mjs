// Regression tests for the parcel financial model:
//   total = sub_total + transport_price + additional_fees
//   balance = max(total - amount_paid, 0)   (0 when payment_condition is paid_origin)
//   a zero balance does NOT mean delivered
//   an offline-created financial parcel reaches the server with identical values
//
// The four cases required by the production-readiness plan:
//   Case 1: sub_total 100000 + transport 10000 + fees 5000, paid 0
//           -> total 115000, balance 115000
//   Case 2: same, paid 50000 -> total 115000, balance 65000
//   Case 3: paid_origin fully paid (paid == total) -> balance 0, status STILL 'received'
//   Case 4: offline create with financials -> after reconnect the server holds the
//           same transport/additional/total/paid/balance values
//
// Uses Vite SSR + fake-indexeddb so the exact browser modules are exercised,
// mirroring scripts/test-parcel-create-local-first.mjs.
import 'fake-indexeddb/auto';
import { createServer } from 'vite';

const results = {};
const record = (name, passed, extra) => { results[name] = passed; console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}${extra !== undefined ? `  ${JSON.stringify(extra)}` : ''}`); };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------
// Environment stubs
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

const json = (data) => ({ ok: true, status: data === null ? 204 : 200, json: async () => ({ data }) });
function errorRes(status, message) {
  return { ok: false, status, json: async () => ({ error: message }) };
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const parsed = new URL(String(url), 'http://test.local');
  const resource = parsed.searchParams.get('resource');
  const body = init.body ? JSON.parse(init.body) : undefined;

  if (init.method === 'GET') {
    if (store[resource]) return json([...store[resource].values()]);
    return json([]);
  }

  if (init.method === 'POST' && resource === 'parcels') {
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
    const finalTotal = subTotal + transportPrice + additionalFees;
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
      totalAmount: finalTotal,
      amountPaid,
      balance: condition === 'paid_origin' ? 0 : Math.max(finalTotal - amountPaid, 0),
      status: body.status ?? 'received',
      receivedDate: body.receivedDate,
      tripId: body.tripId ?? null,
      tripVehicleId: body.tripVehicleId ?? null,
      items,
    };
    store.parcels.set(parcel.id, parcel);
    return json(parcel);
  }

  return errorRes(405, 'Méthode non autorisée.');
};

function parcelInput(overrides = {}) {
  const now = new Date().toISOString();
  return {
    client_id: 'client-test',
    client_name: 'Client Test',
    client_phone: '',
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
    agent_id: 'u-admin',
    agent_name: 'Admin',
    payment_condition: 'unpaid',
    package_type: 'Petit colis',
    sub_total: 100000,
    transport_price: 10000,
    additional_fees: 5000,
    amount_paid: 0,
    status: 'received',
    received_date: now,
    departure_date: null,
    arrival_date: null,
    delivery_date: null,
    registered_by: 'u-admin',
    registered_by_name: 'Admin',
    ...overrides,
  };
}

let vite;
try {
  vite = await createServer({ appType: 'custom', server: { middlewareMode: true } });
  const data = await vite.ssrLoadModule('/src/lib/data.ts');

  // --- Case 1: transport + fees added to sub_total, nothing paid -------------
  const c1 = await data.createParcel(parcelInput(), [{ designation: 'Carton parfum', quantity: 1, unit_price: 100000 }]);
  record('case1.totalIsSubTotalPlusTransportPlusFees', c1.total_amount === 115000, { total: c1.total_amount, sub: c1.sub_total, transport: c1.transport_price, fees: c1.additional_fees });
  record('case1.balanceIsFullTotal', c1.balance === 115000, { balance: c1.balance });

  // --- Case 2: partial payment reduces the balance ---------------------------
  const c2 = await data.createParcel(parcelInput({ amount_paid: 50000 }), [{ designation: 'Carton parfum', quantity: 1, unit_price: 100000 }]);
  record('case2.totalUnchanged', c2.total_amount === 115000, { total: c2.total_amount });
  record('case2.balanceIsTotalMinusPaid', c2.balance === 65000, { balance: c2.balance, paid: c2.amount_paid });

  // --- Case 3: fully paid but not delivered ----------------------------------
  const c3 = await data.createParcel(parcelInput({ payment_condition: 'paid_origin', sub_total: 1000000, transport_price: 50000, additional_fees: 0, amount_paid: 1050000 }), [{ designation: 'Moto', quantity: 1, unit_price: 1000000 }]);
  record('case3.fullyPaidBalanceZero', c3.total_amount === 1050000 && c3.balance === 0, { total: c3.total_amount, balance: c3.balance, paid: c3.amount_paid });
  record('case3.zeroBalanceDoesNotMeanDelivered', c3.status === 'received', { status: c3.status });

  // --- Case 4: offline financial parcel syncs with identical values ----------
  online = false;
  const c4 = await data.createParcel(parcelInput({ additional_fees: 2000, amount_paid: 30000 }), [{ designation: 'Sac', quantity: 1, unit_price: 100000 }]);
  record('case4.offlineLocalFinancialsCorrect', c4.total_amount === 112000 && c4.balance === 82000 && c4.transport_price === 10000 && c4.additional_fees === 2000 && c4.amount_paid === 30000, { total: c4.total_amount, balance: c4.balance, transport: c4.transport_price, fees: c4.additional_fees, paid: c4.amount_paid });
  online = true;
  const syncEngine = await vite.ssrLoadModule('/src/lib/syncEngine.ts');
  let attempts = 0;
  while (![...store.parcels.values()].some((parcel) => parcel.id === c4.id) && attempts < 50) {
    await syncEngine.requestSync();
    await sleep(20);
    attempts += 1;
  }
  const serverRecord = [...store.parcels.values()].find((parcel) => parcel.id === c4.id);
  record('case4.serverReceivedIdenticalFinancials', Boolean(serverRecord) && serverRecord.totalAmount === 112000 && serverRecord.balance === 82000 && serverRecord.transportPrice === 10000 && serverRecord.additionalFees === 2000 && serverRecord.amountPaid === 30000 && serverRecord.paymentCondition === 'unpaid', serverRecord && { total: serverRecord.totalAmount, balance: serverRecord.balance, transport: serverRecord.transportPrice, fees: serverRecord.additionalFees, paid: serverRecord.amountPaid, condition: serverRecord.paymentCondition });
} catch (error) {
  console.error('Financial regression test crashed:', error);
  record('cleanRun', false);
} finally {
  globalThis.fetch = originalFetch;
  if (vite) await vite.close();
  delete globalThis.localStorage;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
}

if (Object.values(results).some((passed) => !passed)) process.exitCode = 1;
console.log(`\n${Object.keys(results).length} parcel-financials tests -> ${Object.values(results).filter(Boolean).length} PASS, ${Object.values(results).filter((passed) => !passed).length} FAIL.`);
process.exit(process.exitCode || 0);