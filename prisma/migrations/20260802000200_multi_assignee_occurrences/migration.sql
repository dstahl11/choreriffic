ALTER TABLE "Occurrence"
ADD COLUMN "assignmentSlot" INTEGER NOT NULL DEFAULT 0;

DROP INDEX "Occurrence_choreId_date_key";

CREATE UNIQUE INDEX "Occurrence_choreId_date_assignmentSlot_key"
ON "Occurrence"("choreId", "date", "assignmentSlot");
