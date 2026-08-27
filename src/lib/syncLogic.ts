// Pure, dependency-free sync decision logic.
//
// This module contains no runtime imports so it can be executed directly under
// Node with `--experimental-strip-types` for the targeted engine tests, while
// the app keeps using it from the browser bundle.

import type { SyncAction, SyncEntity, SyncMutation } from './syncTypes';

export const BACKOFF_SECONDS = [2, 5, 15, 30, 60, 120];
export const MAX_RETRIES = BACKOFF_SECONDS.length;

export function backoffSeconds(retryCount: number): number {
  const index = Math.max(0, Math.min(retryCount - 1, BACKOFF_SECONDS.length - 1));
  return BACKOFF_SECONDS[index];
}

// Stable across retries: the same (entity, action, id) always yields the same key.
export function stableKey(entity: SyncEntity, action: SyncAction, entityId: string): string {
  return `sync_${entity}_${action}_${entityId}`;
}

// HTTP statuses that are worth retrying (network hiccups, upstream failures).
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

// 4xx payload/authorization errors are never blind-retried.
export function isPermanentStatus(status: number): boolean {
  return status === 400 || status === 401 || status === 403 || status === 404;
}

// A mutation that failed transiently may be retried as soon as its backoff
// window has elapsed. Beyond MAX_RETRIES it must be marked failed.
export function canRetryAfter(retryCount: number): boolean {
  return retryCount <= MAX_RETRIES;
}

export function isDueForRetry(m: Pick<SyncMutation, 'retryCount' | 'lastAttemptAt'>, nowMs: number): boolean {
  if (m.retryCount <= 0 || !m.lastAttemptAt) return true;
  const due = new Date(m.lastAttemptAt).getTime() + backoffSeconds(m.retryCount) * 1000;
  return nowMs >= due;
}

// FIFO ordering: oldest first, ignoring mutations still in their backoff window.
export function orderPending(mutations: SyncMutation[], nowMs: number): SyncMutation[] {
  return mutations
    .filter((m) => isDueForRetry(m, nowMs))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function mergeLocalPending<T extends { id: string }>(serverRecords: T[], localRecords: T[], protectedIds: Set<string>): T[] {
  const map = new Map<string, T>();
  for (const record of serverRecords) map.set(record.id, record);
  for (const record of localRecords) {
    if (protectedIds.has(record.id)) map.set(record.id, record);
  }
  return [...map.values()];
}

// Creates are the source of truth for the whole record. When a later update
// touches the same entity while the create is pending, the fields the create
// accepts are folded into it so a redundant update does not run afterwards.
export function foldCreatePayload(
  entity: SyncEntity,
  createPayload: Record<string, unknown>,
  updatePayload: Record<string, unknown>
): Record<string, unknown> | null {
  const target = { ...createPayload };
  if (entity === 'parcels') {
    if (createPayload.parcel && typeof createPayload.parcel === 'object') {
      const parcel = { ...(createPayload.parcel as Record<string, unknown>) };
      const toFold: Record<string, unknown> = {};
      if (updatePayload.status !== undefined) toFold.status = updatePayload.status;
      if (updatePayload.description !== undefined) toFold.description = updatePayload.description;
      if (Object.keys(toFold).length === 0) return null;
      const result = { ...target, parcel: { ...parcel, ...toFold } };
      return JSON.stringify(result) === JSON.stringify(target) ? null : result;
    }
    return null;
  }
  const merged = { ...target, ...updatePayload };
  return JSON.stringify(merged) === JSON.stringify(target) ? null : merged;
}

function mergeUpdatePayload(previous: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  return { ...previous, ...next };
}

// When two parcel STATUS updates are merged, the precondition of the combined
// mutation is the predicate of the FIRST transition, while the target state is
// the one of the LAST transition. Keeping the last expectedStatus would make
// the server reject a perfectly valid received -> in_transit -> arrived sync
// with a false 409 conflict.
function mergeParcelStatusUpdate(previous: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...previous, ...next };
  if (previous.expectedStatus !== undefined) merged.expectedStatus = previous.expectedStatus;
  return merged;
}

export interface CoalescePlan {
  removeIds: string[];
  updates: Array<{ id: string; payload: Record<string, unknown> }>;
  insert: {
    entity: SyncEntity;
    entityId: string;
    action: SyncAction;
    payload: Record<string, unknown>;
    idempotencyKey: string;
    createdAt: string;
    updatedAt: string;
  } | null;
}

interface CoalesceExisting {
  id: string;
  action: SyncAction;
  payload: Record<string, unknown>;
}

interface CoalesceInput {
  entity: SyncEntity;
  entityId: string;
  action: SyncAction;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  now: string;
}

function makeInsert(input: CoalesceInput): CoalescePlan['insert'] {
  return {
    entity: input.entity,
    entityId: input.entityId,
    action: input.action,
    payload: input.payload,
    idempotencyKey: input.idempotencyKey || stableKey(input.entity, input.action, input.entityId),
    createdAt: input.now,
    updatedAt: input.now,
  };
}

// Coalescing rules (see enqueueMutation in syncQueue):
// - update + update            -> single mutation, last write wins per field.
// - create + create            -> single create, last write wins.
// - create + update            -> folded into the create when accepted fields.
// - delete after pending create-> entity never reached the server: drop create
//   and its updates, no delete queued (net zero).
// - update after pending delete-> ignored.
export function planCoalescing(existing: CoalesceExisting[], input: CoalesceInput): CoalescePlan {
  const noop: CoalescePlan = { removeIds: [], updates: [], insert: null };
  const hasDelete = existing.some((m) => m.action === 'delete');

  if (input.action === 'delete') {
    if (existing.some((m) => m.action === 'create')) {
      return { removeIds: existing.map((m) => m.id), updates: [], insert: null };
    }
    if (hasDelete) return noop;
    return {
      removeIds: existing.filter((m) => m.action === 'update').map((m) => m.id),
      updates: [],
      insert: makeInsert(input),
    };
  }

  if (hasDelete) return noop;

  const create = existing.find((m) => m.action === 'create');
  if (create) {
    if (input.action === 'create') {
      const merged = mergeUpdatePayload(create.payload, input.payload);
      if (JSON.stringify(merged) === JSON.stringify(create.payload)) return noop;
      return { removeIds: [], updates: [{ id: create.id, payload: merged }], insert: null };
    }
    const folded = foldCreatePayload(input.entity, create.payload, input.payload);
    if (folded) {
      return { removeIds: [], updates: [{ id: create.id, payload: folded }], insert: null };
    }
  }

  const update = existing.find((m) => m.action === 'update');
  if (input.action === 'update' && update) {
    const hasParcelStatus = input.entity === 'parcels';
    const merged = hasParcelStatus
      ? mergeParcelStatusUpdate(update.payload, input.payload)
      : mergeUpdatePayload(update.payload, input.payload);
    if (JSON.stringify(merged) === JSON.stringify(update.payload)) return noop;
    return { removeIds: [], updates: [{ id: update.id, payload: merged }], insert: null };
  }

  return { removeIds: [], updates: [], insert: makeInsert(input) };
}

export type ClassifiedOutcome =
  | { kind: 'success' }
  | { kind: 'transient' }
  | { kind: 'permanent' }
  | { kind: 'conflict' };

// Maps an HTTP status + mutation action to the engine outcome.
export function classifyStatus(status: number, action: SyncAction): ClassifiedOutcome {
  if (isRetryableStatus(status)) return { kind: 'transient' };
  if (status === 409) {
    if (action === 'create') return { kind: 'success' }; // verified idempotent create
    return { kind: 'conflict' };
  }
  if (isPermanentStatus(status)) return { kind: 'permanent' };
  if (status >= 200 && status < 300) return { kind: 'success' };
  return { kind: 'transient' };
}