import { readFile } from "node:fs/promises";
import { JWT, OAuth2Client, type Credentials } from "google-auth-library";
import { addCalendarDays, parseCalendarDate } from "@/lib/date";
import { appTimeZoneOffsetMinutes } from "@/lib/calendar/normalize";
import type {
  CalendarQueryRange,
  CalendarSourceConfig,
  ProviderCalendarEvent,
} from "@/lib/calendar/types";

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const DEFAULT_KEY_FILE = "/run/secrets/google-service-account.json";
const EVENT_COLORS: Record<string, string> = {
  "1": "#7986cb", "2": "#33b679", "3": "#8e24aa", "4": "#e67c73",
  "5": "#f6c026", "6": "#f5511d", "7": "#039be5", "8": "#616161",
  "9": "#3f51b5", "10": "#0b8043", "11": "#d60000",
};

type ServiceAccountKey = { client_email?: string; private_key?: string };
type OAuthClientConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function parseGoogleOAuthClient(value: unknown): OAuthClientConfig {
  const root = record(value);
  const client = record(root?.installed) ?? record(root?.web) ?? root;
  const clientId = typeof client?.client_id === "string" ? client.client_id : "";
  const clientSecret = typeof client?.client_secret === "string" ? client.client_secret : "";
  const redirectUris = Array.isArray(client?.redirect_uris) ? client.redirect_uris : [];
  const redirectUri = redirectUris.find((item): item is string => typeof item === "string");
  if (!clientId || !clientSecret) throw new Error("Google OAuth client credentials are invalid.");
  return { clientId, clientSecret, redirectUri };
}

export function parseGoogleOAuthToken(value: unknown, profile = "normal"): Credentials {
  const root = record(value);
  const candidate = record(root?.refresh_token ? root : root?.[profile]);
  const refreshToken = typeof candidate?.refresh_token === "string" ? candidate.refresh_token : "";
  if (!refreshToken) throw new Error(`Google OAuth token profile '${profile}' has no refresh token.`);
  return {
    access_token: typeof candidate?.access_token === "string" ? candidate.access_token : undefined,
    refresh_token: refreshToken,
    expiry_date: typeof candidate?.expiry_date === "number" ? candidate.expiry_date : undefined,
    scope: typeof candidate?.scope === "string" ? candidate.scope : undefined,
    token_type: typeof candidate?.token_type === "string" ? candidate.token_type : undefined,
  };
}

async function readJsonFile(file: string, label: string) {
  try {
    return JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch {
    throw new Error(`${label} is not configured.`);
  }
}

function oauthFiles() {
  const credentialsFile = process.env.GOOGLE_OAUTH_CREDENTIALS_FILE?.trim();
  const tokenFile = process.env.GOOGLE_OAUTH_TOKEN_FILE?.trim();
  if (!credentialsFile && !tokenFile) return null;
  if (!credentialsFile || !tokenFile) {
    throw new Error("Both Google OAuth credential and token files must be configured.");
  }
  return {
    credentialsFile,
    tokenFile,
    profile: process.env.GOOGLE_OAUTH_TOKEN_PROFILE?.trim() || "normal",
  };
}

async function readCredentials(): Promise<ServiceAccountKey> {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
  if (inline) {
    const decoded = inline.startsWith("{")
      ? inline
      : Buffer.from(inline, "base64").toString("utf8");
    return JSON.parse(decoded) as ServiceAccountKey;
  }
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || DEFAULT_KEY_FILE;
  try {
    return JSON.parse(await readFile(file, "utf8")) as ServiceAccountKey;
  } catch {
    throw new Error("Google service account is not configured.");
  }
}

export async function getGoogleServiceAccountEmail() {
  try {
    return (await readCredentials()).client_email ?? null;
  } catch {
    return null;
  }
}

export async function getGoogleAuthMode(): Promise<"oauth" | "service-account" | null> {
  try {
    const oauth = oauthFiles();
    if (oauth) {
      parseGoogleOAuthClient(await readJsonFile(oauth.credentialsFile, "Google OAuth client credentials"));
      parseGoogleOAuthToken(await readJsonFile(oauth.tokenFile, "Google OAuth token"), oauth.profile);
      return "oauth";
    }
    const credentials = await readCredentials();
    return credentials.client_email && credentials.private_key ? "service-account" : null;
  } catch {
    return null;
  }
}

async function accessToken() {
  const oauth = oauthFiles();
  if (oauth) {
    const clientConfig = parseGoogleOAuthClient(
      await readJsonFile(oauth.credentialsFile, "Google OAuth client credentials"),
    );
    const token = parseGoogleOAuthToken(
      await readJsonFile(oauth.tokenFile, "Google OAuth token"),
      oauth.profile,
    );
    const client = new OAuth2Client(
      clientConfig.clientId,
      clientConfig.clientSecret,
      clientConfig.redirectUri,
    );
    client.setCredentials(token);
    const result = await client.getAccessToken();
    if (!result.token) throw new Error("Google did not refresh the OAuth access token.");
    return result.token;
  }

  const credentials = await readCredentials();
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Google service account is not configured.");
  }
  const client = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [GOOGLE_SCOPE],
  });
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("Google did not issue an access token.");
  return token.token;
}

function rangeBoundary(date: string) {
  const offset = appTimeZoneOffsetMinutes(new Date(`${date}T12:00:00Z`));
  const sign = offset >= 0 ? "+" : "-";
  const absolute = Math.abs(offset);
  return `${date}T00:00:00${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

function friendlyGoogleError(status: number, statusText: string) {
  if (status === 401 || status === 403) {
    return "Google Calendar access is not authorized for this calendar or the credentials are invalid.";
  }
  if (status === 404) return "Calendar ID not found.";
  return `Google Calendar returned ${status}${statusText ? ` ${statusText}` : ""}.`;
}

type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  colorId?: string;
  originalStartTime?: { date?: string; dateTime?: string };
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

export async function fetchGoogleCalendar(
  source: CalendarSourceConfig,
  range: CalendarQueryRange,
): Promise<ProviderCalendarEvent[]> {
  if (!source.googleCalendarId) throw new Error("Google Calendar ID is missing.");
  const token = await accessToken();
  const events: ProviderCalendarEvent[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: rangeBoundary(range.from),
      timeMax: rangeBoundary(addCalendarDays(parseCalendarDate(range.to), 1).toISOString().slice(0, 10)),
      timeZone: "America/New_York",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(source.googleCalendarId)}/events?${params}`,
      { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) throw new Error(friendlyGoogleError(response.status, response.statusText));
    const body = await response.json() as { items?: GoogleEvent[]; nextPageToken?: string };
    for (const item of body.items ?? []) {
      if (item.status === "cancelled" || !item.start || !item.end) continue;
      const allDay = Boolean(item.start.date);
      const start = allDay ? item.start.date : item.start.dateTime;
      const end = allDay ? item.end.date : item.end.dateTime;
      if (!start || !end) continue;
      events.push({
        providerEventId: item.id ?? `${start}:${item.summary ?? "event"}`,
        title: item.summary ?? "(No title)",
        location: item.location ?? null,
        color: item.colorId ? EVENT_COLORS[item.colorId] ?? null : null,
        allDay,
        start: allDay ? start : new Date(start),
        end: allDay ? end : new Date(end),
      });
    }
    pageToken = body.nextPageToken;
  } while (pageToken);
  return events;
}
