"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Howl, Howler } from "howler";
import Image from "next/image";
import {
  ArrowDownToLine, AudioLines, Check, ChevronDown, ChevronRight, CircleHelp,
  Compass, Disc3, FolderPlus, Headphones, ImagePlus, LocateFixed, Map as MapIcon,
  MapPin, Menu, Music2, Pause, Pencil, Play, Plus, Search, Settings2, Share2,
  SlidersHorizontal, Trash2, Volume2, VolumeX, X, Moon, Sun
} from "lucide-react";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { MemoryMap } from "@/components/memory-map";
import { createClient } from "@/lib/supabase/client";
import { demoCollections, demoPins } from "@/lib/demo";
import { downloadPins } from "@/lib/export";
import { useUIStore } from "@/store/ui";
import { collectionInputSchema, pinInputSchema } from "@/lib/validation";
import type { Collection, MemoryPin, PinInput } from "@/types/database";

type Point = { lat: number; lng: number };
type SearchResult = Point & { label: string; placeName: string };
type Dataset = { pins: MemoryPin[]; collections: Collection[] };
type Draft = PinInput;

const initialDraft = (point: Point, placeName: string | null = null): Draft => ({
  title: placeName?.split(",")[0] ?? "",
  description: "",
  place_name: placeName,
  lat: point.lat,
  lng: point.lng,
  color: "#d8795b",
  collection_id: null,
  image_path: null,
  image_external_url: null,
  audio_path: null,
  audio_url: null
});
const palette = ["#d8795b", "#e5a94d", "#829071", "#536f82", "#9b7896", "#ce6d7c", "#4d8792", "#434b45"];
const storeKey = "map-of-memories-demo-v1";
const emptyPins: MemoryPin[] = [];
const emptyCollections: Collection[] = [];
const cloudEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function mediaKind(url: string | null | undefined) {
  if (!url) return "none";
  if (/youtu\.be|youtube\.com/i.test(url)) {
    const id = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/)?.[1];
    return id ? `youtube:${id}` : "none";
  }
  if (/spotify\.com/i.test(url)) {
    const match = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/);
    return match ? `spotify:${match[1]}/${match[2]}` : "none";
  }
  return /^https?:\/\//i.test(url) ? "audio" : "none";
}

function compressPhoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const ratio = Math.min(1, 1600 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * ratio);
      canvas.height = Math.round(image.height * ratio);
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Your browser could not process this photo."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not compress this photo.")), "image/jpeg", 0.84);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read this photo."));
    };
    image.src = objectUrl;
  });
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data as T;
}

function getEmbed(url: string, autoplay: boolean) {
  const kind = mediaKind(url);
  if (kind.startsWith("youtube:")) return `https://www.youtube-nocookie.com/embed/${kind.slice(8)}?autoplay=${autoplay ? 1 : 0}&rel=0`;
  if (kind.startsWith("spotify:")) return `https://open.spotify.com/embed/${kind.slice(8)}?utm_source=generator`;
  return null;
}

export function MapWorkspace() {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const query = useQuery<Dataset>({
    queryKey: ["memories"],
    queryFn: () => requestJson<Dataset>("/api/pins"),
    enabled: cloudEnabled
  });
  const demoQuery = useQuery<Dataset>({
    queryKey: ["memories"],
    queryFn: async () => ({ pins: demoPins, collections: demoCollections }),
    enabled: !cloudEnabled,
    initialData: !cloudEnabled ? { pins: demoPins, collections: demoCollections } : undefined
  });
  const dataset = cloudEnabled ? query.data : demoQuery.data;
  const pins = dataset?.pins ?? emptyPins;
  const collections = dataset?.collections ?? emptyCollections;
  const selectedPinId = useUIStore((state) => state.selectedPinId);
  const setSelectedPinId = useUIStore((state) => state.setSelectedPinId);
  const mapTheme = useUIStore((state) => state.mapTheme);
  const setMapTheme = useUIStore((state) => state.setMapTheme);
  const autoplay = useUIStore((state) => state.autoplay);
  const setAutoplay = useUIStore((state) => state.setAutoplay);
  const volume = useUIStore((state) => state.volume);
  const setVolume = useUIStore((state) => state.setVolume);
  const muted = useUIStore((state) => state.muted);
  const setMuted = useUIStore((state) => state.setMuted);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searchPoint, setSearchPoint] = useState<(Point & { nonce: number }) | null>(null);
  const [locateSignal, setLocateSignal] = useState(0);
  const [activeCollection, setActiveCollection] = useState<string>("all");
  const [hiddenCollections, setHiddenCollections] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editor, setEditor] = useState<{ draft: Draft; id: string | null } | null>(null);
  const [toast, setToast] = useState("");
  const [toastError, setToastError] = useState(false);
  const [uploading, setUploading] = useState<"image" | "audio" | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [duration, setDuration] = useState(0);
  const [needsSound, setNeedsSound] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [publicLink, setPublicLink] = useState("");
  const [demoHydrated, setDemoHydrated] = useState(false);
  const [systemDark, setSystemDark] = useState(false);
  const selectedSearchResult = useRef(false);
  const fileImageRef = useRef<HTMLInputElement>(null);
  const fileAudioRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<Howl | null>(null);
  const playheadTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedPin = pins.find((pin) => pin.id === selectedPinId) ?? null;
  const effectiveDark = mapTheme === "dark" || (mapTheme === "system" && systemDark);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const showToast = useCallback((message: string, error = false) => {
    setToast(message);
    setToastError(error);
    window.setTimeout(() => setToast(""), 3600);
  }, []);

  useEffect(() => {
    if (cloudEnabled) return;
    const saved = localStorage.getItem(storeKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Dataset;
        if (Array.isArray(parsed.pins) && Array.isArray(parsed.collections)) {
          queryClient.setQueryData(["memories"], parsed);
        }
      } catch (error) {
        console.error("Could not read local demo memories", error);
        // This is a browser-only hydration path after the first client render.
        showToast("Local memories could not be loaded.", true);
      }
    }
    // This flag prevents the demo defaults from overwriting saved browser data.
    setDemoHydrated(true);
  }, [queryClient, showToast]);

  useEffect(() => {
    if (!cloudEnabled && demoHydrated && dataset) {
      try {
        localStorage.setItem(storeKey, JSON.stringify(dataset));
      } catch (error) {
        console.error("Could not save local demo memories", error);
        // Surface quota errors from the browser storage write.
        showToast("Browser storage is full. Export your memories for backup.", true);
      }
    }
  }, [dataset, demoHydrated, showToast]);

  useEffect(() => {
    if (selectedSearchResult.current) {
      selectedSearchResult.current = false;
      return;
    }
    if (search.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSearchError("");
        const response = await fetch(`/api/search?q=${encodeURIComponent(search.trim())}`, {
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Place search is unavailable.");
        setSuggestions(data.results ?? []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchError(error instanceof Error ? error.message : "Place search is unavailable.");
        setSuggestions([]);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  useEffect(() => {
    const listener = (event: Event) => showToast((event as CustomEvent<string>).detail, true);
    window.addEventListener("memory-toast", listener);
    return () => window.removeEventListener("memory-toast", listener);
  }, [showToast]);

  const visiblePins = useMemo(() => pins.filter((pin) => {
    const collectionVisible = activeCollection === "all" || pin.collection_id === activeCollection;
    const notHidden = !pin.collection_id || !hiddenCollections.has(pin.collection_id);
    const matchesSearch = `${pin.title} ${pin.place_name ?? ""}`.toLowerCase().includes(filter.toLowerCase());
    return collectionVisible && notHidden && matchesSearch;
  }), [pins, activeCollection, hiddenCollections, filter]);

  const setDataset = useCallback((next: Dataset | ((current: Dataset) => Dataset)) => {
    queryClient.setQueryData<Dataset>(["memories"], (previous) => {
      const current = previous ?? { pins: demoPins, collections: demoCollections };
      return typeof next === "function" ? next(current) : next;
    });
  }, [queryClient]);

  const focusPin = useCallback((pin: MemoryPin) => {
    setSelectedPinId(pin.id);
    setSidebarOpen(false);
    setSearch("");
    setSuggestions([]);
  }, [setSelectedPinId]);

  const addAtPoint = useCallback((point: Point, placeName: string | null = null) => {
    setSelectedPinId(null);
    setImagePreview(null);
    setEditor({ draft: initialDraft(point, placeName), id: null });
  }, [setSelectedPinId]);

  const saveMutation = useMutation({
    mutationFn: async ({ input, id }: { input: Draft; id: string | null }) => {
      if (!cloudEnabled) {
        const now = new Date().toISOString();
        const pin: MemoryPin = {
          ...input,
          id: id ?? crypto.randomUUID(),
          image_url: input.image_external_url ?? null,
          created_at: id ? pins.find((item) => item.id === id)?.created_at ?? now : now,
          updated_at: now
        };
        return { pin, local: true };
      }
      const data = await requestJson<{ pin: MemoryPin }>(id ? `/api/pins/${id}` : "/api/pins", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(input)
      });
      return { ...data, local: false };
    },
    onMutate: async ({ input, id }) => {
      if (!id) return undefined;
      await queryClient.cancelQueries({ queryKey: ["memories"] });
      const previous = queryClient.getQueryData<Dataset>(["memories"]);
      if (previous) {
        setDataset((current) => ({
          ...current,
          pins: current.pins.map((pin) => pin.id === id
            ? { ...pin, ...input, image_url: input.image_external_url ?? pin.image_url }
            : pin)
        }));
      }
      return { previous };
    },
    onSuccess: ({ pin }, variables) => {
      setDataset((current) => ({
        ...current,
        pins: variables.id
          ? current.pins.map((item) => item.id === pin.id ? pin : item)
          : [pin, ...current.pins]
      }));
      setEditor(null);
      setImagePreview(null);
      setSelectedPinId(pin.id);
      showToast(variables.id ? "Memory updated" : "Memory saved");
    },
    onError: (error, _variables, context) => {
      if (context?.previous) setDataset(context.previous);
      showToast(error.message, true);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!cloudEnabled) return { id };
      await requestJson(`/api/pins/${id}`, { method: "DELETE" });
      return { id };
    },
    onSuccess: ({ id }) => {
      setDataset((current) => ({ ...current, pins: current.pins.filter((pin) => pin.id !== id) }));
      setSelectedPinId(null);
      showToast("Memory deleted");
    },
    onError: (error) => showToast(error.message, true)
  });

  const collectionMutation = useMutation({
    mutationFn: async (name: string) => {
      const parsed = collectionInputSchema.safeParse({ name, color: "#687d61" });
      if (!parsed.success) throw new Error("Collection names must be 1–60 characters.");
      if (!cloudEnabled) {
        return { collection: { id: crypto.randomUUID(), ...parsed.data, is_public: false, share_token: null, created_at: new Date().toISOString() } };
      }
      return requestJson<{ collection: Collection }>("/api/collections", { method: "POST", body: JSON.stringify(parsed.data) });
    },
    onSuccess: ({ collection }) => {
      setDataset((current) => ({ ...current, collections: [...current.collections, collection] }));
      setActiveCollection(collection.id);
      showToast("Collection created");
    },
    onError: (error) => showToast(error.message, true)
  });

  useEffect(() => {
    const previous = playerRef.current;
    if (previous) {
      const oldVolume = previous.volume();
      previous.fade(oldVolume, 0, 700);
      window.setTimeout(() => {
        if (playerRef.current !== previous) previous.unload();
      }, 750);
      playerRef.current = null;
    }
    if (playheadTimer.current) clearInterval(playheadTimer.current);
    // Reset player UI when replacing the externally managed Howler instance.
    setIsPlaying(false);
    setPlayhead(0);
    setDuration(0);
    setNeedsSound(false);
    const mediaUrl = selectedPin?.audio_url;
    if (!mediaUrl || mediaKind(mediaUrl) !== "audio") return;

    const next = new Howl({
      src: [mediaUrl],
      html5: true,
      volume: muted ? 0 : 0,
      onload: () => {
        if (playerRef.current !== next) return;
        setDuration(next.duration());
        if (!autoplay) return;
        next.fade(0, muted ? 0 : volume, 1000);
        next.play();
      },
      onplay: () => {
        if (playerRef.current !== next) return;
        setIsPlaying(true);
        setNeedsSound(false);
        playheadTimer.current = setInterval(() => {
          const position = next.seek();
          if (typeof position === "number") setPlayhead(position);
        }, 500);
      },
      onplayerror: () => {
        setNeedsSound(true);
        setIsPlaying(false);
      },
      onend: () => setIsPlaying(false),
      onloaderror: (_id, error) => {
        console.error("Audio could not be loaded", error);
        showToast("This audio could not be played. Check the link or file type.", true);
      }
    });
    playerRef.current = next;
    next.load();
    return () => {
      if (playheadTimer.current) clearInterval(playheadTimer.current);
    };
  // The player is intentionally replaced whenever its focused pin changes.
  }, [selectedPin?.id, selectedPin?.audio_url, autoplay]);

  useEffect(() => {
    playerRef.current?.volume(muted ? 0 : volume);
  }, [volume, muted]);

  async function enableSound() {
    try {
      await Howler.ctx?.resume();
      const sound = playerRef.current;
      if (sound) {
        sound.volume(0);
        sound.play();
        sound.fade(0, muted ? 0 : volume, 900);
      }
      setNeedsSound(false);
    } catch (error) {
      console.error("Could not enable audio", error);
      showToast("Sound is still blocked by the browser. Try the play button.", true);
    }
  }

  function chooseSearchResult(result: SearchResult, create: boolean) {
    selectedSearchResult.current = search !== result.label;
    setSearch(result.label);
    setSuggestions([]);
    setSearchPoint({ lat: result.lat, lng: result.lng, nonce: Date.now() });
    if (create) addAtPoint({ lat: result.lat, lng: result.lng }, result.placeName);
  }

  async function upload(kind: "image" | "audio", file: File) {
    if (!cloudEnabled) {
      if (kind === "image") {
        const compressed = await compressPhoto(file);
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read this photo."));
          reader.readAsDataURL(compressed);
        });
        setEditor((current) => current ? { ...current, draft: { ...current.draft, image_external_url: dataUrl, image_path: null } } : current);
        setImagePreview(dataUrl);
      } else {
        throw new Error("Audio uploads need a connected Supabase account. You can paste a direct audio link instead.");
      }
      return;
    }
    setUploading(kind);
    try {
      const body = new FormData();
      body.append("kind", kind);
      body.append("file", kind === "image" ? await compressPhoto(file) : file, file.name);
      const response = await fetch("/api/upload", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Upload failed.");
      if (kind === "image") {
        setEditor((current) => current ? { ...current, draft: { ...current.draft, image_path: data.path, image_external_url: null } } : current);
        setImagePreview(data.signedUrl);
      } else {
        setEditor((current) => current ? { ...current, draft: { ...current.draft, audio_path: data.path, audio_url: null } } : current);
      }
      showToast(kind === "image" ? "Photo uploaded" : "Track uploaded");
    } finally {
      setUploading(null);
    }
  }

  function handleFile(kind: "image" | "audio", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void upload(kind, file).catch((error: unknown) => {
      setUploading(null);
      showToast(error instanceof Error ? error.message : "Upload failed.", true);
    });
  }

  function beginEdit(pin: MemoryPin) {
    setImagePreview(pin.image_url);
    setEditor({
      id: pin.id,
      draft: {
        title: pin.title,
        description: pin.description,
        place_name: pin.place_name,
        lat: pin.lat,
        lng: pin.lng,
        color: pin.color,
        collection_id: pin.collection_id,
        image_path: pin.image_path,
        image_external_url: pin.image_external_url ?? (pin.image_path ? null : pin.image_url),
        audio_path: pin.audio_path,
        audio_url: pin.audio_path ? null : pin.audio_url
      }
    });
  }

  function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const localPhoto = !cloudEnabled && editor.draft.image_external_url?.startsWith("data:image/")
      ? editor.draft.image_external_url
      : null;
    const parsed = pinInputSchema.safeParse({
      ...editor.draft,
      image_external_url: localPhoto ? null : editor.draft.image_external_url
    });
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message ?? "Check the memory details.", true);
      return;
    }
    saveMutation.mutate({
      input: { ...parsed.data, ...(localPhoto ? { image_external_url: localPhoto } : {}) },
      id: editor.id
    });
  }

  function movePin(pin: MemoryPin, point: Point) {
    saveMutation.mutate({
      id: pin.id,
      input: { ...pin, lat: point.lat, lng: point.lng, image_external_url: pin.image_external_url ?? null, audio_url: pin.audio_path ? null : pin.audio_url }
    });
  }

  async function createCollection() {
    const name = window.prompt("Name your collection");
    if (name?.trim()) collectionMutation.mutate(name.trim());
  }

  async function toggleCollectionShare(collection: Collection) {
    if (!cloudEnabled) {
      showToast("Sharing requires a connected Supabase account.", true);
      return;
    }
    if (collection.is_public && collection.share_token) {
      const link = `${location.origin}/share/${collection.share_token}`;
      setPublicLink(link);
      try {
        await navigator.clipboard.writeText(link);
        showToast("Share link copied");
      } catch (error) {
        console.error("Clipboard copy failed", error);
        showToast("The share link is shown in your collection list.");
      }
      return;
    }
    try {
      const result = await requestJson<{ collection: Collection }>(`/api/collections/${collection.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_public: true })
      });
      setDataset((current) => ({ ...current, collections: current.collections.map((item) => item.id === collection.id ? result.collection : item) }));
      const link = `${location.origin}/share/${result.collection.share_token}`;
      setPublicLink(result.collection.is_public ? link : "");
      try {
        await navigator.clipboard.writeText(link);
        showToast("Share link copied");
      } catch (error) {
        console.error("Clipboard copy failed", error);
        showToast("Collection is public. Copy the link shown in your collection list.");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update sharing.", true);
    }
  }

  async function makeCollectionPrivate(collection: Collection) {
    try {
      const result = await requestJson<{ collection: Collection }>(`/api/collections/${collection.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_public: false })
      });
      setDataset((current) => ({
        ...current,
        collections: current.collections.map((item) => item.id === collection.id ? result.collection : item)
      }));
      setPublicLink("");
      showToast("Collection is private");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not make the collection private.", true);
    }
  }

  function exportData() {
    downloadPins(pins);
    showToast("Backup downloaded");
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error("Backup files must be smaller than 25 MB.");
      const payload = JSON.parse(await file.text()) as { format?: string; pins?: unknown[] };
      if (payload.format !== "map-of-memories" || !Array.isArray(payload.pins)) throw new Error("This file is not a Map of Memories backup.");
      const valid = payload.pins.flatMap((value) => {
        const externalImage = value && typeof value === "object" && "image_external_url" in value
          ? value.image_external_url
          : null;
        const isLocalImage = !cloudEnabled
          && typeof externalImage === "string"
          && externalImage.length <= 10_000_000
          && /^data:image\/(?:jpeg|png|webp|gif);base64,/.test(externalImage);
        const input = isLocalImage && value && typeof value === "object"
          ? { ...value, image_external_url: null }
          : value;
        const parsed = pinInputSchema.safeParse(input);
        return parsed.success
          ? [{ data: parsed.data, localImageData: isLocalImage && typeof externalImage === "string" ? externalImage : null }]
          : [];
      });
      if (!valid.length) throw new Error("No valid memories were found in that backup.");
      if (cloudEnabled) {
        if (!supabase) throw new Error("Supabase is not configured.");
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) throw new Error("Sign in to import memories.");
        for (const result of valid) {
          const draft = result.data;
          const ownedPath = (path: string | null) => path?.startsWith(`${authData.user.id}/`) ? path : null;
          const normalized: Draft = {
            ...draft,
            image_path: ownedPath(draft.image_path),
            audio_path: ownedPath(draft.audio_path),
            image_external_url: draft.image_external_url ?? null
          };
          const saved = await requestJson<{ pin: MemoryPin }>("/api/pins", { method: "POST", body: JSON.stringify(normalized) });
          setDataset((current) => ({ ...current, pins: [saved.pin, ...current.pins] }));
        }
      } else {
        const imported = valid.map((result) => ({
          ...result.data,
          image_path: null,
          audio_path: null,
          image_external_url: result.localImageData ?? result.data.image_external_url,
          id: crypto.randomUUID(),
          image_url: result.data.image_external_url ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } satisfies MemoryPin));
        setDataset((current) => ({ ...current, pins: [...imported, ...current.pins] }));
      }
      showToast(`Imported ${valid.length} memories`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not import that backup.", true);
    }
  }

  function playPause() {
    const player = playerRef.current;
    const url = selectedPin?.audio_url;
    if (!player && url && mediaKind(url) === "audio") {
      setNeedsSound(true);
      return;
    }
    if (!player) return;
    if (player.playing()) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.volume(0);
      player.play();
      player.fade(0, muted ? 0 : volume, 700);
      setIsPlaying(true);
    }
  }

  const signedOut = cloudEnabled && query.error instanceof Error && query.error.message.includes("Authentication");

  return (
    <main className="relative h-[100dvh] min-h-[520px] overflow-hidden bg-[#e9ece5] text-ink">
      <div className="absolute inset-0">
        <MemoryMap
          pins={visiblePins}
            themePreference={mapTheme}
          selectedPinId={selectedPinId}
          onFocus={focusPin}
          onMapPlace={(point) => addAtPoint(point)}
          onMovePin={movePin}
          locateSignal={locateSignal}
          searchPoint={searchPoint}
        />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3 sm:p-5">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-white/95 px-3 py-2.5 shadow-card backdrop-blur sm:px-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef1e9] text-[#53664e]"><MapPin size={20} fill="currentColor" /></span>
          <span className="hidden sm:block"><span className="block font-serif text-base font-semibold leading-5">memory map</span><span className="text-[10px] uppercase tracking-[.18em] text-[#90958c]">keep a place close</span></span>
          <button className="ml-1 grid h-9 w-9 place-items-center rounded-xl text-[#647160] hover:bg-[#f1f3ee] md:hidden" aria-label="Open memory list" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
        </div>

        <div className="pointer-events-auto absolute left-3 top-[76px] w-[calc(100%-24px)] sm:max-md:top-[76px] sm:max-md:w-[calc(100%-24px)] md:left-[calc(50%+84px)] md:top-5 md:w-[min(460px,calc(100vw-530px))] md:-translate-x-1/2">
          <div className="relative">
            <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-black/[.03]">
              <Search size={18} className="shrink-0 text-[#7c8478]" />
              <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setSuggestions([]); if (event.key === "Enter" && suggestions[0]) chooseSearchResult(suggestions[0], true); }} placeholder="Search a place or address" aria-label="Search for a place" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#a3a69f]" />
              {search && <button onClick={() => { setSearch(""); setSuggestions([]); }} aria-label="Clear search" className="text-[#92978e]"><X size={16} /></button>}
            </div>
            {search.trim().length >= 2 && (suggestions.length > 0 || searchError) && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-2xl bg-white p-1.5 shadow-card">
                {searchError && <p className="px-3 py-2 text-sm text-[#a44c3e]" role="alert">{searchError}</p>}
                {suggestions.map((result, index) => (
                  <button key={`${result.label}-${index}`} onClick={() => chooseSearchResult(result, true)} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#f3f4ef]">
                    <MapPin className="mt-0.5 shrink-0 text-[#819071]" size={17} /><span className="text-sm">{result.label}<span className="mt-0.5 block text-xs text-[#9a9d96]">Jump to place and drop a memory</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pointer-events-auto flex gap-2">
          <button
            onClick={() => setMapTheme(effectiveDark ? "light" : "dark")}
            aria-label={`Switch to ${effectiveDark ? "light" : "dark"} map`}
            title={`Switch to ${effectiveDark ? "light" : "dark"} map`}
            className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#53664e] shadow-card transition hover:-translate-y-0.5"
          >
            {effectiveDark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button onClick={() => setLocateSignal((value) => value + 1)} aria-label="Locate me" title="Locate me" className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#53664e] shadow-card transition hover:-translate-y-0.5"><LocateFixed size={19} /></button>
          <button onClick={() => setSidebarOpen(true)} aria-label="Browse memories" title="Browse memories" className="hidden h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-medium text-[#53664e] shadow-card transition hover:-translate-y-0.5 sm:flex"><MapIcon size={17} /><span>{pins.length}</span></button>
        </div>
      </header>

      <button onClick={() => addAtPoint({ lat: 48.8584, lng: 2.3656 })} className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#53664e] px-5 py-3 text-sm font-semibold text-white shadow-card transition hover:-translate-y-1 hover:bg-[#42533e] sm:bottom-8">
        <Plus size={18} /> Add a memory
      </button>
      <div className="absolute bottom-8 left-4 z-10 hidden items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-xs text-[#6e7669] shadow-sm backdrop-blur sm:flex">
        <span className="h-2 w-2 rounded-full bg-[#829071]" /> {pins.length} {pins.length === 1 ? "memory" : "memories"} on your map
      </div>

      {cloudEnabled && !signedOut && query.isLoading && (
        <div className="absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm text-[#687d61] shadow-card">Loading your memories…</div>
      )}
      {signedOut && (
        <div className="absolute left-1/2 top-24 z-20 flex -translate-x-1/2 items-center gap-4 rounded-2xl bg-white px-5 py-3 shadow-card">
          <span className="text-sm text-[#53664e]">Sign in to open your personal map.</span>
          <a className="rounded-xl bg-[#53664e] px-4 py-2 text-sm font-semibold text-white" href="/sign-in">Sign in</a>
        </div>
      )}
      {!cloudEnabled && <div className="absolute right-4 top-[76px] z-10 hidden rounded-full bg-white/90 px-3 py-1.5 text-[11px] text-[#757b71] shadow-sm sm:block">Local demo · saved in this browser</div>}

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.button aria-label="Close memory list" className="fixed inset-0 z-30 bg-[#20251f]/25" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} />
            <motion.aside initial={{ x: -390 }} animate={{ x: 0 }} exit={{ x: -390 }} transition={{ type: "spring", damping: 28, stiffness: 260 }} className="fixed inset-y-0 left-0 z-40 flex w-[min(370px,92vw)] flex-col bg-[#fbfbf8] shadow-card">
              <div className="flex items-center justify-between border-b border-[#eceee8] px-5 py-5">
                <div><p className="text-xs uppercase tracking-[.16em] text-[#899184]">Your atlas</p><h2 className="mt-1 font-serif text-2xl">Saved places <span className="font-sans text-sm text-[#9da198]">{pins.length}</span></h2></div>
                <button onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" className="rounded-xl p-2 text-[#73806e] hover:bg-[#eef0e9]"><X size={20} /></button>
              </div>
              <div className="space-y-4 px-4 pt-4">
                <div className="flex items-center gap-2 rounded-xl border border-[#e5e7e0] bg-white px-3 py-2.5"><Search size={16} className="text-[#9ca197]" /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter memories" aria-label="Filter memories" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /><SlidersHorizontal size={15} className="text-[#a0a49c]" /></div>
                <div className="flex items-center justify-between gap-2">
                  <select aria-label="Filter by collection" value={activeCollection} onChange={(event) => setActiveCollection(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#e5e7e0] bg-white px-3 py-2.5 text-sm text-[#596253]">
                    <option value="all">All collections</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
                  </select>
                  <button onClick={createCollection} title="Create collection" aria-label="Create collection" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf0e8] text-[#53664e] hover:bg-[#e3e8dc]"><FolderPlus size={18} /></button>
                </div>
                {collections.length > 0 && <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {collections.map((collection) => <button key={collection.id} onClick={() => setHiddenCollections((current) => { const next = new Set(current); if (next.has(collection.id)) next.delete(collection.id); else next.add(collection.id); return next; })} className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${hiddenCollections.has(collection.id) ? "border-[#e6e8e2] text-[#a6aaa1]" : "border-[#e0e5db] bg-white text-[#64705e]"}`}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: collection.color }} />{collection.name}</button>)}
                </div>}
              </div>
              <div className="no-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-3">
                {visiblePins.length === 0 ? (
                  <div className="px-5 py-14 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#edf0e8] text-[#829071]"><Compass /></span><p className="mt-4 font-serif text-lg">A little room for a memory</p><p className="mt-1 text-sm text-[#93998f]">Click on the map to save a place.</p></div>
                ) : visiblePins.map((pin) => (
                  <button key={pin.id} onClick={() => focusPin(pin)} className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-white ${selectedPinId === pin.id ? "bg-white shadow-sm ring-1 ring-[#e9ebe5]" : ""}`}>
                    <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl" style={{ background: `${pin.color}24`, color: pin.color }}>
                      {pin.image_url ? <Image className="object-cover" src={pin.image_url} alt="" fill sizes="48px" unoptimized /> : <MapPin size={20} fill="currentColor" />}
                    </span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#333a31]">{pin.title}</span><span className="mt-1 block truncate text-xs text-[#91968d]">{pin.place_name ?? `${pin.lat.toFixed(3)}, ${pin.lng.toFixed(3)}`}</span></span>
                    {pin.audio_url && <Music2 size={15} className="shrink-0 text-[#85917c]" />}
                    <ChevronRight size={16} className="shrink-0 text-[#b4b8b0]" />
                  </button>
                ))}
              </div>
              <div className="space-y-3 border-t border-[#eceee8] p-4">
                {collections.map((collection) => <div key={`share-${collection.id}`} className="flex items-center gap-2 text-xs">
                  <button onClick={() => void toggleCollectionShare(collection)} className="flex min-w-0 items-center gap-2 text-left text-[#737b6e] hover:text-[#53664e]"><Share2 size={14} />{collection.is_public ? "Copy link" : "Share"} · {collection.name}</button>
                  <span className="ml-auto text-[#9a9f96]">{collection.is_public ? "Public" : "Private"}</span>
                  {collection.is_public && <button onClick={() => void makeCollectionPrivate(collection)} className="text-[#8b6056] hover:underline">Make private</button>}
                </div>)}
                        {publicLink && <div className="flex items-center gap-2 rounded-xl bg-[#f0f2ec] p-2"><input aria-label="Public collection link" readOnly value={publicLink} className="min-w-0 flex-1 bg-transparent text-[10px] text-[#626d5d]" /><button onClick={() => void navigator.clipboard.writeText(publicLink).then(() => showToast("Share link copied")).catch((error: unknown) => { console.error("Clipboard copy failed", error); showToast("Select and copy the link.", true); })} className="shrink-0 text-xs font-semibold text-[#53664e]">Copy</button></div>}
                <div className="flex gap-2">
                  <button onClick={exportData} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#e2e5dd] bg-white py-2.5 text-xs font-medium text-[#64705e] hover:bg-[#f5f6f2]"><ArrowDownToLine size={15} />Export JSON</button>
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#e2e5dd] bg-white py-2.5 text-xs font-medium text-[#64705e] hover:bg-[#f5f6f2]"><Plus size={15} />Import JSON<input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void importData(event)} /></label>
                </div>
                <div className="flex items-center justify-between pt-1 text-xs text-[#92988d]">
                  <button className="flex items-center gap-1.5 hover:text-[#53664e]" onClick={() => setShowSettings((value) => !value)}><Settings2 size={14} /> Playback settings <ChevronDown size={13} /></button>
                  {cloudEnabled ? <button onClick={() => void supabase?.auth.signOut().then(() => location.reload())} className="hover:text-[#53664e]">Sign out</button> : <Link href="/sign-in" className="hover:text-[#53664e]">Connect account</Link>}
                </div>
                {showSettings && <label className="flex items-center justify-between rounded-xl bg-[#f0f2ec] px-3 py-2.5 text-xs text-[#606a59]">Auto-play when focusing a memory<input type="checkbox" checked={autoplay} onChange={(event) => setAutoplay(event.target.checked)} className="accent-[#53664e]" /></label>}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPin && (
          <motion.aside key={selectedPin.id} initial={{ opacity: 0, y: 14, x: 12 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: .24 }} className="fixed inset-x-0 bottom-0 z-20 max-h-[78dvh] overflow-y-auto rounded-t-[28px] bg-[#fbfbf8] shadow-[0_-16px_52px_rgba(28,36,30,.18)] md:inset-y-5 md:left-auto md:right-5 md:max-h-none md:w-[370px] md:rounded-[26px] md:shadow-card">
            <div className="relative">
              <div className="absolute right-3 top-3 z-10 flex gap-1.5">
                <button aria-label="Edit memory" onClick={() => beginEdit(selectedPin)} className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-[#56624e] shadow-sm hover:bg-white"><Pencil size={16} /></button>
                <button aria-label="Delete memory" onClick={() => { if (confirm("Delete this memory?")) deleteMutation.mutate(selectedPin.id); }} className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-[#9f5748] shadow-sm hover:bg-white"><Trash2 size={16} /></button>
                <button aria-label="Close memory details" onClick={() => setSelectedPinId(null)} className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-[#56624e] shadow-sm hover:bg-white"><X size={17} /></button>
              </div>
              <div className="h-48 bg-[#e7e9e1] md:h-56">
                {selectedPin.image_url ? <Image src={selectedPin.image_url} alt={`Photo for ${selectedPin.title}`} fill sizes="(max-width: 768px) 100vw, 370px" unoptimized className="object-cover" /> : <div className="grid h-full place-items-center bg-gradient-to-br from-[#e5e9df] to-[#f6ede2] text-[#8a967e]"><MapPin size={36} /></div>}
              </div>
            </div>
            <div className="px-5 pb-7 pt-5 md:px-6">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.19em] text-[#8a9382]"><span className="h-2 w-2 rounded-full" style={{ background: selectedPin.color }} />{collections.find((c) => c.id === selectedPin.collection_id)?.name ?? "A saved moment"}</div>
              <h2 className="mt-2 font-serif text-[26px] leading-tight text-[#2a3029]">{selectedPin.title}</h2>
              {selectedPin.place_name && <p className="mt-1.5 text-xs text-[#92978f]">{selectedPin.place_name}</p>}
              {selectedPin.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#656d62]">{selectedPin.description}</p>}
              <div className="mt-3 text-[11px] text-[#a2a69e]">{selectedPin.lat.toFixed(5)}°, {selectedPin.lng.toFixed(5)}°</div>

              {selectedPin.audio_url && mediaKind(selectedPin.audio_url) !== "none" && (
                <div className="mt-5 overflow-hidden rounded-2xl bg-[#eef0e9]">
                  {getEmbed(selectedPin.audio_url, autoplay) ? (
                    <iframe title="Attached music" src={getEmbed(selectedPin.audio_url, autoplay)!} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="h-[152px] w-full border-0" />
                  ) : (
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#687d61]"><Disc3 size={19} className={isPlaying ? "animate-spin" : ""} /></span>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#475342]">A song for this place</p><p className="text-[11px] text-[#8b9384]">Soundtrack</p></div>
                        <button aria-label={isPlaying ? "Pause music" : "Play music"} onClick={playPause} className="grid h-10 w-10 place-items-center rounded-full bg-[#53664e] text-white hover:bg-[#42533e]">{isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-[10px] text-[#899183]"><span>{formatTime(playhead)}</span><input aria-label="Seek music" type="range" min={0} max={Math.max(duration, 1)} value={playhead} onChange={(event) => { const value = Number(event.target.value); setPlayhead(value); playerRef.current?.seek(value); }} className="h-1 flex-1 accent-[#687d61]" /><span>{formatTime(duration)}</span></div>
                      <div className="mt-3 flex items-center gap-2">
                        <button aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted(!muted)} className="text-[#6f7969]">{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
                        <input aria-label="Volume" type="range" min={0} max={1} step={.01} value={muted ? 0 : volume} onChange={(event) => { setVolume(Number(event.target.value)); setMuted(false); }} className="h-1 w-24 accent-[#687d61]" />
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-[#8b9384]"><Headphones size={13} />{autoplay ? "Auto-play on focus" : "Tap play to listen"}</span>
                      </div>
                      {needsSound && <button onClick={() => void enableSound()} className="mt-3 w-full rounded-xl bg-[#53664e] px-3 py-2 text-xs font-semibold text-white">Enable sound</button>}
                    </div>
                  )}
                </div>
              )}
              {!selectedPin.audio_url && <div className="mt-5 flex items-center gap-3 rounded-2xl border border-dashed border-[#dfe3d9] px-4 py-3 text-xs text-[#92998d]"><AudioLines size={18} />No song attached yet<button onClick={() => beginEdit(selectedPin)} className="ml-auto text-[#687d61] underline">Add one</button></div>}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editor && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-[#20251f]/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.form onSubmit={submitEditor} initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="no-scrollbar max-h-[92dvh] w-full max-w-[510px] overflow-y-auto rounded-t-[28px] bg-[#fbfbf8] p-5 shadow-card sm:rounded-[28px] sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#87917f]">{editor.id ? "Edit a memory" : "Pin a moment"}</p><h2 className="mt-1 font-serif text-2xl">{editor.id ? "Update this place" : "What should you remember?"}</h2><p className="mt-1 text-xs text-[#9a9e96]">{editor.draft.lat.toFixed(4)}, {editor.draft.lng.toFixed(4)}</p></div>
                <button type="button" aria-label="Close editor" onClick={() => { setEditor(null); setImagePreview(null); }} className="rounded-xl p-2 text-[#76806e] hover:bg-[#eef0e9]"><X size={20} /></button>
              </div>
              <label className="mt-5 block text-xs font-semibold text-[#697263]">Title *
                <input autoFocus required maxLength={80} value={editor.draft.title} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, title: event.target.value } })} placeholder="A moment worth keeping" className="mt-1.5 w-full rounded-xl border border-[#e2e5dd] bg-white px-3.5 py-3 text-sm text-ink outline-none focus:border-[#839174]" />
              </label>
              <label className="mt-3 block text-xs font-semibold text-[#697263]">Place name <span className="font-normal text-[#a4a89f]">· optional</span>
                <input maxLength={160} value={editor.draft.place_name ?? ""} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, place_name: event.target.value || null } })} placeholder="Neighborhood, city" className="mt-1.5 w-full rounded-xl border border-[#e2e5dd] bg-white px-3.5 py-3 text-sm text-ink outline-none focus:border-[#839174]" />
              </label>
              <label className="mt-3 block text-xs font-semibold text-[#697263]">A little note
                <textarea rows={3} maxLength={500} value={editor.draft.description} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, description: event.target.value } })} placeholder="What happened here?" className="mt-1.5 w-full resize-none rounded-xl border border-[#e2e5dd] bg-white px-3.5 py-3 text-sm text-ink outline-none focus:border-[#839174]" />
              </label>
              <div className="mt-4 flex items-center gap-2">
                <span className="mr-1 text-xs font-semibold text-[#697263]">Pin color</span>
                {palette.map((color) => <button key={color} type="button" aria-label={`Choose ${color}`} onClick={() => setEditor({ ...editor, draft: { ...editor.draft, color } })} className="grid h-7 w-7 place-items-center rounded-full border-2" style={{ borderColor: editor.draft.color === color ? color : "transparent" }}><span className="h-5 w-5 rounded-full" style={{ background: color }}>{editor.draft.color === color && <Check size={13} className="m-auto text-white" />}</span></button>)}
                <input type="color" aria-label="Custom pin color" value={editor.draft.color} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, color: event.target.value } })} className="ml-auto h-8 w-9 cursor-pointer rounded-md border-0 bg-transparent p-0" />
              </div>
              <label className="mt-4 block text-xs font-semibold text-[#697263]">Collection
                <select value={editor.draft.collection_id ?? ""} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, collection_id: event.target.value || null } })} className="mt-1.5 w-full rounded-xl border border-[#e2e5dd] bg-white px-3.5 py-3 text-sm outline-none">
                  <option value="">Unsorted</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
                </select>
              </label>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-[#697263]">A photo</span>
                  <button type="button" disabled={uploading === "image"} onClick={() => fileImageRef.current?.click()} className="relative mt-1.5 flex h-24 w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-[#dce1d7] bg-white text-xs text-[#75806f] hover:bg-[#f5f6f1] disabled:opacity-60">
                    {imagePreview ? <Image src={imagePreview} alt="Selected photo preview" fill sizes="220px" unoptimized className="object-cover" /> : <><ImagePlus size={18} />{uploading === "image" ? "Uploading…" : "Upload photo"}</>}
                  </button>
                  <input ref={fileImageRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => handleFile("image", event)} />
                  <input aria-label="Image URL" type="url" placeholder="Or paste image URL" value={editor.draft.image_external_url ?? ""} onChange={(event) => { const value = event.target.value || null; setEditor({ ...editor, draft: { ...editor.draft, image_external_url: value, image_path: null } }); setImagePreview(value); }} className="mt-2 w-full rounded-lg border border-[#e2e5dd] bg-white px-2.5 py-2 text-[11px] outline-none" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-[#697263]">Music</span>
                  <button type="button" disabled={uploading === "audio"} onClick={() => fileAudioRef.current?.click()} className="mt-1.5 flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#dce1d7] bg-white text-xs text-[#75806f] hover:bg-[#f5f6f1] disabled:opacity-60">
                    <Music2 size={18} />{uploading === "audio" ? "Uploading…" : editor.draft.audio_path ? "Track attached" : "Upload MP3 / WAV"}
                  </button>
                  <input ref={fileAudioRef} type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/aac,audio/flac" className="sr-only" onChange={(event) => handleFile("audio", event)} />
                  <input aria-label="Audio URL" type="url" placeholder="Audio, YouTube or Spotify URL" value={editor.draft.audio_url ?? ""} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, audio_url: event.target.value || null, audio_path: null } })} className="mt-2 w-full rounded-lg border border-[#e2e5dd] bg-white px-2.5 py-2 text-[11px] outline-none" />
                </div>
              </div>
              {!cloudEnabled && <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-[#999f94]"><CircleHelp size={14} className="mt-0.5 shrink-0" />Demo uploads are saved in this browser; cloud audio uploads are available after connecting Supabase.</p>}
              {editor.draft.audio_path && <button type="button" onClick={() => setEditor({ ...editor, draft: { ...editor.draft, audio_path: null, audio_url: null } })} className="mt-2 text-xs text-[#9d6457] underline">Remove uploaded audio</button>}
              <div className="mt-6 flex gap-2">
                <button type="button" onClick={() => { setEditor(null); setImagePreview(null); }} className="flex-1 rounded-xl border border-[#e2e5dd] bg-white py-3 text-sm font-medium text-[#6e766a]">Cancel</button>
                <button disabled={saveMutation.isPending || uploading !== null} className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-[#53664e] py-3 text-sm font-semibold text-white transition hover:bg-[#42533e] disabled:opacity-60">{saveMutation.isPending ? "Saving…" : <><Check size={16} />{editor.id ? "Save changes" : "Save memory"}</>}</button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {needsSound && selectedPin && !selectedPin.audio_url?.includes("youtube") && !selectedPin.audio_url?.includes("spotify") && !editor && (
        <button onClick={() => void enableSound()} className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[#252c24] px-5 py-3 text-sm font-semibold text-white shadow-card md:bottom-10">Tap to enable music</button>
      )}
      {toast && <div role={toastError ? "alert" : "status"} className={`fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-4 py-3 text-sm text-white shadow-card md:bottom-6 ${toastError ? "bg-[#a44c3e]" : "bg-[#303a2e]"}`}>{toast}</div>}
      {publicLink && <div className="sr-only" aria-live="polite">Public collection link: {publicLink}</div>}
    </main>
  );
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
