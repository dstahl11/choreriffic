import type { CalendarRange, PrismaClient } from "@prisma/client";
import type { KioskSettings as KioskSettingsPayload } from "@/types/kiosk";

export async function getStoredKioskSettings(prisma: PrismaClient) {
  return prisma.kioskSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}

export async function getKioskSettings(prisma: PrismaClient): Promise<KioskSettingsPayload> {
  const [settings, enabledSources] = await Promise.all([
    getStoredKioskSettings(prisma),
    prisma.calendarSource.count({ where: { enabled: true } }),
  ]);
  return {
    rotationEnabled: settings.rotationEnabled,
    rotationChoresSeconds: settings.rotationChoresSeconds,
    rotationCalendarSeconds: settings.rotationCalendarSeconds,
    rotationCalendarRange: settings.rotationCalendarRange,
    calendarDefaultRange: settings.calendarDefaultRange,
    calendarEnabled: enabledSources > 0,
  };
}

export async function updateKioskSettings(
  prisma: PrismaClient,
  input: {
    rotationEnabled: boolean;
    rotationChoresSeconds: number;
    rotationCalendarSeconds: number;
    rotationCalendarRange: CalendarRange;
    calendarDefaultRange: CalendarRange;
  },
) {
  if (input.rotationEnabled) {
    const enabledSources = await prisma.calendarSource.count({ where: { enabled: true } });
    if (!enabledSources) throw new Error("Add and enable a calendar before turning on rotation.");
  }
  return prisma.kioskSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...input },
    update: input,
  });
}
