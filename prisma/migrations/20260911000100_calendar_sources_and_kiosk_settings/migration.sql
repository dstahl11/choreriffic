CREATE TYPE "CalendarSourceKind" AS ENUM ('google', 'ics');
CREATE TYPE "CalendarRange" AS ENUM ('day', 'week');

CREATE TABLE "CalendarSource" (
  "id" TEXT NOT NULL,
  "kind" "CalendarSourceKind" NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL,
  "googleCalendarId" TEXT,
  "icsUrl" TEXT,
  "showLocation" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KioskSettings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "rotationEnabled" BOOLEAN NOT NULL DEFAULT false,
  "rotationChoresSeconds" INTEGER NOT NULL DEFAULT 90,
  "rotationCalendarSeconds" INTEGER NOT NULL DEFAULT 45,
  "rotationCalendarRange" "CalendarRange" NOT NULL DEFAULT 'day',
  "calendarDefaultRange" "CalendarRange" NOT NULL DEFAULT 'day',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KioskSettings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CalendarSource_enabled_sortOrder_idx" ON "CalendarSource"("enabled", "sortOrder");
