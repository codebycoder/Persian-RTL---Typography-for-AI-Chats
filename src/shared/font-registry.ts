/**
 * Free font families bundled with the extension.
 *
 * The binary files live in /fonts and are copied into the extension build.
 * They are distributed under the SIL Open Font License 1.1; the matching
 * license files and upstream details are kept beside the font binaries.
 */

export const FONT_IDS = [
  "vazirmatn",
  "estedad",
  "noto-sans-arabic",
  "noto-naskh-arabic",
] as const;

export type FontId = (typeof FONT_IDS)[number];
export type FontFormat = "woff2" | "woff" | "truetype" | "opentype";

export type FontWeightFace = {
  /** Discrete weight or a variable-font range such as `"100 900"`. */
  readonly weight: 400 | 700 | `${number} ${number}`;
  /** Names passed to local() after the bundled asset (fallback only). */
  readonly localNames: readonly string[];
  readonly assetPath: string;
  readonly format: FontFormat;
};

export type FontDefinition = {
  readonly displayNameFa: string;
  readonly displayNameEn: string;
  /** Stable alias used in generated @font-face rules. */
  readonly cssFamilyAlias: string;
  readonly candidateFamilyNames: readonly string[];
  readonly faces: readonly FontWeightFace[];
  readonly fallbackStack: readonly string[];
};

export type RegisteredFont = FontDefinition & {
  readonly id: FontId;
};

const PERSIAN_FALLBACK_STACK = [
  "Tahoma",
  "Geeza Pro",
  "Segoe UI",
  "ui-sans-serif",
  "sans-serif",
] as const;

function variableFaces(
  assetPath: string,
  familyNames: readonly string[],
): readonly FontWeightFace[] {
  // One face covering the full variable axis so ChatGPT weights between
  // 400/700 (e.g. 450) still resolve to the bundled file.
  return [
    {
      weight: "100 900",
      localNames: [
        ...familyNames,
        ...familyNames.map((name) => `${name} Regular`),
        ...familyNames.map((name) => `${name} Bold`),
      ],
      assetPath,
      format: "truetype",
    },
  ];
}

export const FONT_REGISTRY: readonly RegisteredFont[] = [
  {
    id: "vazirmatn",
    displayNameFa: "وزیرمتن",
    displayNameEn: "Vazirmatn",
    cssFamilyAlias: "CFC Vazirmatn",
    candidateFamilyNames: ["Vazirmatn"],
    faces: variableFaces("fonts/Vazirmatn-Variable.ttf", ["Vazirmatn"]),
    fallbackStack: PERSIAN_FALLBACK_STACK,
  },
  {
    id: "estedad",
    displayNameFa: "استعداد",
    displayNameEn: "Estedad",
    cssFamilyAlias: "CFC Estedad",
    candidateFamilyNames: ["Estedad"],
    faces: variableFaces("fonts/Estedad-Variable.ttf", ["Estedad"]),
    fallbackStack: PERSIAN_FALLBACK_STACK,
  },
  {
    id: "noto-sans-arabic",
    displayNameFa: "نوتو سنس عربی",
    displayNameEn: "Noto Sans Arabic",
    cssFamilyAlias: "CFC Noto Sans Arabic",
    candidateFamilyNames: ["Noto Sans Arabic"],
    faces: variableFaces("fonts/NotoSansArabic-Variable.ttf", ["Noto Sans Arabic"]),
    fallbackStack: PERSIAN_FALLBACK_STACK,
  },
  {
    id: "noto-naskh-arabic",
    displayNameFa: "نوتو نسخ عربی",
    displayNameEn: "Noto Naskh Arabic",
    cssFamilyAlias: "CFC Noto Naskh Arabic",
    candidateFamilyNames: ["Noto Naskh Arabic"],
    faces: variableFaces("fonts/NotoNaskhArabic-Variable.ttf", ["Noto Naskh Arabic"]),
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

export function buildFontFamilyStack(font: FontDefinition): string {
  const names = [font.cssFamilyAlias, ...font.candidateFamilyNames, ...font.fallbackStack];
  const unique: string[] = [];
  for (const name of names) {
    if (!unique.includes(name)) {
      unique.push(name);
    }
  }
  return unique.map(quoteCssFontFamily).join(", ");
}

function uniqueFontNames(names: readonly string[]): string[] {
  const unique: string[] = [];
  for (const name of names) {
    if (!unique.includes(name)) {
      unique.push(name);
    }
  }
  return unique;
}

export function buildFontFaceSourceList(
  face: FontWeightFace,
  resolveAssetUrl: (assetPath: string) => string = (assetPath) => assetPath,
  extraLocalNames: readonly string[] = [],
): string {
  const localSources = uniqueFontNames([...face.localNames, ...extraLocalNames]).map(
    (name) => `local(${quoteCssFontFamily(name)})`,
  );
  const assetUrl = resolveAssetUrl(face.assetPath);
  const assetSource = `url(${JSON.stringify(assetUrl)}) format("${face.format}")`;
  // Prefer the bundled (or data-URL) asset so a same-named local face cannot
  // shadow the extension font and silently keep the page looking unchanged.
  return [assetSource, ...localSources].join(", ");
}

export function buildFontFaceCss(
  font: FontDefinition,
  resolveAssetUrl?: (assetPath: string) => string,
): string {
  return font.faces
    .map((face) => {
      return [
        "@font-face {",
        `  font-family: ${quoteCssFontFamily(font.cssFamilyAlias)};`,
        `  src: ${buildFontFaceSourceList(face, resolveAssetUrl)};`,
        `  font-weight: ${String(face.weight)};`,
        "  font-style: normal;",
        "  font-display: swap;",
        "}",
      ].join("\n");
    })
    .join("\n\n");
}

export function describeFontRegistryForDiagnostics(id: FontId): {
  id: FontId;
  displayNameEn: string;
  candidateFamilyNames: readonly string[];
  faces: readonly FontWeightFace[];
} {
  const font = getRegisteredFont(id);
  return {
    id: font.id,
    displayNameEn: font.displayNameEn,
    candidateFamilyNames: font.candidateFamilyNames,
    faces: font.faces,
  };
}
