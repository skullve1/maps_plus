import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("is_public" in body) || typeof body.is_public !== "boolean") {
    return NextResponse.json({ error: "Expected a public visibility setting." }, { status: 400 });
  }
  const isPublic = body.is_public;
  const { data, error } = await auth.supabase
    .from("collections")
    .update({
      is_public: isPublic,
      share_token: isPublic ? randomUUID() : null
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("Failed to update collection visibility", error);
    return NextResponse.json({ error: "Could not update collection visibility." }, { status: error ? 500 : 404 });
  }
  return NextResponse.json({ collection: data });
}
