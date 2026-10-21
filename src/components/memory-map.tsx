"use client";

import MapLibre, { Marker, NavigationControl, ScaleControl, type MapRef, type MapLayerMouseEvent, type MapLayerTouchEvent } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StyleSpecification } from "maplibre-gl";
import type { MemoryPin } from "@/types/database";
import { MapPin } from "lucide-react";
import type { PinStyle } from "@/store/ui";

type Point = { lat: number; lng: number };
type SearchPoint = Point & { nonce: number };
type Cluster = { key: string; lat: number; lng: number; pins: MemoryPin[] };
type Props = {
  pins: MemoryPin[];
  themePreference: "system" | "light" | "dark";
  pinStyle: PinStyle;
  selectedPinId: string | null;
  placingPin: boolean;
  canMovePins?: boolean;
  onFocus: (pin: MemoryPin) => void;
  onMapPlace: (point: Point) => void;
  onMovePin: (pin: MemoryPin, point: Point) => void;
  searchPoint: SearchPoint | null;
  satellite?: boolean;
};

const lightStyle = process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT ?? "https://tiles.openfreemap.org/styles/positron";
const darkStyle = process.env.NEXT_PUBLIC_MAP_STYLE_DARK ?? "https://tiles.openfreemap.org/styles/dark";
const satelliteStyle: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics"
    }
  },
  layers: [{ id: "satellite", type: "raster", source: "satellite" }]
};
setWorkerUrl("/maplibre-gl-worker.mjs");

export function MemoryMap({ pins, themePreference, pinStyle, selectedPinId, placingPin, canMovePins = true, onFocus, onMapPlace, onMovePin, searchPoint, satellite = false }: Props) {
  const mapRef = useRef<MapRef>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const lastFocusedId = useRef<string | null>(null);
  const [systemDark, setSystemDark] = useState(false);
  const isDark = themePreference === "dark" || (themePreference === "system" && systemDark);
  const [zoom, setZoom] = useState(3.2);
  const [viewport, setViewport] = useState({ longitude: 9, latitude: 32, zoom: 3.2 });
  const focusedPinRef = useRef<MemoryPin | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const pin = pins.find((item) => item.id === selectedPinId);
    if (!pin) {
      focusedPinRef.current = null;
      lastFocusedId.current = null;
      return;
    }
    focusedPinRef.current = pin;
    if (lastFocusedId.current === pin.id) return;
    lastFocusedId.current = pin.id;
    mapRef.current?.flyTo({
      center: [pin.lng, pin.lat],
      zoom: Math.max(mapRef.current.getZoom(), 12),
      padding: { top: 0, bottom: 0, left: 0, right: window.innerWidth >= 768 ? 390 : 0 },
      duration: 1400,
      essential: true
    });
  }, [selectedPinId, pins]);

  useEffect(() => {
    if (!searchPoint) return;
    mapRef.current?.flyTo({
      center: [searchPoint.lng, searchPoint.lat],
      zoom: Math.max(mapRef.current.getZoom(), 14),
      duration: 1300,
      essential: true
    });
  }, [searchPoint]);

  const clusters = useMemo<Cluster[]>(() => {
    if (zoom >= 8) return pins.map((pin) => ({ key: pin.id, lat: pin.lat, lng: pin.lng, pins: [pin] }));
    const step = zoom < 3 ? 15 : zoom < 5 ? 7 : 2.5;
    const buckets = new globalThis.Map<string, MemoryPin[]>();
    for (const pin of pins) {
      const key = `${Math.round(pin.lat / step)}:${Math.round(pin.lng / step)}`;
      buckets.set(key, [...(buckets.get(key) ?? []), pin]);
    }
    return [...buckets.entries()].map(([key, members]) => ({
      key,
      lat: members.reduce((sum, pin) => sum + pin.lat, 0) / members.length,
      lng: members.reduce((sum, pin) => sum + pin.lng, 0) / members.length,
      pins: members
    }));
  }, [pins, zoom]);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }, []);

  const startLongPress = useCallback((event: MapLayerTouchEvent) => {
    if (!placingPin) return;
    clearLongPress();
    const point = { lat: event.lngLat.lat, lng: event.lngLat.lng };
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      onMapPlace(point);
    }, 650);
  }, [clearLongPress, onMapPlace, placingPin]);

  const placeAtClick = useCallback((event: MapLayerMouseEvent) => {
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }
    if (!placingPin) return;
    onMapPlace({ lat: event.lngLat.lat, lng: event.lngLat.lng });
  }, [onMapPlace, placingPin]);

  return (
    <MapLibre
      ref={mapRef}
      {...viewport}
      onMove={(event) => {
        setViewport(event.viewState);
        setZoom(event.viewState.zoom);
      }}
      onClick={placeAtClick}
      onTouchStart={startLongPress}
      onTouchMove={clearLongPress}
      onTouchEnd={clearLongPress}
      onMouseLeave={clearLongPress}
      onLoad={() => {
        const pin = focusedPinRef.current;
        if (pin) mapRef.current?.flyTo({ center: [pin.lng, pin.lat], zoom: 12 });
      }}
      mapStyle={satellite ? satelliteStyle : isDark ? darkStyle : lightStyle}
      maxPitch={80}
      pitchWithRotate
      dragRotate
      touchPitch
      doubleClickZoom
      cursor={placingPin ? "crosshair" : undefined}
      aria-label={placingPin
        ? "Interactive memory map. Click or press and hold to place a memory."
        : "Interactive memory map. Select Add a memory before clicking or pressing and holding to place a memory."}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <NavigationControl position="bottom-right" visualizePitch />
      <ScaleControl position="bottom-left" />
      {clusters.map((cluster) => {
        const clustered = cluster.pins.length > 1;
        const pin = cluster.pins[0];
        const active = cluster.pins.some((item) => item.id === selectedPinId);
        return (
          <Marker
            key={cluster.key}
            longitude={cluster.lng}
            latitude={cluster.lat}
            anchor="bottom"
            draggable={canMovePins && !clustered && pin.id === selectedPinId && pin.is_own !== false}
            onDragEnd={(event) => {
              if (!canMovePins || pin.id !== selectedPinId || pin.is_own === false) return;
              onMovePin(pin, { lat: event.lngLat.lat, lng: event.lngLat.lng });
            }}
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              if (clustered) {
                mapRef.current?.flyTo({
                  center: [cluster.lng, cluster.lat],
                  zoom: Math.min(mapRef.current.getZoom() + 3, 12),
                  duration: 650
                });
              } else {
                onFocus(pin);
              }
            }}
          >
            {clustered ? (
              <button
                aria-label={`${cluster.pins.length} memories here. Zoom in`}
                className="hud-accent grid h-11 w-11 place-items-center rounded-full border-[3px] border-white text-sm font-bold text-white shadow-lg transition hover:scale-110"
              >{cluster.pins.length}</button>
            ) : (
              <button
                aria-label={`Focus memory: ${pin.title}`}
                title={pin.title}
                className={`memory-marker ${pinStyle === "square" ? "is-square" : ""} ${active ? "is-active" : ""} ${pin.is_own === false ? "is-others" : ""}`}
                style={{ "--pin-color": pin.color } as React.CSSProperties}
              >
                <span className="memory-marker__shell">
                  <span className="memory-marker__image">
                    {pin.image_url ? <Image src={pin.image_url} alt="" fill sizes="30px" unoptimized /> : <MapPin size={15} />}
                  </span>
                </span>
              </button>
            )}
          </Marker>
        );
      })}
    </MapLibre>
  );
}
