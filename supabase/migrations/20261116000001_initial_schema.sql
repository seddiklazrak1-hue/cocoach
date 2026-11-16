-- =============================================================================
-- Combat Coach IA : schéma initial + Row Level Security
-- =============================================================================
-- Principes :
--   1. Chaque table porte un `coach_id`. La règle RLS est donc partout la même
--      et triviale à auditer : coach_id = auth.uid().
--   2. Les clés étrangères sont COMPOSITES (id, coach_id). Un coach ne peut donc
--      pas rattacher sa ligne à l'objet d'un autre coach, même en devinant un id.
--   3. Tout descend de `athletes` et `sessions` en ON DELETE CASCADE : supprimer
--      un athlète efface toutes ses données (droit à l'effacement RGPD).
--   4. Aucune vidéo, aucune donnée d'identification biométrique. Seulement des
--      séries de points articulaires et des métriques dérivées.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- coaches : profil du coach, 1-1 avec auth.users
-- ----------------------------------------------------------------------------
create table public.coaches (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text not null default '' check (length(display_name) <= 60),
  -- Durée de conservation des données de séance (RGPD), en jours.
  retention_days integer not null default 365 check (retention_days between 30 and 3650),
  created_at     timestamptz not null default now()
);

-- Crée automatiquement la ligne `coaches` à l'inscription.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.coaches (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- groups : groupes d'entraînement du coach
-- ----------------------------------------------------------------------------
create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null default auth.uid() references public.coaches (id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 80),
  discipline text not null check (discipline in
               ('wrestling', 'mma', 'bjj', 'boxing', 'kickboxing', 'judo', 'other')),
  level      text not null default 'mixed' check (level in
               ('beginner', 'intermediate', 'advanced', 'mixed')),
  -- Créneaux : [{ "day": 1, "start": "19:00", "end": "20:30" }] (1 = lundi).
  schedule   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, coach_id)
);

-- ----------------------------------------------------------------------------
-- athletes : pas de compte, pas de nom complet exigé (prénom ou pseudo)
-- ----------------------------------------------------------------------------
create table public.athletes (
  id             uuid primary key default gen_random_uuid(),
  coach_id       uuid not null default auth.uid() references public.coaches (id) on delete cascade,
  display_name   text not null check (length(trim(display_name)) between 1 and 60),
  discipline     text check (discipline in
                   ('wrestling', 'mma', 'bjj', 'boxing', 'kickboxing', 'judo', 'other')),
  level          text not null default 'beginner' check (level in
                   ('beginner', 'intermediate', 'advanced')),
  weight_kg      numeric(5, 1) check (weight_kg between 10 and 300),
  height_cm      numeric(4, 1) check (height_cm between 80 and 250),
  birth_date     date,
  -- État courant du consentement. Par défaut 'missing' : AUCUNE analyse n'est
  -- possible tant que le coach n'a pas enregistré un consentement. C'est ce qui
  -- couvre "par défaut" le cas des mineurs.
  consent_status text not null default 'missing' check (consent_status in
                   ('missing', 'adult_confirmed', 'minor_parental_confirmed', 'withdrawn')),
  analysis_allowed boolean generated always as
                   (consent_status in ('adult_confirmed', 'minor_parental_confirmed')) stored,
  created_at     timestamptz not null default now(),
  unique (id, coach_id)
);

create table public.athlete_groups (
  athlete_id uuid not null,
  group_id   uuid not null,
  coach_id   uuid not null default auth.uid(),
  primary key (athlete_id, group_id),
  foreign key (athlete_id, coach_id) references public.athletes (id, coach_id) on delete cascade,
  foreign key (group_id, coach_id)   references public.groups (id, coach_id)   on delete cascade
);

-- ----------------------------------------------------------------------------
-- consents : journal (append-only) des changements de consentement = traçabilité
-- ----------------------------------------------------------------------------
create table public.consents (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null default auth.uid(),
  athlete_id  uuid not null,
  status      text not null check (status in
                ('missing', 'adult_confirmed', 'minor_parental_confirmed', 'withdrawn')),
  note        text check (length(note) <= 500),
  recorded_at timestamptz not null default now(),
  foreign key (athlete_id, coach_id) references public.athletes (id, coach_id) on delete cascade
);

-- ----------------------------------------------------------------------------
-- sessions : séances d'entraînement
-- ----------------------------------------------------------------------------
create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null default auth.uid() references public.coaches (id) on delete cascade,
  group_id     uuid not null,
  session_date date not null default current_date,
  kind         text not null check (kind in ('technique', 'sparring', 'cardio', 'drill')),
  duration_min integer check (duration_min between 1 and 600),
  status       text not null default 'draft' check (status in ('draft', 'captured', 'analyzed')),
  notes        text check (length(notes) <= 2000),
  created_at   timestamptz not null default now(),
  unique (id, coach_id),
  foreign key (group_id, coach_id) references public.groups (id, coach_id) on delete cascade
);

-- Présence d'un athlète à une séance.
create table public.session_athletes (
  session_id uuid not null,
  athlete_id uuid not null,
  coach_id   uuid not null default auth.uid(),
  present    boolean not null default true,
  primary key (session_id, athlete_id),
  foreign key (session_id, coach_id) references public.sessions (id, coach_id) on delete cascade,
  foreign key (athlete_id, coach_id) references public.athletes (id, coach_id) on delete cascade
);

-- ----------------------------------------------------------------------------
-- pose_series : index des séries de points articulaires.
-- Le binaire compressé vit dans Supabase Storage (bucket privé `pose-series`),
-- pas dans Postgres : la base reste petite (palier gratuit).
-- ----------------------------------------------------------------------------
create table public.pose_series (
  id              uuid primary key default gen_random_uuid(),
  coach_id        uuid not null default auth.uid(),
  session_id      uuid not null,
  athlete_id      uuid not null,
  storage_path    text not null,
  sample_rate_hz  real not null check (sample_rate_hz > 0),
  frame_count     integer not null check (frame_count >= 0),
  duration_s      real not null check (duration_s >= 0),
  mean_confidence real check (mean_confidence between 0 and 1),
  format_version  integer not null default 1,
  created_at      timestamptz not null default now(),
  foreign key (session_id, coach_id) references public.sessions (id, coach_id) on delete cascade,
  foreign key (athlete_id, coach_id) references public.athletes (id, coach_id) on delete cascade
);

-- ----------------------------------------------------------------------------
-- metrics : une valeur calculée (code déterministe) + sa confiance
-- ----------------------------------------------------------------------------
create table public.metrics (
  id         bigint generated always as identity primary key,
  coach_id   uuid not null default auth.uid(),
  session_id uuid not null,
  athlete_id uuid not null,
  key        text not null,              -- ex. 'stance_width', 'knee_valgus_left'
  category   text not null check (category in
               ('technique', 'physical', 'injury_prevention', 'discipline')),
  value      double precision not null,
  unit       text,
  confidence real not null check (confidence between 0 and 1),
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, athlete_id, key),
  foreign key (session_id, coach_id) references public.sessions (id, coach_id) on delete cascade,
  foreign key (athlete_id, coach_id) references public.athletes (id, coach_id) on delete cascade
);

-- ----------------------------------------------------------------------------
-- insights : recommandations rédigées par le LLM à partir des métriques
-- ----------------------------------------------------------------------------
create table public.insights (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null default auth.uid(),
  session_id  uuid not null,
  athlete_id  uuid not null,
  content     jsonb not null,                 -- sortie JSON validée par schéma
  metric_keys text[] not null default '{}',   -- métriques citées (traçabilité)
  model       text,
  created_at  timestamptz not null default now(),
  foreign key (session_id, coach_id) references public.sessions (id, coach_id) on delete cascade,
  foreign key (athlete_id, coach_id) references public.athletes (id, coach_id) on delete cascade
);

create table public.group_insights (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null default auth.uid(),
  group_id    uuid not null,
  session_id  uuid,                           -- null = synthèse multi-séances
  content     jsonb not null,
  metric_keys text[] not null default '{}',
  model       text,
  created_at  timestamptz not null default now(),
  foreign key (group_id, coach_id)   references public.groups (id, coach_id)   on delete cascade,
  foreign key (session_id, coach_id) references public.sessions (id, coach_id) on delete cascade
);

-- ----------------------------------------------------------------------------
-- Index (les politiques RLS filtrent sur coach_id à chaque requête)
-- ----------------------------------------------------------------------------
create index groups_coach_idx           on public.groups (coach_id);
create index athletes_coach_idx         on public.athletes (coach_id);
create index athlete_groups_group_idx   on public.athlete_groups (group_id);
create index athlete_groups_coach_idx   on public.athlete_groups (coach_id);
create index consents_athlete_idx       on public.consents (athlete_id, recorded_at desc);
create index consents_coach_idx         on public.consents (coach_id);
create index sessions_coach_idx         on public.sessions (coach_id);
create index sessions_group_date_idx    on public.sessions (group_id, session_date desc);
create index session_athletes_ath_idx   on public.session_athletes (athlete_id);
create index session_athletes_coach_idx on public.session_athletes (coach_id);
create index pose_series_session_idx    on public.pose_series (session_id);
create index pose_series_athlete_idx    on public.pose_series (athlete_id);
create index pose_series_coach_idx      on public.pose_series (coach_id);
create index metrics_athlete_key_idx    on public.metrics (athlete_id, key);
create index metrics_coach_idx          on public.metrics (coach_id);
create index insights_athlete_idx       on public.insights (athlete_id, created_at desc);
create index insights_session_idx       on public.insights (session_id);
create index insights_coach_idx         on public.insights (coach_id);
create index group_insights_group_idx   on public.group_insights (group_id, created_at desc);
create index group_insights_coach_idx   on public.group_insights (coach_id);

-- ----------------------------------------------------------------------------
-- Droits : rien pour les visiteurs anonymes, CRUD pour un coach connecté
-- (la RLS ci-dessous restreint ensuite aux lignes du coach).
-- ----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select, update (display_name, retention_days) on public.coaches to authenticated;
grant select, insert, update, delete on
  public.groups, public.athletes, public.athlete_groups, public.sessions,
  public.session_athletes, public.pose_series, public.metrics,
  public.insights, public.group_insights
  to authenticated;
-- Journal de consentement : on ajoute et on lit, on ne réécrit jamais l'histoire.
grant select, insert on public.consents to authenticated;
grant usage on all sequences in schema public to authenticated;

-- ----------------------------------------------------------------------------
-- Row Level Security : un coach ne voit et ne modifie que ses propres lignes
-- ----------------------------------------------------------------------------
alter table public.coaches enable row level security;

create policy "coach reads own profile" on public.coaches
  for select to authenticated
  using (id = (select auth.uid()));

create policy "coach updates own profile" on public.coaches
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Même politique pour toutes les tables portant un coach_id.
do $$
declare
  t text;
begin
  foreach t in array array[
    'groups', 'athletes', 'athlete_groups', 'consents', 'sessions',
    'session_athletes', 'pose_series', 'metrics', 'insights', 'group_insights'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "coach owns rows" on public.%I
         for all to authenticated
         using (coach_id = (select auth.uid()))
         with check (coach_id = (select auth.uid()))',
      t
    );
  end loop;
end;
$$;
