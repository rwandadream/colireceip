import { getDB, seedDefaultData } from './db';
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

export async function ensureSeed(): Promise<void> {
  await seedDefaultData();
}

// ============================================================
// TRIPS
// ============================================================
export async function getTrips(): Promise<Trip[]> {
  const db = await getDB();
  const trips = await db.getAll('trips');
  return trips.sort((a, b) => b.trip_date.localeCompare(a.trip_date));
}

export async function getTripById(id: string): Promise<Trip | undefined> {
  const db = await getDB();
  return db.get('trips', id);
}

export async function createTrip(data: Omit<Trip, 'id' | 'created_at' | 'updated_at'>): Promise<Trip> {
  const db = await getDB();
  const now = toISO();
  const trip: Trip = { ...data, id: generateId(), created_at: now, updated_at: now };
  await db.put('trips', trip);
  return trip;
}

export async function updateTrip(id: string, data: Partial<Trip>): Promise<Trip | undefined> {
  const db = await getDB();
  const existing = await db.get('trips', id);
  if (!existing) return undefined;
  const trip = { ...existing, ...data, id, updated_at: toISO() };
  await db.put('trips', trip);
  return trip;
}

export async function deleteTrip(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('trips', id);
  const vehicles = await getTripVehicles(id);
  for (const vehicle of vehicles) await db.delete('trip_vehicles', vehicle.id);
}

export async function getTripVehicles(tripId: string): Promise<TripVehicle[]> {
  const db = await getDB();
  const vehicles = await db.getAllFromIndex('trip_vehicles', 'by-trip', tripId);
  return vehicles.sort((a, b) => a.vehicle_number - b.vehicle_number);
}

export async function createTripVehicle(
  data: Omit<TripVehicle, 'id' | 'vehicle_number' | 'created_at' | 'updated_at'>
): Promise<TripVehicle> {
  const db = await getDB();
  const existing = await getTripVehicles(data.trip_id);
  const vehicle_number = existing.reduce((max, vehicle) => Math.max(max, vehicle.vehicle_number), 0) + 1;
  const now = toISO();
  const vehicle: TripVehicle = { ...data, id: generateId(), vehicle_number, created_at: now, updated_at: now };
  await db.put('trip_vehicles', vehicle);
  return vehicle;
}

export async function deleteTripVehicle(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('trip_vehicles', id);
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
  const db = await getDB();
  return db.getAll('users');
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDB();
  const all = await db.getAll('users');
  return all.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function getUserById(id: string): Promise<User | undefined> {
  const db = await getDB();
  return db.get('users', id);
}

export async function createUser(
  data: Omit<User, 'id' | 'created_at' | 'updated_at'>
): Promise<User> {
  const db = await getDB();
  const now = toISO();
  const user: User = { ...data, id: generateId(), created_at: now, updated_at: now };
  await db.put('users', user);
  return user;
}

export async function updateUser(id: string, data: Partial<User>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('users', id);
  if (!existing) return;
  await db.put('users', { ...existing, ...data, id, updated_at: toISO() });
}

export async function deleteUser(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('users', id);
}

// ============================================================
// CLIENTS
// ============================================================
export async function getClients(): Promise<Client[]> {
  const db = await getDB();
  const all = await db.getAll('clients');
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getClientById(id: string): Promise<Client | undefined> {
  const db = await getDB();
  return db.get('clients', id);
}

export async function createClient(
  data: Omit<Client, 'id' | 'created_at' | 'updated_at'>
): Promise<Client> {
  const db = await getDB();
  const now = toISO();
  const client: Client = { ...data, id: generateId(), created_at: now, updated_at: now };
  await db.put('clients', client);
  return client;
}

export async function updateClient(id: string, data: Partial<Client>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('clients', id);
  if (!existing) return;
  await db.put('clients', { ...existing, ...data, id, updated_at: toISO() });
}

export async function deleteClient(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('clients', id);
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
  const db = await getDB();
  const now = toISO();
  const category: ExpenseCategory = { ...data, id: generateId(), created_at: now, updated_at: now };
  await db.put('expense_categories', category);
  return category;
}

export async function getTripExpenses(): Promise<TripExpense[]> {
  const db = await getDB();
  const all = await db.getAll('trip_expenses');
  return all.sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || ''));
}

export async function getExpensesByParcelId(parcelId: string): Promise<TripExpense[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex('trip_expenses', 'by-parcel', parcelId);
  return items.sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || ''));
}

export async function getTripExpenseById(id: string): Promise<TripExpense | undefined> {
  const db = await getDB();
  return db.get('trip_expenses', id);
}

export async function createTripExpense(
  data: Omit<TripExpense, 'id' | 'created_at' | 'updated_at'>
): Promise<TripExpense | undefined> {
  const db = await getDB();
  const now = toISO();
  const expense: TripExpense = { ...data, id: generateId(), created_at: now, updated_at: now };
  await db.put('trip_expenses', expense);
  return expense;
}

export async function updateTripExpense(id: string, data: Partial<TripExpense>): Promise<TripExpense | undefined> {
  const db = await getDB();
  const existing = await db.get('trip_expenses', id);
  if (!existing) return undefined;
  const updatedExpense: TripExpense = { ...existing, ...data, id, updated_at: toISO() } as TripExpense;
  await db.put('trip_expenses', updatedExpense);
  return updatedExpense;
}

export async function deleteTripExpense(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('trip_expenses', id);
  const attachments = await getAttachmentsByEntity('expense', id);
  for (const attachment of attachments) {
    await db.delete('attachments', attachment.id);
  }
}

// ============================================================
// PARCELS
// ============================================================
export async function getParcels(): Promise<Parcel[]> {
  const db = await getDB();
  const all = await db.getAll('parcels');
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getParcelById(id: string): Promise<Parcel | undefined> {
  const db = await getDB();
  return db.get('parcels', id);
}

export async function getParcelByTracking(tracking: string): Promise<Parcel | undefined> {
  const db = await getDB();
  return db.getFromIndex('parcels', 'by-tracking', tracking);
}

export async function getParcelItems(parcelId: string): Promise<ParcelItem[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex('parcel_items', 'by-parcel', parcelId);
  return items.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getProducts(): Promise<Product[]> {
  const db = await getDB();
  const all = await db.getAll('products');
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const db = await getDB();
  return db.get('products', id);
}

export async function getProductByName(name: string): Promise<Product | undefined> {
  const db = await getDB();
  return db.getFromIndex('products', 'by-name', name);
}

export async function createProduct(
  data: Omit<Product, 'id' | 'created_at' | 'updated_at'>
): Promise<Product> {
  const db = await getDB();
  const now = toISO();
  const product: Product = { ...data, id: generateId(), created_at: now, updated_at: now };
  await db.put('products', product);
  return product;
}

export async function createParcel(
  data: Omit<Parcel, 'id' | 'tracking_number' | 'total_amount' | 'balance' | 'created_at' | 'updated_at'>
): Promise<Parcel> {
  const db = await getDB();
  const all = await db.getAll('parcels');
  const tracking = generateTrackingNumber(all.map((p) => p.tracking_number));
  const now = toISO();
  const total_amount = (data.sub_total || 0) + (data.transport_price || 0) + (data.additional_fees || 0);
  const amountPaid = data.amount_paid || 0;
  const effectiveBalance = data.payment_condition === 'paid_origin' ? 0 : Math.max(total_amount - amountPaid, 0);
  const parcel: Parcel = {
    ...data,
    id: generateId(),
    tracking_number: tracking,
    total_amount,
    balance: effectiveBalance,
    created_at: now,
    updated_at: now,
  };
  await db.put('parcels', parcel);
  return parcel;
}

export async function updateParcel(id: string, data: Partial<Parcel>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('parcels', id);
  if (!existing) return;
  const updated = { ...existing, ...data, id, updated_at: toISO() };
  updated.sub_total = updated.sub_total ?? existing.sub_total ?? 0;
  updated.total_amount = (updated.sub_total || 0) + (updated.transport_price || 0) + (updated.additional_fees || 0);
  const amountPaid = updated.amount_paid || 0;
  const condition = updated.payment_condition || existing.payment_condition;
  updated.balance = condition === 'paid_origin' ? 0 : Math.max(updated.total_amount - amountPaid, 0);
  await db.put('parcels', updated);
}

export async function deleteParcel(id: string): Promise<void> {
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

  await updateParcel(parcelId, updates);

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

// ============================================================
// PARCEL ITEMS
// ============================================================
export async function createParcelItem(
  data: Omit<ParcelItem, 'id' | 'amount' | 'created_at' | 'updated_at'>
): Promise<ParcelItem> {
  const db = await getDB();
  const now = toISO();
  const amount = (data.quantity || 0) * (data.unit_price || 0);
  const item: ParcelItem = {
    ...data,
    id: generateId(),
    amount,
    created_at: now,
    updated_at: now,
  };
  await db.put('parcel_items', item);
  return item;
}

export async function updateParcelItem(id: string, data: Partial<ParcelItem>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('parcel_items', id);
  if (!existing) return;
  const updated = { ...existing, ...data, id, updated_at: toISO() };
  updated.amount = (updated.quantity || 0) * (updated.unit_price || 0);
  await db.put('parcel_items', updated);
}

export async function deleteParcelItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('parcel_items', id);
}

// ============================================================
// PAYMENTS
// ============================================================
export async function getPayments(): Promise<Payment[]> {
  const db = await getDB();
  const all = await db.getAll('payments');
  return all.sort((a, b) => b.payment_date.localeCompare(a.payment_date));
}

export async function getPaymentsByParcel(parcelId: string): Promise<Payment[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('payments', 'by-parcel', parcelId);
  return all.sort((a, b) => b.payment_date.localeCompare(a.payment_date));
}

export async function getPaymentsByClient(clientId: string): Promise<Payment[]> {
  const db = await getDB();
  return db.getAllFromIndex('payments', 'by-client', clientId);
}

export async function createPayment(
  data: Omit<Payment, 'id' | 'created_at'>
): Promise<Payment> {
  const db = await getDB();
  const payment: Payment = { ...data, id: generateId(), created_at: toISO() };
  await db.put('payments', payment);

  const parcel = await db.get('parcels', data.parcel_id);
  if (parcel) {
    const newAmountPaid = (parcel.amount_paid || 0) + data.amount;
    await updateParcel(parcel.id, { amount_paid: newAmountPaid });
  }
  return payment;
}

export async function deletePayment(id: string): Promise<void> {
  const db = await getDB();
  const payment = await db.get('payments', id);
  if (!payment) return;
  await db.delete('payments', id);
  const parcel = await db.get('parcels', payment.parcel_id);
  if (parcel) {
    const newAmountPaid = Math.max((parcel.amount_paid || 0) - payment.amount, 0);
    await updateParcel(parcel.id, { amount_paid: newAmountPaid });
  }
  const attachments = await getAttachmentsByEntity('payment', id);
  for (const attachment of attachments) await db.delete('attachments', attachment.id);
}

// ============================================================
// STATUS HISTORY
// ============================================================
export async function getStatusHistory(parcelId: string): Promise<StatusHistory[]> {
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
export async function getSettings(): Promise<AppSettings> {
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
  await db.put('settings', { ...existing, ...data, id: '1' });
}

// ============================================================
// DASHBOARD STATS
// ============================================================
export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDB();
  const [parcels, clients, payments] = await Promise.all([
    db.getAll('parcels'),
    db.getAll('clients'),
    db.getAll('payments'),
  ]);

  const paymentsByParcel = new Map<string, number>();
  for (const payment of payments) {
    paymentsByParcel.set(payment.parcel_id, (paymentsByParcel.get(payment.parcel_id) || 0) + payment.amount);
  }

  const collectedToday = payments
    .filter((p) => isToday(p.payment_date))
    .reduce((sum, p) => sum + p.amount, 0) + parcels
      .filter((p) => p.payment_condition === 'paid_origin' && (p.amount_paid || 0) > 0 && isToday(p.received_date || p.created_at))
      .reduce((sum, p) => sum + ((paymentsByParcel.get(p.id) || 0) > 0 ? 0 : (p.amount_paid || 0)), 0);

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0) + parcels
    .filter((p) => p.payment_condition === 'paid_origin' && (p.amount_paid || 0) > 0)
    .reduce((sum, p) => sum + ((paymentsByParcel.get(p.id) || 0) > 0 ? 0 : (p.amount_paid || 0)), 0);
  const totalOutstanding = parcels
    .filter((p) => p.status !== 'cancelled')
    .reduce((sum, p) => sum + (p.balance || 0), 0);

  return {
    total_parcels: parcels.length,
    received_today: parcels.filter((p) => isToday(p.received_date)).length,
    pending: parcels.filter((p) => p.status === 'pending').length,
    in_transit: parcels.filter((p) => p.status === 'in_transit').length,
    arrived: parcels.filter((p) => p.status === 'arrived').length,
    delivered: parcels.filter((p) => p.status === 'delivered').length,
    cancelled: parcels.filter((p) => p.status === 'cancelled').length,
    total_clients: clients.length,
    collected_today: collectedToday,
    pending_payments: parcels.filter(
      (p) => p.status !== 'cancelled' && (p.balance || 0) > 0
    ).length,
    total_revenue: totalRevenue,
    total_outstanding: totalOutstanding,
  };
}

export async function getAttachmentsByEntity(
  entity_type: AttachmentEntityType,
  entity_id: string
): Promise<Attachment[]> {
  const db = await getDB();
  const attachments = await db.getAllFromIndex('attachments', 'by-entity', [entity_type, entity_id]);
  return attachments.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createAttachment(
  data: Omit<Attachment, 'id' | 'created_at' | 'updated_at'>
): Promise<Attachment> {
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
  await db.delete('attachments', id);
}
