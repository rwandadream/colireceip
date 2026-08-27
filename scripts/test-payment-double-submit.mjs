// Regression test for the payment double-submission bug.
//
// The root cause is that every createPayment() call generates a NEW payment id
// and therefore a NEW idempotency key, so backend idempotency (P2002 replay) can
// never dedupe two distinct submissions. Protection must come from a UI-level
// submit lock. This test verifies:
//   1. the SubmitLock blocks a second submit in the same tick,
//   2. it releases once the handler finishes (later submissions allowed),
//   3. regardless of the lock, two payment ids yield two distinct idempotency
//      keys — which is exactly why the UI guard is mandatory.
//
// No runtime dependencies: imports run under `node --experimental-strip-types`.
import { SubmitLock } from '../src/lib/submitLock.ts';
import { stableKey } from '../src/lib/syncLogic.ts';

const results = {};
const record = (name, passed) => { results[name] = passed; console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}`); };
const pass = (name, assertions) => record(name, assertions.every((value) => Boolean(value)));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- 1. Lock blocks a second click in the same tick -----------------------
let acquireResult = [false, false];
{
  const lock = new SubmitLock();
  acquireResult[0] = lock.acquire();
  acquireResult[1] = lock.acquire(); // double click, same tick → must fail
}
pass('submitLockBlocksSecondAcquireSameTick', [
  acquireResult[0] === true,
  acquireResult[1] === false,
]);

// --- 2. Lock releases after the handler finishes --------------------------
let releasedOk = false;
let secondCallRejected = false;
{
  const lock = new SubmitLock();
  let started = 0;

  const handleSubmit = async () => {
    if (!lock.acquire()) {
      secondCallRejected = true; // a second call arriving mid-flight
      return;
    }
    started += 1;
    try {
      await sleep(20); // simulate save; a natural double-click lands here
    } finally {
      lock.release();
    }
  };

  const first = handleSubmit();
  const second = handleSubmit(); // fired ~immediately after first
  await Promise.all([first, second]);

  // after release, a later submission (post-nav, new intent) is allowed
  releasedOk = lock.acquire();
  lock.release();
}
pass('submitLockRejectsSecondCallMidFlight', [
  secondCallRejected === true,
]);
pass('submitLockReleasesAfterHandlerFinishes', [
  releasedOk === true,
]);

// --- 3. Two distinct payment ids => distinct idempotency keys -------------
// This documents why backend idempotency CANNOT dedupe a double click: each
// createPayment generates a fresh id, so the queue mutation (and thus the
// Idempotency-Key header) differs on every call.
const paymentIdA = 'pay_gen_aaaaaaaa';
const paymentIdB = 'pay_gen_bbbbbbbb';
const keyA = stableKey('payments', 'create', paymentIdA);
const keyB = stableKey('payments', 'create', paymentIdB);
pass('twoPaymentIdsProduceTwoIdempotencyKeys', [
  keyA !== keyB,
  keyA === 'sync_payments_create_pay_gen_aaaaaaaa',
  keyB === 'sync_payments_create_pay_gen_bbbbbbbb',
]);

if (Object.values(results).some((passed) => !passed)) {
  process.exitCode = 1;
  console.log('\nAU MOINS UN TEST A ÉCHOUÉ.');
} else {
  console.log(`\n${Object.keys(results).length} tests PASS.`);
}