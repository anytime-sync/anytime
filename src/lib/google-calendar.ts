/**
 * google-calendar.ts — thin wrapper around Google's OAuth 2.0 + Calendar
 * v3 endpoints. Native fetch only, no extra deps.
 *
 * Used by:
 *   - /api/calendar/google/connect    → buildAuthUrl
 *   - /api/calendar/google/callback   → exchangeCodeForTokens, fetchUserInfo,
 *                                       fetchPrimaryCalendarId
 *   - /api/cron/calendar-sync         → listCalendarEvents (incremental)
 *   - /api/calendar/google/sync-now   → listCalendarEvents (incremental)
 *   - lib/calendar-token.ts           → refreshAccessToken
 *
 * Keep this file pure transport — no DB, no Supabase. Callers handle
 * persistence so we can unit-test the wire layer in isolation.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";
const CAL_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Both scopes requested up front so we never need a re-consent flow when
 * we later flip to writing events. `calendar.readonly` is sufficient for
 * v1 read-only sync; `calendar.events` is staged for v2 task→event push.
 */
export const SCOPES: string[] = [
  // openid + email + profile so we can call /oauth2/v2/userinfo and
  // store the connected account_email. Without these the userinfo
  // request 401s with 'insufficient_scope' and the callback aborts.
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

export type GoogleTokenResponse = {
  access_token: string;
  /** Only present on the initial code exchange (when prompt=consent). */
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

export type GoogleUserInfo = {
  email: string;
  name?: string;
  picture?: string;
};

export type GoogleCalendarEventDateTime = {
  dateTime?: string;       // RFC3339 — timed events
  date?: string;           // YYYY-MM-DD — all-day events
  timeZone?: string;
};

export type GoogleCalendarEvent = {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: GoogleCalendarEventDateTime;
  end?: GoogleCalendarEventDateTime;
  organizer?: { email?: string; displayName?: string; self?: boolean };
  attendees?: { email?: string; responseStatus?: string }[];
  recurringEventId?: string;
  // Plus many more we passthrough as `raw` jsonb.
  [k: string]: unknown;
};

export type ListEventsResponse = {
  items: GoogleCalendarEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
};

/* ------------------------------------------------------------------ */
/*  OAuth                                                              */
/* ------------------------------------------------------------------ */

function getClientId(): string {
  const id = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CALENDAR_CLIENT_ID not set");
  return id;
}

function getClientSecret(): string {
  const s = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!s) throw new Error("GOOGLE_CALENDAR_CLIENT_SECRET not set");
  return s;
}

/**
 * Build the consent URL we 302 the user to. `access_type=offline` is
 * what makes Google return a refresh_token; `prompt=consent` forces
 * the consent screen so we always receive that refresh_token (Google
 * silently omits it on subsequent grants without a fresh consent).
 */
export function buildAuthUrl({
  state,
  redirectUri,
}: {
  state: string;
  redirectUri: string;
}): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCodeForTokens({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: getClientId(),
    client_secret: getClientSecret(),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`google_token_exchange_failed: ${res.status} ${text}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

/**
 * Refresh a stale access_token. Refresh tokens are long-lived and
 * stay the same across refreshes (Google rotates them only on
 * specific events like password change), so we don't persist a new
 * refresh_token here.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number; scope?: string }> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`google_token_refresh_failed: ${res.status} ${text}`);
  }
  const j = (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };
  return j;
}

export async function fetchUserInfo(
  accessToken: string
): Promise<GoogleUserInfo> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`google_userinfo_failed: ${res.status}`);
  }
  return (await res.json()) as GoogleUserInfo;
}

/**
 * Returns the user's primary calendar id. For most accounts this is
 * just their email address, but we ask Google rather than assume so
 * we don't break for users on Workspace with aliased calendars.
 */
export async function fetchPrimaryCalendarId(
  accessToken: string
): Promise<string> {
  const res = await fetch(`${CAL_BASE}/calendars/primary`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`google_primary_calendar_failed: ${res.status}`);
  }
  const j = (await res.json()) as { id?: string };
  if (!j.id) throw new Error("google_primary_calendar_no_id");
  return j.id;
}

/**
 * Incremental events list. Pass `syncToken` for incremental sync, or
 * `timeMin`/`timeMax` for the initial bootstrap. `singleEvents=true`
 * expands recurring events into individual instances so the calendar
 * UI can render them on the right days without us implementing RRULE
 * expansion ourselves.
 *
 * Pagination: callers loop on `nextPageToken` and only persist the
 * `nextSyncToken` from the LAST page (Google only returns it once
 * pagination is exhausted).
 */
export async function listCalendarEvents({
  accessToken,
  calendarId,
  syncToken,
  timeMin,
  timeMax,
  pageToken,
}: {
  accessToken: string;
  calendarId: string;
  syncToken?: string | null;
  timeMin?: string;
  timeMax?: string;
  pageToken?: string;
}): Promise<ListEventsResponse> {
  const params = new URLSearchParams();
  params.set("singleEvents", "true");
  params.set("maxResults", "250");
  // Sync-token mode is mutually exclusive with time bounds + orderBy
  // — Google rejects (400) if you mix them.
  if (syncToken) {
    params.set("syncToken", syncToken);
  } else {
    if (timeMin) params.set("timeMin", timeMin);
    if (timeMax) params.set("timeMax", timeMax);
    params.set("orderBy", "startTime");
  }
  if (pageToken) params.set("pageToken", pageToken);

  const url = `${CAL_BASE}/calendars/${encodeURIComponent(
    calendarId
  )}/events?${params.toString()}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 410) {
    // Sync token expired — caller should retry without a syncToken.
    throw new Error("google_sync_token_expired");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`google_list_events_failed: ${res.status} ${text}`);
  }
  const j = (await res.json()) as {
    items?: GoogleCalendarEvent[];
    nextSyncToken?: string;
    nextPageToken?: string;
  };
  return {
    items: j.items ?? [],
    nextSyncToken: j.nextSyncToken,
    nextPageToken: j.nextPageToken,
  };
}
