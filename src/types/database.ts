export type Collection = {
  id: string;
  name: string;
  color: string;
  is_public: boolean;
  share_token: string | null;
  created_at: string;
};

export type AlbumItem = {
  id: string;
  kind: "image" | "audio";
  title: string;
  path: string | null;
  url: string | null;
};

export type MemoryPin = {
  id: string;
  collection_id: string | null;
  title: string;
  description: string;
  place_name: string | null;
  lat: number;
  lng: number;
  color: string;
  image_path: string | null;
  image_external_url?: string | null;
  image_url: string | null;
  audio_path: string | null;
  audio_url: string | null;
  album?: AlbumItem[];
  is_public: boolean;
  is_own?: boolean;
  created_at: string;
  updated_at: string;
};

export type PinInput = Pick<
  MemoryPin,
  | "title"
  | "description"
  | "place_name"
  | "lat"
  | "lng"
  | "color"
  | "collection_id"
  | "image_path"
  | "image_external_url"
  | "audio_path"
  | "audio_url"
  | "album"
  | "is_public"
>;
