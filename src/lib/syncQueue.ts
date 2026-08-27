import { getDB } from './db';
import { generateId, toISO } from './format';
import type { SyncAction, SyncEntity, SyncMutation } from './syncTypes';
import {
  canRetryAfter,
  mergeLocalPending,
  orderPending,
  planCoalescing,
  stableKey,
} from './syncLogic';

export { mergeLocalPending, stableKey };

const ACTIVE_STATUSES = ['pending', 'syncing', 'failed'] as const;

function isActiveStatus(status: SyncMutation['status']): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

interface EnqueueInput {
  entity: SyncEntity;
  entityId: string;
  action: SyncAction;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface SyncCounts {
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
}

export interface PendingRecord {
  entity: SyncEntity;
  entityId: string;
  action: SyncAction;
}

async function getActiveForTarget(entity: SyncEntity, entityId: string): Promise<SyncMutation[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('sync_queue', 'by-target', [entity, entityId]);
  return all.filter((m) => isActiveStatus(m.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function put(mutation: SyncMutation): Promise<void> {
  const db = await getDB();
  await db.put('sync_queue', mutation);
}

// Records an offline mutation. Coalescing is delegated to the pure
// planCoalescing() logic so it can be unit-tested outside IndexedDB.
export async function enqueueMutation(input: EnqueueInput): Promise<SyncMutation | null> {
  const existing = await getActiveForTarget(input.entity, input.entityId);
  const now = toISO();
  const plan = planCoalescing(existing, { ...input, now });

  for (const id of plan.removeIds) {
    const db = await getDB();
    await db.delete('sync_queue', id);
  }
  for (const update of plan.updates) {
    const current = await getById(update.id);
    if (!current) continue;
    current.payload = update.payload;
    current.updatedAt = now;
    await put(current);
  }
  if (!plan.insert) return null;

  const mutation: SyncMutation = {
    id: generateId(),
    ...plan.insert,
    status: 'pending',
    retryCount: 0,
  };
  await put(mutation);
  return mutation;
}

async function getById(id: string): Promise<SyncMutation | undefined> {
  const db = await getDB();
  return db.get('sync_queue', id);
}

export async function getMutationById(id: string): Promise<SyncMutation | undefined> {
  return getById(id);
}

// True when an offline mutation for this (entity, entityId) still has to reach
// the server (or awaits a manual conflict resolution).
export async function hasProtectedMutation(entity: SyncEntity, entityId: string): Promise<boolean> {
  const db = await getDB();
  const all = await db.getAllFromIndex('sync_queue', 'by-target', [entity, entityId]);
  return all.some((m) => m.status !== 'synced');
}

export async function listProtectedTargets(): Promise<Map<string, PendingRecord>> {
  const db = await getDB();
  const all = await db.getAll('sync_queue');
  const map = new Map<string, PendingRecord>();
  const syncedEntities = new Set<SyncEntity>(['clients', 'products', 'parcels', 'payments', 'trips', 'trip-vehicles']);
  for (const m of all) {
    if (m.status === 'synced' || !syncedEntities.has(m.entity)) continue;
    map.set(`${m.entity}:${m.entityId}`, { entity: m.entity, entityId: m.entityId, action: m.action });
  }
  return map;
}

// Next pending mutation in FIFO order (oldest first), skipping mutations still
// inside their backoff window. Recovers any mutation stuck in "syncing".
export async function nextPendingMutation(): Promise<SyncMutation | null> {
  const db = await getDB();
  const stuck = await db.getAllFromIndex('sync_queue', 'by-status', 'syncing');
  for (const m of stuck) {
    m.status = 'pending';
    await put(m);
  }
  const pending = await db.getAllFromIndex('sync_queue', 'by-status', 'pending');
  const ordered = orderPending(pending, Date.now());
  return ordered[0] ?? null;
}

export async function beginSyncing(mutation: SyncMutation): Promise<void> {
  mutation.status = 'syncing';
  mutation.lastAttemptAt = toISO();
  mutation.updatedAt = toISO();
  await put(mutation);
}

export async function completeSynced(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sync_queue', id);
}

export async function markFailed(mutation: SyncMutation, message: string): Promise<void> {
  mutation.status = 'failed';
  mutation.lastError = message;
  mutation.updatedAt = toISO();
  mutation.lastAttemptAt = toISO();
  await put(mutation);
}

export async function markConflict(mutation: SyncMutation, message: string): Promise<void> {
  mutation.status = 'conflict';
  mutation.lastError = message;
  mutation.updatedAt = toISO();
  mutation.lastAttemptAt = toISO();
  await put(mutation);
}

// Registers a transient failure with backoff. Returns the updated mutation.
export async function registerTransientFailure(mutation: SyncMutation, message: string): Promise<SyncMutation> {
  mutation.retryCount += 1;
  mutation.lastAttemptAt = toISO();
  mutation.updatedAt = toISO();
  mutation.lastError = message;
  if (canRetryAfter(mutation.retryCount)) mutation.status = 'pending';
  else mutation.status = 'failed';
  await put(mutation);
  return mutation;
}

export async function discardMutation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sync_queue', id);
}

export async function countSyncedState(): Promise<SyncCounts> {
  const db = await getDB();
  const all = await db.getAll('sync_queue');
  let pendingCount = 0;
  let failedCount = 0;
  let conflictCount = 0;
  for (const m of all) {
    if (m.status === 'pending' || m.status === 'syncing') pendingCount += 1;
    else if (m.status === 'failed') failedCount += 1;
    else if (m.status === 'conflict') conflictCount += 1;
  }
  return { pendingCount, failedCount, conflictCount };
}

export async function countByIdempotencyKey(key: string): Promise<number> {
  const db = await getDB();
  const all = await db.getAll('sync_queue');
  return all.filter((m) => m.idempotencyKey === key).length;
}

export async function listConflicts(): Promise<SyncMutation[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('sync_queue', 'by-status', 'conflict');
  return all.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}