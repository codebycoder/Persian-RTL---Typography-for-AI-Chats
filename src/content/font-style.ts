import {
  buildFontFaceCss,
  buildFontFaceSourceList,
  buildFontFamilyStack,
  quoteCssFontFamily,
  type FontDefinition,
} from "@shared/font-registry";
import { buildCssRule, joinCssBlocks, joinSelectors, nonBlankSelectors } from "./css-rule";
import {
  buildUiSurfaceTextSelectors,
  type PlatformAdapter,
  type UiSurfaceFont,
} from "./platforms/types";

/**
 * Ordinary rendered-Markdown text elements. Sites often declare
 * `font-family` directly on descendants such as `p` and `li`; a direct
 * declaration always beats the font inherited from the container, so
 * these elements need their own scoped rule.
 *
 * Deliberately excluded here: `pre`, `code`, `kbd`, `samp`, `tt` (code
 * stays monospace) and `svg` (icons). `span` is added in
 * `markdownTextSelectorList` with `:not(pre *)` guards — ChatGPT often
 * wraps streaming / inline text in spans that carry their own
 * `font-family`, which the container rule cannot override.
 */
export const MARKDOWN_TEXT_DESCENDANTS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "a",
  "em",
  "strong",
  "b",
  "i",
  "u",
  "s",
  "del",
  "ins",
  "mark",
  "small",
  "sub",
  "sup",
  "abbr",
  "cite",
  "q",
  "figure",
  "figcaption",
] as const;

/**
 * Virtual family used only for UI chrome, such as sidebar titles and
 * dialog headings.
 * `unicode-range` limits this face to Arabic/Persian glyphs so Latin
 * characters keep the host page's fallback stack.
 */
export const PERSIAN_GLYPH_FONT_FAMILY_ALIAS = "CFC Persian Glyphs";

/**
 * Arabic script ranges used by Persian, plus ZWNJ/ZWJ. Latin, common
 * punctuation, and Western digits are intentionally omitted so they
 * fall through to the next family in the stack.
 */
export const PERSIAN_ARABIC_UNICODE_RANGES = [
  "U+0600-06FF",
  "U+0750-077F",
  "U+0870-089F",
  "U+08A0-08FF",
  "U+200C-200D",
  "U+FB50-FDFF",
  "U+FE70-FEFF",
] as const;

const UI_LATIN_FALLBACK_STACK = [
  "ui-sans-serif",
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "sans-serif",
] as const;

function composerExclusions(platform: PlatformAdapter): string {
  return nonBlankSelectors(platform.selectors.exclusions)
    .map((selector) => `:not(${selector})`)
    .join("");
}

function readingSelectorList(platform: PlatformAdapter): string {
  const excluded = composerExclusions(platform);
  return nonBlankSelectors(platform.selectors.conversationReading)
    .map((selector) => `${selector}${excluded}`)
    .join(",\n");
}

/**
 * Descendant rules for ordinary Markdown text. The container rule alone is
 * not enough when a site declares `font-family` directly on elements like
 * `p` or `span`; a direct declaration overrides the inherited container
 * font. `span` is included with code-tree exclusions so syntax
 * highlighting inside `pre code` keeps the monospace stack.
 */
function markdownTextSelectorList(platform: PlatformAdapter): string {
  const excluded = composerExclusions(platform);
  const descendants = [...MARKDOWN_TEXT_DESCENDANTS, "span"].join(", ");
  return nonBlankSelectors(platform.selectors.conversationReading)
    .map(
      (selector) =>
        `${selector}${excluded} :is(${descendants}):not(pre *):not(code *):not(kbd *):not(samp *):not(tt *):not([data-markdown-copy="inline-code"])`,
    )
    .join(",\n");
}

function editorSelectorList(selectors: readonly string[]): string {
  return joinSelectors(selectors);
}

/**
 * Typed text in ProseMirror editors often carries its own `font-family`,
 * so inheritance from the editor root is not enough. `span` is included
 * because Lexical/ProseMirror decorations live in spans.
 */
function editorTextSelectorList(selectors: readonly string[]): string {
  const descendants = [...MARKDOWN_TEXT_DESCENDANTS, "span"].join(", ");
  // Exclude syntax-highlighted spans inside fenced/inline code. Canvas and
  // the composer wrap ordinary text in spans, so those must be restyled,
  // but a span inside `pre code` must keep the monospace stack.
  return nonBlankSelectors(selectors)
    .map(
      (selector) =>
        `${selector} :is(${descendants}):not(pre *):not(code *):not(kbd *):not(samp *):not(tt *)`,
    )
    .join(",\n");
}

function editorPlaceholderSelectorList(selectors: readonly string[]): string {
  return nonBlankSelectors(selectors)
    .flatMap((selector) => [`${selector}::placeholder`, `${selector} p::before`])
    .join(",\n");
}

/**
 * Selected-registry faces limited to Persian/Arabic code points.
 * Conversation faces stay unrestricted so existing chat typography is
 * unchanged.
 */
export function buildPersianGlyphFontFaceCss(
  font: FontDefinition,
  resolveAssetUrl?: (assetPath: string) => string,
): string {
  const unicodeRange = PERSIAN_ARABIC_UNICODE_RANGES.join(", ");

  return font.faces
    .map((face) => {
      const names = [...face.localNames, ...font.candidateFamilyNames];

      return [
        "@font-face {",
        `  font-family: ${quoteCssFontFamily(PERSIAN_GLYPH_FONT_FAMILY_ALIAS)};`,
        `  src: ${buildFontFaceSourceList(face, resolveAssetUrl, names)};`,
        `  unicode-range: ${unicodeRange};`,
        `  font-weight: ${String(face.weight)};`,
        "  font-style: normal;",
        "  font-display: swap;",
        "}",
      ].join("\n");
    })
    .join("\n\n");
}

export function buildUiSurfaceFontStack(): string {
  return [PERSIAN_GLYPH_FONT_FAMILY_ALIAS, ...UI_LATIN_FALLBACK_STACK]
    .map((name) => quoteCssFontFamily(name))
    .join(", ");
}

export function buildUiSurfaceSelectorList(
  platform: PlatformAdapter,
  font?: UiSurfaceFont,
): string {
  const surfaces =
    font === undefined
      ? platform.selectors.uiSurfaces
      : platform.selectors.uiSurfaces.filter((surface) => (surface.font ?? "glyphs") === font);

  return buildUiSurfaceTextSelectors(surfaces).join(",\n");
}

/**
 * CSS that restyles conversation reading text, the prompt composer,
 * document editors, and verified UI chrome such as sidebar chat titles.
 * Does not target html, body, or universal selectors.
 *
 * Every selector group in `PlatformSelectors` may legitimately be empty
 * for a given platform. Each rule below is built with `buildCssRule`,
 * which emits nothing for an empty selector list instead of falling back
 * to a broader or malformed selector — an empty group must never widen
 * the CSS scope.
 */
export function buildConversationFontCss(
  font: FontDefinition,
  platform: PlatformAdapter,
  resolveAssetUrl?: (assetPath: string) => string,
): string {
  const stack = buildFontFamilyStack(font);
  const uiStack = buildUiSurfaceFontStack();
  const reading = readingSelectorList(platform);
  const markdownText = markdownTextSelectorList(platform);
  const composer = editorSelectorList(platform.selectors.composer);
  const composerText = editorTextSelectorList(platform.selectors.composer);
  const composerPlaceholder = editorPlaceholderSelectorList(platform.selectors.composer);
  const canvas = editorSelectorList(platform.selectors.canvasEditors);
  const canvasText = editorTextSelectorList(platform.selectors.canvasEditors);
  const canvasPlaceholder = editorPlaceholderSelectorList(platform.selectors.canvasEditors);
  const uiGlyphs = buildUiSurfaceSelectorList(platform, "glyphs");
  const uiConversation = buildUiSurfaceSelectorList(platform, "conversation");
  const codeFont = joinSelectors(platform.selectors.codeFont ?? []);
  const code = joinSelectors(platform.selectors.codePreserve);
  const icons = joinSelectors(platform.selectors.iconPreserve);
  const cdsIcons = joinSelectors(platform.selectors.cdsIconPreserve ?? []);
  const cdsIconFontFamily = platform.selectors.cdsIconFontFamily;

  return joinCssBlocks([
    buildFontFaceCss(font, resolveAssetUrl),
    buildPersianGlyphFontFaceCss(font, resolveAssetUrl),
    buildCssRule(reading, `  font-family: ${stack} !important;`),
    buildCssRule(markdownText, `  font-family: ${stack} !important;`),
    buildCssRule(composer, `  font-family: ${stack} !important;`),
    buildCssRule(composerText, `  font-family: ${stack} !important;`),
    buildCssRule(composerPlaceholder, `  font-family: ${stack} !important;`),
    buildCssRule(canvas, `  font-family: ${stack} !important;`),
    buildCssRule(canvasText, `  font-family: ${stack} !important;`),
    buildCssRule(canvasPlaceholder, `  font-family: ${stack} !important;`),
    buildCssRule(uiGlyphs, `  font-family: ${uiStack} !important;`),
    buildCssRule(uiConversation, `  font-family: ${stack} !important;`),
    buildCssRule(
      code,
      `  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;`,
    ),
    buildCssRule(codeFont, `  font-family: ${stack} !important;`),
    buildCssRule(icons, "  font-family: revert !important;"),
    buildCssRule(
      cdsIcons,
      cdsIconFontFamily ? `  font-family: ${cdsIconFontFamily} !important;` : "",
    ),
  ]);
}
