-- =============================================================================
-- Séquences de capture : plusieurs par séance, et jamais sans consentement
-- =============================================================================
-- Une séance peut contenir plusieurs séquences filmées (quelques minutes
-- chacune). Chaque séquence produit un fichier de pose par athlète.

alter table public.pose_series
  add column clip_id    uuid not null default gen_random_uuid(),
  add column started_at timestamptz not null default now();

-- Un seul fichier par athlète et par séquence.
create unique index pose_series_clip_athlete_key
  on public.pose_series (clip_id, athlete_id);
create index pose_series_session_clip_idx
  on public.pose_series (session_id, clip_id);

-- Garde-fou en base : impossible d'enregistrer la pose d'un athlète dont le
-- consentement n'est pas enregistré, même si l'app se trompait.
-- (Fonction « invoker » : elle lit `athletes` avec les droits du coach connecté.)
create function public.check_pose_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.athletes
    where id = new.athlete_id
      and coach_id = new.coach_id
      and analysis_allowed
  ) then
    raise exception 'Consentement manquant : cet athlète ne peut pas être enregistré'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger pose_series_requires_consent
  before insert on public.pose_series
  for each row execute function public.check_pose_consent();
