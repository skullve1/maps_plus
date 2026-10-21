"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type PinStyle = "teardrop" | "square";
export type HudStyle = "sage" | "ocean" | "berry";

type UIState = {
  selectedPinId: string | null;
  mapTheme: "system" | "light" | "dark";
  pinStyle: PinStyle;
  hudStyle: HudStyle;
  autoplay: boolean;
  volume: number;
  muted: boolean;
  showPublicPins: boolean;
  setSelectedPinId: (id: string | null) => void;
  setMapTheme: (theme: "system" | "light" | "dark") => void;
  setPinStyle: (style: PinStyle) => void;
  setHudStyle: (style: HudStyle) => void;
  setAutoplay: (value: boolean) => void;
  setVolume: (value: number) => void;
  setMuted: (value: boolean) => void;
  setShowPublicPins: (value: boolean) => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      selectedPinId: null,
      mapTheme: "system",
      pinStyle: "teardrop",
      hudStyle: "sage",
      autoplay: true,
      volume: 0.7,
      muted: false,
      showPublicPins: true,
      setSelectedPinId: (selectedPinId) => set({ selectedPinId }),
      setMapTheme: (mapTheme) => set({ mapTheme }),
      setPinStyle: (pinStyle) => set({ pinStyle }),
      setHudStyle: (hudStyle) => set({ hudStyle }),
      setAutoplay: (autoplay) => set({ autoplay }),
      setVolume: (volume) => set({ volume }),
      setMuted: (muted) => set({ muted }),
      setShowPublicPins: (showPublicPins) => set({ showPublicPins })
    }),
    {
      name: "map-of-memories-player",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ autoplay, volume, muted, mapTheme, pinStyle, hudStyle, showPublicPins }) => ({
        autoplay, volume, muted, mapTheme, pinStyle, hudStyle, showPublicPins
      })
    }
  )
);
