import type { MemoryPin } from "@/types/database";

export function downloadPins(pins: MemoryPin[]) {
  const payload = {
    format: "map-of-memories",
    version: 1,
    exportedAt: new Date().toISOString(),
    pins: pins.map((pin) => ({
      ...pin,
      image_url: undefined,
      audio_url: pin.audio_path ? undefined : pin.audio_url
    }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `map-of-memories-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
