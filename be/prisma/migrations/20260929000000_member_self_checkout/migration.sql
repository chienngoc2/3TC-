-- CreateEnum
CREATE TYPE "checkout_kind" AS ENUM ('NEW_SUBSCRIPTION', 'RENEWAL', 'PT_ADDON');

-- CreateEnum
CREATE TYPE "checkout_status" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_FAILED', 'EXPIRED', 'FULFILLED', 'PAYMENT_REVIEW', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "payment_attempt_status" AS ENUM ('PENDING', 'FAILED', 'SUCCEEDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "payment_method" ADD VALUE 'MOCK';
ALTER TYPE "payment_method" ADD VALUE 'FREE';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "checkout_id" UUID;

-- CreateTable
CREATE TABLE "checkout_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "kind" "checkout_kind" NOT NULL,
    "status" "checkout_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "plan_id" UUID,
    "target_subscription_id" UUID,
    "coach_id" UUID,
    "addon_sessions" INTEGER,
    "base_amount" DECIMAL(12,2) NOT NULL,
    "pt_amount" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "price_snapshot" JSONB NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "failure_reason" VARCHAR(200),
    "fulfilled_subscription_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "checkout_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "checkout_id" UUID NOT NULL,
    "payment_id" VARCHAR(32) NOT NULL,
    "retry_key" VARCHAR(100),
    "status" "payment_attempt_status" NOT NULL DEFAULT 'PENDING',
    "simulation_outcome" VARCHAR(16),
    "simulation_event_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "checkout_id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "event_id" VARCHAR(100) NOT NULL,
    "payload_hash" VARCHAR(64) NOT NULL,
    "outcome" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_checkout_member_created" ON "checkout_orders"("member_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_checkout_status_expiry" ON "checkout_orders"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_checkout_member_idempotency" ON "checkout_orders"("member_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_attempt_payment_id" ON "payment_attempts"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_attempt_simulation_event" ON "payment_attempts"("simulation_event_id");

-- CreateIndex
CREATE INDEX "idx_payment_attempt_checkout_created" ON "payment_attempts"("checkout_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_attempt_retry_key" ON "payment_attempts"("checkout_id", "retry_key");

-- CreateIndex
CREATE INDEX "idx_payment_webhook_checkout" ON "payment_webhook_events"("checkout_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_webhook_event" ON "payment_webhook_events"("provider", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoices_checkout_id" ON "invoices"("checkout_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "checkout_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_orders" ADD CONSTRAINT "checkout_orders_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "checkout_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "checkout_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
