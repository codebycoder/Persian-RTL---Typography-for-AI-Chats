import {
  CUSTOM_FONT_ID,
  createCustomFontDefinition,
  parseStoredCustomFont,
  type StoredCustomFont,
} from "./custom-font";
import { getRegisteredFont, isFontId, type FontId } from "./font-registry";

export const FONT_SETTINGS_STORAGE_KEY = "fontSettings" as const;

export const FONT_SETTINGS_STORAGE_AREA = "local" as const;

export type FontSettings = {
  readonly schemaVersion: 2;
  readonly enabled: boolean;
  readonly fontId: FontId | typeof CUSTOM_FONT_ID;
  readonly customFont: StoredCustomFont | null;
};

export const DEFAULT_FONT_SETTINGS: FontSettings = {
  schemaVersion: 2,
  enabled: true,
  fontId: "vazirmatn",
  customFont: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Coerce stored JSON into a valid settings object.
 * Missing, invalid, or future-unknown fields fall back to defaults.
 */
export function parseFontSettings(value: unknown): FontSettings {
  if (!isRecord(value)) {
    return DEFAULT_FONT_SETTINGS;
  }

  const enabled = typeof value.enabled === "boolean" ? value.enabled : DEFAULT_FONT_SETTINGS.enabled;
  const customFont = parseStoredCustomFont(value.customFont);
  const fontId =
    isFontId(value.fontId) || (value.fontId === CUSTOM_FONT_ID && customFont)
      ? value.fontId
      : DEFAULT_FONT_SETTINGS.fontId;

  return {
    schemaVersion: 2,
    enabled,
    fontId,
    customFont,
  };
}

export function resolveSettingsFont(settings: FontSettings) {
  if (settings.fontId === CUSTOM_FONT_ID && settings.customFont) {
    return createCustomFontDefinition(settings.customFont);
  }
  return getRegisteredFont(isFontId(settings.fontId) ? settings.fontId : "vazirmatn");
}
