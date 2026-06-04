-- Add custom color columns to announcements
alter table public.announcements
  add column if not exists bg_color text,
  add column if not exists text_color text,
  add column if not exists border_color text;

-- Comment: bg_color / text_color / border_color are optional CSS color values.
-- When set, they override the style-based defaults in the announcement banner.
