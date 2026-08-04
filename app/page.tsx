import { Suspense } from "react";
import { KioskBoard } from "@/components/kiosk-board";
import { formatCalendarDate, todayInAppTimeZone } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const initialView = params.view === "week" ? "week" : "today";
  const weekStartsOn = process.env.WEEK_START === "sunday" ? "sunday" : "monday";
  const confirmTap = process.env.KIOSK_CONFIRM_TAP === "true";

  return (
    <Suspense fallback={<div className="kiosk-loading">Loading the sticker board…</div>}>
      <KioskBoard
        initialToday={formatCalendarDate(todayInAppTimeZone())}
        initialView={initialView}
        weekStartsOn={weekStartsOn}
        confirmTap={confirmTap}
      />
    </Suspense>
  );
}
