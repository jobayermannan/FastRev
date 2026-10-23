-- Keep a nullable unique key for active starts. A cancelled appointment keeps
-- its history while freeing the start for a new booking.
ALTER TABLE `appointments`
  ADD COLUMN `duration_minutes` INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN `active_slot_key` VARCHAR(191) NULL,
  ADD COLUMN `idempotency_key` VARCHAR(191) NULL;

UPDATE `appointments`
SET `active_slot_key` = CONCAT(`doctor_id`, ':', DATE_FORMAT(`scheduled_at`, '%Y-%m-%dT%H:%i:%s'))
WHERE `status` <> 'cancelled';

DROP INDEX `appointments_doctor_id_scheduled_at_key` ON `appointments`;
CREATE INDEX `appointments_doctor_id_scheduled_at_idx` ON `appointments`(`doctor_id`, `scheduled_at`);
CREATE UNIQUE INDEX `appointments_active_slot_key_key` ON `appointments`(`active_slot_key`);
CREATE UNIQUE INDEX `appointments_idempotency_key_key` ON `appointments`(`idempotency_key`);
