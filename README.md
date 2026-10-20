# Map of Memories

A full-screen, responsive memory map built with Next.js App Router, MapLibre, Supabase, and Howler. Signed-in users can collect places, photos, and music in private collections; the app also opens in a clearly labelled local demo when Supabase has not been configured.

## Run locally

1. Install Node.js 20+ and dependencies: `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and anon key. The service-role key is optional and must never be exposed to browser code.
3. Apply all SQL files in `supabase/migrations/` in timestamp order in the Supabase SQL editor, or run them with the Supabase CLI (`supabase db push`).
4. In Supabase Auth, enable email/password and Google providers. Set the site URL and redirect URL to `http://localhost:3000/auth/callback`.
5. Start the app: `npm run dev`.

Without Supabase variables, the map starts in local demo mode: map interaction, search, sample pins, pin creation/editing, playback controls, and JSON export work locally in browser storage. When Supabase is configured, visiting the map while signed out redirects directly to `/sign-in`; account features and cloud uploads require Supabase.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | For cloud mode | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For cloud mode | Public browser key; RLS protects user data |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional, server only | Reserved for trusted server-side admin tasks; never use in a client component |
| `NEXT_PUBLIC_MAP_STYLE_LIGHT` | No | OpenFreeMap-compatible light style |
| `NEXT_PUBLIC_MAP_STYLE_DARK` | No | OpenFreeMap-compatible dark style |

OpenFreeMap's public styles and Photon geocoding are used by default; both are keyless public services. Use a hosted geocoder and tile provider with your own quota policy for high-volume production deployments.

## Features

- MapLibre vector map with system-aware light/dark styles and a persistent manual map-theme toggle, tilt/zoom/pan/touch, marker clustering, long-press and click-to-create, draggable pins, and browser geolocation.
- Debounced Photon suggestions served through a server route.
- Accessible responsive sidebar and memory detail sheet, collections, filtering, image previews, photo compression, and JSON backup/restore.
- Howler audio with focus-driven crossfade, seek, volume, mute, explicit browser sound-unlock prompt, direct audio URLs, and YouTube/Spotify embeds. Direct audio files/URLs crossfade; provider embeds use their own iframe player controls.
- Email/password authentication, protected route handlers, shared Zod input validation, private Supabase Storage buckets, and Postgres/PostGIS RLS policies. Enable email in Supabase; no OAuth provider is required.
- Public collections use revocable UUID tokens and have a separate read-only shared map route.
- Small shadcn-style Button/Input primitives, Tailwind v4, Framer Motion, Zustand, and TanStack Query.

The search and upload routes include per-process rate limits as a baseline. Multi-instance production deployments should also configure a shared rate-limit provider or edge/WAF limits, since in-memory counters are not distributed across instances.

## Deploy

Deploy to Vercel or any Node 20 host. Set the same environment variables in the hosting environment, apply the migration, and add the deployed `/auth/callback` URL to Supabase Auth redirect allowlists. For Docker, pass the two `NEXT_PUBLIC_SUPABASE_*` values as build arguments because Next.js inlines public environment variables into the client bundle at build time.

`Dockerfile` builds and runs the production app. Keep the Supabase service-role key out of `NEXT_PUBLIC_*` variables and rotate it if it is ever exposed.

## Data and storage notes

Postgres stores pin coordinates both as validated latitude/longitude and as an indexed PostGIS geography point, kept in sync by a trigger. Private image/audio buckets store files under `{auth.uid()}/{random-id}.{ext}`. Upload size/MIME checks run in the application and are also constrained by bucket configuration. Pin reads return short-lived signed media URLs.

JSON exports include pin data and storage paths, not copies of uploaded cloud file bytes. Importing into the same account restores those references; local demo photo data is embedded in its JSON export.

The migration intentionally does not include personal seed pins. Three illustrative pins appear only in the local demo and are not uploaded to an account.
