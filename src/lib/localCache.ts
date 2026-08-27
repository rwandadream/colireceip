import { getDB } from './db';
import type {
  Client,
  Parcel,
  ParcelItem,
  Payment,
  Product,
  Trip,
  TripVehicle,
} from './types';
import type { SyncEntity } from './syncTypes';
import { hasProtectedMutation, listProtectedTargets } from './syncQueue';

// ---------------------------------------------------------------
// Server -> local polished refresh. Records still protected by a pending
// offline mutation are left untouched. Local records that no longer exist on
// the server (and are not protected) are removed.
// ---------------------------------------------------------------

type ProtectedMap = Map<string, unknown>;

async function protectedKeys(): Promise<ProtectedMap> {
  return listProtectedTargets();
}

function isProtected(map: ProtectedMap, entity: SyncEntity, id: string): boolean {
  return map.has(`${entity}:${id}`);
}

export async function refreshClients(server: Client[]): Promise<void> {
  const db = await getDB();
  const protectedMap = await protectedKeys();
  const serverIds = new Set<string>();
  for (const client of server) {
    serverIds.add(client.id);
    if (isProtected(protectedMap, 'clients', client.id)) continue;
    await upsertClient(client);
  }
  const local = await db.getAll('clients');
  for (const record of local) {
    if (!serverIds.has(record.id) && !isProtected(protectedMap, 'clients', record.id)) {
      await removeFromLocal('clients', record.id);
    }
  }
}

export async function refreshProducts(server: Product[]): Promise<void> {
  const db = await getDB();
  const protectedMap = await protectedKeys();
  const serverIds = new Set<string>();
  for (const product of server) {
    serverIds.add(product.id);
    if (isProtected(protectedMap, 'products', product.id)) continue;
    await upsertProduct(product);
  }
  const local = await db.getAll('products');
  for (const record of local) {
    if (!serverIds.has(record.id) && !isProtected(protectedMap, 'products', record.id)) {
      await removeFromLocal('products', record.id);
    }
  }
}

export async function refreshParcels(server: Array<Parcel & { items?: ParcelItem[] }>): Promise<void> {
  const db = await getDB();
  const protectedMap = await protectedKeys();
  const serverIds = new Set<string>();
  for (const parcel of server) {
    serverIds.add(parcel.id);
    if (isProtected(protectedMap, 'parcels', parcel.id)) continue;
    await upsertParcel(parcel, parcel.items ?? []);
  }
  const local = await db.getAll('parcels');
  for (const record of local) {
    if (!serverIds.has(record.id) && !isProtected(protectedMap, 'parcels', record.id)) {
      await removeFromLocal('parcels', record.id);
    }
  }
}

export async function refreshPayments(server: Payment[]): Promise<void> {
  const db = await getDB();
  const protectedMap = await protectedKeys();
  const serverIds = new Set<string>();
  for (const payment of server) {
    serverIds.add(payment.id);
    if (isProtected(protectedMap, 'payments', payment.id)) continue;
    await upsertPayment(payment);
  }
  const local = await db.getAll('payments');
  for (const record of local) {
    if (!serverIds.has(record.id) && !isProtected(protectedMap, 'payments', record.id)) {
      await removeFromLocal('payments', record.id);
    }
  }
}

export async function refreshTrips(server: Trip[], allVehicles: TripVehicle[]): Promise<void> {
  const db = await getDB();
  const protectedMap = await protectedKeys();
  const serverIds = new Set<string>();
  for (const trip of server) {
    serverIds.add(trip.id);
    if (isProtected(protectedMap, 'trips', trip.id)) continue;
    const vehicles = allVehicles.filter((vehicle) => vehicle.trip_id === trip.id);
    await upsertTrip(trip, vehicles);
  }
  const localTrips = await db.getAll('trips');
  for (const record of localTrips) {
    if (!serverIds.has(record.id) && !isProtected(protectedMap, 'trips', record.id)) {
      await removeFromLocal('trips', record.id);
    }
  }
  // Remove vehicle-level protected entries too (they are tracked separately).
  const localVehicles = await db.getAll('trip_vehicles');
  for (const vehicle of localVehicles) {
    const tripStillPresent = server.some((trip) => trip.id === vehicle.trip_id);
    if (!tripStillPresent && !isProtected(protectedMap, 'trip-vehicles', vehicle.id)) {
      await db.delete('trip_vehicles', vehicle.id);
    }
  }
}

export async function protectedUpsert(entity: SyncEntity, id: string, write: () => Promise<void>): Promise<boolean> {
  if (await hasProtectedMutation(entity, id)) return false;
  await write();
  return true;
}

export async function upsertClient(client: Client): Promise<void> {
  const db = await getDB();
  await db.put('clients', client);
}

export async function upsertProduct(product: Product): Promise<void> {
  const db = await getDB();
  await db.put('products', product);
}

export async function upsertParcel(parcel: Parcel, items: ParcelItem[] = []): Promise<void> {
  const db = await getDB();
  await db.put('parcels', parcel);
  if ((parcel as Parcel & { items?: ParcelItem[] }).items) {
    delete (parcel as Parcel & { items?: ParcelItem[] }).items;
  }
  const existing = items.length > 0;
  if (existing) {
    const oldItems = await db.getAllFromIndex('parcel_items', 'by-parcel', parcel.id);
    for (const old of oldItems) await db.delete('parcel_items', old.id);
    for (const item of items) await db.put('parcel_items', item);
  }
}

export async function upsertPayment(payment: Payment): Promise<void> {
  const db = await getDB();
  await db.put('payments', payment);
}

export async function upsertTrip(trip: Trip, vehicles: TripVehicle[] = []): Promise<void> {
  const db = await getDB();
  await db.put('trips', trip);
  if (vehicles.length > 0) {
    const oldVehicles = await db.getAllFromIndex('trip_vehicles', 'by-trip', trip.id);
    for (const old of oldVehicles) await db.delete('trip_vehicles', old.id);
    for (const vehicle of vehicles) await db.put('trip_vehicles', vehicle);
  }
}

export async function upsertTripVehicle(vehicle: TripVehicle): Promise<void> {
  const db = await getDB();
  await db.put('trip_vehicles', vehicle);
}

export async function removeFromLocal(entity: SyncEntity, id: string): Promise<void> {
  const db = await getDB();
  if (entity === 'clients') await db.delete('clients', id);
  else if (entity === 'products') await db.delete('products', id);
  else if (entity === 'payments') {
    const payment = await db.get('payments', id);
    await db.delete('payments', id);
    if (payment?.parcel_id) await reconcileParcelFromPayments(payment.parcel_id);
  } else if (entity === 'trips') {
    const vehicles = await db.getAllFromIndex('trip_vehicles', 'by-trip', id);
    for (const vehicle of vehicles) await db.delete('trip_vehicles', vehicle.id);
    await db.delete('trips', id);
  } else if (entity === 'trip-vehicles') {
    await db.delete('trip_vehicles', id);
  } else if (entity === 'parcels') {
    const items = await db.getAllFromIndex('parcel_items', 'by-parcel', id);
    for (const item of items) await db.delete('parcel_items', item.id);
    const payments = await db.getAllFromIndex('payments', 'by-parcel', id);
    for (const payment of payments) await db.delete('payments', payment.id);
    const history = await db.getAllFromIndex('status_history', 'by-parcel', id);
    for (const h of history) await db.delete('status_history', h.id);
    await db.delete('parcels', id);
  }
}

// Recomputes the local parcel "amount_paid"/"balance" after a local payment was
// removed so the view stays coherent while offline.
export async function reconcileParcelFromPayments(parcelId: string): Promise<void> {
  const db = await getDB();
  const parcel = await db.get('parcels', parcelId);
  if (!parcel) return;
  const payments = await db.getAllFromIndex('payments', 'by-parcel', parcelId);
  const amountPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const condition = parcel.payment_condition || 'unpaid';
  const total = Number(parcel.total_amount) || 0;
  const updated = {
    ...parcel,
    amount_paid: amountPaid,
    balance: condition === 'paid_origin' ? 0 : Math.max(total - amountPaid, 0),
    updated_at: new Date().toISOString(),
  };
  await db.put('parcels', updated);
}