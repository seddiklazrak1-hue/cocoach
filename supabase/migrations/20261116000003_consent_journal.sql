-- =============================================================================
-- Consentement : le journal `consents` devient la SEULE façon de le modifier
-- =============================================================================
-- Avant : l'app pouvait écrire `athletes.consent_status` directement, donc
-- changer un consentement sans laisser de trace.
-- Après : on ajoute une ligne au journal, et un trigger reporte le statut sur
-- l'athlète. Impossible d'autoriser une analyse sans entrée datée au journal.

create function public.apply_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_birth_date date;
begin
  select birth_date into v_birth_date
  from public.athletes
  where id = new.athlete_id and coach_id = new.coach_id;

  -- Garde-fou mineurs : avec une date de naissance de moins de 18 ans, seul le
  -- consentement parental est accepté.
  if new.status = 'adult_confirmed'
     and v_birth_date is not null
     and v_birth_date > (current_date - interval '18 years')::date then
    raise exception 'Athlète mineur : un consentement parental est requis'
      using errcode = 'check_violation';
  end if;

  -- `new.coach_id` a déjà été validé par la RLS (= coach connecté) : on ne peut
  -- donc toucher qu'à un athlète de ce coach.
  update public.athletes
  set consent_status = new.status
  where id = new.athlete_id and coach_id = new.coach_id;

  return new;
end;
$$;

create trigger on_consent_recorded
  after insert on public.consents
  for each row execute function public.apply_consent();

-- Le coach ne peut plus écrire `consent_status` lui-même, ni à la création ni
-- à la modification : droits limités aux colonnes de la fiche.
revoke insert, update on public.athletes from authenticated;

grant insert (coach_id, display_name, discipline, level, weight_kg, height_cm, birth_date)
  on public.athletes to authenticated;
grant update (display_name, discipline, level, weight_kg, height_cm, birth_date)
  on public.athletes to authenticated;
