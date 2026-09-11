const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3010";
const token = process.env.API_TOKEN;
const feedToken = process.env.FEED_TOKEN;
const from = process.env.SMOKE_FROM ?? "2026-08-03";
const to = process.env.SMOKE_TO ?? from;

if (!token || !feedToken) {
  throw new Error("API_TOKEN and FEED_TOKEN are required for the smoke test.");
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

const health = await fetch(`${baseUrl}/health`);
assert(health.ok, `Health check returned ${health.status}.`);

const kioskCalendar = await fetch(`${baseUrl}/kiosk/calendar?from=${from}&to=${to}`);
assert(kioskCalendar.ok, `Kiosk calendar returned ${kioskCalendar.status}.`);
const kioskCalendarBody = await kioskCalendar.json();
assert(Array.isArray(kioskCalendarBody.data?.events), "Kiosk calendar response did not include events.");
const serializedCalendar = JSON.stringify(kioskCalendarBody);
assert(!serializedCalendar.includes("icsUrl"), "Kiosk calendar exposed an ICS URL field.");
assert(!serializedCalendar.includes("googleCalendarId"), "Kiosk calendar exposed a Google calendar ID field.");

const unauthorized = await fetch(`${baseUrl}/api/occurrences?from=${from}&to=${to}`);
assert(unauthorized.status === 401, `Unauthorized API request returned ${unauthorized.status}.`);

const headers = { authorization: `Bearer ${token}` };
const authorized = await fetch(`${baseUrl}/api/occurrences?from=${from}&to=${to}`, { headers });
assert(authorized.ok, `Authorized API request returned ${authorized.status}.`);
const occurrenceBody = await authorized.json();
assert(Array.isArray(occurrenceBody.data), "Occurrence response did not include a data array.");

if (occurrenceBody.data.length) {
  const occurrence = occurrenceBody.data[0];
  const complete = await fetch(`${baseUrl}/api/occurrences/${occurrence.id}/complete`, {
    method: "POST",
    headers,
  });
  assert(complete.ok, `Completion request returned ${complete.status}.`);

  const report = await fetch(`${baseUrl}/api/reports/completions?from=${from}&to=${to}`, { headers });
  assert(report.ok, `Report request returned ${report.status}.`);
  const reportBody = await report.json();
  assert(
    reportBody.data.rows.some((row) => row.id === occurrence.id),
    "Completed occurrence was missing from the report.",
  );

  const undo = await fetch(`${baseUrl}/api/occurrences/${occurrence.id}/uncomplete`, {
    method: "POST",
    headers,
  });
  assert(undo.ok, `Undo request returned ${undo.status}.`);
}

const calendar = await fetch(`${baseUrl}/calendar/${feedToken}/all.ics`);
const calendarText = await calendar.text();
assert(
  calendar.ok && calendarText.includes("BEGIN:VCALENDAR"),
  "Calendar feed was not valid ICS output.",
);

console.log(
  `Smoke test passed: ${occurrenceBody.data.length} occurrence(s), auth, reports, writes, undo, calendar view, and ICS feed.`,
);
