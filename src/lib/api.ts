import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AlbumItem } from "@/types/database";

export async function requireUser() {
  const supabase = await createClient();
  if (!supabase) {
    return {
      error: NextResponse.json(
        { error: "Cloud features require Supabase configuration." },
        { status: 503 }
      )
    } as const;
  }
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      error: NextResponse.json({ error: "Authentication required." }, { status: 401 })
    } as const;
  }
  return { supabase, user } as const;
}

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export function albumProblem(album: AlbumItem[] | undefined, userId: string) {
  for (const item of album ?? []) {
    if (item.path && !item.path.startsWith(`${userId}/`)) return "Media must belong to your account.";
    if (!item.path && !item.url) return "Every album item needs a file or link.";
    if (!item.path && item.url?.startsWith("data:")) return "Album photos must be uploaded.";
  }
  return null;
}

export function storableAlbum(album: AlbumItem[]) {
  return album.map((item) => ({ ...item, url: item.path ? null : item.url }));
}

async function signedAlbum(supabase: SupabaseClient, album: unknown): Promise<AlbumItem[]> {
  if (!Array.isArray(album)) return [];
  return Promise.all(
    (album as AlbumItem[]).map(async (item) => {
      if (!item.path) return item;
      const { data } = await supabase.storage
        .from(item.kind === "image" ? "memory-images" : "memory-audio")
        .createSignedUrl(item.path, 60 * 60);
      return { ...item, url: data?.signedUrl ?? null };
    })
  );
}

export async function signedPinMedia<T extends { image_path?: string | null; audio_path?: string | null; album?: unknown }>(
  supabase: SupabaseClient,
  pins: T[]
) {
  return Promise.all(
    pins.map(async (pin) => {
      const [image, audio, album] = await Promise.all([
        pin.image_path
          ? supabase.storage.from("memory-images").createSignedUrl(pin.image_path, 60 * 60)
          : Promise.resolve({ data: null }),
        pin.audio_path
          ? supabase.storage.from("memory-audio").createSignedUrl(pin.audio_path, 60 * 60)
          : Promise.resolve({ data: null }),
        signedAlbum(supabase, pin.album)
      ]);
      return {
        ...pin,
        album,
        image_url: image.data?.signedUrl ?? ("image_external_url" in pin ? pin.image_external_url : null) ?? null,
        ...(pin.audio_path ? { audio_url: audio.data?.signedUrl ?? null } : {})
      };
    })
  );
}
