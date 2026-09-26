import type { FontDefinition, FontFormat } from "./font-registry";

export const CUSTOM_FONT_ID = "custom" as const;
export const MAX_CUSTOM_FONT_BYTES = 4 * 1024 * 1024;
export const CUSTOM_FONT_FAMILY_ALIAS = "CFC Custom Font";

export type StoredCustomFont = {
  readonly name: string;
  readonly fileName: string;
  readonly format: FontFormat;
  readonly size: number;
  readonly dataUrl: string;
};

const FORMAT_MIME: Readonly<Record<FontFormat, string>> = {
  woff2: "font/woff2",
  woff: "font/woff",
  truetype: "font/ttf",
  opentype: "font/otf",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFontFormat(value: unknown): value is FontFormat {
  return value === "woff2" || value === "woff" || value === "truetype" || value === "opentype";
}

function hasSafeLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 120 &&
    Array.from(value).every((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
  );
}

export function parseStoredCustomFont(value: unknown): StoredCustomFont | null {
  if (!isRecord(value) || !hasSafeLabel(value.name) || !hasSafeLabel(value.fileName)) {
    return null;
  }
  if (!isFontFormat(value.format)) {
    return null;
  }
  if (
    typeof value.size !== "number" ||
    !Number.isInteger(value.size) ||
    value.size <= 0 ||
    value.size > MAX_CUSTOM_FONT_BYTES
  ) {
    return null;
  }
  if (typeof value.dataUrl !== "string") {
    return null;
  }

  const expectedPrefix = `data:${FORMAT_MIME[value.format]};base64,`;
  if (
    !value.dataUrl.startsWith(expectedPrefix) ||
    value.dataUrl.length > Math.ceil((MAX_CUSTOM_FONT_BYTES * 4) / 3) + 128 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value.dataUrl.slice(expectedPrefix.length))
  ) {
    return null;
  }

  return {
    name: value.name,
    fileName: value.fileName,
    format: value.format,
    size: value.size,
    dataUrl: value.dataUrl,
  };
}

export function detectFontFormat(header: Uint8Array): FontFormat | null {
  if (header.length < 4) {
    return null;
  }

  const signature = String.fromCharCode(header[0] ?? 0, header[1] ?? 0, header[2] ?? 0, header[3] ?? 0);
  if (signature === "wOF2") return "woff2";
  if (signature === "wOFF") return "woff";
  if (signature === "OTTO") return "opentype";
  if (
    (header[0] === 0x00 && header[1] === 0x01 && header[2] === 0x00 && header[3] === 0x00) ||
    signature === "true"
  ) {
    return "truetype";
  }
  return null;
}

export function customFontMime(format: FontFormat): string {
  return FORMAT_MIME[format];
}

export function customFontDisplayName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.(?:woff2?|ttf|otf)$/i, "").trim();
  return (withoutExtension || "فونت من").slice(0, 120);
}

export function createCustomFontDefinition(customFont: StoredCustomFont): FontDefinition {
  const face = {
    assetPath: customFont.dataUrl,
    format: customFont.format,
    localNames: [],
  } as const;

  return {
    displayNameFa: customFont.name,
    displayNameEn: customFont.name,
    cssFamilyAlias: CUSTOM_FONT_FAMILY_ALIAS,
    candidateFamilyNames: [],
    faces: [
      { ...face, weight: 400 },
      { ...face, weight: 700 },
    ],
    fallbackStack: ["Tahoma", "Geeza Pro", "Segoe UI", "ui-sans-serif", "sans-serif"],
  };
}
