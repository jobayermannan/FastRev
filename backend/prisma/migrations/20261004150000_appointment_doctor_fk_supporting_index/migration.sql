-- MySQL requires a separate index for the doctor foreign key before the
-- historical compound unique index can be replaced by the active-slot key.
CREATE INDEX `appointments_doctor_id_fk_idx` ON `appointments`(`doctor_id`);
