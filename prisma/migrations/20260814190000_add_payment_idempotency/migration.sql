-- Keep historical payments valid while requiring idempotency for new API requests.
ALTER TABLE "payments"
  ADD COLUMN "idempotency_fingerprint" TEXT,
  ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");
