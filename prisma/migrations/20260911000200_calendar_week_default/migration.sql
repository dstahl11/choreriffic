ALTER TABLE "KioskSettings"
  ALTER COLUMN "calendarDefaultRange" SET DEFAULT 'week';

UPDATE "KioskSettings"
SET "calendarDefaultRange" = 'week';
