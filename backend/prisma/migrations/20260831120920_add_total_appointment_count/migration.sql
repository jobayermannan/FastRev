-- AlterTable
ALTER TABLE `patients` ADD COLUMN `total_appointment_count` INTEGER NOT NULL DEFAULT 0;

-- RenameIndex
ALTER TABLE `appointments` RENAME INDEX `appointments_doctor_id_scheduled_at_idx` TO `appointments_doctor_id_scheduled_at_key`;
