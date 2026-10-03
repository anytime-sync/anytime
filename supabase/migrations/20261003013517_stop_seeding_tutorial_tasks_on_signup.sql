-- Applied to production on 2026-10-03. Preserve profile and Personal list creation.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public','auth'
as $function$
begin
  insert into public.profiles (id,email,full_name,avatar_url)
  values (new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),new.raw_user_meta_data->>'avatar_url');
  insert into public.projects (user_id,name,color,position)
  values (new.id,'Personal','#4772fa',0);
  return new;
end;
$function$;
