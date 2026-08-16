import 'dotenv/config';
import { authenticate } from '../server/auth.js';
import { create, list, remove } from '../server/data.js';

const marker = `api-test-${Date.now()}`;
const user = await authenticate(process.env.INITIAL_ADMIN_EMAIL, process.env.INITIAL_ADMIN_PASSWORD);
if (!user) throw new Error('Test authentication failed.');

let product; let client; let trip; let parcel; let payment;
try {
  product = await create('products', { name: `${marker}-product`, category: 'Test', defaultPrice: 1000 }, user);
  client = await create('clients', { fullName: `${marker}-client`, phone: `+223${String(Date.now()).slice(-8)}`, city: 'Bamako', address: 'Test address' }, user);
  trip = await create('trips', { tripNumber: marker, tripDate: new Date().toISOString(), origin: 'Bamako', destination: 'Abidjan', vehicles: [{ registration: `${marker}-truck` }] }, user);
  parcel = await create('parcels', { clientId: client.id, recipientName: 'Recipient', recipientPhone: '+22370000000', recipientAddress: 'Test address', merchandiseType: 'Test', weight: 1, vehicle: `${marker}-truck`, origin: 'Bamako', destination: 'Abidjan', departureBranch: 'Bamako', arrivalBranch: 'Abidjan', packageType: 'Petit colis', tripId: trip.id, items: [{ productId: product.id, designation: product.name, quantity: 1, unitPrice: 1000 }] }, user);
  payment = await create('payments', { parcelId: parcel.id, amount: 250, paymentMethod: 'cash', paymentDate: new Date().toISOString() }, user, { idempotencyKey: `${marker}-payment` });
  const { update } = await import('../server/data.js');
  await update('products', product.id, { category: 'Updated test' }, user);
  await update('clients', client.id, { notes: 'Updated test' }, user);
  await update('trips', trip.id, { status: 'in_transit' }, user);
  await update('parcels', parcel.id, { status: 'in_transit' }, user);
  await update('payments', payment.id, { note: 'Updated test' }, user);
  const [products, clients, trips, parcels, payments] = await Promise.all(['products', 'clients', 'trips', 'parcels', 'payments'].map((resource) => list(resource, user)));
  const tests = { productCrud: products.some((item) => item.id === product.id && item.category === 'Updated test'), clientCrud: clients.some((item) => item.id === client.id && item.notes === 'Updated test'), tripCrud: trips.some((item) => item.id === trip.id && item.status === 'in_transit' && item.vehicles.length === 1), parcelCrud: parcels.some((item) => item.id === parcel.id && item.status === 'in_transit' && item.items.length === 1), paymentCrud: payments.some((item) => item.id === payment.id && item.note === 'Updated test') };
  for (const [name, passed] of Object.entries(tests)) console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}`);
  if (Object.values(tests).some((passed) => !passed)) process.exitCode = 1;
} finally {
  if (payment) await remove('payments', payment.id, user);
  if (parcel) await remove('parcels', parcel.id, user);
  if (trip) await remove('trips', trip.id, user);
  if (client) await remove('clients', client.id, user);
  if (product) await remove('products', product.id, user);
}
