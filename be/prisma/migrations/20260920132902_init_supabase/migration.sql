/*
  Warnings:

  - The values [MANAGER] on the enum `user_role` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "booking_type" AS ENUM ('GROUP_CLASS', 'PERSONAL_TRAINING');

-- CreateEnum
CREATE TYPE "plan_type" AS ENUM ('GENERAL', 'PERSONAL_TRAINING');

-- AlterEnum
BEGIN;
CREATE TYPE "user_role_new" AS ENUM ('ADMIN', 'CENTER_MANAGER', 'COACH', 'RECEPTIONIST', 'MEMBER');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "user_role_new" USING ("role"::text::"user_role_new");
ALTER TYPE "user_role" RENAME TO "user_role_old";
ALTER TYPE "user_role_new" RENAME TO "user_role";
DROP TYPE "user_role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
COMMIT;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "booking_type" "booking_type" NOT NULL DEFAULT 'GROUP_CLASS',
ADD COLUMN     "coach_availability_id" UUID,
ALTER COLUMN "schedule_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "membership_plans" ADD COLUMN     "plan_type" "plan_type" NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "created_by_id" UUID;

-- CreateTable
CREATE TABLE "coach_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "coach_id" UUID NOT NULL,
    "rate_per_session" DECIMAL(12,2) NOT NULL,
    "effective_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "staff_id" UUID NOT NULL,
    "shift_date" DATE NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "assigned_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_curriculum_requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "discipline_id" UUID NOT NULL,
    "sessions_per_week" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_curriculum_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "equipment_type" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_availability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "coach_id" UUID NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "is_booked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipment_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "reserved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_coach_rates_coach_id" ON "coach_rates"("coach_id");

-- CreateIndex
CREATE INDEX "idx_staff_shifts_staff_id" ON "staff_shifts"("staff_id");

-- CreateIndex
CREATE INDEX "idx_staff_shifts_shift_date" ON "staff_shifts"("shift_date");

-- CreateIndex
CREATE INDEX "idx_curriculum_plan_id" ON "plan_curriculum_requirements"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_curriculum_plan_discipline" ON "plan_curriculum_requirements"("plan_id", "discipline_id");

-- CreateIndex
CREATE INDEX "idx_equipment_room_id" ON "equipment"("room_id");

-- CreateIndex
CREATE INDEX "idx_coach_availability_coach_id" ON "coach_availability"("coach_id");

-- CreateIndex
CREATE INDEX "idx_coach_availability_start_time" ON "coach_availability"("start_time");

-- CreateIndex
CREATE UNIQUE INDEX "uq_equipment_reservation_booking" ON "equipment_reservations"("booking_id");

-- CreateIndex
CREATE INDEX "idx_equipment_reservations_equipment_id" ON "equipment_reservations"("equipment_id");

-- CreateIndex
CREATE INDEX "idx_equipment_reservations_time" ON "equipment_reservations"("start_time", "end_time");

-- CreateIndex
CREATE INDEX "idx_bookings_coach_availability_id" ON "bookings"("coach_availability_id");

-- CreateIndex
CREATE INDEX "idx_users_created_by_id" ON "users"("created_by_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "fk_users_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_rates" ADD CONSTRAINT "fk_coach_rates_coach" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shifts" ADD CONSTRAINT "fk_staff_shifts_staff" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shifts" ADD CONSTRAINT "fk_staff_shifts_assigned_by" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_curriculum_requirements" ADD CONSTRAINT "fk_curriculum_plan" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_curriculum_requirements" ADD CONSTRAINT "fk_curriculum_discipline" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "fk_equipment_room" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_availability" ADD CONSTRAINT "fk_coach_availability_coach" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "fk_bookings_coach_availability" FOREIGN KEY ("coach_availability_id") REFERENCES "coach_availability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_reservations" ADD CONSTRAINT "fk_equipment_reservations_equipment" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_reservations" ADD CONSTRAINT "fk_equipment_reservations_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
