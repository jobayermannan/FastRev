-- DropForeignKey
ALTER TABLE `appointments` DROP FOREIGN KEY `appointments_doctor_id_fkey`;

-- DropIndex
DROP INDEX `appointments_doctor_id_scheduled_at_idx` ON `appointments`;

-- CreateIndex
CREATE UNIQUE INDEX `appointments_doctor_id_scheduled_at_idx` ON `appointments`(`doctor_id`, `scheduled_at`);

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_doctor_id_fkey` FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
