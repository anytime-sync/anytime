-- 0013_site_design.sql
-- Site-wide visual design override system. The admin /admin/design
-- editor writes to site_design; every annotated <DesignSlot id="..."/>
-- in the app reads its overrides at render time and applies them as
-- inline styles. Style is shared across locales (per the editor scope);
-- per-locale TEXT overrides continue to live in site_content.
--
-- Storage bucket `design-assets` holds uploaded background images and
-- other media — public-read so the runtime can fetch without auth.

-- ---------- site_design (per-element style/transform/image) ----------
create table if not exists site_design (
  element_id text primary key,
  -- JSONB blob: { fontFamily, fontSize, fontWeight, fontStyle,
  --              letterSpacing, lineHeight, color, textAlign,
  --              translateX, translateY, scale, rotate, opacity,
  --              bgImageUrl, bgPosition, bgSize, hidden }
  overrides jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz default now() not null
);

alter table site_design enable row level security;

-- Public reads — anonymous landing visitors must render with overrides.
drop policy if exists "site_design_public_read" on site_design;
create policy "site_design_public_read"
  on site_design for select
  using (true);

-- Only the admin email can mutate. (Writes also go through service-role
-- API routes for image uploads; the table policy is the belt to that
-- route's suspenders.)
drop policy if exists "site_design_admin_insert" on site_design;
create policy "site_design_admin_insert"
  on site_design for insert
  to authenticated
  with check (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
        and auth.users.email = 'anytime.sync@gmail.com'
    )
  );

drop policy if exists "site_design_admin_update" on site_design;
create policy "site_design_admin_update"
  on site_design for update
  to authenticated
  using (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
        and auth.users.email = 'anytime.sync@gmail.com'
    )
  );

drop policy if exists "site_design_admin_delete" on site_design;
create policy "site_design_admin_delete"
  on site_design for delete
  to authenticated
  using (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
        and auth.users.email = 'anytime.sync@gmail.com'
    )
  );

-- ---------- storage bucket: design-assets ----------
-- Public-read bucket for uploaded background images and any other
-- editor-uploaded media. We create it idempotently so re-running this
-- migration is safe.
insert into storage.buckets (id, name, public)
values ('design-assets', 'design-assets', true)
on conflict (id) do nothing;

-- Anyone can read.
drop policy if exists "design_assets_public_read" on storage.objects;
create policy "design_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'design-assets');

-- Only admin can write. The /api/design/upload route uses the service
-- role so this policy is mostly defence-in-depth.
drop policy if exists "design_assets_admin_write" on storage.objects;
create policy "design_assets_admin_write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'design-assets'
    and exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
        and auth.users.email = 'anytime.sync@gmail.com'
    )
  );

drop policy if exists "design_assets_admin_delete" on storage.objects;
create policy "design_assets_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'design-assets'
    and exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
        and auth.users.email = 'anytime.sync@gmail.com'
    )
  );
