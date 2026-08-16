import 'dotenv/config';
import bcrypt from 'bcryptjs';
import dataHandler from '../api/data.js';
import { authenticate, createSessionToken } from '../server/auth.js';
import { create, remove } from '../server/data.js';
import { prisma } from '../server/prisma.js';

const marker = `idempotency-test-${Date.now()}`;
const idempotencyKey = `TEST-IDEMPOTENCY-${marker}`;
const concurrentKey = `TEST-IDEMPOTENCY-CONCURRENT-${marker}`;
const paymentAmount = 10000;

const results = {};
const record = (name, passed, detail = '') => {
  results[name] = passed;
  console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}${detail ? ` (${detail})` : ''}`);
};

const assertError = (error, code) => error?.code === code || error?.message === code;

async function invokeApi({ method = 'POST', resource, body, cookie, idempotencyKey: key }) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (key) headers['idempotency-key'] = key;
  const req = { method, query: { resource }, headers, body };
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

let product;
let client;
let trip;
let parcel;
let concurrentParcel;
let payment;
let agentUser;
let agentCookie;

try {
  const admin = await authenticate(process.env.INITIAL_ADMIN_EMAIL, process.env.INITIAL_ADMIN_PASSWORD);
  if (!admin) throw new Error('Admin authentication failed.');
  const adminCookie = `groupe_gaff_session=${encodeURIComponent(createSessionToken(admin))}`;

  product = await create('products', { name: `${marker}-product`, category: 'Test', defaultPrice: 1000 }, admin);
  client = await create('clients', { fullName: `${marker}-client`, phone: `+223${String(Date.now()).slice(-8)}`, city: 'Bamako', address: 'Test address' }, admin);
  trip = await create('trips', { tripNumber: marker, tripDate: new Date().toISOString(), origin: 'Bamako', destination: 'Abidjan', vehicles: [{ registration: `${marker}-truck` }] }, admin);
  parcel = await create('parcels', {
    clientId: client.id,
    recipientName: 'Recipient',
    recipientPhone: '+22370000000',
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
    items: [{ productId: product.id, designation: product.name, quantity: 1, unitPrice: 1000 }],
  }, admin);

  const initialParcel = await prisma.parcel.findUnique({ where: { id: parcel.id } });
  const initialBalance = Number(initialParcel.balance);
  const initialAmountPaid = Number(initialParcel.amountPaid);

  const expectedBalance = Math.max(initialBalance - paymentAmount, 0);
  const expectedAmountPaid = initialAmountPaid + paymentAmount;
  const paymentPayload = {
    parcelId: parcel.id,
    amount: paymentAmount,
    paymentMethod: 'cash',
    paymentDate: new Date().toISOString(),
    note: `${marker}-payment`,
  };

  // TEST 1 — FIRST PAYMENT
  const firstApi = await invokeApi({ resource: 'payments', body: paymentPayload, cookie: adminCookie, idempotencyKey });
  payment = firstApi.payload?.data;
  const afterFirstParcel = await prisma.parcel.findUnique({ where: { id: parcel.id } });
  record(
    'firstPayment',
    firstApi.statusCode === 201
      && payment?.id
      && payment.idempotencyKey === idempotencyKey
      && Number(payment.amount) === paymentAmount
      && Number(afterFirstParcel.amountPaid) === expectedAmountPaid
      && Number(afterFirstParcel.balance) === expectedBalance,
  );

  // TEST 2 — EXACT RETRY
  const retryApi = await invokeApi({ resource: 'payments', body: paymentPayload, cookie: adminCookie, idempotencyKey });
  const afterRetryParcel = await prisma.parcel.findUnique({ where: { id: parcel.id } });
  const paymentCount = await prisma.payment.count({ where: { idempotencyKey } });
  record(
    'exactRetry',
    retryApi.statusCode === 201
      && retryApi.payload?.data?.id === payment.id
      && paymentCount === 1
      && Number(afterRetryParcel.amountPaid) === expectedAmountPaid
      && Number(afterRetryParcel.balance) === expectedBalance,
  );

  // TEST 3 — SAME KEY, DIFFERENT PAYLOAD
  let conflictThrown = false;
  try {
    await create('payments', { ...paymentPayload, amount: 50000, parcelId: parcel.id }, admin, { idempotencyKey });
  } catch (error) {
    conflictThrown = assertError(error, 'IDEMPOTENCY_CONFLICT');
  }
  const afterConflictParcel = await prisma.parcel.findUnique({ where: { id: parcel.id } });
  record(
    'sameKeyDifferentPayload',
    conflictThrown
      && (await prisma.payment.count({ where: { idempotencyKey } })) === 1
      && Number(afterConflictParcel.balance) === expectedBalance,
  );

  // TEST 4 — MISSING IDEMPOTENCY KEY
  const missingKeyApi = await invokeApi({ resource: 'payments', body: paymentPayload, cookie: adminCookie });
  record('missingIdempotencyKey', missingKeyApi.statusCode === 400);

  // TEST 5 — CONCURRENT DUPLICATE
  concurrentParcel = await create('parcels', {
    clientId: client.id,
    recipientName: 'Concurrent Recipient',
    recipientPhone: '+22370000001',
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
    items: [{ productId: product.id, designation: product.name, quantity: 1, unitPrice: 1000 }],
  }, admin);
  const concurrentPayload = {
    parcelId: concurrentParcel.id,
    amount: 2500,
    paymentMethod: 'cash',
    paymentDate: new Date().toISOString(),
    note: `${marker}-concurrent`,
  };
  const [concurrentA, concurrentB] = await Promise.allSettled([
    create('payments', concurrentPayload, admin, { idempotencyKey: concurrentKey }),
    create('payments', concurrentPayload, admin, { idempotencyKey: concurrentKey }),
  ]).then((results) => results.map((result) => (result.status === 'fulfilled' ? result.value : null)));
  const concurrentIds = [concurrentA?.id, concurrentB?.id].filter(Boolean);
  const concurrentCount = await prisma.payment.count({ where: { idempotencyKey: concurrentKey } });
  const concurrentParcelAfter = await prisma.parcel.findUnique({ where: { id: concurrentParcel.id } });
  record(
    'concurrentDuplicate',
    concurrentIds.length === 2
      && concurrentIds[0] === concurrentIds[1]
      && concurrentCount === 1
      && Number(concurrentParcelAfter.amountPaid) === 2500,
  );

  // TEST 6 — UNAUTHENTICATED
  const unauthenticatedApi = await invokeApi({ resource: 'payments', body: paymentPayload, idempotencyKey: `${idempotencyKey}-unauth` });
  record('unauthenticated', unauthenticatedApi.statusCode === 401);

  // TEST 7 — UNAUTHORIZED
  agentUser = await prisma.user.create({
    data: {
      phone: `+223${String(Date.now() + 1).slice(-8)}`,
      email: `${marker}-agent@groupe-gaff.invalid`,
      fullName: `${marker}-agent`,
      role: 'agent',
      active: true,
      passwordHash: await bcrypt.hash('test-agent-password', 12),
    },
  });
  agentCookie = `groupe_gaff_session=${encodeURIComponent(createSessionToken({
    id: agentUser.id,
    email: agentUser.email,
    full_name: agentUser.fullName,
    phone: agentUser.phone,
    role: agentUser.role,
    active: agentUser.active,
    created_at: agentUser.createdAt.toISOString(),
    updated_at: agentUser.updatedAt.toISOString(),
  }))}`;
  const unauthorizedApi = await invokeApi({
    resource: 'payments',
    body: paymentPayload,
    cookie: agentCookie,
    idempotencyKey: `${idempotencyKey}-unauthorized`,
  });
  record('unauthorized', unauthorizedApi.statusCode === 403);

  // TEST 8 — FINANCIAL CONSISTENCY
  const storedPayment = await prisma.payment.findUnique({ where: { idempotencyKey } });
  const storedParcel = await prisma.parcel.findUnique({ where: { id: parcel.id } });
  record(
    'financialConsistency',
    storedPayment
      && Number(storedPayment.amount) === paymentAmount
      && storedPayment.idempotencyFingerprint
      && Number(storedParcel.amountPaid) === expectedAmountPaid
      && Number(storedParcel.balance) === expectedBalance
      && (await prisma.payment.count({ where: { idempotencyKey } })) === 1,
  );
} finally {
  // TEST 9 — CLEANUP
  const admin = await authenticate(process.env.INITIAL_ADMIN_EMAIL, process.env.INITIAL_ADMIN_PASSWORD);
  const concurrentPayments = await prisma.payment.findMany({ where: { idempotencyKey: concurrentKey }, select: { id: true } });
  for (const item of concurrentPayments) {
    try { await remove('payments', item.id, admin); } catch { /* ignore */ }
  }
  if (payment?.id) {
    try { await remove('payments', payment.id, admin); } catch { /* ignore */ }
  }
  for (const parcelId of [concurrentParcel?.id, parcel?.id].filter(Boolean)) {
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
  if (agentUser?.id) {
    await prisma.user.delete({ where: { id: agentUser.id } }).catch(() => {});
  }

  const leftoverPayments = await prisma.payment.count({ where: { OR: [{ idempotencyKey }, { idempotencyKey: concurrentKey }] } });
  const leftoverParcels = await prisma.parcel.count({ where: { id: { in: [parcel?.id, concurrentParcel?.id].filter(Boolean) } } });
  const leftoverUsers = agentUser?.id ? await prisma.user.count({ where: { id: agentUser.id } }) : 0;
  record(
    'cleanup',
    leftoverPayments === 0 && leftoverParcels === 0 && leftoverUsers === 0,
    leftoverPayments || leftoverParcels || leftoverUsers ? 'residual test data remains' : '',
  );

  await prisma.$disconnect();
}

if (Object.values(results).some((passed) => !passed)) process.exitCode = 1;
