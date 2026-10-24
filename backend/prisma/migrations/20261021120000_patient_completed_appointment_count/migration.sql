-- Count attended visits so a patient's history includes shows, not only no-shows.
ALTER TABLE `patients`
  ADD COLUMN `completed_appointment_count` INTEGER NOT NULL DEFAULT 0;

UPDATE `patients` p
SET p.`completed_appointment_count` = (
  SELECT COUNT(*) FROM `appointments` a
  WHERE a.`patient_id` = p.`id` AND a.`status` = 'completed'
);
