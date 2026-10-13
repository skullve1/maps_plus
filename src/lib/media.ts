export function mediaKind(url: string | null | undefined) {
  if (!url) return "none";
  if (/youtu\.be|youtube\.com/i.test(url)) {
    const id = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/)?.[1];
    return id ? `youtube:${id}` : "none";
  }
  if (/spotify\.com/i.test(url)) {
    const match = url.match(/open\.spotify\.com\/(?:intl-[^/]+\/)?(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/);
    return match ? `spotify:${match[1]}/${match[2]}` : "none";
  }
  return /^https?:\/\//i.test(url) ? "audio" : "none";
}

export function getEmbed(url: string, autoplay: boolean) {
  const kind = mediaKind(url);
  if (kind.startsWith("youtube:")) return `https://www.youtube-nocookie.com/embed/${kind.slice(8)}?autoplay=${autoplay ? 1 : 0}&rel=0`;
  if (kind.startsWith("spotify:")) return `https://open.spotify.com/embed/${kind.slice(8)}?utm_source=generator`;
  return null;
}

export function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
