// TRANSIENT HTTP MAPPING — regression guard for the root-cause fix.
//
// Unexpected backend/database/network failures used to fall into the generic
// HTTP 400 catch-all of api/data.js. The sync engine treats 400 as a permanent
// error (never retried), so a single infrastructure hiccup permanently failed a
// queued mutation and stuck it in the UI ("1 enregistrement(s) en erreur").
//
// This suite pins the mapping that root-cause fix relies on:
//   A. transient database/driver/network errors are classified as 503,
//   B. the existing contract is preserved on every non-transient path
//      (Forbidden 403, conflicts 409, validation 400, config-missing 503).
// It drives classifyApiErrorStatus()/isTransientServiceError() directly, so no
// live database is required.
import { classifyApiErrorStatus, isTransientServiceError } from '../api/data.js';

const results = {};
const record = (name, passed, detail = '') => {
  results[name] = passed;
  console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}${detail ? ` (${detail})` : ''}`);
};

const mk = (code, message = 'err') => Object.assign(new Error(message), code ? { code } : {});

// --- A. Transient database / driver / network errors -> 503 ----------------
record('prismaPoolTimeout503', classifyApiErrorStatus(mk('P2024')) === 503);
record('prismaServerClosed503', classifyApiErrorStatus(mk('P1017')) === 503);
record('prismaOperationTimeout503', classifyApiErrorStatus(mk('P1008')) === 503);
record('prismaCannotReachDb503', classifyApiErrorStatus(mk('P1001')) === 503);
record('prismaAuthDb503', classifyApiErrorStatus(mk('P1000')) === 503);
record('pgConnectionException503', classifyApiErrorStatus(mk('08P01')) === 503);
record('pgCannotConnectNow503', classifyApiErrorStatus(mk('57P03')) === 503);
record('pgTooManyConnections503', classifyApiErrorStatus(mk('53300')) === 503);
record('socketReset503', classifyApiErrorStatus(mk('ECONNRESET')) === 503);
record('connectionRefused503', classifyApiErrorStatus(mk('ECONNREFUSED')) === 503);
record('timeout503', classifyApiErrorStatus(mk('ETIMEDOUT')) === 503);
record('dnsNotFound503', classifyApiErrorStatus(mk('ENOTFOUND')) === 503);

// --- B. Existing contract preserved ----------------------------------------
record('forbiddenStays403', classifyApiErrorStatus(new Error('Forbidden.')) === 403);
record('fkViolationStays409', classifyApiErrorStatus(mk('P2003')) === 409);
record('duplicatePhoneStays409', classifyApiErrorStatus(mk('DUPLICATE_PHONE')) === 409);
record('idempotencyConflictStays409', classifyApiErrorStatus(mk('IDEMPOTENCY_CONFLICT')) === 409);
record('statusConflictStays409', classifyApiErrorStatus(mk('STATUS_CONFLICT')) === 409);
record('duplicateKeyStays409', classifyApiErrorStatus(mk('P2002')) === 409);
record('missingIdempotencyKeyStays400', classifyApiErrorStatus(mk('MISSING_IDEMPOTENCY_KEY')) === 400);
record('configMissingStays503', classifyApiErrorStatus(mk('REQUIRED_CONFIG_MISSING')) === 503);
record('writeConflictStays503', classifyApiErrorStatus(mk('P2034')) === 503);
record('configMessageStays503', classifyApiErrorStatus(new Error('Required server configuration "X" is unavailable.')) === 503);
record('unknownErrorStays400', classifyApiErrorStatus(mk('SOMETHING_ELSE')) === 400);
record('plainValidationStays400', classifyApiErrorStatus(new Error('Requête invalide. Vérifiez les champs saisies.')) === 400);
record('codeFreeErrorStays400', classifyApiErrorStatus(new Error('boom')) === 400);

// --- C. isTransientServiceError guard bounds -------------------------------
record('nonErrorObjectNotTransient', isTransientServiceError({ code: 'P2024' }) === false);
record('stringNotTransient', isTransientServiceError('P2024') === false);
record('codeFreeErrorNotTransient', isTransientServiceError(new Error('boom')) === false);
record('nonTransientPrismaCodeNotTransient', isTransientServiceError(mk('P2002')) === false);

console.log('\n--- SUMMARY ---');
let allPass = true;
for (const [name, passed] of Object.entries(results)) {
  allPass = allPass && passed;
}
console.log(`total: ${Object.keys(results).length} checks, ${Object.values(results).filter(Boolean).length} PASS`);
if (!allPass) process.exitCode = 1;
process.exit(process.exitCode || 0);