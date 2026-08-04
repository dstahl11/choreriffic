CREATE TYPE "TimeOfDay" AS ENUM ('morning', 'afternoon', 'evening', 'anytime');
CREATE TYPE "OccurrenceStatus" AS ENUM ('pending', 'done', 'skipped');

CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "todoistLabel" TEXT,
    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Chore" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "rrule" TEXT NOT NULL,
    "dtstart" DATE NOT NULL,
    "rotation" BOOLEAN NOT NULL DEFAULT false,
    "timeOfDay" "TimeOfDay",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Chore_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChoreAssignee" (
    "choreId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "ChoreAssignee_pkey" PRIMARY KEY ("choreId", "personId")
);

CREATE TABLE "Occurrence" (
    "id" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "personId" TEXT NOT NULL,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'pending',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Occurrence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Person_sortOrder_idx" ON "Person"("sortOrder");
CREATE INDEX "Chore_active_idx" ON "Chore"("active");
CREATE UNIQUE INDEX "ChoreAssignee_choreId_sortOrder_key" ON "ChoreAssignee"("choreId", "sortOrder");
CREATE INDEX "ChoreAssignee_personId_idx" ON "ChoreAssignee"("personId");
CREATE UNIQUE INDEX "Occurrence_choreId_date_key" ON "Occurrence"("choreId", "date");
CREATE INDEX "Occurrence_date_personId_idx" ON "Occurrence"("date", "personId");
CREATE INDEX "Occurrence_status_date_idx" ON "Occurrence"("status", "date");

ALTER TABLE "ChoreAssignee"
ADD CONSTRAINT "ChoreAssignee_choreId_fkey"
FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChoreAssignee"
ADD CONSTRAINT "ChoreAssignee_personId_fkey"
FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Occurrence"
ADD CONSTRAINT "Occurrence_choreId_fkey"
FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Occurrence"
ADD CONSTRAINT "Occurrence_personId_fkey"
FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
