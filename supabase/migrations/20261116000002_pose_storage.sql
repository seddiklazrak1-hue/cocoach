-- =============================================================================
-- Stockage des séries de pose : bucket privé, un dossier par coach
-- =============================================================================
-- Chemin d'un fichier : <coach_id>/<session_id>/<athlete_id>.bin
-- Le premier dossier du chemin doit être l'id du coach connecté.

insert into storage.buckets (id, name, public, file_size_limit)
values ('pose-series', 'pose-series', false, 20 * 1024 * 1024)  -- 20 Mo max par fichier
on conflict (id) do nothing;

create policy "coach reads own pose files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pose-series'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "coach uploads own pose files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pose-series'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "coach deletes own pose files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pose-series'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
