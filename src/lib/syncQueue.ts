import { getDB } from './db';
import { generateId, toISO } from './format';
import type { SyncAction, SyncEntity, SyncMutation } from './syncTypes';
import {
  backoffSeconds,
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
  const syncedEntities = new Set<SyncEntity>(['clients', 'products', 'parcels', 'payments', 'trips', 'trip-vehicles', 'settings', 'expenses']);
  for (const m of all) {
    if (m.status === 'synced' || !syncedEntities.has(m.entity)) continue;
    map.set(`${m.entity}:${m.entityId}`, { entity: m.entity, entityId: m.entityId, action: m.action });
  }
  return map;
}

// True when at least one offline mutation for the entity still has to reach the
// server. The local mirror GC uses this to avoid sweeping records the server has
// not applied yet (e.g. a parcel created just before navigating to its detail
// page, while its create is still being drained).
export async function hasActiveMutations(entity: SyncEntity): Promise<boolean> {
  const db = await getDB();
  const all = await db.getAll('sync_queue');
  return all.some((m) => m.entity === entity && m.status !== 'synced');
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

// Removes every queued mutation for a target. Used after an online-first delete
// succeeds so previously queued offline edits for the now-deleted record are
// never replayed against the server (they would otherwise fail as client-not-found
// HTTP 400s). Mutations for any other target are left untouched.
export async function cancelMutations(entity: SyncEntity, entityId: string): Promise<void> {
  const db = await getDB();
  const all = await db.getAllFromIndex('sync_queue', 'by-target', [entity, entityId]);
  for (const mutation of all) {
    await db.delete('sync_queue', mutation.id);
  }
}

// Re-queues a conflict/failed mutation as pending: it is retried on the next
// drain. Both terminal states expose user-driven recovery, so a re-queue is
// valid for either of them.
export async function requeueMutation(id: string): Promise<void> {
  const db = await getDB();
  const all = await db.getAll('sync_queue');
  const mutation = all.find((m) => m.id === id && (m.status === 'conflict' || m.status === 'failed'));
  if (!mutation) return;
  mutation.status = 'pending';
  mutation.retryCount = 0;
  mutation.updatedAt = toISO();
  mutation.lastError = undefined;
  await put(mutation);
}

// Clears the backoff window of a PENDING mutation so the very next drain retries
// it immediately. Used after a formerly-missing dependency has been resolved:
// the parcel create waiting on a transient 400 ("client introuvable") must not
// sit out the rest of its backoff once its client now exists server-side.
export async function retryPendingNow(id: string): Promise<void> {
  const db = await getDB();
  const all = await db.getAll('sync_queue');
  const mutation = all.find((m) => m.id === id && m.status === 'pending');
  if (!mutation) return;
  mutation.retryCount = 0;
  mutation.lastAttemptAt = undefined;
  mutation.lastError = undefined;
  mutation.updatedAt = toISO();
  await put(mutation);
}

// Earliest absolute timestamp (ms) at which a pending mutation may be retried,
// i.e. the moment its current backoff window elapses. Mutations that never
// failed (or have no recorded attempt) are already due and ignored here: they
// are handled by the next drain directly.
export async function nextPendingRetryDeadlineMs(): Promise<number | null> {
  const db = await getDB();
  const pending = await db.getAllFromIndex('sync_queue', 'by-status', 'pending');
  let earliest: number | null = null;
  for (const m of pending) {
    if (m.retryCount <= 0 || !m.lastAttemptAt) continue;
    const due = new Date(m.lastAttemptAt).getTime() + backoffSeconds(m.retryCount) * 1000;
    if (earliest === null || due < earliest) earliest = due;
  }
  return earliest;
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

export async function listFailed(): Promise<SyncMutation[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('sync_queue', 'by-status', 'failed');
  return all.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

export async function listPending(): Promise<SyncMutation[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('sync_queue', 'by-status', 'pending');
  return all.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}