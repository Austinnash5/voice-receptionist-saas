-- Add menuOptionDelayMs column with default of 2000ms (2 seconds)
ALTER TABLE "ReceptionistConfig"
ADD COLUMN "menuOptionDelayMs" INTEGER NOT NULL DEFAULT 2000;
