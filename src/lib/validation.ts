import { z } from "zod";

export const maxAlbumItems = 40;

function isUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const albumUrlSchema = z
  .string()
  .trim()
  .max(2_000_000)
  .refine(
    (value) =>
      /^data:image\/(?:jpeg|png|webp|gif);base64,/.test(value) ||
      (value.length <= 2000 && /^https?:\/\//i.test(value) && isUrl(value)),
    "Album links must be http(s) URLs."
  );

export const albumItemSchema = z.object({
  id: z.string().trim().min(1).max(64),
  kind: z.enum(["image", "audio"]),
  title: z.string().trim().max(80).default(""),
  path: z.string().max(500).nullable().default(null),
  url: albumUrlSchema.nullable().default(null)
});

export const pinInputSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(""),
  place_name: z.string().trim().max(160).nullable().default(null),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  collection_id: z.string().uuid().nullable().default(null),
  image_path: z.string().max(500).nullable().default(null),
  image_external_url: z
    .string()
    .trim()
    .max(2000)
    .url()
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol))
    .nullable()
    .default(null),
  audio_path: z.string().max(500).nullable().default(null),
  audio_url: z
    .string()
    .trim()
    .max(2000)
    .url()
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol))
    .nullable()
    .default(null),
  album: z.array(albumItemSchema).max(maxAlbumItems).default([])
});

export const collectionInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#687d61")
});

export const geocodeQuerySchema = z.object({
  q: z.string().trim().min(2).max(120)
});

export type ValidPinInput = z.infer<typeof pinInputSchema>;
