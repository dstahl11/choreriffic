import assert from "node:assert/strict";
import test from "node:test";
import { choreViewUrl, initialKioskView } from "@/lib/kiosk-navigation";

test("Calendar is the landing view, including for unknown view parameters", () => {
  assert.equal(initialKioskView(), "calendar");
  assert.equal(initialKioskView("calendar"), "calendar");
  assert.equal(initialKioskView("unknown"), "calendar");
});

test("manual chore links preserve Today and Week on reload", () => {
  for (const view of ["today", "week"] as const) {
    const url = new URL(choreViewUrl(view), "http://localhost");
    assert.equal(initialKioskView(url.searchParams.get("view") ?? undefined), view);
  }
});
