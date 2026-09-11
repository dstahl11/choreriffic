import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ICAL from "ical.js";
import { dateFromAppTimeZoneParts } from "@/lib/calendar/normalize";
import type {
  CalendarQueryRange,
  CalendarSourceConfig,
  ProviderCalendarEvent,
} from "@/lib/calendar/types";

const MAX_ICS_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function privateIpv4(address: string) {
  const octets = address.split(".").map(Number);
  return octets.length === 4 && (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 169 && octets[1] === 254)
  );
}

export function isPrivateCalendarAddress(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  if (isIP(normalized) === 4) return privateIpv4(normalized);
  if (isIP(normalized) === 6) {
    return normalized === "::1" || normalized.startsWith("fc") ||
      normalized.startsWith("fd") || normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") || normalized.startsWith("fea") ||
      normalized.startsWith("feb") || normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
  }
  return false;
}

export async function assertSafeCalendarUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Calendar URL must use http or https.");
  }
  if (process.env.CALENDAR_ALLOW_PRIVATE_URLS === "true") return url;
  if (url.hostname.toLowerCase() === "localhost" || isPrivateCalendarAddress(url.hostname)) {
    throw new Error("Private-network calendar URLs are not allowed.");
  }
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.some(({ address }) => isPrivateCalendarAddress(address))) {
    throw new Error("Private-network calendar URLs are not allowed.");
  }
  return url;
}

async function readLimitedBody(response: Response) {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_ICS_BYTES) throw new Error("Calendar response is larger than 5 MB.");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_ICS_BYTES) {
      await reader.cancel();
      throw new Error("Calendar response is larger than 5 MB.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function fetchIcsText(value: string) {
  let current = await assertSafeCalendarUrl(value);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "text/calendar, text/plain;q=0.9" },
    });
    if (response.status >= 300 && response.status < 400) {
      if (redirects === MAX_REDIRECTS) throw new Error("Calendar URL redirected too many times.");
      const location = response.headers.get("location");
      if (!location) throw new Error("Calendar redirect did not include a destination.");
      current = await assertSafeCalendarUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Calendar URL returned ${response.status} ${response.statusText}.`);
    return readLimitedBody(response);
  }
  throw new Error("Calendar URL redirected too many times.");
}

function icalTimeToDate(time: ICAL.Time) {
  const zone = time.zone?.tzid?.toLowerCase();
  if (!zone || zone === "floating" || zone === "local") {
    return dateFromAppTimeZoneParts({
      year: time.year, month: time.month, day: time.day,
      hour: time.hour, minute: time.minute, second: time.second,
    });
  }
  return time.toJSDate();
}

function toProviderEvent(event: ICAL.Event, start: ICAL.Time, end: ICAL.Time): ProviderCalendarEvent {
  return {
    providerEventId: `${event.uid || "event"}:${start.toString()}`,
    title: event.summary || "(No title)",
    location: event.location || null,
    color: /^#[0-9a-f]{6}$/i.test(event.color || "") ? event.color : null,
    allDay: start.isDate,
    start: start.isDate ? start.toString().slice(0, 10) : icalTimeToDate(start),
    end: end.isDate ? end.toString().slice(0, 10) : icalTimeToDate(end),
  };
}

export function parseIcsCalendar(text: string, range: CalendarQueryRange) {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const component of root.getAllSubcomponents("vtimezone")) {
    ICAL.TimezoneService.register(component);
  }
  const components = root.getAllSubcomponents("vevent");
  const events = components.map((component) => new ICAL.Event(component));
  const masters = events.filter((event) => !event.isRecurrenceException());
  const exceptions = events.filter((event) => event.isRecurrenceException());
  for (const master of masters) {
    for (const exception of exceptions.filter((candidate) => candidate.uid === master.uid)) {
      master.relateException(exception);
    }
  }

  const queryStart = dateFromAppTimeZoneParts({
    year: Number(range.from.slice(0, 4)), month: Number(range.from.slice(5, 7)), day: Number(range.from.slice(8, 10)),
  });
  const queryEndDate = new Date(`${range.to}T12:00:00Z`);
  queryEndDate.setUTCDate(queryEndDate.getUTCDate() + 1);
  const queryEnd = dateFromAppTimeZoneParts({
    year: queryEndDate.getUTCFullYear(), month: queryEndDate.getUTCMonth() + 1, day: queryEndDate.getUTCDate(),
  });
  const output: ProviderCalendarEvent[] = [];

  for (const event of masters) {
    if (event.component.getFirstPropertyValue("status") === "CANCELLED") continue;
    if (!event.isRecurring()) {
      output.push(toProviderEvent(event, event.startDate, event.endDate));
      continue;
    }
    const iterator = event.iterator();
    for (let count = 0; count < 10_000; count += 1) {
      const occurrence = iterator.next();
      if (!occurrence) break;
      const details = event.getOccurrenceDetails(occurrence);
      if (icalTimeToDate(details.startDate) >= queryEnd) break;
      if (
        details.item.component.getFirstPropertyValue("status") !== "CANCELLED" &&
        icalTimeToDate(details.endDate) > queryStart
      ) {
        output.push(toProviderEvent(details.item, details.startDate, details.endDate));
      }
    }
  }
  return output;
}

export async function fetchIcsCalendar(source: CalendarSourceConfig, range: CalendarQueryRange) {
  if (!source.icsUrl) throw new Error("ICS calendar URL is missing.");
  return parseIcsCalendar(await fetchIcsText(source.icsUrl), range);
}
