// Regression tests for payment deletion / reconciliation:
//   A. normal parcel (unpaid): pay 3000 then delete it -> paid 0, balance restored
//   B. paid_origin parcel: 3000 collected at creation + runtime payments 2000 & 1000,
//      delete the 2000 payment -> paid_origin amount is preserved, not wiped out
//   C. normal parcel with several payments: 2000 + 1000, delete 2000 ->
//      recomputed from remaining rows: paid 1000, balance = total - 1000
//
// Exercises the real HTTP API surface (auth cookie + Idempotency-Key header),
// matching scripts/test-payment-idempotency.mjs.
import 'dotenv/config';
import dataHandler from '../api/data.js';
import { authenticate, createSessionToken } from '../server/auth.js';
import { create, remove } from '../server/data.js';
import { prisma } from '../server/prisma.js';

const marker = `payment-deletion-${Date.now()}`;

const results = {};
const record = (name, passed, detail = '') => {
  results[name] = passed;
  console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}${detail ? ` (${detail})` : ''}`);
};

async function invokeApi({ method = 'POST', resource, id, body, cookie, idempotencyKey: key }) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (key) headers['idempotency-key'] = key;
  const req = { method, query: { resource, ...(id ? { id } : {}) }, headers, body };
  let statusCode = 200;
  let payload;
  const res = {
    status(code) { statusCode = code; return this; },
    json(data) { payload = data; return this; },
    end() { return this; },
  };
  await dataHandler(req, res);
  return { statusCode, payload };
}

const pay = async (parcelId, amount, key) =>
  invokeApi({
    resource: 'payments',
    body: { parcelId, amount, paymentMethod: 'cash', paymentDate: new Date().toISOString(), note: `${marker}` },
    cookie: adminCookie,
    idempotencyKey: key,
  });

let product;
let client;
let trip;
let normalParcel;
let originParcel;
let multiParcel;
let adminCookie;

try {
  const admin = await authenticate(process.env.INITIAL_ADMIN_EMAIL, process.env.INITIAL_ADMIN_PASSWORD);
  if (!admin) throw new Error('Admin authentication failed.');
  adminCookie = `groupe_gaff_session=${encodeURIComponent(createSessionToken(admin))}`;

  product = await create('products', { name: `${marker}-product`, category: 'Test', defaultPrice: 1000 }, admin);
  client = await create('clients', { fullName: `${marker}-client`, phone: `+223${String(Date.now()).slice(-8)}`, city: 'Bamako', address: 'Test address' }, admin);
  trip = await create('trips', { tripNumber: marker, tripDate: new Date().toISOString(), origin: 'Bamako', destination: 'Abidjan', vehicles: [{ registration: `${marker}-truck` }] }, admin);

  const parcelInput = (overrides = {}) => ({
    clientId: client.id,
    recipientName: 'Recipient',
    recipientPhone: '+22370000002',
    recipientAddress: 'Test address',
    merchandiseType: 'Test',
    weight: 1,
    vehicle: `${marker}-truck`,
    origin: 'Bamako',
    destination: 'Abidjan',
    departureBranch: 'Bamako',
    arrivalBranch: 'Abidjan',
    packageType: 'Petit colis',
    tripId: trip.id,
    items: [{ productId: product.id, designation: product.name, quantity: 1, unitPrice: 10000 }],
    ...overrides,
  });

  // --- A. NORMAL PARCEL: single payment deleted restores the balance ----------
  normalParcel = await create('parcels', parcelInput({ paymentCondition: 'unpaid', amountPaid: 0 }), admin);
  const payA = await pay(normalParcel.id, 3000, `DEL-A-${marker}`);
  const createdAParcel = await prisma.parcel.findUnique({ where: { id: normalParcel.id } });
  record(
    'normal.createdAndPayable',
    payA.statusCode === 201 && Number(createdAParcel.amountPaid) === 3000 && Number(createdAParcel.balance) === 7000,
    `paid=${createdAParcel.amountPaid} balance=${createdAParcel.balance}`,
  );
  const delA = await invokeApi({ method: 'DELETE', resource: 'payments', id: payA.payload?.data?.id, cookie: adminCookie });
  const deletedAParcel = await prisma.parcel.findUnique({ where: { id: normalParcel.id } });
  record(
    'normal.deleteRestoresBalance',
    delA.statusCode === 204 && Number(deletedAParcel.amountPaid) === 0 && Number(deletedAParcel.balance) === 10000,
    `paid=${deletedAParcel.amountPaid} balance=${deletedAParcel.balance}`,
  );

  // --- B. PAID_ORIGIN PARCEL: origin amount survives payment deletion ----------
  originParcel = await create('parcels', parcelInput({ paymentCondition: 'paid_origin', amountPaid: 3000 }), admin);
  const payO1 = await pay(originParcel.id, 2000, `DEL-O1-${marker}`);
  const payO2 = await pay(originParcel.id, 1000, `DEL-O2-${marker}`);
  const afterOriginPays = await prisma.parcel.findUnique({ where: { id: originParcel.id } });
  record(
    'paidOrigin.createdWithTwoPayments',
    payO1.statusCode === 201 && payO2.statusCode === 201 && Number(afterOriginPays.amountPaid) === 6000 && Number(afterOriginPays.balance) === 0,
    `paid=${afterOriginPays.amountPaid}`,
  );
  const delO1 = await invokeApi({ method: 'DELETE', resource: 'payments', id: payO1.payload?.data?.id, cookie: adminCookie });
  const deletedOriginParcel = await prisma.parcel.findUnique({ where: { id: originParcel.id } });
  const remainingPayments = await prisma.payment.aggregate({ where: { parcelId: originParcel.id }, _sum: { amount: true } });
  const originContribution = Number(deletedOriginParcel.amountPaid) - Number(remainingPayments._sum.amount ?? 0);
  record(
    'paidOrigin.originAmountPreservedOnDelete',
    delO1.statusCode === 204
      && Number(deletedOriginParcel.amountPaid) === 4000
      && Number(deletedOriginParcel.balance) === 0
      && originContribution === 3000,
    `paid=${deletedOriginParcel.amountPaid} balance=${deletedOriginParcel.balance} origin=${originContribution}`,
  );

  // --- C. NORMAL PARCEL, MULTIPLE PAYMENTS: recomputed from remaining rows ------
  multiParcel = await create('parcels', parcelInput({ paymentCondition: 'unpaid', amountPaid: 0 }), admin);
  const payM1 = await pay(multiParcel.id, 2000, `DEL-M1-${marker}`);
  const payM2 = await pay(multiParcel.id, 1000, `DEL-M2-${marker}`);
  const afterMultiPays = await prisma.parcel.findUnique({ where: { id: multiParcel.id } });
  record(
    'multi.createdWithTwoPayments',
    payM1.statusCode === 201 && payM2.statusCode === 201 && Number(afterMultiPays.amountPaid) === 3000 && Number(afterMultiPays.balance) === 7000,
    `paid=${afterMultiPays.amountPaid} balance=${afterMultiPays.balance}`,
  );
  const delM1 = await invokeApi({ method: 'DELETE', resource: 'payments', id: payM1.payload?.data?.id, cookie: adminCookie });
  const deletedMultiParcel = await prisma.parcel.findUnique({ where: { id: multiParcel.id } });
  record(
    'multi.deleteRecomputesFromRemaining',
    delM1.statusCode === 204 && Number(deletedMultiParcel.amountPaid) === 1000 && Number(deletedMultiParcel.balance) === 9000,
    `paid=${deletedMultiParcel.amountPaid} balance=${deletedMultiParcel.balance}`,
  );
} finally {
  const admin = await authenticate(process.env.INITIAL_ADMIN_EMAIL, process.env.INITIAL_ADMIN_PASSWORD);
  const paymentIds = await prisma.payment.findMany({
    where: { parcelId: { in: [normalParcel?.id, originParcel?.id, multiParcel?.id].filter(Boolean) } },
    select: { id: true },
  });
  for (const item of paymentIds) {
    try { await remove('payments', item.id, admin); } catch { /* ignore */ }
  }
  for (const parcelId of [normalParcel?.id, originParcel?.id, multiParcel?.id].filter(Boolean)) {
    try { await remove('parcels', parcelId, admin); } catch { /* ignore */ }
  }
  if (trip?.id) {
    try { await remove('trips', trip.id, admin); } catch { /* ignore */ }
  }
  if (client?.id) {
    try { await remove('clients', client.id, admin); } catch { /* ignore */ }
  }
  if (product?.id) {
    try { await remove('products', product.id, admin); } catch { /* ignore */ }
  }

  const leftoverPayments = await prisma.payment.count({
    where: { parcelId: { in: [normalParcel?.id, originParcel?.id, multiParcel?.id].filter(Boolean) } },
  });
  const leftoverParcels = await prisma.parcel.count({
    where: { id: { in: [normalParcel?.id, originParcel?.id, multiParcel?.id].filter(Boolean) } },
  });
  record(
    'cleanup',
    leftoverPayments === 0 && leftoverParcels === 0,
    leftoverPayments || leftoverParcels ? 'residual test data remains' : '',
  );

  await prisma.$disconnect();
}

if (Object.values(results).some((passed) => !passed)) process.exitCode = 1;