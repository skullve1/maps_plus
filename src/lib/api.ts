import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

export async function signedPinMedia<T extends { image_path?: string | null; audio_path?: string | null }>(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  pins: T[]
) {
  return Promise.all(
    pins.map(async (pin) => {
      const [image, audio] = await Promise.all([
        pin.image_path
          ? supabase.storage.from("memory-images").createSignedUrl(pin.image_path, 60 * 60)
          : Promise.resolve({ data: null }),
        pin.audio_path
          ? supabase.storage.from("memory-audio").createSignedUrl(pin.audio_path, 60 * 60)
          : Promise.resolve({ data: null })
      ]);
      return {
        ...pin,
        image_url: image.data?.signedUrl ?? ("image_external_url" in pin ? pin.image_external_url : null) ?? null,
        ...(pin.audio_path ? { audio_url: audio.data?.signedUrl ?? null } : {})
      };
    })
  );
}
