alter table public.pins add column is_public boolean not null default false;
create index pins_public_idx on public.pins(created_at desc) where is_public;

create policy "Signed-in users can read public pins" on public.pins for select to authenticated
using (is_public = true);

create policy "Signed-in users can read media from public pins" on storage.objects for select to authenticated
using (
  bucket_id in ('memory-images', 'memory-audio') and exists (
    select 1 from public.pins p
    where p.is_public = true
      and (
        p.image_path = name
        or p.audio_path = name
        or p.album @> jsonb_build_array(jsonb_build_object('path', name))
      )
  )
);

notify pgrst, 'reload schema';
