import 'dotenv/config';
import { authenticate } from '../server/auth.js';
import { create, list, remove } from '../server/data.js';

const marker = `collision-${Date.now()}`;
const tracking = `GG-COL-${70000 + (Date.now() % 29999)}`;
const user = await authenticate(process.env.INITIAL_ADMIN_EMAIL, process.env.INITIAL_ADMIN_PASSWORD);
if (!user) throw new Error('Test authentication failed.');

let client; let parcelA; let parcelB;
const baseParcel = (clientId) => ({
  clientId,
  recipientName: 'Recipient',
  recipientPhone: '+22370000000',
  recipientAddress: 'Test address',
  merchandiseType: 'Test',
  weight: 1,
  origin: 'Bamako',
  destination: 'Abidjan',
  departureBranch: 'Bamako',
  arrivalBranch: 'Abidjan',
  packageType: 'Petit colis',
  items: [{ designation: marker, quantity: 1, unitPrice: 1000 }],
});
try {
  client = await create('clients', { fullName: `${marker}-client`, phone: `+223${String(Date.now()).slice(-8)}`, city: 'Bamako', address: 'Test address' }, user);
  parcelA = await create('parcels', { ...baseParcel(client.id), trackingNumber: tracking }, user);
  parcelB = await create('parcels', { ...baseParcel(client.id), trackingNumber: tracking }, user);

  const all = await list('parcels', user);
  const serverA = all.find((item) => item.id === parcelA.id);
  const serverB = all.find((item) => item.id === parcelB.id);

  const regenerated = serverB && serverB.trackingNumber !== serverA.trackingNumber && /^GG-COL-\d+$/.test(serverB.trackingNumber);
  const duplicatesEliminated = all.filter((item) => item.trackingNumber === serverA.trackingNumber).length === 1
    && all.filter((item) => item.trackingNumber === serverB.trackingNumber).length === 1;

  console.log(`trackingRegenerated: ${regenerated ? 'PASS' : 'FAIL'} (${serverA && serverA.trackingNumber} -> ${serverB && serverB.trackingNumber})`);
  console.log(`duplicatesEliminated: ${duplicatesEliminated ? 'PASS' : 'FAIL'}`);
  if (!regenerated || !duplicatesEliminated) process.exitCode = 1;
} finally {
  if (parcelB) await remove('parcels', parcelB.id, user).catch(() => {});
  if (parcelA) await remove('parcels', parcelA.id, user).catch(() => {});
  if (client) await remove('clients', client.id, user).catch(() => {});
}