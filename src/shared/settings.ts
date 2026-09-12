import { getRegisteredFont, isFontId, type FontId } from "./font-registry";

export const FONT_SETTINGS_STORAGE_KEY = "fontSettings" as const;

export const FONT_SETTINGS_STORAGE_AREA = "local" as const;

export type FontSettings = {
  readonly schemaVersion: 1;
  readonly enabled: boolean;
  readonly fontId: FontId;
};

export const DEFAULT_FONT_SETTINGS: FontSettings = {
  schemaVersion: 1,
  enabled: true,
  fontId: "yekan-bakh",
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
  const fontId = isFontId(value.fontId) ? value.fontId : DEFAULT_FONT_SETTINGS.fontId;

  return {
    schemaVersion: 1,
    enabled,
    fontId,
  };
}

export function resolveSettingsFont(settings: FontSettings) {
  return getRegisteredFont(settings.fontId);
}
