import { INJECTED_BIDI_STYLE_ELEMENT_ID, RASTTEXT_DIR_ATTRIBUTE } from "@shared/constants";
import { buildCssRule, joinCssBlocks, joinSelectors, nonBlankSelectors } from "./css-rule";
import type { PlatformAdapter } from "./platforms/types";
import { syncInjectedStyle, type StyleHost } from "./style-lifecycle";

/**
 * Block-level conversation text for the BiDi engine. Each element gets its
 * own `unicode-bidi: plaintext` paragraph so the browser can infer a base
 * direction from the first strong character.
 *
 * Blocks that already carry `data-rasttext-dir` are excluded. That
 * attribute is an explicit RastText direction (not first-strong), and
 * plaintext would independently recompute base direction from the first
 * strong character and undo it. This file does not detect language.
 *
 * Intentionally narrower than Markdown text descendants used by the font
 * engine: inline tags stay in the parent paragraph context, and structural
 * wrappers (ul, ol, table) are not isolated so markers/layout stay with
 * their items and cells.
 *
 * Excluded: pre, code, kbd, samp, tt, span, a, strong, em, and other inlines.
 */
export const BIDI_BLOCK_ELEMENTS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "blockquote",
  "th",
  "td",
] as const;

function composerExclusions(platform: PlatformAdapter): string {
  return nonBlankSelectors(platform.selectors.exclusions)
    .map((selector) => `:not(${selector})`)
    .join("");
}

function bidiTargetExclusions(platform: PlatformAdapter): string {
  return [
    composerExclusions(platform),
    ':not([contenteditable="true"] *)',
    ':not([contenteditable="plaintext-only"] *)',
    `:not([${RASTTEXT_DIR_ATTRIBUTE}])`,
    ...nonBlankSelectors(platform.selectors.composer).map((selector) => `:not(${selector} *)`),
  ].join("");
}

/**
 * Block descendants of every conversation container, plus the reading node
 * itself when it is the text block (user copy, DIL components, pre-wrap).
 *
 * `conversationReading` and `bidiLeaf` may each be empty for a platform;
 * an empty group simply contributes no selectors here rather than falling
 * back to a broader match.
 */
export function buildConversationBidiSelectorList(platform: PlatformAdapter): string {
  const containerExcluded = composerExclusions(platform);
  const targetExcluded = bidiTargetExclusions(platform);
  const blocks = BIDI_BLOCK_ELEMENTS.join(", ");

  const descendants = nonBlankSelectors(platform.selectors.conversationReading).map(
    (selector) => `${selector}${containerExcluded} :is(${blocks})${targetExcluded}`,
  );

  const leaves = nonBlankSelectors(platform.selectors.bidiLeaf).map(
    (selector) => `${selector}${targetExcluded}`,
  );

  return [...leaves, ...descendants].join(",\n");
}

/**
 * CSS that isolates each conversation text block for the Unicode
 * Bidirectional Algorithm. Does not set a forced base direction, and does
 * not target html, body, or universal selectors.
 *
 * If `conversationReading`/`bidiLeaf` (or `codePreserve`) are empty, the
 * corresponding rule is omitted entirely via `buildCssRule` rather than
 * emitting a rule with an empty selector.
 */
export function buildConversationBidiCss(platform: PlatformAdapter): string {
  const blocks = buildConversationBidiSelectorList(platform);
  const code = joinSelectors(platform.selectors.codePreserve);

  return joinCssBlocks([
    buildCssRule(blocks, "  unicode-bidi: plaintext !important;\n  text-align: start !important;"),
    buildCssRule(code, "  text-align: initial;"),
  ]);
}

/**
 * Idempotent BiDi stylesheet lifecycle. `enabled: false` removes the style
 * element so the page's default rendering is restored.
 */
export function syncConversationBidiStyle(
  host: StyleHost,
  enabled: boolean,
  platform: PlatformAdapter,
): ReturnType<typeof syncInjectedStyle> {
  return syncInjectedStyle(
    host,
    INJECTED_BIDI_STYLE_ELEMENT_ID,
    enabled ? buildConversationBidiCss(platform) : null,
  );
}
