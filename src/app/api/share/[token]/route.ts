import { NextResponse } from "next/server";
import { signedPinMedia } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Shared maps are unavailable." }, { status: 503 });
  const { data: collection, error: collectionError } = await supabase
    .from("collections")
    .select("id, name, color")
    .eq("share_token", token)
    .eq("is_public", true)
    .maybeSingle();
  if (collectionError) {
    console.error("Could not load shared collection", collectionError);
    return NextResponse.json({ error: "Could not load this shared map." }, { status: 500 });
  }
  if (!collection) return NextResponse.json({ error: "This share link is no longer available." }, { status: 404 });
  const { data: rawPins, error } = await supabase
    .from("pins")
    .select("*")
    .eq("collection_id", collection.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Could not load shared memories", error);
    return NextResponse.json({ error: "Could not load this shared map." }, { status: 500 });
  }
  const pins = await signedPinMedia(supabase, rawPins ?? []);
  return NextResponse.json({ collection, pins });
}
