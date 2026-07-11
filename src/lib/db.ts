import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  User,
  Client,
  Parcel,
  Payment,
  StatusHistory,
  ActivityLog,
  AppSettings,
} from './types';

const DB_NAME = 'transit-mali-ci';
const DB_VERSION = 1;

interface TransitDB extends DBSchema {
  users: { key: string; value: User };
  clients: { key: string; value: Client; indexes: { 'by-name': string; 'by-phone': string } };
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
  payments: {
    key: string;
    value: Payment;
    indexes: { 'by-parcel': string; 'by-client': string; 'by-date': string };
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
      if (!db.objectStoreNames.contains('parcels')) {
        const store = db.createObjectStore('parcels', { keyPath: 'id' });
        store.createIndex('by-tracking', 'tracking_number');
        store.createIndex('by-client', 'client_id');
        store.createIndex('by-status', 'status');
        store.createIndex('by-date', 'received_date');
      }
      if (!db.objectStoreNames.contains('payments')) {
        const store = db.createObjectStore('payments', { keyPath: 'id' });
        store.createIndex('by-parcel', 'parcel_id');
        store.createIndex('by-client', 'client_id');
        store.createIndex('by-date', 'payment_date');
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
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
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
      id: '1' as any,
      company_name: 'Sarah-Groupe',
      company_phone: '+223 76 00 00 00',
      company_email: 'contact@sarah-groupe.ci',
      bamako_address: 'Bamako, Mali',
      abidjan_address: 'Abidjan, Côte d\'Ivoire',
      default_transport_price: 5000,
      currency: 'FCFA',
    });
  }
  const adminEmail = 'admin@transitmali.ci';
  const allUsers = await db.getAll('users');
  const existingAdmin = allUsers.find((u) => u.email === adminEmail);
  if (!existingAdmin) {
    const adminId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.put('users', {
      id: adminId,
      email: adminEmail,
      full_name: 'Administrateur Principal',
      phone: '+223 76 00 00 00',
      role: 'admin',
      active: true,
      password: 'admin123',
      created_at: now,
      updated_at: now,
    });
  }
}
