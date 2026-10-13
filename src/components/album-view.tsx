"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Music2, Pause, Play, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { getEmbed, mediaKind } from "@/lib/media";
import { useUIStore } from "@/store/ui";
import type { AlbumItem } from "@/types/database";

type Props = {
  album: AlbumItem[];
  pinTitle: string;
  onTrackPlay?: () => void;
};

export function AlbumView({ album, pinTitle, onTrackPlay }: Props) {
  const photos = album.filter((item) => item.kind === "image" && item.url);
  const tracks = album.filter((item) => item.kind === "audio" && item.url);
  const volume = useUIStore((state) => state.volume);
  const muted = useUIStore((state) => state.muted);
  const [viewing, setViewing] = useState<number | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [embedId, setEmbedId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const step = useCallback((delta: number) => {
    setViewing((current) => current === null ? null : (current + delta + photos.length) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (viewing === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewing(null);
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewing, step]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  function toggleTrack(track: AlbumItem) {
    if (!track.url) return;
    if (getEmbed(track.url, false)) {
      audioRef.current?.pause();
      setPlayingId(null);
      setEmbedId((current) => current === track.id ? null : track.id);
      return;
    }
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    setEmbedId(null);
    const audio = new Audio(track.url);
    audio.volume = muted ? 0 : volume;
    audio.onended = () => setPlayingId((current) => current === track.id ? null : current);
    audio.onerror = () => setPlayingId((current) => current === track.id ? null : current);
    audioRef.current = audio;
    onTrackPlay?.();
    setPlayingId(track.id);
    void audio.play().catch(() => setPlayingId(null));
  }

  if (!photos.length && !tracks.length) return null;
  const current = viewing === null ? null : photos[viewing];

  return (
    <section className="mt-6" aria-label={`Album for ${pinTitle}`}>
      <h3 className="text-[10px] font-semibold uppercase tracking-[.19em] text-[#8a9382]">Album</h3>
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {photos.map((photo, index) => (
            <button key={photo.id} type="button" aria-label={`Open ${photo.title || `photo ${index + 1}`}`} onClick={() => setViewing(index)} className="relative aspect-square cursor-zoom-in overflow-hidden rounded-xl bg-[#e7e9e1]">
              <img src={photo.url!} alt={photo.title || `Photo ${index + 1} from ${pinTitle}`} loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
            </button>
          ))}
        </div>
      )}
      {tracks.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {tracks.map((track, index) => {
            const embed = track.url ? getEmbed(track.url, false) : null;
            const playing = playingId === track.id;
            return (
              <li key={track.id} className="overflow-hidden rounded-xl bg-[#eef0e9]">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#687d61]"><Music2 size={15} /></span>
                  <span className="min-w-0 flex-1 truncate text-sm text-[#475342]">{track.title || `Track ${index + 1}`}</span>
                  <button type="button" aria-label={`${playing || embedId === track.id ? "Pause" : "Play"} ${track.title || `track ${index + 1}`}`} onClick={() => toggleTrack(track)} className="grid h-8 w-8 place-items-center rounded-full bg-[#53664e] text-white hover:bg-[#42533e]">
                    {playing || embedId === track.id ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                  </button>
                </div>
                {embed && embedId === track.id && mediaKind(track.url) !== "audio" && (
                  <iframe title={track.title || `Track ${index + 1}`} src={getEmbed(track.url!, true)!} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="h-[152px] w-full border-0" />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {typeof document !== "undefined" && createPortal(<AnimatePresence>
        {current && (
          <motion.div key="album-lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .18 }} onClick={() => setViewing(null)} role="dialog" aria-modal="true" aria-label={`Album photos for ${pinTitle}`} className="fixed inset-0 z-[55] grid cursor-zoom-out place-items-center bg-black/85 p-4 md:p-10">
            <button type="button" aria-label="Close photo" onClick={() => setViewing(null)} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[#56624e]"><X size={18} /></button>
            {photos.length > 1 && (
              <>
                <button type="button" aria-label="Previous photo" onClick={(event) => { event.stopPropagation(); step(-1); }} className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#56624e]"><ChevronLeft size={22} /></button>
                <button type="button" aria-label="Next photo" onClick={(event) => { event.stopPropagation(); step(1); }} className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#56624e]"><ChevronRight size={22} /></button>
              </>
            )}
            <figure className="flex max-h-full max-w-full flex-col items-center gap-3" onClick={(event) => event.stopPropagation()}>
              <img src={current.url!} alt={current.title || `Photo from ${pinTitle}`} className="max-h-[80dvh] max-w-full cursor-default rounded-2xl object-contain shadow-2xl" />
              <figcaption className="text-sm text-white/85">{current.title && `${current.title} · `}{(viewing ?? 0) + 1} / {photos.length}</figcaption>
            </figure>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </section>
  );
}
