-- M1: Storage-Bucket für Firmenlogos. Pfad: <betrieb_id>/<dateiname>
-- Öffentlich lesbar (Logo erscheint auf Rechnungen/PDFs), schreiben nur Inhaber.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

create policy logos_lesen on storage.objects
  for select using (bucket_id = 'logos');

create policy logos_hochladen on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and public.ist_inhaber(((storage.foldername(name))[1])::uuid)
  );

create policy logos_aendern on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and public.ist_inhaber(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'logos' and public.ist_inhaber(((storage.foldername(name))[1])::uuid));

create policy logos_loeschen on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and public.ist_inhaber(((storage.foldername(name))[1])::uuid));
