import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";

export const runtime = "nodejs";
const limits = {
  image: { maxBytes: 8 * 1024 * 1024, mimeTypes: new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]), bucket: "memory-images" },
  audio: { maxBytes: 20 * 1024 * 1024, mimeTypes: new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/flac"]), bucket: "memory-audio" }
} as const;
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/flac": "flac"
};
const recentUploads = new Map<string, { count: number; startedAt: number }>();

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 22 * 1024 * 1024) {
    return NextResponse.json({ error: "The upload request is too large." }, { status: 413 });
  }
  const now = Date.now();
  const activity = recentUploads.get(auth.user.id);
  if (activity && now - activity.startedAt < 60 * 60_000 && activity.count >= 30) {
    return NextResponse.json({ error: "Upload limit reached. Try again later." }, { status: 429 });
  }
  recentUploads.set(
    auth.user.id,
    activity && now - activity.startedAt < 60 * 60_000
      ? { ...activity, count: activity.count + 1 }
      : { count: 1, startedAt: now }
  );
  if (recentUploads.size > 5000) {
    for (const [userId, state] of recentUploads) {
      if (now - state.startedAt > 60 * 60_000) recentUploads.delete(userId);
    }
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  if (!(file instanceof File) || (kind !== "image" && kind !== "audio")) {
    return NextResponse.json({ error: "Choose an image or audio file to upload." }, { status: 400 });
  }
  const policy = limits[kind];
  if (file.size === 0 || file.size > policy.maxBytes || !policy.mimeTypes.has(file.type)) {
    return NextResponse.json(
      { error: kind === "image" ? "Images must be JPG, PNG, WebP, or GIF and under 8 MB." : "Audio must be MP3, WAV, OGG, M4A, AAC, or FLAC and under 20 MB." },
      { status: 400 }
    );
  }
  const path = `${auth.user.id}/${randomUUID()}.${extensions[file.type]}`;
  const { error } = await auth.supabase.storage.from(policy.bucket).upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false
  });
  if (error) {
    console.error("Media upload failed", error);
    return NextResponse.json({ error: "Could not upload this file." }, { status: 500 });
  }
  const { data, error: signingError } = await auth.supabase.storage
    .from(policy.bucket)
    .createSignedUrl(path, 60 * 60);
  if (signingError || !data) {
    console.error("Could not sign uploaded media", signingError);
    return NextResponse.json({ error: "Uploaded file could not be prepared." }, { status: 500 });
  }
  return NextResponse.json({ path, signedUrl: data.signedUrl });
}
