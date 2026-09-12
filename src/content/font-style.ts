import {
  CANVAS_EDITOR_SELECTORS,
  CODE_PRESERVE_SELECTORS,
  COMPOSER_AND_CONTROL_EXCLUSIONS,
  COMPOSER_SELECTORS,
  CONVERSATION_READING_SELECTORS,
  ICON_PRESERVE_SELECTORS,
  MARKDOWN_TEXT_DESCENDANTS,
} from "./chatgpt-selectors";
import { buildFontFamilyStack, quoteCssFontFamily, type RegisteredFont } from "@shared/font-registry";

function composerExclusions(): string {
  return COMPOSER_AND_CONTROL_EXCLUSIONS.map((selector) => `:not(${selector})`).join("");
}

function readingSelectorList(): string {
  const excluded = composerExclusions();
  return CONVERSATION_READING_SELECTORS.map((selector) => `${selector}${excluded}`).join(",\n");
}

/**
 * Descendant rules for ordinary Markdown text. The container rule alone is
 * not enough for assistant messages: ChatGPT declares `font-family` directly
 * on elements like `.markdown p`, and a direct declaration overrides the
 * inherited container font. Kept to text-bearing elements so code, icons,
 * and syntax highlighting are untouched.
 */
function markdownTextSelectorList(): string {
  const excluded = composerExclusions();
  const descendants = MARKDOWN_TEXT_DESCENDANTS.join(", ");
  return CONVERSATION_READING_SELECTORS.map(
    (selector) => `${selector}${excluded} :is(${descendants})`,
  ).join(",\n");
}

function editorSelectorList(selectors: readonly string[]): string {
  return selectors.join(",\n");
}

/**
 * Typed text in ProseMirror editors often carries its own `font-family`,
 * so inheritance from the editor root is not enough. `span` is included
 * here only: Lexical/ProseMirror decorations live in spans, unlike
 * conversation Markdown where bare spans are left alone to protect
 * syntax highlighting.
 */
function editorTextSelectorList(selectors: readonly string[]): string {
  const descendants = [...MARKDOWN_TEXT_DESCENDANTS, "span"].join(", ");
  // Exclude syntax-highlighted spans inside fenced/inline code. Canvas and
  // the composer wrap ordinary text in spans, so those must be restyled,
  // but a span inside `pre code` must keep the monospace stack.
  return selectors
    .map(
      (selector) =>
        `${selector} :is(${descendants}):not(pre *):not(code *):not(kbd *):not(samp *):not(tt *)`,
    )
    .join(",\n");
}

function editorPlaceholderSelectorList(selectors: readonly string[]): string {
  return selectors
    .flatMap((selector) => [`${selector}::placeholder`, `${selector} p::before`])
    .join(",\n");
}

function buildLocalFontFaceCss(font: RegisteredFont): string {
  return font.localFaceNames
    .map((face) => {
      const src = face.localNames.map((name) => `local(${quoteCssFontFamily(name)})`).join(", ");
      return [
        "@font-face {",
        `  font-family: ${quoteCssFontFamily(font.cssFamilyAlias)};`,
        `  src: ${src};`,
        `  font-weight: ${String(face.weight)};`,
        "  font-style: normal;",
        "  font-display: swap;",
        "}",
      ].join("\n");
    })
    .join("\n\n");
}

/**
 * CSS that restyles conversation reading text, the prompt composer, and
 * ChatGPT Canvas. Does not target html, body, or universal selectors.
 */
export function buildConversationFontCss(font: RegisteredFont): string {
  const stack = buildFontFamilyStack(font);
  const reading = readingSelectorList();
  const markdownText = markdownTextSelectorList();
  const composer = editorSelectorList(COMPOSER_SELECTORS);
  const composerText = editorTextSelectorList(COMPOSER_SELECTORS);
  const composerPlaceholder = editorPlaceholderSelectorList(COMPOSER_SELECTORS);
  const canvas = editorSelectorList(CANVAS_EDITOR_SELECTORS);
  const canvasText = editorTextSelectorList(CANVAS_EDITOR_SELECTORS);
  const canvasPlaceholder = editorPlaceholderSelectorList(CANVAS_EDITOR_SELECTORS);
  const code = CODE_PRESERVE_SELECTORS.join(",\n");
  const icons = ICON_PRESERVE_SELECTORS.join(",\n");

  return `
${buildLocalFontFaceCss(font)}

${reading} {
  font-family: ${stack} !important;
}

${markdownText} {
  font-family: ${stack} !important;
}

${composer} {
  font-family: ${stack} !important;
}

${composerText} {
  font-family: ${stack} !important;
}

${composerPlaceholder} {
  font-family: ${stack} !important;
}

${canvas} {
  font-family: ${stack} !important;
}

${canvasText} {
  font-family: ${stack} !important;
}

${canvasPlaceholder} {
  font-family: ${stack} !important;
}

${code} {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

${icons} {
  font-family: inherit;
}
`.trim();
}
