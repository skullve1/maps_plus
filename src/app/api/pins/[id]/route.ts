import { NextResponse } from "next/server";
import { albumProblem, requireUser, signedPinMedia, storableAlbum } from "@/lib/api";
import { pinInputSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = pinInputSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success || !id) {
    return NextResponse.json({ error: "Invalid memory details." }, { status: 400 });
  }
  if (
    (parsed.data.image_path && !parsed.data.image_path.startsWith(`${auth.user.id}/`)) ||
    (parsed.data.audio_path && !parsed.data.audio_path.startsWith(`${auth.user.id}/`))
  ) {
    return NextResponse.json({ error: "Media must belong to your account." }, { status: 400 });
  }
  const problem = albumProblem(parsed.data.album, auth.user.id);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const update = parsed.data.album ? { ...parsed.data, album: storableAlbum(parsed.data.album) } : parsed.data;
  const { data, error } = await auth.supabase
    .from("pins")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("Failed to update memory", error);
    return NextResponse.json({ error: "Could not update this memory." }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: "Memory not found." }, { status: 404 });
  const [pin] = await signedPinMedia(auth.supabase, [data]);
  return NextResponse.json({ pin });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase
    .from("pins")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Failed to delete memory", error);
    return NextResponse.json({ error: "Could not delete this memory." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Memory not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
