import type {
  AppSettings,
  Client,
  Parcel,
  ParcelItem,
  Payment,
  Product,
  Trip,
  TripExpense,
  TripVehicle,
} from './types';
import type { SyncEngineState, SyncEntity, SyncMutation } from './syncTypes';
import { ApiError, isTransientApiError } from './api';
import { toISO } from './format';
import {
  beginSyncing,
  completeSynced,
  countSyncedState,
  discardMutation,
  listConflicts,
  markConflict,
  markFailed,
  nextPendingMutation,
  nextPendingRetryDeadlineMs,
  registerTransientFailure,
  requeueMutation,
} from './syncQueue';
import {
  refreshClients,
  refreshExpenses,
  refreshParcels,
  refreshPayments,
  refreshProducts,
  refreshSettings,
  refreshTrips,
  removeFromLocal,
  upsertClient,
  upsertExpense,
  upsertParcel,
  upsertPayment,
  upsertProduct,
  upsertSettings,
  upsertTrip,
  upsertTripVehicle,
} from './localCache';
import {
  createOnlineClient,
  deleteOnlineClient,
  listOnlineClients,
  updateOnlineClient,
} from './clientPersistence';
import {
  createOnlineProduct,
  deleteOnlineProduct,
  listOnlineProducts,
  updateOnlineProduct,
} from './productPersistence';
import {
  createOnlineTrip,
  createOnlineTripVehicle,
  deleteOnlineTrip,
  deleteOnlineTripVehicle,
  listOnlineTripVehicles,
  listOnlineTrips,
  updateOnlineTrip,
} from './tripPersistence';
import {
  createParcelOnline,
  deleteOnlineParcel,
  listOnlineParcels,
  updateOnlineParcel,
} from './parcelPersistence';
import {
  createOnlinePayment,
  deleteOnlinePayment,
  listOnlinePayments,
  updateOnlinePayment,
} from './paymentPersistence';
import {
  createOnlineExpense,
  deleteOnlineExpense,
  listOnlineExpenses,
  updateOnlineExpense,
} from './expensePersistence';
import {
  listOnlineSettings,
  updateOnlineSettings,
} from './settingsPersistence';

// ---------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------
type Outcome =
  | { kind: 'success'; value?: unknown }
  | { kind: 'transient'; message: string }
  | { kind: 'permanent'; code: number; message: string }
  | { kind: 'conflict'; message: string }
  | { kind: 'create-conflict' };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Erreur inconnue.';
}

function classifyError(error: unknown, action: SyncMutation['action']): Outcome {
  if (isTransientApiError(error)) return { kind: 'transient', message: messageOf(error) };
  if (error instanceof ApiError) {
    const status = error.status;
    if (status === 409) {
      if (action === 'create') return { kind: 'create-conflict' };
      return { kind: 'conflict', message: `API_${status}` };
    }
    if (status === 404 && action === 'update') {
      return { kind: 'conflict', message: 'Enregistrement introuvable sur le serveur.' };
    }
    return { kind: 'permanent', code: status, message: `API_${status}` };
  }
  return { kind: 'transient', message: messageOf(error) };
}

// ---------------------------------------------------------------
// Transport: translates a queued mutation into the matching API call.
// ---------------------------------------------------------------
async function runMutation(mutation: SyncMutation): Promise<Outcome> {
  try {
    let value: unknown;
    switch (mutation.entity) {
      case 'clients': {
        const payload = mutation.payload as unknown as Client;
        if (mutation.action === 'create') {
          value = await createOnlineClient({
            full_name: payload.full_name ?? '',
            phone: payload.phone ?? '',
            company_name: payload.company_name,
            email: payload.email,
            city: payload.city ?? '',
            neighborhood: payload.neighborhood,
            address: payload.address ?? '',
            reference: payload.reference,
            notes: payload.notes ?? '',
          }, mutation.entityId);
        } else if (mutation.action === 'update') {
          value = await updateOnlineClient(mutation.entityId, mutation.payload as Partial<Client>);
        } else {
          await deleteOnlineClient(mutation.entityId);
        }
        break;
      }
      case 'products': {
        const payload = mutation.payload as unknown as Product;
        if (mutation.action === 'create') {
          value = await createOnlineProduct({
            name: payload.name,
            category: payload.category,
            default_price: payload.default_price,
          }, mutation.entityId);
        } else if (mutation.action === 'update') {
          value = await updateOnlineProduct(mutation.entityId, mutation.payload as Partial<Product>);
        } else {
          await deleteOnlineProduct(mutation.entityId);
        }
        break;
      }
      case 'trips': {
        const payload = mutation.payload as unknown as Trip;
        if (mutation.action === 'create') {
          value = await createOnlineTrip({
            trip_number: payload.trip_number,
            trip_date: payload.trip_date,
            origin: payload.origin,
            destination: payload.destination,
            status: payload.status,
          }, mutation.entityId);
        } else if (mutation.action === 'update') {
          value = await updateOnlineTrip(mutation.entityId, mutation.payload as Partial<Trip>);
        } else {
          await deleteOnlineTrip(mutation.entityId);
        }
        break;
      }
      case 'trip-vehicles': {
        const payload = mutation.payload as unknown as TripVehicle;
        if (mutation.action === 'create') {
          value = await createOnlineTripVehicle({
            trip_id: payload.trip_id,
            registration: payload.registration,
            road_bamako_frontier: payload.road_bamako_frontier,
            customs_fee: payload.customs_fee,
            frontier_formalities: payload.frontier_formalities,
            road_frontier_bouake: payload.road_frontier_bouake,
            road_bouake_abidjan: payload.road_bouake_abidjan,
            road_abidjan: payload.road_abidjan,
            loading_fee: payload.loading_fee,
            unloading_fee: payload.unloading_fee,
            truck_quota: payload.truck_quota,
            monthly_fee: payload.monthly_fee,
          }, mutation.entityId);
        } else {
          await deleteOnlineTripVehicle(mutation.entityId);
        }
        break;
      }
      case 'parcels': {
        if (mutation.action === 'create') {
          const payload = mutation.payload as { parcel: Parcel; items: Array<{ product_id?: string; designation: string; quantity: number; unit_price: number }> };
          value = await createParcelOnline(payload.parcel as unknown as Record<string, unknown>, payload.items, mutation.entityId);
        } else if (mutation.action === 'update') {
          value = await updateOnlineParcel(mutation.entityId, mutation.payload as Parameters<typeof updateOnlineParcel>[1]);
        } else {
          await deleteOnlineParcel(mutation.entityId);
        }
        break;
      }
      case 'payments': {
        const payload = mutation.payload as unknown as Payment;
        if (mutation.action === 'create') {
          value = await createOnlinePayment({
            parcel_id: payload.parcel_id,
            amount: payload.amount,
            payment_method: payload.payment_method,
            payment_date: payload.payment_date,
            note: payload.note ?? '',
          }, mutation.idempotencyKey, mutation.entityId);
        } else if (mutation.action === 'update') {
          value = await updateOnlinePayment(mutation.entityId, {
            note: payload.note,
            payment_method: payload.payment_method,
          });
        } else {
          await deleteOnlinePayment(mutation.entityId);
        }
        break;
      }
      case 'expenses': {
        const payload = mutation.payload as unknown as TripExpense;
        if (mutation.action === 'create') {
          value = await createOnlineExpense({
            parcel_id: payload.parcel_id,
            trip_id: payload.trip_id,
            trip_vehicle_id: payload.trip_vehicle_id,
            category_id: payload.category_id,
            category_name: payload.category_name,
            label: payload.label,
            amount: payload.amount,
            expense_date: payload.expense_date,
            location: payload.location,
            notes: payload.notes,
          }, mutation.entityId);
        } else if (mutation.action === 'update') {
          value = await updateOnlineExpense(mutation.entityId, mutation.payload as Partial<TripExpense>);
        } else {
          await deleteOnlineExpense(mutation.entityId);
        }
        break;
      }
      case 'settings': {
        // Settings is a singleton resource: it is enqueued as an update and
        // never created or deleted from a device.
        if (mutation.action !== 'update') {
          return { kind: 'permanent', code: 400, message: 'Une mutation non prise en charge a été rejetée.' };
        }
        value = await updateOnlineSettings(mutation.payload as Partial<AppSettings>);
        break;
      }
    }
    return { kind: 'success', value };
  } catch (error) {
    return classifyError(error, mutation.action);
  }
}

// After a create - 409, re-check whether the entity actually exists server side
// (the first attempt may have committed while the response was lost). If it
// exists, the create is treated as successful (idempotent).
async function verifyExists(mutation: SyncMutation): Promise<Outcome> {
  try {
    switch (mutation.entity) {
      case 'clients': {
        const found = (await listOnlineClients()).find((c) => c.id === mutation.entityId);
        return found ? { kind: 'success', value: found } : { kind: 'conflict', message: 'Création impossible : le serveur a refusé la mutation.' };
      }
      case 'products': {
        const found = (await listOnlineProducts()).find((p) => p.id === mutation.entityId);
        return found ? { kind: 'success', value: found } : { kind: 'conflict', message: 'Création impossible : le serveur a refusé la mutation.' };
      }
      case 'trips': {
        const found = (await listOnlineTrips()).find((t) => t.id === mutation.entityId);
        return found ? { kind: 'success', value: found } : { kind: 'conflict', message: 'Création impossible : le serveur a refusé la mutation.' };
      }
      case 'trip-vehicles': {
        const tripId = (mutation.payload as unknown as TripVehicle).trip_id;
        const found = (await listOnlineTripVehicles(tripId)).find((v) => v.id === mutation.entityId);
        return found ? { kind: 'success', value: found } : { kind: 'conflict', message: 'Création impossible : le serveur a refusé la mutation.' };
      }
      case 'parcels': {
        const found = (await listOnlineParcels()).find((p) => p.id === mutation.entityId);
        return found ? { kind: 'success', value: found } : { kind: 'conflict', message: 'Création impossible : le serveur a refusé la mutation.' };
      }
      case 'payments': {
        const found = (await listOnlinePayments()).find((p) => p.id === mutation.entityId);
        return found ? { kind: 'success', value: found } : { kind: 'conflict', message: 'Création impossible : le serveur a refusé la mutation.' };
      }
      case 'expenses': {
        const found = (await listOnlineExpenses()).find((e) => e.id === mutation.entityId);
        return found ? { kind: 'success', value: found } : { kind: 'conflict', message: 'Création impossible : le serveur a refusé la mutation.' };
      }
    }
    return { kind: 'conflict', message: 'Création impossible.' };
  } catch (error) {
    return classifyError(error, 'create');
  }
}

// ---------------------------------------------------------------
// Local apply after a server-success
// ---------------------------------------------------------------
async function applySynced(mutation: SyncMutation, value: unknown): Promise<void> {
  try {
    switch (mutation.entity) {
      case 'clients':
        if (value) await upsertClient(value as Client);
        break;
      case 'products':
        if (value) await upsertProduct(value as Product);
        break;
      case 'trips':
        if (value) await upsertTrip(value as Trip);
        break;
      case 'trip-vehicles':
        if (value) await upsertTripVehicle(value as TripVehicle);
        break;
      case 'parcels': {
        if (value) {
          const wrapped = value as { parcel?: Parcel & { items?: ParcelItem[] }; items?: ParcelItem[] };
          if (wrapped.parcel) {
            await upsertParcel(wrapped.parcel, wrapped.items ?? wrapped.parcel.items ?? []);
          } else {
            const parcel = value as Parcel & { items?: ParcelItem[] };
            await upsertParcel(parcel, parcel.items ?? []);
          }
        }
        break;
      }
      case 'payments':
        if (value) await upsertPayment(value as Payment);
        break;
      case 'expenses':
        if (value) await upsertExpense(value as TripExpense);
        break;
      case 'settings':
        if (value) await upsertSettings(value as AppSettings);
        break;
    }
    if (mutation.action === 'delete') {
      await removeFromLocal(mutation.entity, mutation.entityId);
    }
  } catch {
    // Local application is best-effort; the server state is already committed.
  }
}

// ---------------------------------------------------------------
// Drain
// ---------------------------------------------------------------
async function drain(): Promise<boolean> {
  const GUARD = 1000;
  for (let index = 0; index < GUARD; index += 1) {
    const mutation = await nextPendingMutation();
    if (!mutation) return false;
    await beginSyncing(mutation);
    const outcome = await runMutation(mutation);

    if (outcome.kind === 'success') {
      syncedInLastRun += 1;
      await applySynced(mutation, outcome.value);
      await completeSynced(mutation.id);
      continue;
    }
    if (outcome.kind === 'transient') {
      await registerTransientFailure(mutation, outcome.message);
      return true;
    }
    if (outcome.kind === 'create-conflict') {
      const verified = await verifyExists(mutation);
      if (verified.kind === 'success') {
        syncedInLastRun += 1;
        await applySynced(mutation, verified.value);
        await completeSynced(mutation.id);
        continue;
      }
      if (verified.kind === 'transient') {
        await registerTransientFailure(mutation, verified.message);
        return true;
      }
      if (verified.kind === 'permanent') {
        await markFailed(mutation, verified.message);
        continue;
      }
      const verifiedMessage = verified.kind === 'conflict' ? verified.message : 'Création impossible.';
      await markConflict(mutation, verifiedMessage);
      continue;
    }
    if (outcome.kind === 'permanent') {
      await markFailed(mutation, outcome.message);
      continue;
    }
    await markConflict(mutation, outcome.message);
  }
  return false;
}

// Safe server -> local pull. Protected records (pending/failed/conflict
// mutations) are never touched, so offline work is never silently overwritten.
async function pullAll(): Promise<boolean> {
  if (!onlineState) return false;
  try {
    const clients = await listOnlineClients();
    await refreshClients(clients);
    const products = await listOnlineProducts();
    await refreshProducts(products);
    const trips = await listOnlineTrips();
    const vehicles = trips.flatMap((trip) => (trip as Trip & { vehicles?: TripVehicle[] }).vehicles ?? []);
    await refreshTrips(trips, vehicles);
    const parcels = await listOnlineParcels();
    await refreshParcels(parcels);
    const payments = await listOnlinePayments();
    await refreshPayments(payments);
    const expenses = await listOnlineExpenses();
    await refreshExpenses(expenses);
    const settings = await listOnlineSettings();
    await refreshSettings(settings);
    return true;
  } catch (error) {
    if (isTransientApiError(error)) return false;
    throw error;
  }
}

// ---------------------------------------------------------------
// Engine state + public API
// ---------------------------------------------------------------
let running = false;
// A requestSync() issued while a cycle is in-flight is latched and re-run as
// soon as that cycle finishes, so a reconnect/online event is never dropped.
let syncQueued = false;
let onlineState = typeof navigator !== 'undefined' ? navigator.onLine : false;
let lastSyncAt: string | null = null;
let lastError: string | null = null;
let syncedInLastRun = 0;
const listeners = new Set<(state: SyncEngineState) => void>();

async function emitState(): Promise<void> {
  const counts = await countSyncedState();
  const state: SyncEngineState = {
    online: onlineState,
    running,
    lastSyncAt,
    lastError,
    pendingCount: counts.pendingCount,
    failedCount: counts.failedCount,
    conflictCount: counts.conflictCount,
    syncedInLastRun,
  };
  for (const listener of [...listeners]) listener(state);
}

// A retry only re-enters the normal engine cycle; it never "fakes" a sync.
// It ensures a mutation waiting out its backoff is retried exactly when the
// backoff elapses instead of waiting for the next 30s interval tick.
let retryTimer: ReturnType<typeof setTimeout> | null = null;

async function scheduleRetry(): Promise<void> {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (!onlineState) return;
  let deadlineMs: number | null = null;
  try {
    deadlineMs = await nextPendingRetryDeadlineMs();
  } catch {
    return;
  }
  if (deadlineMs === null) return;
  const delay = Math.max(0, deadlineMs - Date.now());
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void requestSync();
  }, delay);
}

export async function requestSync(): Promise<void> {
  if (running) {
    syncQueued = true;
    return;
  }
  // A connectivity event may have been missed or arrived late; re-read the
  // actual state so a stale offlineState never pins the engine down.
  if (typeof navigator !== 'undefined') onlineState = navigator.onLine;
  if (!onlineState) {
    lastError = 'Hors ligne : la synchronisation reprendra au retour du réseau.';
    await emitState();
    return;
  }
  running = true;
  syncedInLastRun = 0;
  await emitState();
  try {
    const blocked = await drain();
    if (blocked) {
      lastError = 'Synchronisation différée : nouvelle tentative dans quelques secondes.';
    } else {
      const pulled = await pullAll();
      if (pulled) lastError = null;
      lastSyncAt = toISO();
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Erreur de synchronisation.';
  } finally {
    running = false;
    await emitState();
    await scheduleRetry();
    if (syncQueued) {
      syncQueued = false;
      void requestSync();
    }
  }
}

export function setOnlineState(value: boolean): void {
  onlineState = value;
  if (value) {
    void requestSync();
  } else {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    lastError = 'Hors ligne.';
    void emitState();
  }
}

export function getOnlineState(): boolean {
  return onlineState;
}

export function subscribeSyncState(listener: (state: SyncEngineState) => void): () => void {
  listeners.add(listener);
  void emitState();
  return () => {
    listeners.delete(listener);
  };
}

export async function getConflicts(): Promise<SyncMutation[]> {
  return listConflicts();
}

// Manual conflict resolution: drop the offline mutation, then the next pull
// restores the server truth into the local cache.
export async function resolveConflict(id: string): Promise<void> {
  await discardMutation(id);
  void requestSync();
}

// Manual conflict resolution keeping the local version: re-queues the mutation
// as pending so the next drain re-applies it against the server.
export async function resolveConflictKeepingLocal(id: string): Promise<void> {
  await requeueMutation(id);
  void requestSync();
}

export type { SyncEngineState, SyncEntity };