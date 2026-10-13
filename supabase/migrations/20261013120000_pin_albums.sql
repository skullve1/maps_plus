alter table public.pins
  add column album jsonb not null default '[]'::jsonb
  check (jsonb_typeof(album) = 'array' and jsonb_array_length(album) <= 40);

create policy "Readers can access album media from public collections" on storage.objects for select to anon, authenticated
using (
  bucket_id in ('memory-images', 'memory-audio') and exists (
    select 1 from public.pins p
    join public.collections c on c.id = p.collection_id
    where c.is_public = true
      and p.album @> jsonb_build_array(jsonb_build_object('path', name))
  )
);
