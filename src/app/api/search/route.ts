import { NextResponse } from "next/server";
import { geocodeQuerySchema } from "@/lib/validation";

export const revalidate = 60;
const recentRequests = new Map<string, { count: number; startedAt: number }>();

export async function GET(request: Request) {
  const parsed = geocodeQuerySchema.safeParse({
    q: new URL(request.url).searchParams.get("q")
  });
  if (!parsed.success) return NextResponse.json({ results: [] });

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const windowState = recentRequests.get(forwarded);
  if (windowState && now - windowState.startedAt < 60_000 && windowState.count >= 40) {
    return NextResponse.json({ error: "Search limit reached. Try again shortly." }, { status: 429 });
  }
  recentRequests.set(
    forwarded,
    windowState && now - windowState.startedAt < 60_000
      ? { ...windowState, count: windowState.count + 1 }
      : { count: 1, startedAt: now }
  );
  if (recentRequests.size > 5000) {
    for (const [key, state] of recentRequests) {
      if (now - state.startedAt > 60_000) recentRequests.delete(key);
    }
  }

  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", parsed.data.q);
    url.searchParams.set("limit", "6");
    const response = await fetch(url, {
      headers: { "User-Agent": "MapOfMemories/1.0" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) {
      console.error("Geocoder returned a non-success response", response.status);
      return NextResponse.json({ error: "Place search is temporarily unavailable." }, { status: 502 });
    }
    const body = (await response.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: Record<string, string | undefined>;
      }>;
    };
    const results = (body.features ?? []).flatMap((feature) => {
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates || coordinates.length < 2) return [];
      const properties = feature.properties ?? {};
      const name = properties.name;
      const label = [
        name,
        properties.street,
        properties.city ?? properties.town ?? properties.village,
        properties.state,
        properties.country
      ]
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(", ");
      return label
        ? [{ label, lat: coordinates[1], lng: coordinates[0], placeName: label }]
        : [];
    });
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Place search failed", error);
    return NextResponse.json({ error: "Place search is temporarily unavailable." }, { status: 502 });
  }
}
