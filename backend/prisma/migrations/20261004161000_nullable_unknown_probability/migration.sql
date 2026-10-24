-- Unknown risk has no meaningful numeric probability.
ALTER TABLE `predictions` MODIFY COLUMN `no_show_probability` DOUBLE NULL;
