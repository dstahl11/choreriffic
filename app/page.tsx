import { Suspense } from "react";
import { KioskBoard } from "@/components/kiosk-board";
import { formatCalendarDate, todayInAppTimeZone } from "@/lib/date";
import { getKioskSettings } from "@/lib/calendar/settings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; range?: string }>;
}) {
  const params = await searchParams;
  const initialSettings = await getKioskSettings(prisma);
  const initialView = params.view === "week"
    ? "week"
    : params.view === "calendar"
      ? "calendar"
      : "today";
  const initialCalendarRange = params.range === "day" || params.range === "week"
    ? params.range
    : initialSettings.calendarDefaultRange;
  const weekStartsOn = process.env.WEEK_START === "sunday" ? "sunday" : "monday";
  const confirmTap = process.env.KIOSK_CONFIRM_TAP === "true";

  return (
    <Suspense fallback={<div className="kiosk-loading">Loading the sticker board…</div>}>
      <KioskBoard
        initialToday={formatCalendarDate(todayInAppTimeZone())}
        initialView={initialView}
        initialCalendarRange={initialCalendarRange}
        initialSettings={initialSettings}
        weekStartsOn={weekStartsOn}
        confirmTap={confirmTap}
      />
    </Suspense>
  );
}
