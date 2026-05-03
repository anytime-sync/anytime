-- =====================================================================
-- ICS calendar subscription feed
--
-- Each user can opt in to a public iCalendar feed by minting a token
-- that's embedded in /api/ics/[token]/calendar.ics. Apple Calendar /
-- Google Calendar / Outlook subscribe to that URL and refresh
-- periodically — read-only, one-way out.
--
-- The token is the only auth on the feed (the route looks up the user
-- by token via the service-role client). When the user disables the
-- feed or rotates the token, every subscribed calendar app silently
-- 404's on the next refresh — exactly the behaviour we want.
-- =====================================================================
alter table user_preferences
  add column if not exists ics_feed_token text unique,
  add column if not exists ics_feed_created_at timestamptz;

create index if not exists user_preferences_ics_feed_token_idx
  on user_preferences (ics_feed_token)
  where ics_feed_token is not null;
