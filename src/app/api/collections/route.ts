import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { collectionInputSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase.from("collections").select("*").order("created_at");
  if (error) {
    console.error("Failed to load collections", error);
    return NextResponse.json({ error: "Could not load collections." }, { status: 500 });
  }
  return NextResponse.json({ collections: data });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = collectionInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid collection details." }, { status: 400 });
  }
  const { data, error } = await auth.supabase
    .from("collections")
    .insert({ ...parsed.data, user_id: auth.user.id })
    .select("*")
    .single();
  if (error) {
    console.error("Failed to create collection", error);
    return NextResponse.json({ error: "Could not create collection." }, { status: 400 });
  }
  return NextResponse.json({ collection: data }, { status: 201 });
}
