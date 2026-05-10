/**
 * google-calendar.ts — thin wrapper around Google's OAuth 2.0 + Calendar
 * v3 endpoints. Native fetch only, no extra deps.
 *
 * Used by:
 *   - /api/calendar/google/connect    → buildAuthUrl
 *   - /api/calendar/google/callback   → exchangeCodeForTokens, fetchUserInfo,
 *                                       fetchPrimaryCalendarId
 *   - /api/cron/calendar-sync         → listCalendarEvents (read pass),
 *                                       createCalendarEvent / patchCalendarEvent /
 *                                       deleteCalendarEvent (write pass — Round F v2)
 *   - /api/calendar/google/sync-now   → listCalendarEvents (incremental)
 *   - lib/calendar-token.ts           → refreshAccessToken
 *   - lib/calendar-write.ts           → create/patch/delete (Round F v2)
 *
 * Keep this file pure transport — no DB, no Supabase. Callers handle
 * persistence so we can unit-test the wire layer in isolation.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";
const CAL_BASE = "https://www.googleapis.com/calendar/v3";

export const SCOPES: string[] = [
  // openid + email + profile so we can call /oauth2/v2/userinfo and
  // store the connected account_email.
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

export type GoogleTokenResponse = {
  access_token: string;
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
  dateTime?: string;
  date?: string;
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
  /**
   * Round F v2: events we created carry our task id under
   * extendedProperties.private.firstlightTaskId so the read-side cron
   * can identify and skip them.
   */
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
  [k: string]: unknown;
};

export type GoogleCalendarEventInput = {
  summary: string;
  description?: string;
  location?: string;
  start: GoogleCalendarEventDateTime;
  end: GoogleCalendarEventDateTime;
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
};

export type ListEventsResponse = {
  items: GoogleCalendarEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
};

/* ------------------------------------------------------------------ */
/* OAuth                                                              */
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
  return (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };
}

export async function fetchUserInfo(
  accessToken: string
): Promise<GoogleUserInfo> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`google_userinfo_failed: ${res.status}`);
  return (await res.json()) as GoogleUserInfo;
}

export async function fetchPrimaryCalendarId(
  accessToken: string
): Promise<string> {
  const res = await fetch(`${CAL_BASE}/calendars/primary`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`google_primary_calendar_failed: ${res.status}`);
  const j = (await res.json()) as { id?: string };
  if (!j.id) throw new Error("google_primary_calendar_no_id");
  return j.id;
}

/* ------------------------------------------------------------------ */
/* Read (Round F v1)                                                  */
/* ------------------------------------------------------------------ */

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
  if (res.status === 410) throw new Error("google_sync_token_expired");
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

/* ------------------------------------------------------------------ */
/* Write (Round F v2)                                                 */
/* ------------------------------------------------------------------ */

/**
 * Create a new event on the user's calendar. Returns the created
 * event (with `id` populated by Google).
 */
export async function createCalendarEvent({
  accessToken,
  calendarId,
  event,
}: {
  accessToken: string;
  calendarId: string;
  event: GoogleCalendarEventInput;
}): Promise<GoogleCalendarEvent> {
  const url = `${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`google_create_event_failed: ${res.status} ${text}`);
  }
  return (await res.json()) as GoogleCalendarEvent;
}

/**
 * Patch (partial update) an existing event. We use PATCH not PUT so
 * a missing field doesn't clear it on Google's side — important if
 * the user added attendees or notes there that we don't track.
 */
export async function patchCalendarEvent({
  accessToken,
  calendarId,
  eventId,
  patch,
}: {
  accessToken: string;
  calendarId: string;
  eventId: string;
  patch: Partial<GoogleCalendarEventInput>;
}): Promise<GoogleCalendarEvent> {
  const url = `${CAL_BASE}/calendars/${encodeURIComponent(
    calendarId
  )}/events/${encodeURIComponent(eventId)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(patch),
  });
  // 404 means the event was already deleted on Google's side. Treat as
  // a no-op success so our cron doesn't loop forever.
  if (res.status === 404) {
    return { id: eventId, status: "cancelled" } as GoogleCalendarEvent;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`google_patch_event_failed: ${res.status} ${text}`);
  }
  return (await res.json()) as GoogleCalendarEvent;
}

/**
 * Delete an event. 404 (already gone) and 410 (gone) are treated as
 * success so the queue can clear the row.
 */
export async function deleteCalendarEvent({
  accessToken,
  calendarId,
  eventId,
}: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}): Promise<void> {
  const url = `${CAL_BASE}/calendars/${encodeURIComponent(
    calendarId
  )}/events/${encodeURIComponent(eventId)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (res.ok || res.status === 404 || res.status === 410) return;
  const text = await res.text();
  throw new Error(`google_delete_event_failed: ${res.status} ${text}`);
}
