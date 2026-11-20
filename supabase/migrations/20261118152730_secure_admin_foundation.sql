-- Socle de securite pour la gestion des utilisateurs CRM.
-- Migration additive : aucune donnee ni aucun compte existant n'est supprime.

alter function public.update_updated_at_column()
  set search_path = public;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres, supabase_auth_admin;

-- Un utilisateur ne doit jamais pouvoir modifier lui-meme son role ou son
-- statut actif depuis le navigateur. Ces changements passent exclusivement
-- par l'Edge Function manage-crm-users, qui verifie le role admin et utilise
-- le service role cote serveur.
drop policy if exists "Users can update their own profile" on public.profiles;
