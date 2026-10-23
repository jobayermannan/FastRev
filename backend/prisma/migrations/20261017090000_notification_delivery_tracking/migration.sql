ALTER TABLE `notifications`
  ADD COLUMN `dedupe_key` VARCHAR(191) NULL,
  ADD COLUMN `scheduled_at` DATETIME(0) NULL,
  ADD COLUMN `attempts` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `error_message` VARCHAR(191) NULL,
  ADD COLUMN `provider_message_id` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `notifications_dedupe_key_key` ON `notifications`(`dedupe_key`);
