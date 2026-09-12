import {
  FONT_SETTINGS_STORAGE_AREA,
  FONT_SETTINGS_STORAGE_KEY,
  parseFontSettings,
  type FontSettings,
} from "./settings";

export async function loadFontSettings(): Promise<FontSettings> {
  const result = await chrome.storage.local.get(FONT_SETTINGS_STORAGE_KEY);
  return parseFontSettings(result[FONT_SETTINGS_STORAGE_KEY]);
}

export async function saveFontSettings(settings: FontSettings): Promise<void> {
  await chrome.storage.local.set({ [FONT_SETTINGS_STORAGE_KEY]: settings });
}

export function subscribeToFontSettings(
  onChange: (settings: FontSettings) => void,
): () => void {
  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
    changes,
    areaName,
  ) => {
    if (areaName !== FONT_SETTINGS_STORAGE_AREA) {
      return;
    }

    const change = changes[FONT_SETTINGS_STORAGE_KEY];
    if (!change) {
      return;
    }

    onChange(parseFontSettings(change.newValue));
  };

  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
