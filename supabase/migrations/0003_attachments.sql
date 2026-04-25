-- Task attachments via Supabase Storage.

create table if not exists task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz default now()
);
create index if not exists task_attachments_task_idx on task_attachments(task_id);
create index if not exists task_attachments_user_idx on task_attachments(user_id);

alter table task_attachments enable row level security;

drop policy if exists "attachments select with task" on task_attachments;
create policy "attachments select with task" on task_attachments
  for select using (
    exists (
      select 1 from tasks t
      where t.id = task_attachments.task_id
      and (t.user_id = auth.uid() or (t.project_id is not null and is_project_member(t.project_id)))
    )
  );

drop policy if exists "attachments insert by user with task access" on task_attachments;
create policy "attachments insert by user with task access" on task_attachments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from tasks t
      where t.id = task_attachments.task_id
      and (t.user_id = auth.uid() or (t.project_id is not null and is_project_member(t.project_id)))
    )
  );

drop policy if exists "attachments delete by uploader or task owner" on task_attachments;
create policy "attachments delete by uploader or task owner" on task_attachments
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from tasks t where t.id = task_attachments.task_id and t.user_id = auth.uid())
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_attachments'
  ) then
    execute 'alter publication supabase_realtime add table task_attachments';
  end if;
end$$;

-- Storage bucket (private, 25 MB limit).
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)
on conflict (id) do nothing;

-- Path convention: <user_id>/<task_id>/<filename>
drop policy if exists "users upload to own folder in attachments" on storage.objects;
create policy "users upload to own folder in attachments" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "read attachment if task is visible" on storage.objects;
create policy "read attachment if task is visible" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and exists (
      select 1
      from public.task_attachments a
      join public.tasks t on t.id = a.task_id
      where a.storage_path = storage.objects.name
      and (t.user_id = auth.uid() or (t.project_id is not null and is_project_member(t.project_id)))
    )
  );

drop policy if exists "delete own attachment files" on storage.objects;
create policy "delete own attachment files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
