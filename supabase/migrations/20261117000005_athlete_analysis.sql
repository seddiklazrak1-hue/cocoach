-- =============================================================================
-- Résumé d'analyse par athlète et par séance
-- =============================================================================
-- Les métriques vont dans `metrics` (une ligne par métrique). Ici on garde le
-- contexte de fiabilité de l'analyse : durée exploitable, part du temps au sol,
-- remarques (« présence trop courte », « travail au sol »…), métriques non
-- mesurables. Les recommandations (phase 5) s'appuieront dessus.

alter table public.session_athletes
  add column analysis    jsonb,
  add column analyzed_at timestamptz;
