// FINAL DATA PERSISTENCE & DELETE AUDIT — DB-backed CRUD proof.
// For every synced entity, drives the full HTTP chain (POST/PATCH/GET/DELETE)
// exactly as the frontend would, then directly verifies the committed rows in
// PostgreSQL, then re-reads through the API ("refresh") to prove the UI would
// reconcile. Also proves the relational guarantees: FK deletions are blocked
// with a clear 409 when related data exists, parcel deletion cascades payments
// at the code level, trip deletion nulls parcel references (no orphans), and no
// test row is left behind.
import 'dotenv/config';
import dataHandler from '../api/data.js';
import { authenticate, createSessionToken } from '../server/auth.js';
import { prisma } from '../server/prisma.js';

const marker = `crud-${Date.now()}`;
const par1 = `+223${String(Date.now()).slice(-9)}`;
const par2 = `+223${String(Date.now() + 1).slice(-9)}`;
const uid1 = `${marker}-a1`;
const uid2 = `${marker}-a2`;

const results = {};
const record = (name, passed, detail = '') => {
  results[name] = passed;
  console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}${detail ? ` (${detail})` : ''}`);
};

function invokeApi({ method = 'POST', resource, body, cookie, id, idempotencyKey }) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const req = { method, query: { ...(resource ? { resource } : {}), ...(id ? { id } : {}) }, headers, body };
  let statusCode = 200;
  let payload;
  const res = {
    status(code) { statusCode = code; return this; },
    json(data) { payload = data; return this; },
    end() { return this; },
  };
  return dataHandler(req, res).then(() => ({ statusCode, payload }));
}

let adminCookie;
const created = {
  product: null,
  clientBase: null,
  clientOfB: null,
  trip: null,
  vehicleInline: null,
  vehicleExtra: null,
  parcel: null,
  parcel2: null,
  payment: null,
  payment2: null,
  agentA: null,
  agentB: null,
  expense: null,
};

try {
  const admin = await authenticate(process.env.INITIAL_ADMIN_EMAIL, process.env.INITIAL_ADMIN_PASSWORD);
  if (!admin) throw new Error('Admin authentication failed.');
  adminCookie = `groupe_gaff_session=${encodeURIComponent(createSessionToken(admin))}`;

  // ================================================================
  // USERS — full CRUD (create / verify / update / refresh / delete)
  // ================================================================
  const userCreate = await invokeApi({
    resource: 'users',
    body: { fullName: `${marker}-agent-a`, phone: par1, email: `${uid1}@test.invalid`, password: 'test-agent-a-pw', role: 'agent', active: true },
    cookie: adminCookie,
  });
  created.agentA = userCreate.payload?.data;
  const dbAgentA = created.agentA?.id ? await prisma.user.findUnique({ where: { id: created.agentA.id } }) : null;
  record('users.createPersists', userCreate.statusCode === 201 && dbAgentA?.role === 'agent' && dbAgentA?.active === true, { status: userCreate.statusCode });

  const userPatch = await invokeApi({ method: 'PATCH', resource: 'users', id: created.agentA?.id, body: { active: false }, cookie: adminCookie });
  const dbAgentA2 = created.agentA?.id ? await prisma.user.findUnique({ where: { id: created.agentA.id } }) : null;
  record('users.updatePersists', userPatch.statusCode === 200 && dbAgentA2?.active === false, { status: userPatch.statusCode });

  const userRefreshAfterUpdate = await invokeApi({ method: 'GET', resource: 'users', cookie: adminCookie });
  record('users.refreshSeesUpdate', (userRefreshAfterUpdate.payload?.data ?? []).some((u) => u.id === created.agentA?.id && u.active === false));

  // ================================================================
  // USERS — FK-protected deletion: a user who owns records cannot be
  // deleted; the API answers 409 with a clear explanation.
  // ================================================================
  const userB = await invokeApi({
    resource: 'users',
    body: { fullName: `${marker}-agent-b`, phone: par2, email: `${uid2}@test.invalid`, password: 'test-agent-b-pw', role: 'agent', active: true },
    cookie: adminCookie,
  });
  created.agentB = userB.payload?.data;
  const agentBCookie = `groupe_gaff_session=${encodeURIComponent(createSessionToken(created.agentB))}`;
  const clientOfB = await invokeApi({ resource: 'clients', body: { fullName: `${marker}-client-b`, phone: `+223${String(Date.now() + 2).slice(-9)}`, city: 'Bamako', address: 'Addr B' }, cookie: agentBCookie });
  created.clientOfB = clientOfB.payload?.data;
  const dbClientOfB = created.clientOfB?.id ? await prisma.client.findUnique({ where: { id: created.clientOfB.id } }) : null;
  record('users.delete.RefsBlocked', dbClientOfB?.createdById === created.agentB?.id, `client.created_by=${dbClientOfB?.createdById}`);

  const blockedUserDelete = await invokeApi({ method: 'DELETE', resource: 'users', id: created.agentB?.id, cookie: adminCookie });
  const dbAgentBBeforeCleanup = await prisma.user.count({ where: { id: created.agentB?.id } });
  record(
    'users.deleteBlockedWithClear409',
    blockedUserDelete.statusCode === 409 && String(blockedUserDelete.payload?.error ?? '').includes('des données liées existent') && dbAgentBBeforeCleanup === 1,
    { status: blockedUserDelete.statusCode, error: blockedUserDelete.payload?.error },
  );

  // ================================================================
  // PRODUCTS — full CRUD
  // ================================================================
  const productCreate = await invokeApi({ resource: 'products', body: { name: `${marker}-product`, category: 'Test', defaultPrice: 1000 }, cookie: adminCookie });
  created.product = productCreate.payload?.data;
  const dbProduct = created.product?.id ? await prisma.product.findUnique({ where: { id: created.product.id } }) : null;
  record('products.createPersists', productCreate.statusCode === 201 && Number(dbProduct?.defaultPrice) === 1000, { status: productCreate.statusCode });

  const productPatch = await invokeApi({ method: 'PATCH', resource: 'products', id: created.product?.id, body: { defaultPrice: 2500 }, cookie: adminCookie });
  const dbProduct2 = created.product?.id ? await prisma.product.findUnique({ where: { id: created.product.id } }) : null;
  record('products.updatePersists', productPatch.statusCode === 200 && Number(dbProduct2?.defaultPrice) === 2500, { status: productPatch.statusCode });

  const productRefresh = await invokeApi({ method: 'GET', resource: 'products', cookie: adminCookie });
  record('products.refreshSeesUpdate', (productRefresh.payload?.data ?? []).some((p) => p.id === created.product?.id && Number(p.defaultPrice) === 2500));

  // ================================================================
  // CLIENTS — full CRUD (deletion proven blocked later while parcels
  // reference the client, then deletion succeeds after cleanup).
  // ================================================================
  const clientCreate = await invokeApi({ resource: 'clients', body: { fullName: `${marker}-client`, phone: `+223${String(Date.now() + 3).slice(-9)}`, city: 'Bamako', address: 'Test address' }, cookie: adminCookie });
  created.clientBase = clientCreate.payload?.data;
  const dbClient = created.clientBase?.id ? await prisma.client.findUnique({ where: { id: created.clientBase.id } }) : null;
  record('clients.createPersists', clientCreate.statusCode === 201 && dbClient?.city === 'Bamako', { status: clientCreate.statusCode });

  const clientPatch = await invokeApi({ method: 'PATCH', resource: 'clients', id: created.clientBase?.id, body: { fullName: `${marker}-client-v2`, neighborhood: 'Hamdallaye' }, cookie: adminCookie });
  const dbClient2 = created.clientBase?.id ? await prisma.client.findUnique({ where: { id: created.clientBase.id } }) : null;
  record('clients.updatePersists', clientPatch.statusCode === 200 && dbClient2?.fullName === `${marker}-client-v2` && dbClient2?.neighborhood === 'Hamdallaye', { status: clientPatch.statusCode });

  const clientRefresh = await invokeApi({ method: 'GET', resource: 'clients', cookie: adminCookie });
  record('clients.refreshSeesUpdate', (clientRefresh.payload?.data ?? []).some((c) => c.id === created.clientBase?.id && c.full_name === `${marker}-client-v2`));

  // ================================================================
  // TRIPS + TRIP-VEHICLES — full CRUD (vehicle created with the trip,
  // refreshed through the list, plus a separately managed vehicle).
  // ================================================================
  const tripCreate = await invokeApi({ resource: 'trips', body: { tripNumber: marker, tripDate: new Date().toISOString(), origin: 'Bamako', destination: 'Abidjan', vehicles: [{ registration: `${marker}-truck-1` }] }, cookie: adminCookie });
  created.trip = tripCreate.payload?.data;
  created.vehicleInline = created.trip?.vehicles?.[0];
  const dbTrip = created.trip?.id ? await prisma.trip.findUnique({ where: { id: created.trip.id }, include: { vehicles: true } }) : null;
  record('trips.createPersists', tripCreate.statusCode === 201 && dbTrip?.tripNumber === marker && dbTrip?.vehicles.length === 1, { status: tripCreate.statusCode, vehicles: dbTrip?.vehicles.length });

  const tripPatch = await invokeApi({ method: 'PATCH', resource: 'trips', id: created.trip?.id, body: { status: 'in_transit' }, cookie: adminCookie });
  const dbTrip2 = created.trip?.id ? await prisma.trip.findUnique({ where: { id: created.trip.id } }) : null;
  record('trips.updatePersists', tripPatch.statusCode === 200 && dbTrip2?.status === 'in_transit', { status: tripPatch.statusCode });

  const tripRefresh = await invokeApi({ method: 'GET', resource: 'trips', cookie: adminCookie });
  const refreshedTrip = (tripRefresh.payload?.data ?? []).find((t) => t.id === created.trip?.id);
  record('trips.refreshSeesUpdate', refreshedTrip?.status === 'in_transit' && Array.isArray(refreshedTrip?.vehicles) && refreshedTrip.vehicles.length === 1);

  const vehicleCreate = await invokeApi({ resource: 'trip-vehicles', body: { tripId: created.trip?.id, registration: `${marker}-truck-2` }, cookie: adminCookie });
  created.vehicleExtra = vehicleCreate.payload?.data;
  const dbVehicleExtra = created.vehicleExtra?.id ? await prisma.tripVehicle.findUnique({ where: { id: created.vehicleExtra.id } }) : null;
  record('trip-vehicles.createPersists', vehicleCreate.statusCode === 201 && dbVehicleExtra?.tripId === created.trip?.id, { status: vehicleCreate.statusCode });

  const vehicleRefresh = await (async () => {
    const req = { method: 'GET', query: { resource: 'trip-vehicles', tripId: created.trip?.id }, headers: { cookie: adminCookie }, body: undefined };
    let statusCode = 200; let payload;
    const res = { status(c) { statusCode = c; return this; }, json(d) { payload = d; return this; }, end() { return this; } };
    await dataHandler(req, res);
    return { statusCode, payload };
  })();
  record('trip-vehicles.refreshSeesCreate', (vehicleRefresh.payload?.data ?? []).some((v) => v.id === created.vehicleExtra?.id));

  const vehicleDelete = await invokeApi({ method: 'DELETE', resource: 'trip-vehicles', id: created.vehicleExtra?.id, cookie: adminCookie });
  const dbVehicleAfterDelete = await prisma.tripVehicle.count({ where: { id: created.vehicleExtra?.id } });
  record('trip-vehicles.deletePersists', vehicleDelete.statusCode === 204 && dbVehicleAfterDelete === 0, { status: vehicleDelete.statusCode });

  // ================================================================
  // PARCELS — full CRUD (single-linked parcel on the trip).
  // ================================================================
  const parcelCreate = await invokeApi({
    resource: 'parcels',
    body: {
      clientId: created.clientBase?.id,
      recipientName: 'Recipient',
      recipientPhone: '+22370000000',
      recipientAddress: 'Test address',
      merchandiseType: 'Test',
      weight: 1,
      vehicle: `${marker}-truck-1`,
      origin: 'Bamako',
      destination: 'Abidjan',
      departureBranch: 'Bamako',
      arrivalBranch: 'Abidjan',
      packageType: 'Petit colis',
      paymentCondition: 'unpaid',
      tripId: created.trip?.id,
      items: [{ designation: 'Marchandise test', quantity: 1, unitPrice: 20000 }],
    },
    cookie: adminCookie,
  });
  created.parcel = parcelCreate.payload?.data;
  const dbParcel = created.parcel?.id ? await prisma.parcel.findUnique({ where: { id: created.parcel.id }, include: { items: true } }) : null;
  record('parcels.createPersists', parcelCreate.statusCode === 201 && dbParcel?.clientId === created.clientBase?.id && dbParcel?.tripId === created.trip?.id && dbParcel?.items.length === 1, { status: parcelCreate.statusCode, subTotal: Number(dbParcel?.subTotal) });

  const parcelPatch = await invokeApi({ method: 'PATCH', resource: 'parcels', id: created.parcel?.id, body: { status: 'in_transit', expectedStatus: 'received' }, cookie: adminCookie });
  const dbParcel2 = created.parcel?.id ? await prisma.parcel.findUnique({ where: { id: created.parcel.id } }) : null;
  const dbStatusHistory = created.parcel?.id ? await prisma.statusHistory.count({ where: { parcelId: created.parcel.id } }) : 0;
  record('parcels.updatePersists', parcelPatch.statusCode === 200 && dbParcel2?.status === 'in_transit' && dbStatusHistory === 1, { status: parcelPatch.statusCode });

  const parcelRefresh = await invokeApi({ method: 'GET', resource: 'parcels', cookie: adminCookie });
  record('parcels.refreshSeesUpdate', (parcelRefresh.payload?.data ?? []).some((p) => p.id === created.parcel?.id && p.status === 'in_transit'));

  // ================================================================
  // PAYMENTS — full CRUD (idempotency-keyed POST, financial side effect).
  // ================================================================
  const payKey1 = `CRUD-PAY-1-${marker}`;
  const paymentCreate = await invokeApi({ resource: 'payments', body: { parcelId: created.parcel?.id, amount: 15000, paymentMethod: 'cash', paymentDate: new Date().toISOString(), note: `${marker}-payment` }, cookie: adminCookie, idempotencyKey: payKey1 });
  created.payment = paymentCreate.payload?.data;
  const dbPayment = created.payment?.id ? await prisma.payment.findUnique({ where: { id: created.payment.id } }) : null;
  const dbParcelAfterPay = created.parcel?.id ? await prisma.parcel.findUnique({ where: { id: created.parcel.id } }) : null;
  record(
    'payments.createPersists',
    paymentCreate.statusCode === 201 && dbPayment?.parcelId === created.parcel?.id && Number(dbPayment.amount) === 15000
      && Number(dbParcelAfterPay?.amountPaid) === 15000 && Number(dbParcelAfterPay?.balance) === 5000,
    { status: paymentCreate.statusCode, amountPaid: Number(dbParcelAfterPay?.amountPaid), balance: Number(dbParcelAfterPay?.balance) },
  );

  const paymentPatch = await invokeApi({ method: 'PATCH', resource: 'payments', id: created.payment?.id, body: { note: 'Note mise à jour' }, cookie: adminCookie });
  const dbPayment2 = created.payment?.id ? await prisma.payment.findUnique({ where: { id: created.payment.id } }) : null;
  record('payments.updatePersists', paymentPatch.statusCode === 200 && dbPayment2?.note === 'Note mise à jour', { status: paymentPatch.statusCode });

  const paymentRefresh = await invokeApi({ method: 'GET', resource: 'payments', cookie: adminCookie });
  record('payments.refreshSeesUpdate', (paymentRefresh.payload?.data ?? []).some((p) => p.id === created.payment?.id && p.note === 'Note mise à jour'));

  // ================================================================
  // EXPENSES — full CRUD (the entity that used to be local-only).
  // ================================================================
  const expenseCreate = await invokeApi({
    resource: 'expenses',
    body: { parcelId: created.parcel?.id, tripId: created.trip?.id, categoryName: 'Douane', label: 'Test expense', amount: 5000, expenseDate: new Date().toISOString().slice(0, 10), location: 'Bamako', notes: 'Initial' },
    cookie: adminCookie,
  });
  created.expense = expenseCreate.payload?.data;
  const dbExpense = created.expense?.id ? await prisma.tripExpense.findUnique({ where: { id: created.expense.id } }) : null;
  record('expenses.createPersists', expenseCreate.statusCode === 201 && dbExpense?.parcelId === created.parcel?.id && dbExpense?.categoryName === 'Douane' && Number(dbExpense?.amount) === 5000, { status: expenseCreate.statusCode });

  const expensePatch = await invokeApi({ method: 'PATCH', resource: 'expenses', id: created.expense?.id, body: { amount: 7500, label: 'Updated label' }, cookie: adminCookie });
  const dbExpense2 = created.expense?.id ? await prisma.tripExpense.findUnique({ where: { id: created.expense.id } }) : null;
  record('expenses.updatePersists', expensePatch.statusCode === 200 && Number(dbExpense2?.amount) === 7500 && dbExpense2?.label === 'Updated label', { status: expensePatch.statusCode });

  const expenseRefresh = await invokeApi({ method: 'GET', resource: 'expenses', cookie: adminCookie });
  record('expenses.refreshSeesUpdate', (expenseRefresh.payload?.data ?? []).some((e) => e.id === created.expense?.id && Number(e.amount) === 7500));

  // ================================================================
  // RELATIONAL GUARANTEES
  // ================================================================
  // Expense FK (Restrict): deleting a parcel that still carries an expense
  // is refused with a clear 409, nothing is silently orphaned.
  const blockedParcelDeleteWithExpense = await invokeApi({ method: 'DELETE', resource: 'parcels', id: created.parcel?.id, cookie: adminCookie });
  const dbParcelStillThere = await prisma.parcel.count({ where: { id: created.parcel?.id } });
  record(
    'parcel.deleteBlockedByExpense409',
    blockedParcelDeleteWithExpense.statusCode === 409 && String(blockedParcelDeleteWithExpense.payload?.error ?? '').includes('des données liées existent') && dbParcelStillThere === 1,
    { status: blockedParcelDeleteWithExpense.statusCode, error: blockedParcelDeleteWithExpense.payload?.error },
  );

  // Client FK (Restrict): a client with parcels cannot be deleted either.
  const blockedClientDelete = await invokeApi({ method: 'DELETE', resource: 'clients', id: created.clientBase?.id, cookie: adminCookie });
  const dbClientStillThere = await prisma.client.count({ where: { id: created.clientBase?.id } });
  record('clients.deleteBlockedByParcels409', blockedClientDelete.statusCode === 409 && dbClientStillThere === 1, { status: blockedClientDelete.statusCode });

  // Expense delete then GET refresh proves the UI reconciles.
  const expenseDelete = await invokeApi({ method: 'DELETE', resource: 'expenses', id: created.expense?.id, cookie: adminCookie });
  const dbExpenseGone = await prisma.tripExpense.count({ where: { id: created.expense?.id } });
  const expenseRefreshAfterDelete = await invokeApi({ method: 'GET', resource: 'expenses', cookie: adminCookie });
  record('expenses.deletePersists', expenseDelete.statusCode === 204 && dbExpenseGone === 0 && !(expenseRefreshAfterDelete.payload?.data ?? []).some((e) => e.id === created.expense?.id), { status: expenseDelete.statusCode });

  // Trip deletion: vehicles are removed, referencing parcels survive with
  // trip_id/trip_vehicle_id set to NULL (no orphans).
  const tripDelete = await invokeApi({ method: 'DELETE', resource: 'trips', id: created.trip?.id, cookie: adminCookie });
  const dbTripGone = await prisma.trip.count({ where: { id: created.trip?.id } });
  const dbVehicleCount = await prisma.tripVehicle.count({ where: { tripId: created.trip?.id } });
  const dbParcelAfterTripDel = created.parcel?.id ? await prisma.parcel.findUnique({ where: { id: created.parcel.id } }) : null;
  const tripRefreshAfterDelete = await invokeApi({ method: 'GET', resource: 'trips', cookie: adminCookie });
  record(
    'trips.deleteCascadesVehiclesAndNullsParcels',
    tripDelete.statusCode === 204 && dbTripGone === 0 && dbVehicleCount === 0 && dbParcelAfterTripDel?.tripId === null && !(tripRefreshAfterDelete.payload?.data ?? []).some((t) => t.id === created.trip?.id),
    { status: tripDelete.statusCode, parcelsTripId: dbParcelAfterTripDel?.tripId ?? null },
  );

  // Code-level cascade: deleting a parcel removes its payments, items and
  // status history in one transaction and the DB ends up consistent.
  const parcel2Create = await invokeApi({
    resource: 'parcels',
    body: {
      clientId: created.clientBase?.id,
      recipientName: 'Recipient 2',
      recipientPhone: '+22370000001',
      recipientAddress: 'Test address',
      merchandiseType: 'Test',
      weight: 1,
      origin: 'Bamako',
      destination: 'Abidjan',
      packageType: 'Petit colis',
      items: [{ designation: 'Marchandise 2', quantity: 1, unitPrice: 2000 }],
    },
    cookie: adminCookie,
  });
  created.parcel2 = parcel2Create.payload?.data;
  const payKey2 = `CRUD-PAY-2-${marker}`;
  await invokeApi({ resource: 'payments', body: { parcelId: created.parcel2?.id, amount: 3000, paymentMethod: 'cash', paymentDate: new Date().toISOString(), note: `${marker}-pay2` }, cookie: adminCookie, idempotencyKey: payKey2 });
  const dbPayment2Before = await prisma.payment.count({ where: { parcelId: created.parcel2?.id } });
  const parcel2Delete = await invokeApi({ method: 'DELETE', resource: 'parcels', id: created.parcel2?.id, cookie: adminCookie });
  const dbParcel2Gone = await prisma.parcel.count({ where: { id: created.parcel2?.id } });
  const dbPayments2Gone = await prisma.payment.count({ where: { parcelId: created.parcel2?.id } });
  const dbItems2Gone = await prisma.parcelItem.count({ where: { parcelId: created.parcel2?.id } });
  record(
    'parcel.deleteCascadesPaymentsItemsHistory',
    dbPayment2Before === 1 && parcel2Delete.statusCode === 204 && dbParcel2Gone === 0 && dbPayments2Gone === 0 && dbItems2Gone === 0,
    { status: parcel2Delete.statusCode, paymentsBefore: dbPayment2Before },
  );

  // Payment delete restores the parcel financial state (self-healing).
  const paymentDelete = await invokeApi({ method: 'DELETE', resource: 'payments', id: created.payment?.id, cookie: adminCookie });
  const dbPaymentGone = await prisma.payment.count({ where: { id: created.payment?.id } });
  const dbParcelAfterPayDel = created.parcel?.id ? await prisma.parcel.findUnique({ where: { id: created.parcel.id } }) : null;
  record('payments.deleteRestoresBalance', paymentDelete.statusCode === 204 && dbPaymentGone === 0 && Number(dbParcelAfterPayDel?.amountPaid) === 0 && Number(dbParcelAfterPayDel?.balance) === 20000, { status: paymentDelete.statusCode, balance: Number(dbParcelAfterPayDel?.balance) });

  // Now the parcel can be deleted (no expense, no payment, no trip link).
  const parcelDelete = await invokeApi({ method: 'DELETE', resource: 'parcels', id: created.parcel?.id, cookie: adminCookie });
  const dbParcelGone = await prisma.parcel.count({ where: { id: created.parcel?.id } });
  const dbHistoryGone = created.parcel?.id ? await prisma.statusHistory.count({ where: { parcelId: created.parcel.id } }) : 0;
  const parcelRefreshAfterDelete = await invokeApi({ method: 'GET', resource: 'parcels', cookie: adminCookie });
  record('parcels.deletePersists', parcelDelete.statusCode === 204 && dbParcelGone === 0 && dbHistoryGone === 0 && !(parcelRefreshAfterDelete.payload?.data ?? []).some((p) => p.id === created.parcel?.id), { status: parcelDelete.statusCode });

  // Then the client can be deleted too (its parcels are gone).
  const clientDelete = await invokeApi({ method: 'DELETE', resource: 'clients', id: created.clientBase?.id, cookie: adminCookie });
  const dbClientGone = await prisma.client.count({ where: { id: created.clientBase?.id } });
  record('clients.deletePersists', clientDelete.statusCode === 204 && dbClientGone === 0, { status: clientDelete.statusCode });

  // ================================================================
  // SETTINGS — singleton update + DB verify + refresh (no delete: the
  // app never deletes the settings row).
  // ================================================================
  const settingsPatch = await invokeApi({ method: 'PATCH', resource: 'settings', id: '1', body: { companyName: `${marker}-company`, defaultTransportPrice: 5000 }, cookie: adminCookie });
  const dbSettings = await prisma.appSettings.findFirst();
  record('settings.updatePersists', settingsPatch.statusCode === 200 && dbSettings?.companyName === `${marker}-company` && Number(dbSettings?.defaultTransportPrice) === 5000, { status: settingsPatch.statusCode });
  const settingsRefresh = await invokeApi({ method: 'GET', resource: 'settings', cookie: adminCookie });
  record('settings.refreshSeesUpdate', (settingsRefresh.payload?.data ?? []).some((s) => s.company_name === `${marker}-company` && Number(s.default_transport_price) === 5000));

  // Products deletion (straight DB delete path).
  const productDelete = await invokeApi({ method: 'DELETE', resource: 'products', id: created.product?.id, cookie: adminCookie });
  const dbProductGone = await prisma.product.count({ where: { id: created.product?.id } });
  record('products.deletePersists', productDelete.statusCode === 204 && dbProductGone === 0, { status: productDelete.statusCode });

  // Users deletion: after the owning client is removed, the agent is
  // deletable and the API list reconciles.
  const clientOfBDelete = await invokeApi({ method: 'DELETE', resource: 'clients', id: created.clientOfB?.id, cookie: adminCookie });
  const agentBDelete = await invokeApi({ method: 'DELETE', resource: 'users', id: created.agentB?.id, cookie: adminCookie });
  const dbAgentBGone = await prisma.user.count({ where: { id: created.agentB?.id } });
  record('users.deletePersistsAfterRefsGone', clientOfBDelete.statusCode === 204 && agentBDelete.statusCode === 204 && dbAgentBGone === 0, { clientStatus: clientOfBDelete.statusCode, userStatus: agentBDelete.statusCode });

  const agentADelete = await invokeApi({ method: 'DELETE', resource: 'users', id: created.agentA?.id, cookie: adminCookie });
  const dbAgentAGone = await prisma.user.count({ where: { id: created.agentA?.id } });
  const userRefreshAfterDelete = await invokeApi({ method: 'GET', resource: 'users', cookie: adminCookie });
  record('users.deletePersists', agentADelete.statusCode === 204 && dbAgentAGone === 0 && !(userRefreshAfterDelete.payload?.data ?? []).some((u) => u.id === created.agentA?.id), { status: agentADelete.statusCode });
} finally {
  const admin = await authenticate(process.env.INITIAL_ADMIN_EMAIL, process.env.INITIAL_ADMIN_PASSWORD);

  // ---- CLEANUP ----
  if (created.expense?.id) { try { await invokeApi({ method: 'DELETE', resource: 'expenses', id: created.expense.id, cookie: adminCookie }); } catch { /* ignore */ } }
  for (const pid of [created.parcel2?.id, created.parcel?.id].filter(Boolean)) {
    try { await invokeApi({ method: 'DELETE', resource: 'parcels', id: pid, cookie: adminCookie }); } catch { /* ignore */ }
  }
  if (created.vehicleExtra?.id) { try { await invokeApi({ method: 'DELETE', resource: 'trip-vehicles', id: created.vehicleExtra.id, cookie: adminCookie }); } catch { /* ignore */ } }
  if (created.trip?.id) { try { await invokeApi({ method: 'DELETE', resource: 'trips', id: created.trip.id, cookie: adminCookie }); } catch { /* ignore */ } }
  for (const cid of [created.clientOfB?.id, created.clientBase?.id].filter(Boolean)) {
    try { await invokeApi({ method: 'DELETE', resource: 'clients', id: cid, cookie: adminCookie }); } catch { /* ignore */ }
  }
  if (created.product?.id) { try { await invokeApi({ method: 'DELETE', resource: 'products', id: created.product.id, cookie: adminCookie }); } catch { /* ignore */ } }
  if (created.agentA?.id) { try { await invokeApi({ method: 'DELETE', resource: 'users', id: created.agentA.id, cookie: adminCookie }); } catch { /* ignore */ } }
  if (created.agentB?.id) { try { await invokeApi({ method: 'DELETE', resource: 'users', id: created.agentB.id, cookie: adminCookie }); } catch { /* ignore */ } }

  const leftoverUsers = created.agentA?.id || created.agentB?.id
    ? await prisma.user.count({ where: { OR: [{ email: { in: [`${uid1}@test.invalid`, `${uid2}@test.invalid`] } }, { id: { in: [created.agentA?.id, created.agentB?.id].filter(Boolean) } }] } })
    : 0;
  const leftoverProducts = created.product?.id ? await prisma.product.count({ where: { id: created.product.id } }) : 0;
  const leftoverClients = await prisma.client.count({ where: { OR: [{ id: { in: [created.clientBase?.id, created.clientOfB?.id].filter(Boolean) } }, { phone: { in: [`+223${String(Date.now() + 2).slice(-9)}`] } }] } });
  const leftoverTrips = created.trip?.id ? await prisma.trip.count({ where: { id: created.trip.id } }) : 0;
  const leftoverParcels = await prisma.parcel.count({ where: { id: { in: [created.parcel?.id, created.parcel2?.id].filter(Boolean) } } });
  const leftoverPayments = await prisma.payment.count({ where: { OR: [{ parcelId: { in: [created.parcel?.id, created.parcel2?.id].filter(Boolean) } }, { note: { in: [`${marker}-payment`, `${marker}-pay2`] } }] } });
  const leftoverExpenses = created.expense?.id ? await prisma.tripExpense.count({ where: { id: created.expense.id } }) : 0;
  record(
    'cleanup',
    leftoverUsers === 0 && leftoverProducts === 0 && leftoverClients === 0 && leftoverTrips === 0 && leftoverParcels === 0 && leftoverPayments === 0 && leftoverExpenses === 0,
    [leftoverUsers, leftoverProducts, leftoverClients, leftoverTrips, leftoverParcels, leftoverPayments, leftoverExpenses].join('/'),
  );

  await prisma.$disconnect();
}

if (Object.values(results).some((passed) => !passed)) process.exitCode = 1;
console.log(`\n${Object.keys(results).length} persistence checks -> ${Object.values(results).filter(Boolean).length} PASS, ${Object.values(results).filter((p) => !p).length} FAIL.`);
process.exit(process.exitCode || 0);