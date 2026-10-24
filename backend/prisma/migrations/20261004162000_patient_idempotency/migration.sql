-- Retain an optional request key so retried enrollment cannot create a duplicate.
ALTER TABLE `patients` ADD COLUMN `idempotency_key` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `patients_idempotency_key_key` ON `patients`(`idempotency_key`);
