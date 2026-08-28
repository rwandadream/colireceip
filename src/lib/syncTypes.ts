import type {
  Client,
  Parcel,
  Payment,
  Product,
  Trip,
  TripVehicle,
} from './types';

// Entities that participate in the offline -> online sync queue.
// "users" are deliberately excluded: accounts are never synced from a device
// (administration is always online, offline login uses local verifiers only).
export type SyncEntity =
  | 'clients'
  | 'products'
  | 'parcels'
  | 'payments'
  | 'trips'
  | 'trip-vehicles'
  | 'settings';

export type SyncAction = 'create' | 'update' | 'delete';

export type SyncMutationStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

// Primary key is `id` (client generated). Entity id is preserved so the server
// reuses it: no local -> server id mapping is ever needed.
export interface SyncMutation {
  id: string;
  entity: SyncEntity;
  entityId: string;
  action: SyncAction;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  status: SyncMutationStatus;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt?: string;
  lastError?: string;
}

export type SyncEnginePhase = 'idle' | 'syncing' | 'offline';

export interface SyncEngineState {
  online: boolean;
  running: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  syncedInLastRun: number;
}

// Payload contact shapes used by the real transport.
export interface SyncParcelPayload {
  parcel: Parcel;
  items: Array<{ product_id?: string; designation: string; quantity: number; unit_price: number }>;
}

export type SyncCreatePayload =
  | Client
  | Product
  | Trip
  | TripVehicle
  | Payment
  | SyncParcelPayload;

export interface SyncUpdatePayload {
  [key: string]: unknown;
}

export interface PullContext {
  clients?: Client[];
  products?: Product[];
  trips?: Trip[];
  tripsVehicles?: TripVehicle[];
  parcels?: Parcel[];
  payments?: Payment[];
}