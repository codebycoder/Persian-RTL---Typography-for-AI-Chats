/**
 * Central font registry for locally installed families.
 *
 * Candidate names were taken from this machine's font name tables where files
 * were present. They are not interchangeable: IRANYekanRd is not IRANYekanX,
 * and "Yekan Bakh" is not "Yekan Bakh FaNum".
 *
 * To inspect or correct names on macOS, run:
 *   pnpm fonts:inspect
 * then update `candidateFamilyNames` / `localFaceNames` below.
 */

export const FONT_IDS = ["yekan-bakh", "peyda", "iran-yekan", "estedad"] as const;

export type FontId = (typeof FONT_IDS)[number];

export type FontWeightFace = {
  readonly weight: 400 | 700;
  /**
   * Names passed to `@font-face src: local()`. CSS Fonts matches the
   * PostScript name or the full font name, not necessarily the family name.
   */
  readonly localNames: readonly string[];
};

export type RegisteredFont = {
  readonly id: FontId;
  readonly displayNameFa: string;
  readonly displayNameEn: string;
  /** Stable alias used in generated `@font-face` rules. */
  readonly cssFamilyAlias: string;
  /**
   * Installed `font-family` names to try, in preference order.
   * Edit these when Font Book shows a different family name.
   */
  readonly candidateFamilyNames: readonly string[];
  readonly localFaceNames: readonly FontWeightFace[];
  readonly fallbackStack: readonly string[];
};

const PERSIAN_FALLBACK_STACK = [
  "Tahoma",
  "Geeza Pro",
  "Segoe UI",
  "ui-sans-serif",
  "sans-serif",
] as const;

export const FONT_REGISTRY: readonly RegisteredFont[] = [
  {
    id: "yekan-bakh",
    displayNameFa: "یکان بخ",
    displayNameEn: "Yekan Bakh",
    cssFamilyAlias: "CFC Yekan Bakh",
    // Inspected from YekanBakh-Regular.ttf: family "Yekan Bakh".
    candidateFamilyNames: ["Yekan Bakh"],
    localFaceNames: [
      {
        weight: 400,
        localNames: ["Yekan Bakh Regular", "YekanBakh-Regular", "Yekan Bakh"],
      },
      {
        weight: 700,
        localNames: ["Yekan Bakh Bold", "YekanBakh-Bold"],
      },
    ],
    fallbackStack: PERSIAN_FALLBACK_STACK,
  },
  {
    id: "peyda",
    displayNameFa: "پیدا",
    displayNameEn: "Peyda",
    cssFamilyAlias: "CFC Peyda",
    // Inspected from Peyda-Regular.ttf: family "Peyda".
    candidateFamilyNames: ["Peyda"],
    localFaceNames: [
      {
        weight: 400,
        localNames: ["Peyda Regular", "Peyda-Regular", "Peyda"],
      },
      {
        weight: 700,
        localNames: ["Peyda Bold", "Peyda-Bold"],
      },
    ],
    fallbackStack: PERSIAN_FALLBACK_STACK,
  },
  {
    id: "iran-yekan",
    displayNameFa: "ایران یکان",
    displayNameEn: "Iran Yekan",
    cssFamilyAlias: "CFC Iran Yekan",
    // Inspected Regular/Bold files register family "IRANYekanRd", not IRANYekan
    // or IRANYekanX. IRANYekanXFaNum is a different installed family and is not
    // listed here.
    candidateFamilyNames: ["IRANYekanRd", "IRANYekan", "Iran Yekan"],
    localFaceNames: [
      {
        weight: 400,
        localNames: ["IRANYekanRd", "IRANYekanRd Regular", "IRANYekan"],
      },
      {
        weight: 700,
        localNames: ["IRANYekanRd Bold", "IRANYekanRd-Bold"],
      },
    ],
    fallbackStack: PERSIAN_FALLBACK_STACK,
  },
  {
    id: "estedad",
    displayNameFa: "استعداد",
    displayNameEn: "Estedad",
    cssFamilyAlias: "CFC Estedad",
    // No Estedad files were found under ~/Library/Fonts during inspection.
    // These are common published family names, not verified on this machine.
    candidateFamilyNames: ["Estedad", "Estedad FD", "Estedad Variable", "Estedad VF"],
    localFaceNames: [
      {
        weight: 400,
        localNames: ["Estedad Regular", "Estedad-Regular", "Estedad", "Estedad FD"],
      },
      {
        weight: 700,
        localNames: ["Estedad Bold", "Estedad-Bold"],
      },
    ],
    fallbackStack: PERSIAN_FALLBACK_STACK,
  },
];

const FONT_BY_ID = new Map<FontId, RegisteredFont>(
  FONT_REGISTRY.map((font) => [font.id, font]),
);

export function isFontId(value: unknown): value is FontId {
  return typeof value === "string" && FONT_IDS.includes(value as FontId);
}

export function getRegisteredFont(id: FontId): RegisteredFont {
  const font = FONT_BY_ID.get(id);
  if (!font) {
    throw new Error(`Unknown font id: ${id}`);
  }
  return font;
}

export function quoteCssFontFamily(name: string): string {
  if (/^[a-zA-Z][-a-zA-Z0-9]*$/.test(name) && !name.includes(" ")) {
    return name;
  }
  return `"${name.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function buildFontFamilyStack(font: RegisteredFont): string {
  const names = [font.cssFamilyAlias, ...font.candidateFamilyNames, ...font.fallbackStack];
  const unique: string[] = [];
  for (const name of names) {
    if (!unique.includes(name)) {
      unique.push(name);
    }
  }
  return unique.map(quoteCssFontFamily).join(", ");
}

export function describeFontRegistryForDiagnostics(id: FontId): {
  id: FontId;
  displayNameEn: string;
  candidateFamilyNames: readonly string[];
  localFaceNames: readonly FontWeightFace[];
} {
  const font = getRegisteredFont(id);
  return {
    id: font.id,
    displayNameEn: font.displayNameEn,
    candidateFamilyNames: font.candidateFamilyNames,
    localFaceNames: font.localFaceNames,
  };
}
