drop policy if exists "Public collection pins can be read by anyone" on public.pins;
create policy "Public collection pins can be read by anyone" on public.pins for select to anon, authenticated
using (
  is_public = true and exists (
    select 1 from public.collections c
    where c.id = collection_id and c.is_public = true
  )
);

drop policy if exists "Readers can access media from public collections" on storage.objects;
create policy "Readers can access media from public collections" on storage.objects for select to anon, authenticated
using (
  (bucket_id = 'memory-images' and exists (
    select 1 from public.pins p
    join public.collections c on c.id = p.collection_id
    where p.image_path = name and p.is_public = true and c.is_public = true
  ))
  or
  (bucket_id = 'memory-audio' and exists (
    select 1 from public.pins p
    join public.collections c on c.id = p.collection_id
    where p.audio_path = name and p.is_public = true and c.is_public = true
  ))
);

drop policy if exists "Readers can access album media from public collections" on storage.objects;
create policy "Readers can access album media from public collections" on storage.objects for select to anon, authenticated
using (
  bucket_id in ('memory-images', 'memory-audio') and exists (
    select 1 from public.pins p
    join public.collections c on c.id = p.collection_id
    where c.is_public = true
      and p.is_public = true
      and p.album @> jsonb_build_array(jsonb_build_object('path', name))
  )
);
