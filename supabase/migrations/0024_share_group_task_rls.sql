-- 0024_share_group_task_rls.sql
--
-- Fix: group-shared tasks (via share_group_id) were invisible to group
-- members because the RLS policies only checked project_id membership.
-- This migration extends SELECT / UPDATE / DELETE policies on tasks to
-- also honour share_group_id, and allows any group member to delete
-- group tasks (not just the creator or project owner).

-- ========== helper: is_share_group_member ==========
-- Mirrors the existing is_project_member() pattern. SECURITY DEFINER
-- avoids recursive RLS evaluation when called from a policy.

create or replace function is_share_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from share_group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;
revoke all on function is_share_group_member(uuid) from public;
grant execute on function is_share_group_member(uuid) to authenticated;

-- ========== tasks: SELECT ==========
-- Was: user_id = auth.uid() OR (project_id IS NOT NULL AND is_project_member(project_id))
-- Add: OR (share_group_id IS NOT NULL AND is_share_group_member(share_group_id))

drop policy if exists "tasks select for owner or member" on tasks;
create policy "tasks select for owner or member" on tasks
  for select using (
    user_id = auth.uid()
    or (project_id is not null and is_project_member(project_id))
    or (share_group_id is not null and is_share_group_member(share_group_id))
  );

-- ========== tasks: UPDATE ==========
-- Was: user_id = auth.uid() OR (project_id IS NOT NULL AND is_project_member(project_id))
-- Add: OR (share_group_id IS NOT NULL AND is_share_group_member(share_group_id))

drop policy if exists "tasks update for owner or member" on tasks;
create policy "tasks update for owner or member" on tasks
  for update using (
    user_id = auth.uid()
    or (project_id is not null and is_project_member(project_id))
    or (share_group_id is not null and is_share_group_member(share_group_id))
  ) with check (
    user_id = auth.uid()
    or (project_id is not null and is_project_member(project_id))
    or (share_group_id is not null and is_share_group_member(share_group_id))
  );

-- ========== tasks: DELETE ==========
-- Was: user_id = auth.uid() OR (project_id IS NOT NULL AND project owner)
-- New: also allow any share_group member to delete group tasks.

drop policy if exists "tasks delete for owner or project owner" on tasks;
create policy "tasks delete for owner or project owner" on tasks
  for delete using (
    user_id = auth.uid()
    or (project_id is not null and exists (
      select 1 from projects p where p.id = tasks.project_id and p.user_id = auth.uid()
    ))
    or (share_group_id is not null and is_share_group_member(share_group_id))
  );

-- ========== tasks: INSERT ==========
-- Insert stays user_id = auth.uid() — only the creator can insert tasks.
-- (Group members see tasks via SELECT, toggle via UPDATE, remove via DELETE.)
