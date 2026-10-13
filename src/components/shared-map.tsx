"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { MemoryMap } from "@/components/memory-map";
import type { Collection, MemoryPin } from "@/types/database";

type SharedData = { collection: Pick<Collection, "id" | "name" | "color">; pins: MemoryPin[] };

export function SharedMap({ token }: { token: string }) {
  const [selected, setSelected] = useState<MemoryPin | null>(null);
  const query = useQuery({
    queryKey: ["shared-map", token],
    queryFn: async () => {
      const response = await fetch(`/api/share/${encodeURIComponent(token)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load this map.");
      return data as SharedData;
    }
  });
  return (
    <main className="relative h-[100dvh] min-h-[480px] overflow-hidden bg-[#e9ece5]">
      {query.data && (
        <MemoryMap
          pins={query.data.pins}
          themePreference="system"
          selectedPinId={selected?.id ?? null}
          onFocus={setSelected}
          onMapPlace={() => {}}
          onMovePin={() => {}}
          locateSignal={0}
          searchPoint={null}
        />
      )}
      <header className="absolute left-4 top-4 z-20 rounded-2xl bg-white/95 p-4 shadow-card sm:left-6 sm:top-6">
        <Link href="/" className="mb-3 flex items-center gap-1.5 text-xs text-[#687d61]"><ArrowLeft size={14} />Map of Memories</Link>
        <p className="text-[10px] uppercase tracking-[.18em] text-[#92988d]">A collection, shared with you</p>
        <h1 className="mt-1 font-serif text-xl text-[#30372f]">{query.data?.collection.name ?? "Shared map"}</h1>
        <p className="mt-1 text-xs text-[#92988d]">{query.data ? `${query.data.pins.length} saved places` : query.isLoading ? "Loading memories…" : ""}</p>
      </header>
      {selected && (
        <aside className="absolute inset-x-0 bottom-0 z-20 max-h-[65vh] overflow-y-auto rounded-t-[26px] bg-[#fbfbf8] shadow-card md:inset-y-6 md:left-auto md:right-6 md:w-[350px] md:rounded-[24px]">
          {selected.image_url
            ? <div className="relative h-44"><Image src={selected.image_url} alt={`Photo for ${selected.title}`} fill sizes="350px" unoptimized className="object-cover" /></div>
            : <div className="grid h-32 place-items-center bg-[#edf0e8] text-[#809071]"><MapPin /></div>}
          <div className="p-5"><button className="float-right text-[#7d8578]" onClick={() => setSelected(null)} aria-label="Close memory">×</button><h2 className="font-serif text-2xl">{selected.title}</h2>{selected.place_name && <p className="mt-1 text-xs text-[#92978f]">{selected.place_name}</p>}<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#656d62]">{selected.description}</p>{selected.audio_url && <audio controls src={selected.audio_url} className="mt-4 w-full" />}</div>
        </aside>
      )}
      {query.error && <div role="alert" className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 rounded-2xl bg-white p-6 text-center text-sm text-[#8c4439] shadow-card">{query.error.message}</div>}
    </main>
  );
}
