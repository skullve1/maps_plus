create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#687d61' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_public boolean not null default false,
  share_token uuid unique,
  created_at timestamptz not null default now(),
  constraint public_collection_token check (is_public = false or share_token is not null)
);
create index collections_user_id_idx on public.collections(user_id);

create table public.pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  place_name text check (place_name is null or char_length(place_name) <= 160),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location extensions.geography(Point, 4326),
  color text not null default '#d8795b' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  image_path text,
  image_external_url text check (image_external_url is null or char_length(image_external_url) <= 2000),
  audio_path text,
  audio_url text check (audio_url is null or char_length(audio_url) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pins_user_id_idx on public.pins(user_id);
create index pins_collection_id_idx on public.pins(collection_id);
create index pins_location_idx on public.pins using gist(location);

create or replace function public.sync_pin_location()
returns trigger language plpgsql as $$
begin
  new.location := extensions.st_setsrid(
    extensions.st_makepoint(new.lng, new.lat), 4326
  )::extensions.geography;
  new.updated_at := now();
  if new.collection_id is not null and not exists (
    select 1 from public.collections
    where id = new.collection_id and user_id = new.user_id
  ) then
    raise exception 'Collection must belong to the pin owner';
  end if;
  return new;
end;
$$;
create trigger pins_sync_location before insert or update on public.pins
for each row execute function public.sync_pin_location();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  ) on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.pins enable row level security;

create policy "Users can read own profile" on public.profiles for select to authenticated
using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update to authenticated
using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users manage their collections" on public.collections for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Public collections can be read by anyone" on public.collections for select to anon, authenticated
using (is_public = true);

create policy "Users manage their pins" on public.pins for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Public collection pins can be read by anyone" on public.pins for select to anon, authenticated
using (exists (
  select 1 from public.collections c
  where c.id = collection_id and c.is_public = true
));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('memory-images', 'memory-images', false, 8388608, array['image/jpeg','image/png','image/webp','image/gif']),
  ('memory-audio', 'memory-audio', false, 20971520, array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/mp4','audio/aac','audio/flac'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners upload their own memory files" on storage.objects for insert to authenticated
with check (
  bucket_id in ('memory-images', 'memory-audio')
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Owners read their own memory files" on storage.objects for select to authenticated
using (
  bucket_id in ('memory-images', 'memory-audio')
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Owners update their own memory files" on storage.objects for update to authenticated
using (
  bucket_id in ('memory-images', 'memory-audio')
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id in ('memory-images', 'memory-audio')
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Owners delete their own memory files" on storage.objects for delete to authenticated
using (
  bucket_id in ('memory-images', 'memory-audio')
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Readers can access media from public collections" on storage.objects for select to anon, authenticated
using (
  (bucket_id = 'memory-images' and exists (
    select 1 from public.pins p
    join public.collections c on c.id = p.collection_id
    where p.image_path = name and c.is_public = true
  ))
  or
  (bucket_id = 'memory-audio' and exists (
    select 1 from public.pins p
    join public.collections c on c.id = p.collection_id
    where p.audio_path = name and c.is_public = true
  ))
);
