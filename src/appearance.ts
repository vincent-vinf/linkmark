import { useLayoutEffect, useState } from "react";

export const palettes = [
  { id: "graphite", name: "岩墨", description: "冷灰与墨蓝，清晰克制" },
  { id: "ocean", name: "海盐", description: "雾蓝与海蓝，明净舒展" },
  { id: "sage", name: "松雾", description: "灰绿与青松，柔和安静" },
  { id: "sand", name: "暖砂", description: "暖灰与陶棕，温润自然" },
] as const;
export type Palette = (typeof palettes)[number]["id"];
export type ColorMode = "light" | "dark" | "system";
export type Appearance = { palette: Palette; mode: ColorMode };
const storageKey = "linkmark-appearance";
const defaultAppearance: Appearance = { palette: "graphite", mode: "system" };

export function readAppearance(): Appearance {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const value = JSON.parse(stored);
      return {
        palette: palettes.some((palette) => palette.id === value?.palette)
          ? value.palette
          : defaultAppearance.palette,
        mode: ["light", "dark", "system"].includes(value?.mode)
          ? value.mode
          : defaultAppearance.mode,
      };
    }
    const legacyMode = localStorage.getItem("linkmark-theme");
    if (legacyMode === "light" || legacyMode === "dark")
      return { ...defaultAppearance, mode: legacyMode };
  } catch {
    // A blocked or invalid preference must never prevent opening the app.
  }
  return { ...defaultAppearance };
}

export function applyAppearance(appearance: Appearance) {
  const mode =
    appearance.mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : appearance.mode;
  document.documentElement.dataset.palette = appearance.palette;
  document.documentElement.dataset.theme = mode;
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue("--canvas")
    .trim();
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", color);
}

export function useAppearance() {
  const [appearance, setAppearance] = useState(readAppearance);
  useLayoutEffect(() => {
    applyAppearance(appearance);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemMode = () => applyAppearance(appearance);
    media.addEventListener("change", updateSystemMode);
    try {
      localStorage.setItem(storageKey, JSON.stringify(appearance));
    } catch {
      // Keep the selected appearance for this page when persistence is blocked.
    }
    return () => media.removeEventListener("change", updateSystemMode);
  }, [appearance]);
  useLayoutEffect(() => {
    const updateFromStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null)
        setAppearance(readAppearance());
    };
    window.addEventListener("storage", updateFromStorage);
    return () => window.removeEventListener("storage", updateFromStorage);
  }, []);
  return [appearance, setAppearance] as const;
}
