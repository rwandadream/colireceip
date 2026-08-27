// Pure decision-logic tests for the sync engine. No runtime dependencies: the
// module only imports type-only from syncTypes, so it runs under Node's
// --experimental-strip-types flag without a bundler or a database.
import {
  backoffSeconds,
  canRetryAfter,
  classifyStatus,
  foldCreatePayload,
  isDueForRetry,
  isPermanentStatus,
  isRetryableStatus,
  MAX_RETRIES,
  mergeLocalPending,
  orderPending,
  planCoalescing,
  stableKey,
} from '../src/lib/syncLogic.ts';

const results = {};
const record = (name, passed) => { results[name] = passed; console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}`); };
const pass = (name, assertions) => record(name, assertions.every((value) => Boolean(value)));

const iso = (offsetSeconds) => new Date(Date.now() + offsetSeconds * 1000).toISOString();

// --- stableKey ---------------------------------------------------------
pass('stableKeyIsStableAndScoped', [
  stableKey('clients', 'create', 'abc') === 'sync_clients_create_abc',
  stableKey('clients', 'create', 'abc') !== stableKey('clients', 'update', 'abc'),
  stableKey('clients', 'create', 'abc') !== stableKey('payments', 'create', 'abc'),
]);

// --- backoff / retries --------------------------------------------------
pass('backoffSchedule', [
  backoffSeconds(0) === 2,
  backoffSeconds(1) === 2,
  backoffSeconds(2) === 5,
  backoffSeconds(5) === 60,
  backoffSeconds(6) === 120,
  backoffSeconds(99) === 120,
]);
pass('maxRetriesCapping', [
  MAX_RETRIES === 6,
  canRetryAfter(1) && canRetryAfter(6),
  !canRetryAfter(7),
]);
pass('retryableVsPermanentStatus', [
  [429, 500, 502, 503, 504].every((s) => isRetryableStatus(s)),
  [400, 401, 403, 404].every((s) => isPermanentStatus(s)),
  !isRetryableStatus(400) && !isPermanentStatus(429) && !isPermanentStatus(200),
]);
pass('isDueForRetryUsesBackoff', [
  isDueForRetry({ retryCount: 0, lastAttemptAt: undefined }, Date.now()),
  isDueForRetry({ retryCount: 1, lastAttemptAt: iso(-100) }, Date.now()),
  !isDueForRetry({ retryCount: 1, lastAttemptAt: iso(0) }, Date.now()),
]);

// --- classifyStatus -----------------------------------------------------
const classify = (status, action) => classifyStatus(status, action).kind;
pass('classifyStatusMapsOutcomes', [
  classify(200, 'create') === 'success',
  classify(204, 'delete') === 'success',
  classify(500, 'create') === 'transient',
  classify(429, 'update') === 'transient',
  classify(418, 'update') === 'transient',
  classify(400, 'create') === 'permanent',
  classify(403, 'create') === 'permanent',
  classify(404, 'update') === 'permanent',
  classify(409, 'update') === 'conflict',
  classify(409, 'create') === 'success', // verified idempotent create
]);

// --- orderPending (FIFO + backoff) --------------------------------------
const mk = (id, createdAt, retryCount = 0, lastAttemptAt) => ({ id, createdAt, retryCount, lastAttemptAt });
pass('orderPendingFifo', [
  orderPending([mk('b', iso(-20)), mk('a', iso(-10))], Date.now()).map((m) => m.id).join() === 'b,a',
]);
pass('orderPendingSkipsBackoff', [
  orderPending([mk('retry', iso(-20), 1, iso(0)), mk('fresh', iso(-5))], Date.now()).map((m) => m.id).join() === 'fresh',
]);
pass('orderPendingAllowsDueRetry', [
  orderPending([mk('retry', iso(-20), 1, iso(-100))], Date.now()).map((m) => m.id).join() === 'retry',
]);

// --- mergeLocalPending --------------------------------------------------
pass('mergeLocalPendingProtectsLocal', [
  mergeLocalPending(
    [{ id: 'a', v: 'server' }, { id: 'b', v: 'server' }],
    [{ id: 'a', v: 'local' }, { id: 'c', v: 'local' }],
    new Set(['a', 'c'])
  ).map((r) => `${r.id}:${r.v}`).sort().join() === 'a:local,b:server,c:local',
]);
pass('mergeLocalPendingServerTruthWithoutProtection', [
  mergeLocalPending(
    [{ id: 'a', v: 'server' }],
    [{ id: 'a', v: 'local' }, { id: 'c', v: 'local' }],
    new Set()
  ).map((r) => `${r.id}:${r.v}`).sort().join() === 'a:server',
]);

// --- foldCreatePayload ---------------------------------------------------
pass('foldCreatePayloadFoldsClientUpdate', [
  foldCreatePayload('clients', { full_name: 'A', city: 'Bamako' }, { city: 'Abidjan' })?.city === 'Abidjan',
  foldCreatePayload('clients', { full_name: 'A', city: 'Bamako' }, { city: 'Bamako' }) === null,
]);
pass('foldCreatePayloadFoldsParcelStatus', [
  foldCreatePayload('parcels', { parcel: { tracking_number: 'T1', status: 'received' }, items: [] }, { status: 'in_transit' })?.parcel?.status === 'in_transit',
  foldCreatePayload('parcels', { parcel: { tracking_number: 'T1', status: 'received' }, items: [] }, { description: 'ok' })?.parcel?.description === 'ok',
  foldCreatePayload('parcels', { parcel: { tracking_number: 'T1', status: 'received' }, items: [] }, { status: 'received' }) === null,
]);

// --- planCoalescing ------------------------------------------------------
const plan = (existing, entity, action, entityId, payload, now) => planCoalescing(existing, { entity, entityId, action, payload, now });

const base = { entityId: 'id-1', now: iso(-5) };
const createMutation = { id: 'm-create', action: 'create', payload: { full_name: 'A' } };
const updateParcelPayload = (status, expectedStatus) => ({ status, expectedStatus });

pass('coalesceInsertWhenEmpty', [
  (() => {
    const result = plan([], 'clients', 'update', 'id-1', { full_name: 'A' }, iso(-5));
    return result.insert !== null && result.insert.action === 'update' && result.removeIds.length === 0 && result.updates.length === 0;
  })(),
]);

pass('coalesceCreatePlusCreate', [
  (() => {
    const result = plan([createMutation], 'clients', 'create', 'id-1', { full_name: 'B' }, iso(-4));
    return result.insert === null && result.updates.length === 1 && result.updates[0].id === 'm-create' && result.updates[0].payload.full_name === 'B';
  })(),
]);

pass('coalesceCreatePlusUpdateFolds', [
  (() => {
    const existing = [{ id: 'm-create', action: 'create', payload: { full_name: 'A', city: 'Bamako' } }];
    const result = plan(existing, 'clients', 'update', 'id-1', { city: 'Abidjan' }, iso(-4));
    return result.insert === null && result.updates.length === 1 && result.updates[0].id === 'm-create' && result.updates[0].payload.city === 'Abidjan';
  })(),
]);

pass('coalesceUpdatePlusUpdateLastWriteWins', [
  (() => {
    const existing = [{ id: 'm-upd', action: 'update', payload: { city: 'Bamako' } }];
    const result = plan(existing, 'clients', 'update', 'id-1', { city: 'Abidjan' }, iso(-4));
    return result.insert === null && result.updates[0].id === 'm-upd' && result.updates[0].payload.city === 'Abidjan';
  })(),
]);

pass('coalesceParcelStatusKeepsFirstExpectedStatus', [
  (() => {
    const existing = [{ id: 'm-upd', action: 'update', payload: updateParcelPayload('in_transit', 'received') }];
    const result = plan(existing, 'parcels', 'update', 'id-1', updateParcelPayload('arrived', 'in_transit'), iso(-4));
    const merged = result.updates[0].payload;
    return merged.status === 'arrived' && merged.expectedStatus === 'received';
  })(),
]);

pass('coalesceDeleteAfterPendingCreateIsNetZero', [
  (() => {
    const existing = [{ id: 'm-create', action: 'create', payload: { full_name: 'A' } }, { id: 'm-upd', action: 'update', payload: { city: 'X' } }];
    const result = plan(existing, 'clients', 'delete', 'id-1', {}, iso(-4));
    return result.insert === null && result.removeIds.sort().join() === ['m-create', 'm-upd'].join();
  })(),
]);

pass('coalesceUpdateAfterPendingDeleteIgnored', [
  (() => {
    const existing = [{ id: 'm-del', action: 'delete', payload: {} }];
    const result = plan(existing, 'clients', 'update', 'id-1', { full_name: 'X' }, iso(-4));
    return result.insert === null && result.removeIds.length === 0 && result.updates.length === 0;
  })(),
]);

pass('coalesceDeleteRemovesUpdatesAndKeepsDelete', [
  (() => {
    const existing = [{ id: 'm-upd', action: 'update', payload: { city: 'X' } }];
    const result = plan(existing, 'clients', 'delete', 'id-1', {}, iso(-4));
    return result.insert !== null && result.insert.action === 'delete' && result.removeIds.join() === 'm-upd';
  })(),
]);

if (Object.values(results).some((passed) => !passed)) {
  process.exitCode = 1;
  console.log('\nAU MOINS UN TEST A ÉCHOUÉ.');
} else {
  console.log(`\n${Object.keys(results).length} tests PASS.`);
}