-- Store explainability reason codes returned by the AI service alongside each prediction.
-- Nullable and additive: existing rows keep NULL and nothing else changes.
ALTER TABLE `predictions` ADD COLUMN `reason_codes` JSON NULL;
