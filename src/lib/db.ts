import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { generateId } from './format';
import type { StoredVerifier } from './authVerifier';
import { createOfflineVerifier } from './authVerifier';
import type {
  User,
  Client,
  Parcel,
  Payment,
  StatusHistory,
  ActivityLog,
  AppSettings,
  Attachment,
  Trip,
  TripVehicle,
} from './types';
import type { SyncMutation } from './syncTypes';

const DB_NAME = 'sarah-groupe-db';
const DB_VERSION = 6;

interface TransitDB extends DBSchema {
  users: { key: string; value: User };
  clients: { key: string; value: Client; indexes: { 'by-name': string; 'by-phone': string } };
  products: { key: string; value: import('./types').Product; indexes: { 'by-name': string } };
  parcels: {
    key: string;
    value: Parcel;
    indexes: {
      'by-tracking': string;
      'by-client': string;
      'by-status': string;
      'by-date': string;
    };
  };
  parcel_items: {
    key: string;
    value: import('./types').ParcelItem;
    indexes: { 'by-parcel': string };
  };
  payments: {
    key: string;
    value: Payment;
    indexes: { 'by-parcel': string; 'by-client': string; 'by-date': string };
  };
  attachments: {
    key: string;
    value: Attachment;
    indexes: { 'by-entity': [string, string]; 'by-entity-type': string };
  };
  expense_categories: {
    key: string;
    value: import('./types').ExpenseCategory;
    indexes: { 'by-name': string };
  };
  trip_expenses: {
    key: string;
    value: import('./types').TripExpense;
    indexes: { 'by-parcel': string; 'by-date': string };
  };
  status_history: {
    key: string;
    value: StatusHistory;
    indexes: { 'by-parcel': string; 'by-date': string };
  };
  activity_logs: {
    key: string;
    value: ActivityLog;
    indexes: { 'by-date': string; 'by-user': string };
  };
  settings: { key: string; value: AppSettings };
  trips: { key: string; value: Trip; indexes: { 'by-date': string; 'by-status': string } };
  trip_vehicles: { key: string; value: TripVehicle; indexes: { 'by-trip': string; 'by-registration': string } };
  auth_verifiers: { key: string; value: StoredVerifier };
  sync_queue: {
    key: string;
    value: SyncMutation;
    indexes: {
      'by-status': string;
      'by-target': [string, string];
      'by-created': string;
    };
  };
}

let dbInstance: IDBPDatabase<TransitDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<TransitDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<TransitDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('clients')) {
        const store = db.createObjectStore('clients', { keyPath: 'id' });
        store.createIndex('by-name', 'full_name');
        store.createIndex('by-phone', 'phone');
      }
      if (!db.objectStoreNames.contains('products')) {
        const store = db.createObjectStore('products', { keyPath: 'id' });
        store.createIndex('by-name', 'name');
      }
      if (!db.objectStoreNames.contains('parcels')) {
        const store = db.createObjectStore('parcels', { keyPath: 'id' });
        store.createIndex('by-tracking', 'tracking_number');
        store.createIndex('by-client', 'client_id');
        store.createIndex('by-status', 'status');
        store.createIndex('by-date', 'received_date');
      }
      if (!db.objectStoreNames.contains('parcel_items')) {
        const store = db.createObjectStore('parcel_items', { keyPath: 'id' });
        store.createIndex('by-parcel', 'parcel_id');
      }
      if (!db.objectStoreNames.contains('payments')) {
        const store = db.createObjectStore('payments', { keyPath: 'id' });
        store.createIndex('by-parcel', 'parcel_id');
        store.createIndex('by-client', 'client_id');
        store.createIndex('by-date', 'payment_date');
      }
      if (!db.objectStoreNames.contains('attachments')) {
        const store = db.createObjectStore('attachments', { keyPath: 'id' });
        store.createIndex('by-entity', ['entity_type', 'entity_id']);
        store.createIndex('by-entity-type', 'entity_type');
      }
      if (!db.objectStoreNames.contains('status_history')) {
        const store = db.createObjectStore('status_history', { keyPath: 'id' });
        store.createIndex('by-parcel', 'parcel_id');
        store.createIndex('by-date', 'created_at');
      }
      if (!db.objectStoreNames.contains('activity_logs')) {
        const store = db.createObjectStore('activity_logs', { keyPath: 'id' });
        store.createIndex('by-date', 'created_at');
        store.createIndex('by-user', 'user_id');
      }
      if (!db.objectStoreNames.contains('expense_categories')) {
        const store = db.createObjectStore('expense_categories', { keyPath: 'id' });
        store.createIndex('by-name', 'name');
      }
      if (!db.objectStoreNames.contains('trip_expenses')) {
        const store = db.createObjectStore('trip_expenses', { keyPath: 'id' });
        store.createIndex('by-parcel', 'parcel_id');
        store.createIndex('by-date', 'expense_date');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('trips')) {
        const store = db.createObjectStore('trips', { keyPath: 'id' });
        store.createIndex('by-date', 'trip_date');
        store.createIndex('by-status', 'status');
      }
      if (!db.objectStoreNames.contains('trip_vehicles')) {
        const store = db.createObjectStore('trip_vehicles', { keyPath: 'id' });
        store.createIndex('by-trip', 'trip_id');
        store.createIndex('by-registration', 'registration');
      }
      if (!db.objectStoreNames.contains('auth_verifiers')) {
        db.createObjectStore('auth_verifiers', { keyPath: 'identifier' });
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        const store = db.createObjectStore('sync_queue', { keyPath: 'id' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-target', ['entity', 'entityId']);
        store.createIndex('by-created', 'createdAt');
      }
    },
  });
  return dbInstance;
}

export async function seedDefaultData(): Promise<void> {
  const db = await getDB();
  const settings = await db.get('settings', '1');
  if (!settings) {
    await db.put('settings', {
      id: '1',
      company_name: 'Groupe-Gaff',
      company_phone: '+223 76 00 00 00',
      company_email: 'contact@groupe-gaff.com',
      bamako_address: 'Bamako, Mali',
      abidjan_address: "Abidjan, Côte d'Ivoire",
      default_transport_price: 5000,
      currency: 'FCFA',
      default_origin: 'Bamako',
      default_destination: 'Abidjan',
    });
  } else if (settings.company_name === 'Sarah-Groupe') {
    await db.put('settings', {
      ...settings,
      company_name: 'Groupe-Gaff',
      company_email: 'contact@groupe-gaff.com',
    });
  }
  await sanitizeLocalUsers(db);
  await seedDevAdmin(db);

  const products = await db.getAll('products');
  if (products.length === 0) {
    const now = new Date().toISOString();
    const defaultProducts = [
      { name: 'Carton parfum', category: 'Carton', default_price: 4000 },
      { name: 'Carton Uniparco', category: 'Carton', default_price: 4500 },
      { name: 'Carton Sivop', category: 'Carton', default_price: 4200 },
      { name: 'Sac', category: 'Sacs', default_price: 6000 },
      { name: 'Moto', category: 'Véhicules', default_price: 250000 },
      { name: 'Compresseur', category: 'Équipement', default_price: 120000 },
      { name: 'Batterie', category: 'Équipement', default_price: 30000 },
      { name: 'Thé', category: 'Produits', default_price: 2000 },
      { name: 'Balles', category: 'Produits', default_price: 1500 },
      { name: 'Rouleaux', category: 'Produits', default_price: 8000 },
      { name: 'Colis', category: 'Divers', default_price: 10000 },
      { name: 'Gros colis', category: 'Divers', default_price: 25000 },
    ];

    for (const product of defaultProducts) {
      await db.put('products', {
        id: generateId(),
        name: product.name,
        category: product.category,
        default_price: product.default_price,
        created_at: now,
        updated_at: now,
      });
    }
  }
}

// Security upgrade: no local user record may ever contain a plaintext (or any)
// password. Older versions stored the password for offline login; those fields
// are stripped on upgrade. The legacy admin email is migrated as well.
async function sanitizeLocalUsers(db: IDBPDatabase<TransitDB>): Promise<void> {
  const allUsers = await db.getAll('users');
  for (const user of allUsers) {
    const hasStoredPassword = typeof (user as User & { password?: string }).password === 'string';
    const isLegacyEmail = user.email === 'admin@sarah-groupe.com';
    if (!hasStoredPassword && !isLegacyEmail) continue;
    const sanitized: User = { ...user, updated_at: new Date().toISOString() };
    if (isLegacyEmail) sanitized.email = 'admin@groupe-gaff.com';
    delete (sanitized as User & { password?: string }).password;
    await db.put('users', sanitized);
  }
}

// DEV-ONLY: bootstraps a local administrator when running `npm run dev` without
// a configured database/API. Credentials come from VITE_DEV_ADMIN_EMAIL and
// VITE_DEV_ADMIN_PASSWORD (never hardcoded). This code is compiled away in
// production builds (`import.meta.env.DEV` is statically false), so no account
// can be seeded from shipped source.
async function seedDevAdmin(db: IDBPDatabase<TransitDB>): Promise<void> {
  if (!import.meta.env.DEV) return;
  const email = String(import.meta.env.VITE_DEV_ADMIN_EMAIL ?? '').trim();
  const password = String(import.meta.env.VITE_DEV_ADMIN_PASSWORD ?? '').trim();
  if (!email || !password || email.startsWith('<') || password.startsWith('<')) return;
  const normalized = email.toLowerCase();
  const allUsers = await db.getAll('users');
  if (allUsers.some((user) => user.email?.toLowerCase() === normalized)) return;
  const now = new Date().toISOString();
  const admin: User = {
    id: generateId(),
    email: normalized,
    full_name: 'Administrateur de développement',
    phone: '',
    role: 'admin',
    active: true,
    created_at: now,
    updated_at: now,
  };
  await db.put('users', admin);
  await createOfflineVerifier(normalized, password);
}
