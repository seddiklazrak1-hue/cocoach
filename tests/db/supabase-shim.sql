-- Reproduit le strict minimum de l'environnement Supabase dans un Postgres nu
-- (PGlite), pour pouvoir exécuter nos migrations et tester la RLS sans réseau.
-- Ce fichier n'est JAMAIS appliqué sur le vrai projet Supabase.

create role anon nologin;
create role authenticated nologin;

create schema auth;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Comme chez Supabase : l'id du coach connecté vient du jeton JWT de la requête.
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
