import type { Collection, MemoryPin } from "@/types/database";

export const demoCollectionId = "00000000-0000-4000-8000-000000000001";

export const demoCollections: Collection[] = [
  {
    id: demoCollectionId,
    name: "Little moments",
    color: "#687d61",
    is_public: false,
    share_token: null,
    created_at: "2025-01-01T00:00:00.000Z"
  }
];

export const demoPins: MemoryPin[] = [
  {
    id: "demo-pin-1",
    collection_id: demoCollectionId,
    title: "First coffee in Paris",
    description: "A tiny table, warm croissants, and nowhere else to be.",
    place_name: "Le Marais, Paris",
    lat: 48.8584,
    lng: 2.3656,
    color: "#d8795b",
    image_path: null,
    image_url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=900&auto=format&fit=crop&q=80",
    audio_path: null,
    audio_url: null,
    is_public: false,
    created_at: "2025-03-02T09:00:00.000Z",
    updated_at: "2025-03-02T09:00:00.000Z"
  },
  {
    id: "demo-pin-2",
    collection_id: demoCollectionId,
    title: "The long way home",
    description: "We took the coastal path and watched the sky turn pink.",
    place_name: "Cinque Terre, Italy",
    lat: 44.1358,
    lng: 9.6841,
    color: "#788da0",
    image_path: null,
    image_url: "https://images.unsplash.com/photo-1498307833015-e7b400441eb8?w=900&auto=format&fit=crop&q=80",
    audio_path: null,
    audio_url: null,
    is_public: false,
    created_at: "2025-06-15T19:30:00.000Z",
    updated_at: "2025-06-15T19:30:00.000Z"
  },
  {
    id: "demo-pin-3",
    collection_id: demoCollectionId,
    title: "A song for the sea",
    description: "Our last evening before everything changed.",
    place_name: "Big Sur, California",
    lat: 36.2704,
    lng: -121.8081,
    color: "#829071",
    image_path: null,
    image_url: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=900&auto=format&fit=crop&q=80",
    audio_path: null,
    audio_url: null,
    is_public: false,
    created_at: "2025-08-22T18:20:00.000Z",
    updated_at: "2025-08-22T18:20:00.000Z"
  }
];
