import { getDB, seedDefaultData } from './db';
import { createOfflineVerifier, storeUserVerifier, normalizeIdentifier } from './authVerifier';
import type {
  User,
  Client,
  Product,
  Parcel,
  ParcelItem,
  Payment,
  ExpenseCategory,
  TripExpense,
  StatusHistory,
  ActivityLog,
  AppSettings,
  DashboardStats,
  ParcelStatus,
  Attachment,
  AttachmentEntityType,
  Trip,
  TripVehicle,
  TripStatus,
} from './types';
import { generateId, generateTrackingNumber, isToday, toISO } from './format';
import { AUTH_STORAGE_KEYS, readStorageJson } from './storage';
import { canUseClientApi, deleteOnlineClient, isApiUnavailable, listOnlineClients } from './clientPersistence';
import { ApiError } from './api';
import { canUseProductApi, isProductApiUnavailable, listOnlineProducts } from './productPersistence';
import { canUseTripApi, isTripApiUnavailable, listOnlineTripVehicles, listOnlineTrips } from './tripPersistence';
import { canUsePaymentApi, isPaymentApiUnavailable, listOnlinePayments } from './paymentPersistence';
import { canUseParcelApi, isParcelApiUnavailable, listOnlineParcels, listOnlineStatusHistory } from './parcelPersistence';
import { canUseUserApi, createOnlineUser, deleteOnlineUser, isUserApiUnavailable, listOnlineUsers, updateOnlineUser } from './userPersistence';
import { canUseSettingsApi, isSettingsApiUnavailable, listOnlineSettings, settingsToApi } from './settingsPersistence';
import { canUseExpenseApi, isExpenseApiUnavailable, listOnlineExpenses } from './expensePersistence';
import { cancelMutations, enqueueMutation, hasProtectedMutation, listProtectedTargets, mergeLocalPending } from './syncQueue';
import { requestSync } from './syncEngine';
import { refreshClients, refreshExpenses, refreshParcels, refreshPayments, refreshProducts, refreshSettings, refreshTrips, reconcileParcelFromPayments } from './localCache';
import type { SyncEntity } from './syncTypes';

export async function ensureSeed(): Promise<void> {
  await seedDefaultData();
}

function notifySync(): void {
  void requestSync();
}

function pickChanged<T extends object>(
  previous: T,
  next: T,
  keys: Array<keyof T & string>
): Record<string, unknown> {
  const changed: Record<string, unknown> = {};
  for (const key of keys) {
    const before = (previous as Record<string, unknown>)[key];
    const after = (next as Record<string, unknown>)[key];
    if (after !== undefined && after !== before) changed[key] = after;
  }
  return changed;
}

async function collectProtectedIds(entity: SyncEntity, ids: string[]): Promise<Set<string>> {
  const map = await listProtectedTargets();
  const set = new Set<string>();
  for (const id of ids) {
    if (map.has(`${entity}:${id}`)) set.add(id);
  }
  return set;
}

// ============================================================
// TRIPS
// ============================================================
export async function getTrips(): Promise<Trip[]> {
  if (canUseTripApi()) {
    try {
      const server = await listOnlineTrips();
      const vehicles = server.flatMap((trip) => (trip as Trip & { vehicles?: TripVehicle[] }).vehicles ?? []);
      await refreshTrips(server, vehicles);
      const db = await getDB();
      const local = await db.getAll('trips');
      const protectedIds = await collectProtectedIds('trips', local.map((t) => t.id));
      const user = getAuthenticatedUser();
      return mergeLocalPending(server, local, protectedIds)
        .filter((trip) => canAccessOwnedRecord(user, trip.created_by))
        .sort((a, b) => b.trip_date.localeCompare(a.trip_date));
    } catch (error) { if (!isTripApiUnavailable(error)) throw error; }
  }
  const db = await getDB();
  const user = getAuthenticatedUser();
  const trips = (await db.getAll('trips')).filter((trip) => canAccessOwnedRecord(user, trip.created_by));
  return trips.sort((a, b) => b.trip_date.localeCompare(a.trip_date));
}

export async function getTripById(id: string): Promise<Trip | undefined> {
  const db = await getDB();
  const user = getAuthenticatedUser();
  const cached = await db.get('trips', id);
  if (cached && canAccessOwnedRecord(user, cached.created_by)) return cached;
  const all = await getTrips();
  return all.find((trip) => trip.id === id);
}

export async function createTrip(data: Omit<Trip, 'id' | 'created_at' | 'updated_at'>): Promise<Trip> {
  const db = await getDB();
  const now = toISO();
  const user = getAuthenticatedUser();
  const trip: Trip = {
    ...data,
    created_by: user?.role === 'agent' ? user.id : data.created_by,
    created_by_name: user?.role === 'agent' ? user.full_name : data.created_by_name,
    id: generateId(),
    created_at: now,
    updated_at: now,
  };
  await db.put('trips', trip);
  await enqueueMutation({ entity: 'trips', entityId: trip.id, action: 'create', payload: { ...trip } });
  notifySync();
  return trip;
}

export async function updateTrip(id: string, data: Partial<Trip>): Promise<Trip | undefined> {
  const db = await getDB();
  const existing = await db.get('trips', id);
  if (!existing) return undefined;
  requireOwnedAccess(existing.created_by);
  const trip = { ...existing, ...data, id, updated_at: toISO() };
  await db.put('trips', trip);
  const changed = pickChanged(existing, trip, ['trip_number', 'trip_date', 'origin', 'destination', 'status']);
  if (Object.keys(changed).length > 0) {
    await enqueueMutation({ entity: 'trips', entityId: id, action: 'update', payload: changed });
    notifySync();
  }
  return trip;
}

export async function deleteTrip(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get('trips', id);
  if (!existing) return;
  requireOwnedAccess(existing.created_by);
  const vehicles = await db.getAllFromIndex('trip_vehicles', 'by-trip', id);
  for (const vehicle of vehicles) await db.delete('trip_vehicles', vehicle.id);
  await db.delete('trips', id);
  // Vehicles must be removed first on the server (foreign key).
  for (const vehicle of vehicles) {
    await enqueueMutation({ entity: 'trip-vehicles', entityId: vehicle.id, action: 'delete', payload: {} });
  }
  await enqueueMutation({ entity: 'trips', entityId: id, action: 'delete', payload: {} });
  notifySync();
}

export async function getTripVehicles(tripId: string): Promise<TripVehicle[]> {
  if (canUseTripApi()) {
    try {
      const server = await listOnlineTripVehicles(tripId);
      const db = await getDB();
      for (const vehicle of server) {
        if (!(await hasProtectedMutation('trip-vehicles', vehicle.id))) {
          await db.put('trip_vehicles', vehicle);
        }
      }
      const local = await db.getAllFromIndex('trip_vehicles', 'by-trip', tripId);
      const protectedIds = await collectProtectedIds('trip-vehicles', local.map((v) => v.id));
      return mergeLocalPending(server, local, protectedIds).sort((a, b) => a.vehicle_number - b.vehicle_number);
    } catch (error) { if (!isTripApiUnavailable(error)) throw error; }
  }
  const db = await getDB();
  if (!(await getTripById(tripId))) return [];
  const vehicles = await db.getAllFromIndex('trip_vehicles', 'by-trip', tripId);
  return vehicles.sort((a, b) => a.vehicle_number - b.vehicle_number);
}

export async function createTripVehicle(
  data: Omit<TripVehicle, 'id' | 'vehicle_number' | 'created_at' | 'updated_at'>
): Promise<TripVehicle> {
  const db = await getDB();
  const existing = await db.getAllFromIndex('trip_vehicles', 'by-trip', data.trip_id);
  const vehicle_number = existing.reduce((max, vehicle) => Math.max(max, vehicle.vehicle_number), 0) + 1;
  const now = toISO();
  const vehicle: TripVehicle = { ...data, id: generateId(), vehicle_number, created_at: now, updated_at: now };
  await db.put('trip_vehicles', vehicle);
  await enqueueMutation({ entity: 'trip-vehicles', entityId: vehicle.id, action: 'create', payload: { ...vehicle } });
  notifySync();
  return vehicle;
}

export async function deleteTripVehicle(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('trip_vehicles', id);
  await enqueueMutation({ entity: 'trip-vehicles', entityId: id, action: 'delete', payload: {} });
  notifySync();
}

export async function getParcelsByTripId(tripId: string): Promise<Parcel[]> {
  const parcels = await getParcels();
  return parcels.filter((parcel) => parcel.trip_id === tripId);
}

export function getTripStatusLabel(status: TripStatus): string {
  return { planned: 'Planifié', in_transit: 'En route', arrived: 'Arrivé', closed: 'Clôturé', cancelled: 'Annulé' }[status];
}

// ============================================================
// USERS
// ============================================================
export async function getUsers(): Promise<User[]> {
  if (canUseUserApi()) {
    try {
      const onlineUsers = await listOnlineUsers();
      const db = await getDB();
      for (const u of onlineUsers) {
        await db.put('users', u);
      }
      return onlineUsers;
    } catch (error) {
      if (!isUserApiUnavailable(error)) throw error;
    }
  }
  const db = await getDB();
  return db.getAll('users');
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const all = await getUsers();
  const query = normalizeIdentifier(email);
  return all.find((u) =>
    (u.email ? normalizeIdentifier(u.email) === query : false) ||
    normalizeIdentifier(u.phone) === query
  );
}

function requireDirectorAccess(): void {
  const user = readStorageJson<User>(AUTH_STORAGE_KEYS);
  if (!user) throw new Error('Accès refusé. Connexion Directeur requise.');
  if (user.role !== 'admin') throw new Error('Accès refusé. Les dépenses sont réservées au Directeur.');
}

function getAuthenticatedUser(): User | null {
  return readStorageJson<User>(AUTH_STORAGE_KEYS);
}

function canSeeAllData(user: User | null): boolean {
  return user?.role === 'admin';
}

function canAccessOwnedRecord(user: User | null, ownerId: string | undefined): boolean {
  return canSeeAllData(user) || Boolean(user && ownerId === user.id);
}

function requireOwnedAccess(ownerId: string | undefined): void {
  if (!canAccessOwnedRecord(getAuthenticatedUser(), ownerId)) {
    throw new Error('Accès refusé. Cet enregistrement appartient à un autre utilisateur.');
  }
}

export async function getUserById(id: string): Promise<User | undefined> {
  const db = await getDB();
  return db.get('users', id);
}

export async function createUser(
  data: Omit<User, 'id' | 'created_at' | 'updated_at'>
): Promise<User> {
  const password = typeof data.password === 'string' ? data.password.trim() : '';
  let createdUser: User | undefined;
  if (canUseUserApi()) {
    try {
      createdUser = await createOnlineUser(data);
    } catch (error) {
      if (!isUserApiUnavailable(error)) throw error;
    }
  }

  const db = await getDB();
  if (!data.full_name.trim() || !data.phone.trim() || (!createdUser && !password)) {
    throw new Error('Le nom complet, le téléphone et le mot de passe sont obligatoires.');
  }

  const now = toISO();
  const user: User = createdUser || {
    ...data,
    id: generateId(),
    created_at: now,
    updated_at: now,
  };

  await db.put('users', toStoredUser(user));
  if (password && !createdUser) {
    await storeUserVerifier(user, password);
  }
  return user;
}

export async function updateUser(id: string, data: Partial<User>): Promise<void> {
  const password = typeof data.password === 'string' ? data.password.trim() : '';
  if (canUseUserApi()) {
    try {
      await updateOnlineUser(id, data);
    } catch (error) {
      if (!isUserApiUnavailable(error)) throw error;
    }
  }
  const db = await getDB();
  const existing = await db.get('users', id);
  if (!existing) return;
  await db.put('users', toStoredUser({ ...existing, ...data, id, updated_at: toISO() }));
  if (password) {
    const identifiers = new Set<string>();
    if (existing.email) identifiers.add(normalizeIdentifier(existing.email));
    if (existing.phone) identifiers.add(normalizeIdentifier(existing.phone));
    if (data.email) identifiers.add(normalizeIdentifier(data.email));
    if (data.phone) identifiers.add(normalizeIdentifier(data.phone));
    for (const identifier of identifiers) {
      if (identifier) await createOfflineVerifier(identifier, password);
    }
  }
}

function toStoredUser(user: User): User {
  const stored: User = { ...user };
  delete (stored as User & { password?: string }).password;
  return stored;
}

export async function deleteUser(id: string): Promise<void> {
  if (canUseUserApi()) {
    try {
      await deleteOnlineUser(id);
    } catch (error) {
      if (!isUserApiUnavailable(error)) throw error;
    }
  }
  const db = await getDB();
  await db.delete('users', id);
}

// ============================================================
// CLIENTS
// ============================================================
export async function getClients(): Promise<Client[]> {
  if (canUseClientApi()) {
    try {
      const server = await listOnlineClients();
      await refreshClients(server);
      const db = await getDB();
      const local = await db.getAll('clients');
      const protectedIds = await collectProtectedIds('clients', local.map((c) => c.id));
      return mergeLocalPending(server, local, protectedIds).sort((a, b) => b.created_at.localeCompare(a.created_at));
    } catch (error) { if (!isApiUnavailable(error)) throw error; }
  }
  const db = await getDB();
  const all = await db.getAll('clients');
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getClientById(id: string): Promise<Client | undefined> {
  const db = await getDB();
  const cached = await db.get('clients', id);
  if (cached) return cached;
  const all = await getClients();
  return all.find((client) => client.id === id);
}

export async function createClient(
  data: Omit<Client, 'id' | 'created_at' | 'updated_at'>
): Promise<Client> {
  const db = await getDB();
  const now = toISO();
  const user = getAuthenticatedUser();
  const client: Client = {
    ...data,
    created_by: user?.role === 'agent' ? user.id : data.created_by,
    created_by_name: user?.role === 'agent' ? user.full_name : data.created_by_name,
    id: generateId(),
    created_at: now,
    updated_at: now,
  };
  await db.put('clients', client);
  await enqueueMutation({ entity: 'clients', entityId: client.id, action: 'create', payload: { ...client } });
  notifySync();
  return client;
}

export async function updateClient(id: string, data: Partial<Client>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('clients', id);
  if (!existing) return;
  requireOwnedAccess(existing.created_by);
  const updated = { ...existing, ...data, id, updated_at: toISO() };
  await db.put('clients', updated);
  const changed = pickChanged(existing, updated, ['full_name', 'phone', 'company_name', 'email', 'city', 'neighborhood', 'address', 'reference', 'notes']);
  if (Object.keys(changed).length > 0) {
    await enqueueMutation({ entity: 'clients', entityId: id, action: 'update', payload: changed });
    notifySync();
  }
}

export async function getRelatedDataForClient(clientId: string): Promise<{ parcels: Parcel[]; payments: Payment[] }> {
  const [parcels, payments] = await Promise.all([
    getParcels().then((all) => all.filter((parcel) => parcel.client_id === clientId)),
    getPaymentsByClient(clientId),
  ]);

  return { parcels, payments };
}

export async function deleteClient(id: string): Promise<{ pendingSync: boolean }> {
  const db = await getDB();
  const existing = await db.get('clients', id);
  if (!existing) return { pendingSync: false };
  requireOwnedAccess(existing.created_by);
  if (canUseClientApi()) {
    try {
      // Online: the server must confirm the deletion before the UI may claim
      // success. A permanent rejection (401/403/400/409) is surfaced to the
      // user instead of presenting a local-only deletion as successful.
      await deleteOnlineClient(id);
      // Purge offline-edited mutations for the deleted record so they are never
      // replayed against the now-removed server row (client-not-found 400s).
      await cancelMutations('clients', id);
    } catch (error) {
      if (isApiUnavailable(error)) {
        await db.delete('clients', id);
        await enqueueMutation({ entity: 'clients', entityId: id, action: 'delete', payload: {} });
        notifySync();
        return { pendingSync: true };
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          throw new Error('Votre session a expiré. Connectez-vous à nouveau pour supprimer ce client.');
        }
        if (error.status === 403) {
          throw new Error('Vous n\'avez pas la permission de supprimer ce client.');
        }
      }
      throw error;
    }
  } else {
    await db.delete('clients', id);
    await enqueueMutation({ entity: 'clients', entityId: id, action: 'delete', payload: {} });
    notifySync();
    return { pendingSync: true };
  }
  await db.delete('clients', id);
  return { pendingSync: false };
}

// ============================================================
// EXPENSES
// ============================================================
const DEFAULT_EXPENSE_CATEGORIES = [
  'Douane',
  'Carburant',
  'Police',
  'Gendarmerie',
  'Péage',
  'Réparation',
  'Manutention',
  'Déchargement',
  'Chargement',
  'Parking',
  'Hébergement',
  'Nourriture',
  'Communication',
  'Divers',
];

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  requireDirectorAccess();
  const db = await getDB();
  const all = await db.getAll('expense_categories');
  if (all.length === 0) {
    const categories = DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
      id: name,
      name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    for (const category of categories) {
      await db.put('expense_categories', category);
    }
    return categories;
  }
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createExpenseCategory(
  data: Omit<ExpenseCategory, 'id' | 'created_at' | 'updated_at'>
): Promise<ExpenseCategory> {
  requireDirectorAccess();
  const db = await getDB();
  const now = toISO();
  const category: ExpenseCategory = { ...data, id: generateId(), created_at: now, updated_at: now };
  await db.put('expense_categories', category);
  return category;
}

export async function getTripExpenses(): Promise<TripExpense[]> {
  requireDirectorAccess();
  if (canUseExpenseApi()) {
    try {
      const server = await listOnlineExpenses();
      await refreshExpenses(server);
      const db = await getDB();
      const local = await db.getAll('trip_expenses');
      const protectedIds = await collectProtectedIds('expenses', local.map((e) => e.id));
      return mergeLocalPending(server, local, protectedIds).sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || ''));
    } catch (error) { if (!isExpenseApiUnavailable(error)) throw error; }
  }
  const db = await getDB();
  const all = await db.getAll('trip_expenses');
  return all.sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || ''));
}

export async function getExpensesByParcelId(parcelId: string): Promise<TripExpense[]> {
  requireDirectorAccess();
  const all = await getTripExpenses();
  return all.filter((expense) => expense.parcel_id === parcelId);
}

export async function getTripExpenseById(id: string): Promise<TripExpense | undefined> {
  requireDirectorAccess();
  const db = await getDB();
  const cached = await db.get('trip_expenses', id);
  if (cached) return cached;
  const all = await getTripExpenses();
  return all.find((expense) => expense.id === id);
}

export async function createTripExpense(
  data: Omit<TripExpense, 'id' | 'created_at' | 'updated_at'>
): Promise<TripExpense | undefined> {
  requireDirectorAccess();
  const db = await getDB();
  const now = toISO();
  const expense: TripExpense = { ...data, id: generateId(), created_at: now, updated_at: now };
  await db.put('trip_expenses', expense);
  await enqueueMutation({ entity: 'expenses', entityId: expense.id, action: 'create', payload: { ...expense } });
  notifySync();
  return expense;
}

export async function updateTripExpense(id: string, data: Partial<TripExpense>): Promise<TripExpense | undefined> {
  requireDirectorAccess();
  const db = await getDB();
  const existing = await db.get('trip_expenses', id);
  if (!existing) return undefined;
  const updatedExpense: TripExpense = { ...existing, ...data, id, updated_at: toISO() } as TripExpense;
  await db.put('trip_expenses', updatedExpense);
  const changed = pickChanged(existing, updatedExpense, ['parcel_id', 'trip_id', 'trip_vehicle_id', 'category_id', 'category_name', 'label', 'amount', 'expense_date', 'location', 'notes']);
  if (Object.keys(changed).length > 0) {
    await enqueueMutation({ entity: 'expenses', entityId: id, action: 'update', payload: changed });
    notifySync();
  }
  return updatedExpense;
}

export async function deleteTripExpense(id: string): Promise<void> {
  requireDirectorAccess();
  const db = await getDB();
  await db.delete('trip_expenses', id);
  await enqueueMutation({ entity: 'expenses', entityId: id, action: 'delete', payload: {} });
  notifySync();
  const attachments = await getAttachmentsByEntity('expense', id);
  for (const attachment of attachments) {
    await db.delete('attachments', attachment.id);
  }
}

// ============================================================
// PARCELS
// ============================================================
export async function getParcels(): Promise<Parcel[]> {
  if (canUseParcelApi()) {
    try {
      const server = await listOnlineParcels();
      await refreshParcels(server);
      const db = await getDB();
      const local = await db.getAll('parcels');
      const protectedIds = await collectProtectedIds('parcels', local.map((p) => p.id));
      return mergeLocalPending(server, local, protectedIds).sort((a, b) => b.created_at.localeCompare(a.created_at));
    } catch (error) { if (!isParcelApiUnavailable(error)) throw error; }
  }
  const db = await getDB();
  const all = await db.getAll('parcels');
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getParcelById(id: string): Promise<Parcel | undefined> {
  const db = await getDB();
  const cached = await db.get('parcels', id);
  if (cached) return cached;
  const all = await getParcels();
  return all.find((parcel) => parcel.id === id);
}

export async function getParcelByTracking(tracking: string): Promise<Parcel | undefined> {
  const all = await getParcels();
  return all.find((parcel) => parcel.tracking_number === tracking);
}

export async function getParcelItems(parcelId: string): Promise<ParcelItem[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex('parcel_items', 'by-parcel', parcelId);
  return items.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getProducts(): Promise<Product[]> {
  if (canUseProductApi()) {
    try {
      const server = await listOnlineProducts();
      await refreshProducts(server);
      const db = await getDB();
      const local = await db.getAll('products');
      const protectedIds = await collectProtectedIds('products', local.map((p) => p.id));
      return mergeLocalPending(server, local, protectedIds).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) { if (!isProductApiUnavailable(error)) throw error; }
  }
  const db = await getDB();
  const all = await db.getAll('products');
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const all = await getProducts();
  return all.find((product) => product.id === id);
}

export async function getProductByName(name: string): Promise<Product | undefined> {
  const all = await getProducts();
  return all.find((product) => product.name === name);
}

export async function createProduct(
  data: Omit<Product, 'id' | 'created_at' | 'updated_at'>
): Promise<Product> {
  const db = await getDB();
  const now = toISO();
  const product: Product = { ...data, id: generateId(), created_at: now, updated_at: now };
  await db.put('products', product);
  await enqueueMutation({ entity: 'products', entityId: product.id, action: 'create', payload: { ...product } });
  notifySync();
  return product;
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<Product | undefined> {
  const db = await getDB();
  const existing = await db.get('products', id);
  if (!existing) return undefined;
  const product = { ...existing, ...data, id, updated_at: toISO() };
  await db.put('products', product);
  const changed = pickChanged(existing, product, ['name', 'category', 'default_price']);
  if (Object.keys(changed).length > 0) {
    await enqueueMutation({ entity: 'products', entityId: id, action: 'update', payload: changed });
    notifySync();
  }
  return product;
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('products', id);
  await enqueueMutation({ entity: 'products', entityId: id, action: 'delete', payload: {} });
  notifySync();
}

export async function createParcel(
  data: Omit<Parcel, 'id' | 'tracking_number' | 'total_amount' | 'balance' | 'created_at' | 'updated_at'>,
  items: Array<{ product_id?: string; designation: string; quantity: number; unit_price: number }> = []
): Promise<Parcel> {
  const db = await getDB();
  const all = await db.getAll('parcels');
  const tracking = generateTrackingNumber(all.map((p) => p.tracking_number));
  const now = toISO();
  const total_amount = (data.sub_total || 0) + (data.transport_price || 0) + (data.additional_fees || 0);
  const amountPaid = data.amount_paid || 0;
  const effectiveBalance = data.payment_condition === 'paid_origin' ? 0 : Math.max(total_amount - amountPaid, 0);
  const user = getAuthenticatedUser();
  const parcel: Parcel = {
    ...data,
    registered_by: user?.role === 'agent' ? user.id : data.registered_by,
    registered_by_name: user?.role === 'agent' ? user.full_name : data.registered_by_name,
    agent_id: user?.role === 'agent' ? user.id : data.agent_id,
    agent_name: user?.role === 'agent' ? user.full_name : data.agent_name,
    id: generateId(),
    tracking_number: tracking,
    total_amount,
    balance: effectiveBalance,
    created_at: now,
    updated_at: now,
  };
  await db.put('parcels', parcel);
  const localItems: ParcelItem[] = items.map((item) => ({
    id: generateId(),
    parcel_id: parcel.id,
    product_id: item.product_id,
    designation: item.designation,
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    amount: (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    created_at: now,
    updated_at: now,
  }));
  for (const item of localItems) await db.put('parcel_items', item);
  await enqueueMutation({
    entity: 'parcels',
    entityId: parcel.id,
    action: 'create',
    payload: {
      parcel: { ...parcel },
      items: items.map((item) => ({
        product_id: item.product_id,
        designation: item.designation,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
      })),
    },
  });
  notifySync();
  return parcel;
}

export async function updateParcel(id: string, data: Partial<Parcel>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('parcels', id);
  if (!existing) return;
  requireOwnedAccess(existing.registered_by === getAuthenticatedUser()?.id ? existing.registered_by : existing.agent_id);
  const updated = { ...existing, ...data, id, updated_at: toISO() };
  updated.sub_total = updated.sub_total ?? existing.sub_total ?? 0;
  updated.total_amount = (updated.sub_total || 0) + (updated.transport_price || 0) + (updated.additional_fees || 0);
  const amountPaid = updated.amount_paid || 0;
  const condition = updated.payment_condition || existing.payment_condition;
  updated.balance = condition === 'paid_origin' ? 0 : Math.max(updated.total_amount - amountPaid, 0);
  await db.put('parcels', updated);
  const payload: Record<string, unknown> = {};
  if (data.description !== undefined) payload.description = data.description;
  if (data.status !== undefined && data.status !== existing.status) {
    payload.status = data.status;
    payload.expectedStatus = existing.status;
  }
  if (Object.keys(payload).length > 0) {
    await enqueueMutation({ entity: 'parcels', entityId: id, action: 'update', payload });
    notifySync();
  }
}

export async function getRelatedDataForParcel(parcelId: string): Promise<{
  items: ParcelItem[];
  payments: Payment[];
  history: StatusHistory[];
  attachments: Attachment[];
}> {
  const [items, payments, history, attachments] = await Promise.all([
    getParcelItems(parcelId),
    getPaymentsByParcel(parcelId),
    getStatusHistory(parcelId),
    getAttachmentsByEntity('parcel', parcelId),
  ]);

  return { items, payments, history, attachments };
}

async function deleteParcelLocalCache(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('parcels', id);
  const items = await db.getAllFromIndex('parcel_items', 'by-parcel', id);
  for (const item of items) await db.delete('parcel_items', item.id);
  const payments = await db.getAllFromIndex('payments', 'by-parcel', id);
  for (const p of payments) await db.delete('payments', p.id);
  const history = await db.getAllFromIndex('status_history', 'by-parcel', id);
  for (const h of history) await db.delete('status_history', h.id);
  const attachments = await getAttachmentsByEntity('parcel', id);
  for (const attachment of attachments) await db.delete('attachments', attachment.id);
}

export async function deleteParcel(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get('parcels', id);
  if (!existing) return;
  requireOwnedAccess(existing.registered_by === getAuthenticatedUser()?.id ? existing.registered_by : existing.agent_id);
  await deleteParcelLocalCache(id);
  await enqueueMutation({ entity: 'parcels', entityId: id, action: 'delete', payload: {} });
  notifySync();
}

async function updateParcelStatusLocal(
  parcelId: string,
  newStatus: ParcelStatus,
  userId: string,
  userName: string,
  note = ''
): Promise<void> {
  const db = await getDB();
  const parcel = await db.get('parcels', parcelId);
  if (!parcel) return;
  requireOwnedAccess(parcel.registered_by === userId ? parcel.registered_by : parcel.agent_id);
  const oldStatus = parcel.status;
  if (oldStatus === newStatus) return;

  const now = toISO();
  const updates: Partial<Parcel> = { status: newStatus, updated_at: now };
  if ((newStatus === 'in_transit' || newStatus === 'arrived' || newStatus === 'delivered') && !parcel.departure_date) {
    updates.departure_date = now;
  }
  if ((newStatus === 'arrived' || newStatus === 'delivered') && !parcel.arrival_date) {
    updates.arrival_date = now;
  }
  if (newStatus === 'delivered' && !parcel.delivery_date) {
    updates.delivery_date = now;
  }

  await db.put('parcels', { ...parcel, ...updates });

  const history: StatusHistory = {
    id: generateId(),
    parcel_id: parcelId,
    parcel_tracking: parcel.tracking_number,
    previous_status: oldStatus,
    new_status: newStatus,
    changed_by: userId,
    changed_by_name: userName,
    note,
    created_at: now,
  };
  await db.put('status_history', history);
}

export async function updateParcelStatus(
  parcelId: string,
  newStatus: ParcelStatus,
  userId: string,
  userName: string,
  note = ''
): Promise<void> {
  const db = await getDB();
  const parcel = await db.get('parcels', parcelId);
  if (!parcel) return;
  const previousStatus = parcel.status;
  await updateParcelStatusLocal(parcelId, newStatus, userId, userName, note);
  if (previousStatus === newStatus) return;
  await enqueueMutation({
    entity: 'parcels',
    entityId: parcelId,
    action: 'update',
    payload: { status: newStatus, note, expectedStatus: previousStatus },
  });
  notifySync();
}

// ============================================================


// ============================================================
// PAYMENTS
// ============================================================
export async function getPayments(): Promise<Payment[]> {
  if (canUsePaymentApi()) {
    try {
      const server = await listOnlinePayments();
      await refreshPayments(server);
      const db = await getDB();
      const local = await db.getAll('payments');
      const protectedIds = await collectProtectedIds('payments', local.map((p) => p.id));
      return mergeLocalPending(server, local, protectedIds).sort((a, b) => b.payment_date.localeCompare(a.payment_date));
    } catch (error) { if (!isPaymentApiUnavailable(error)) throw error; }
  }
  const db = await getDB();
  const all = await db.getAll('payments');
  return all.sort((a, b) => b.payment_date.localeCompare(a.payment_date));
}

export async function getPaymentsByParcel(parcelId: string): Promise<Payment[]> {
  const all = await getPayments();
  return all.filter((payment) => payment.parcel_id === parcelId);
}

export async function getPaymentsByClient(clientId: string): Promise<Payment[]> {
  const all = await getPayments();
  return all.filter((payment) => payment.client_id === clientId);
}

export async function createPayment(
  data: Omit<Payment, 'id' | 'created_at'>
): Promise<Payment> {
  const db = await getDB();
  const user = getAuthenticatedUser();
  const payment: Payment = {
    ...data,
    recorded_by: user?.role === 'agent' ? user.id : data.recorded_by,
    recorded_by_name: user?.role === 'agent' ? user.full_name : data.recorded_by_name,
    id: generateId(),
    created_at: toISO(),
  };
  const parcel = await db.get('parcels', data.parcel_id);
  if (!parcel) throw new Error('Colis introuvable.');
  requireOwnedAccess(parcel.registered_by === user?.id ? parcel.registered_by : parcel.agent_id);
  await db.put('payments', payment);

  const newAmountPaid = (parcel.amount_paid || 0) + data.amount;
  const condition = parcel.payment_condition;
  await db.put('parcels', {
    ...parcel,
    amount_paid: newAmountPaid,
    balance: condition === 'paid_origin' ? 0 : Math.max((parcel.total_amount || 0) - newAmountPaid, 0),
    updated_at: toISO(),
  });

  await enqueueMutation({ entity: 'payments', entityId: payment.id, action: 'create', payload: { ...payment } });
  notifySync();
  return payment;
}

export async function updatePayment(id: string, data: { note?: string; payment_method?: Payment['payment_method'] }): Promise<void> {
  const db = await getDB();
  const existing = await db.get('payments', id);
  if (!existing) return;
  const updated = { ...existing, ...data };
  await db.put('payments', updated);
  const payload: Record<string, unknown> = {};
  if (data.note !== undefined && data.note !== existing.note) payload.note = data.note;
  if (data.payment_method !== undefined && data.payment_method !== existing.payment_method) payload.payment_method = data.payment_method;
  if (Object.keys(payload).length > 0) {
    await enqueueMutation({ entity: 'payments', entityId: id, action: 'update', payload });
    notifySync();
  }
}

export async function deletePayment(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get('payments', id);
  if (!existing) return;
  await db.delete('payments', id);
  if (existing.parcel_id) await reconcileParcelFromPayments(existing.parcel_id, Number(existing.amount) || 0);
  await enqueueMutation({ entity: 'payments', entityId: id, action: 'delete', payload: {} });
  notifySync();
}



// ============================================================
// STATUS HISTORY
// ============================================================
export async function getStatusHistory(parcelId: string): Promise<StatusHistory[]> {
  if (canUseParcelApi()) {
    try { return await listOnlineStatusHistory(parcelId); } catch (error) { if (!isParcelApiUnavailable(error)) throw error; }
  }
  const db = await getDB();
  const all = await db.getAllFromIndex('status_history', 'by-parcel', parcelId);
  return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// ============================================================
// ACTIVITY LOGS
// ============================================================
export async function getActivityLogs(limit?: number): Promise<ActivityLog[]> {
  const db = await getDB();
  const all = await db.getAll('activity_logs');
  const sorted = all.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return limit ? sorted.slice(0, limit) : sorted;
}

export async function logActivity(
  userId: string,
  userName: string,
  action: string,
  entityType = '',
  entityId = '',
  details = ''
): Promise<void> {
  const db = await getDB();
  const log: ActivityLog = {
    id: generateId(),
    user_id: userId,
    user_name: userName,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
    created_at: toISO(),
  };
  await db.put('activity_logs', log);
}

// ============================================================
// SETTINGS
// ============================================================
// Settings is a singleton resource (id "1"). Reads are local-first and are
// refreshed from the server when online; writes persist locally then enqueue a
// server update through the standard offline sync queue. A pull never
// overwrites a pending local settings edit (protected-record rule) and never
// garbage-collects the local mirror, so the app always has usable defaults.
export async function getSettings(): Promise<AppSettings> {
  if (canUseSettingsApi()) {
    try {
      const serverSettings = await listOnlineSettings();
      await refreshSettings(serverSettings);
    } catch (error) {
      if (!isSettingsApiUnavailable(error)) throw error;
    }
  }
  const db = await getDB();
  const s = await db.get('settings', '1');
  if (s) return s;
  await seedDefaultData();
  return (await db.get('settings', '1'))!;
}

export async function updateSettings(data: Partial<AppSettings>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('settings', '1');
  if (!existing) return;
  const next = { ...existing, ...data, id: '1' };
  await db.put('settings', next);
  await enqueueMutation({
    entity: 'settings',
    entityId: '1',
    action: 'update',
    payload: settingsToApi(next),
  });
  notifySync();
}

// ============================================================
// DASHBOARD STATS
// ============================================================
export async function getDashboardStats(): Promise<DashboardStats> {
  const [parcels, clients, payments, trips] = await Promise.all([
    getParcels(),
    getClients(),
    getPayments(),
    getTrips(),
  ]);

  // Agents only see their own record. getTrips() is already agent-scoped
  // internally, parcels/payments/clients are scoped here.
  const user = getAuthenticatedUser();
  const isAgent = user?.role === 'agent';
  const scopedParcels = isAgent
    ? parcels.filter((p) => p.agent_id === user.id || p.registered_by === user.id)
    : parcels;
  const scopedPayments = isAgent ? payments.filter((p) => p.recorded_by === user.id) : payments;
  const scopedClients = isAgent ? clients.filter((c) => c.created_by === user.id) : clients;

  const paymentsByParcel = new Map<string, number>();
  for (const payment of scopedPayments) {
    paymentsByParcel.set(payment.parcel_id, (paymentsByParcel.get(payment.parcel_id) || 0) + payment.amount);
  }
  // For a "paid at origin" parcel the origin amount sits on the parcel itself
  // (no payment row). Total contribution = max(amount_paid - payments, 0).
  const originContribution = (p: Parcel): number =>
    Math.max((p.amount_paid || 0) - (paymentsByParcel.get(p.id) || 0), 0);

  const collectedToday = scopedPayments
    .filter((p) => isToday(p.payment_date))
    .reduce((sum, p) => sum + p.amount, 0) + scopedParcels
      .filter((p) => p.payment_condition === 'paid_origin' && originContribution(p) > 0 && isToday(p.received_date || p.created_at))
      .reduce((sum, p) => sum + originContribution(p), 0);

  const totalRevenue = scopedPayments.reduce((sum, p) => sum + p.amount, 0) + scopedParcels
    .filter((p) => p.payment_condition === 'paid_origin' && originContribution(p) > 0)
    .reduce((sum, p) => sum + originContribution(p), 0);

  const totalOutstanding = scopedParcels
    .filter((p) => p.status !== 'cancelled')
    .reduce((sum, p) => sum + (p.balance || 0), 0);

  return {
    total_parcels: scopedParcels.length,
    received_today: scopedParcels.filter((p) => isToday(p.received_date)).length,
    pending: scopedParcels.filter((p) => p.status === 'pending').length,
    in_transit: scopedParcels.filter((p) => p.status === 'in_transit').length,
    arrived: scopedParcels.filter((p) => p.status === 'arrived').length,
    delivered: scopedParcels.filter((p) => p.status === 'delivered').length,
    cancelled: scopedParcels.filter((p) => p.status === 'cancelled').length,
    total_clients: scopedClients.length,
    collected_today: collectedToday,
    pending_payments: scopedParcels.filter(
      (p) => p.status !== 'cancelled' && (p.balance || 0) > 0
    ).length,
    total_revenue: totalRevenue,
    total_outstanding: totalOutstanding,
    total_trips: trips.length,
    total_payments: scopedPayments.length,
  };
}

export async function getAttachmentsByEntity(
  entity_type: AttachmentEntityType,
  entity_id: string
): Promise<Attachment[]> {
  if (entity_type === 'expense') requireDirectorAccess();
  const db = await getDB();
  const attachments = await db.getAllFromIndex('attachments', 'by-entity', [entity_type, entity_id]);
  return attachments.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createAttachment(
  data: Omit<Attachment, 'id' | 'created_at' | 'updated_at'>
): Promise<Attachment> {
  if (data.entity_type === 'expense') requireDirectorAccess();
  const db = await getDB();
  const now = toISO();
  const attachment: Attachment = {
    ...data,
    id: generateId(),
    created_at: now,
    updated_at: now,
  };
  await db.put('attachments', attachment);
  return attachment;
}

export async function saveAttachmentsForEntity(
  entity_type: AttachmentEntityType,
  entity_id: string,
  attachments: Attachment[]
): Promise<Attachment[]> {
  if (entity_type === 'expense') requireDirectorAccess();
  const saved = await Promise.all(
    attachments.map(async (attachment) => {
      if (attachment.entity_id === entity_id && attachment.id) {
        return attachment;
      }
      if (!attachment.blob) {
        return null;
      }

      return createAttachment({
        entity_type,
        entity_id,
        filename: attachment.filename,
        mime_type: attachment.mime_type,
        size: attachment.size,
        blob: attachment.blob,
      });
    })
  );

  return saved.filter((item): item is Attachment => item !== null);
}

export async function deleteAttachment(id: string): Promise<void> {
  const db = await getDB();
  const attachment = await db.get('attachments', id);
  if (attachment?.entity_type === 'expense') requireDirectorAccess();
  await db.delete('attachments', id);
}
