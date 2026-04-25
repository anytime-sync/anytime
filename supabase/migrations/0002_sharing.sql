-- Sharing & collaborators: project_members + relaxed RLS so members
-- see/edit shared projects and tasks.

create table if not exists project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member','viewer')),
  added_at timestamptz default now(),
  primary key (project_id, user_id)
);
create index if not exists project_members_user_idx on project_members(user_id);

alter table project_members enable row level security;

-- Backfill: every existing project gets an owner row.
insert into project_members (project_id, user_id, role)
select p.id, p.user_id, 'owner' from projects p
on conflict do nothing;

-- Trigger: when a project is created, add an owner row automatically.
create or replace function on_project_insert_add_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists projects_add_owner on projects;
create trigger projects_add_owner
  after insert on projects
  for each row execute function on_project_insert_add_owner();

-- Drop the old owner-only RLS in favor of finer-grained policies below.
drop policy if exists "projects owner all" on projects;
drop policy if exists "tasks owner all" on tasks;

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_members'
  ) then
    execute 'alter publication supabase_realtime add table project_members';
  end if;
end$$;

-- Helper functions (SECURITY DEFINER) avoid recursive RLS evaluation
-- when policies need to peek at project_members.
create or replace function is_project_member(pid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from project_members where project_id = pid and user_id = auth.uid()
  );
$$;
revoke all on function is_project_member(uuid) from public;
grant execute on function is_project_member(uuid) to authenticated;

create or replace function shares_project_with(other_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from project_members me
    join project_members them on me.project_id = them.project_id
    where me.user_id = auth.uid() and them.user_id = other_user
  );
$$;
revoke all on function shares_project_with(uuid) from public;
grant execute on function shares_project_with(uuid) to authenticated;

-- Email lookup for invite flow (returns id+email only, no other PII).
create or replace function find_profile_by_email(p_email text)
returns table (id uuid, email text)
language sql
security definer
set search_path = public
as $$
  select id, email from profiles
  where lower(email) = lower(p_email)
  limit 1;
$$;
revoke all on function find_profile_by_email(text) from public;
grant execute on function find_profile_by_email(text) to authenticated;

-- ===== Policies =====

-- profiles: visible to self OR co-members.
drop policy if exists "profiles self read" on profiles;
drop policy if exists "profiles visible to co-members" on profiles;
create policy "profiles visible to co-members" on profiles
  for select using (id = auth.uid() or shares_project_with(profiles.id));

-- project_members: visible to anyone in that project; only owner can add/remove.
drop policy if exists "members visible to project participants" on project_members;
create policy "members visible to project participants" on project_members
  for select using (
    user_id = auth.uid()
    or is_project_member(project_id)
    or exists (select 1 from projects p where p.id = project_members.project_id and p.user_id = auth.uid())
  );
drop policy if exists "only owner manages members" on project_members;
create policy "only owner manages members" on project_members
  for all using (
    exists (select 1 from projects p where p.id = project_members.project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from projects p where p.id = project_members.project_id and p.user_id = auth.uid())
  );

-- projects: select if owner OR member; mutations only by owner.
drop policy if exists "projects select for owner or member" on projects;
create policy "projects select for owner or member" on projects
  for select using (user_id = auth.uid() or is_project_member(projects.id));
drop policy if exists "projects insert by self" on projects;
create policy "projects insert by self" on projects
  for insert with check (user_id = auth.uid());
drop policy if exists "projects update by owner" on projects;
create policy "projects update by owner" on projects
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "projects delete by owner" on projects;
create policy "projects delete by owner" on projects
  for delete using (user_id = auth.uid());

-- tasks: select/update if owner OR member of containing project.
drop policy if exists "tasks select for owner or member" on tasks;
create policy "tasks select for owner or member" on tasks
  for select using (
    user_id = auth.uid()
    or (project_id is not null and is_project_member(project_id))
  );
drop policy if exists "tasks insert by self" on tasks;
create policy "tasks insert by self" on tasks
  for insert with check (user_id = auth.uid());
drop policy if exists "tasks update for owner or member" on tasks;
create policy "tasks update for owner or member" on tasks
  for update using (
    user_id = auth.uid()
    or (project_id is not null and is_project_member(project_id))
  ) with check (
    user_id = auth.uid()
    or (project_id is not null and is_project_member(project_id))
  );
drop policy if exists "tasks delete for owner or project owner" on tasks;
create policy "tasks delete for owner or project owner" on tasks
  for delete using (
    user_id = auth.uid()
    or (project_id is not null and exists (
      select 1 from projects p where p.id = tasks.project_id and p.user_id = auth.uid()
    ))
  );

-- ===== handle_new_user: explicit search_path + qualified names =====
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  proj_id uuid;
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.projects (user_id, name, color, position)
  values (new.id, 'Personal', '#4772fa', 0)
  returning id into proj_id;

  insert into public.tasks (user_id, project_id, title, notes, priority, due_at)
  values
    (new.id, proj_id,
     'Welcome to Anytime — try the quick add (press q)',
     'Try: "Email Sam tomorrow 9am #work !1" — chrono parses dates, # adds tags, !1 is High priority.',
     5,
     now() + interval '1 day'),
    (new.id, proj_id,
     'Toggle a list to Kanban view',
     'Open this list, click "Kanban" in the top-right, drag a card between priority columns.',
     3,
     now() + interval '2 days'),
    (new.id, proj_id,
     'Build a habit',
     'Visit Habits in the sidebar, add a habit, and click each day you do it.',
     1,
     now() + interval '3 days');

  return new;
end;
$$;
