import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

test("calendar source CRUD persists provider-specific fields", { skip: !process.env.DATABASE_URL }, async () => {
  const prisma = new PrismaClient();
  const id = "calendar-source-integration";
  try {
    await prisma.calendarSource.deleteMany({ where: { id } });
    const created = await prisma.calendarSource.create({
      data: {
        id,
        kind: "google",
        name: "Integration calendar",
        color: "#123456",
        sortOrder: 999,
        googleCalendarId: "family@example.com",
      },
    });
    assert.equal(created.enabled, true);
    const updated = await prisma.calendarSource.update({
      where: { id },
      data: { enabled: false, showLocation: false },
    });
    assert.equal(updated.enabled, false);
    assert.equal(updated.showLocation, false);
    await prisma.calendarSource.delete({ where: { id } });
    assert.equal(await prisma.calendarSource.count({ where: { id } }), 0);
  } finally {
    await prisma.calendarSource.deleteMany({ where: { id } });
    await prisma.$disconnect();
  }
});
