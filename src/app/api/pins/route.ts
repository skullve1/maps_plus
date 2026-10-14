import { NextResponse } from "next/server";
import { albumProblem, requireUser, signedPinMedia, storableAlbum } from "@/lib/api";
import { pinInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const [pinsResult, publicResult, collectionsResult] = await Promise.all([
    auth.supabase.from("pins").select("*").eq("user_id", auth.user.id).order("created_at", { ascending: false }),
    auth.supabase.from("pins").select("*").eq("is_public", true).neq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(500),
    auth.supabase.from("collections").select("*").order("created_at", { ascending: true })
  ]);
  if (pinsResult.error || collectionsResult.error) {
    console.error("Failed to load memories", pinsResult.error ?? collectionsResult.error);
    return NextResponse.json({ error: "Could not load your memories." }, { status: 500 });
  }
  if (publicResult.error) console.error("Failed to load public memories", publicResult.error);
  const pins = await signedPinMedia(auth.supabase, pinsResult.data ?? []);
  const publicPins = await signedPinMedia(
    auth.supabase,
    (publicResult.data ?? []).map((pin) => ({ ...pin, user_id: undefined, collection_id: null, is_own: false }))
  );
  return NextResponse.json({ pins, publicPins, collections: collectionsResult.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const parsed = pinInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid memory details.", details: parsed.error.flatten() }, { status: 400 });
  }
  if (
    (parsed.data.image_path && !parsed.data.image_path.startsWith(`${auth.user.id}/`)) ||
    (parsed.data.audio_path && !parsed.data.audio_path.startsWith(`${auth.user.id}/`))
  ) {
    return NextResponse.json({ error: "Media must belong to your account." }, { status: 400 });
  }
  const problem = albumProblem(parsed.data.album, auth.user.id);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const { data, error } = await auth.supabase
    .from("pins")
    .insert({ ...parsed.data, album: storableAlbum(parsed.data.album), user_id: auth.user.id })
    .select("*")
    .single();
  if (error) {
    console.error("Failed to create memory", error);
    return NextResponse.json({ error: "Could not save this memory." }, { status: 400 });
  }
  const [pin] = await signedPinMedia(auth.supabase, [data]);
  return NextResponse.json({ pin }, { status: 201 });
}
