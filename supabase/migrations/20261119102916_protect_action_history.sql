drop policy if exists "Authenticated users can insert actions" on public.actions;
drop policy if exists "Authenticated users can update actions" on public.actions;
drop policy if exists "Authenticated users can delete actions" on public.actions;

create policy "Users create their own actions"
  on public.actions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own actions or admins update all"
  on public.actions for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin' and actif = true
    )
  )
  with check (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin' and actif = true
    )
  );

create policy "Users delete own actions or admins delete all"
  on public.actions for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin' and actif = true
    )
  );
