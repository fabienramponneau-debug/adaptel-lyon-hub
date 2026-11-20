drop policy if exists "Users create their own actions" on public.actions;

create policy "Users create own actions or admins create all"
  on public.actions for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin' and actif = true
    )
  );
