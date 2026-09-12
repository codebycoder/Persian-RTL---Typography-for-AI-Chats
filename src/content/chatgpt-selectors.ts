/**
 * ChatGPT-specific selectors, isolated so they can be updated when the site
 * changes.
 *
 * Two frontend generations are covered:
 *
 * 1. Classic frontend: messages expose
 *    `data-message-author-role="user"|"assistant"`, assistant Markdown is a
 *    `.markdown` descendant, and user turns render plain text in a
 *    `whitespace-pre-wrap` container. On this frontend the site declares
 *    `font-family` directly on Markdown descendants (p, li, h1-h6, ...), so
 *    the container font does not inherit into assistant messages; the
 *    descendant rule in font-style.ts exists for this reason.
 *
 * 2. Current frontend (verified against a live logged-out conversation on
 *    2026-09-08): turns are `li[data-message-role="user"|"assistant"]`,
 *    assistant Markdown renders in `div[data-assistant-markdown]` (no
 *    `.markdown` class), and user reading text is
 *    `p[data-user-message-copy]`. Descendants there have no direct
 *    font-family declarations, so inheritance from the container works.
 *
 * 3. Logged-in hybrid (reproduced 2026-09-08): user turns still match the
 *    classic `[data-message-author-role="user"] .whitespace-pre-wrap`
 *    selector, but assistant turns expose `data-message-author-role` with
 *    `[data-assistant-markdown]` and no `.markdown` class or
 *    `data-message-role`. Only the combined author-role + assistant-markdown
 *    selector reaches assistant text in this markup.
 *
 * 4. Logged-in DIL renderer (verified 2026-09-08): assistant reading text
 *    renders as semantic components such as `p[data-d-component="text"]`,
 *    `h3[data-d-component="title"]`, and `div[data-d-component="badge"]`
 *    inside `[data-dil-widget-copy-target]`.
 *    There is no `.markdown`, `[data-assistant-markdown]`, or
 *    `data-message-role` on this markup. Embedded `[data-writing-block]`
 *    editors use bare `ProseMirror.markdown` paragraphs without
 *    `data-d-component="text"`; conversation reading rules still exclude them
 *    via `:not([contenteditable])`. Canvas/writing-block editors are
 *    restyled by a dedicated rule, not by these reading selectors.
 *
 * 5. Work chat (reported 2026-09): assistant reading text renders in a
 *    standalone `div.markdown.markdown-new-styling.prose` container without
 *    `data-message-author-role`, `data-message-role`, or
 *    `[data-assistant-markdown]`. Site typography still declares
 *    `font-family` directly on Markdown descendants, so the descendant rule
 *    applies here as well.
 *
 * The prompt composer (`#prompt-textarea`, typically a ProseMirror
 * contenteditable) sits outside message-role nodes. Reading selectors
 * below still exclude it and other controls; a dedicated composer rule
 * restyles that prompt editor. ChatGPT Canvas uses a separate ProseMirror
 * writing-block editor (`[data-writing-block-fullscreen-editor-region]`,
 * including the inline layout) and is restyled by its own rule.
 *
 * Manual verification: see README "Manual DOM verification".
 */

export const CONVERSATION_READING_SELECTORS = [
  // Classic frontend. User messages confirmed working with these selectors.
  '[data-message-author-role="assistant"] .markdown',
  '[data-message-author-role="user"] .markdown',
  '[data-message-author-role="user"] .whitespace-pre-wrap',
  // Logged-in hybrid (verified 2026-09): turns still expose
  // `data-message-author-role`, but assistant Markdown now renders in
  // `[data-assistant-markdown]` without a `.markdown` ancestor. Neither the
  // classic `.markdown` selector nor the current `[data-message-role]` selector
  // matches this markup alone.
  '[data-message-author-role="assistant"] [data-assistant-markdown]',
  // Current frontend (verified against a live logged-out conversation,
  // 2026-09): turns are `li[data-message-role]`, assistant Markdown renders
  // inside `div[data-assistant-markdown]` (no `.markdown` class), and user
  // reading text is `p[data-user-message-copy]` inside the message bubble.
  '[data-message-role="assistant"] [data-assistant-markdown]',
  '[data-message-role="user"] [data-user-message-copy]',
  // Logged-in DIL renderer (verified 2026-09): assistant reading text is exposed
  // as semantic `data-d-component` nodes, not `.markdown` descendants.
  '[data-dil-widget-copy-target] [data-d-component="text"]',
  '[data-dil-widget-copy-target] [data-d-component="title"]',
  '[data-dil-widget-copy-target] [data-d-component="badge"]',
  '[data-message-author-role="assistant"] [data-d-component="text"]',
  '[data-message-author-role="assistant"] [data-d-component="title"]',
  '[data-message-author-role="assistant"] [data-d-component="badge"]',
  // Work chat (reported 2026-09): Markdown renders outside message-role
  // wrappers in `.markdown.markdown-new-styling` containers.
  ".markdown.markdown-new-styling",
] as const;

/**
 * Ordinary rendered-Markdown text elements. ChatGPT's stylesheet declares
 * `font-family` directly on descendants such as `p` and `li`; a direct
 * declaration always beats the font inherited from the `.markdown`
 * container, so these elements need their own scoped rule.
 *
 * Deliberately excluded: `pre`, `code`, `kbd`, `samp`, `tt` (code stays
 * monospace), `svg` (icons), and `span` (syntax-highlighting spans live
 * inside `pre code`; ordinary Markdown text does not rely on bare spans).
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

export const CODE_PRESERVE_SELECTORS = [
  '[data-message-author-role] .markdown :is(pre, code, kbd, samp, tt)',
  '[data-message-author-role] .markdown :is(pre, code, kbd, samp, tt) *',
  '[data-message-author-role] [data-assistant-markdown] :is(pre, code, kbd, samp, tt)',
  '[data-message-author-role] [data-assistant-markdown] :is(pre, code, kbd, samp, tt) *',
  '[data-message-role] [data-assistant-markdown] :is(pre, code, kbd, samp, tt)',
  '[data-message-role] [data-assistant-markdown] :is(pre, code, kbd, samp, tt) *',
  '[data-dil-widget-copy-target] [data-d-component="code"]',
  '[data-message-author-role="assistant"] [data-d-component="code"]',
  ".markdown.markdown-new-styling :is(pre, code, kbd, samp, tt)",
  ".markdown.markdown-new-styling :is(pre, code, kbd, samp, tt) *",
  "[data-writing-block-fullscreen-editor-region] :is(pre, code, kbd, samp, tt)",
  "[data-writing-block-fullscreen-editor-region] :is(pre, code, kbd, samp, tt) *",
  "[data-writing-block] .ProseMirror :is(pre, code, kbd, samp, tt)",
  "[data-writing-block] .ProseMirror :is(pre, code, kbd, samp, tt) *",
] as const;

/**
 * Prompt composer only. ChatGPT's current editor is a ProseMirror
 * `div#prompt-textarea[contenteditable]`; older frontends use a
 * `textarea#prompt-textarea`. Do not broaden this to every
 * contenteditable — Canvas writing-blocks also use ProseMirror and
 * have their own selectors.
 */
export const COMPOSER_SELECTORS = ["#prompt-textarea"] as const;

/**
 * ChatGPT Canvas / writing-block document editor.
 *
 * Verified against user-provided Canvas markup (2026-09): the editor is
 * a `ProseMirror.markdown.prose` contenteditable with
 * `data-writing-block-fullscreen-editor-region="true"`. The same
 * attribute is used for both fullscreen and inline
 * (`data-writing-block-fullscreen-editor-layout`) layouts. Embedded
 * writing-blocks in assistant turns wrap `.ProseMirror` in
 * `[data-writing-block]`.
 *
 * Restyled separately from conversation reading text because these
 * nodes are contenteditable and would otherwise be excluded by
 * COMPOSER_AND_CONTROL_EXCLUSIONS. Do not replace this with a generic
 * `[contenteditable]` rule.
 */
export const CANVAS_EDITOR_SELECTORS = [
  "[data-writing-block-fullscreen-editor-region]",
  "[data-writing-block] .ProseMirror",
] as const;

/**
 * Reading-text exclusions. The composer and Canvas editors are restyled
 * separately; these `:not()` clauses keep conversation rules off the
 * prompt editor, generic form controls, and writing-block editors.
 */
export const COMPOSER_AND_CONTROL_EXCLUSIONS = [
  "#prompt-textarea",
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  "textarea",
  "input",
  "button",
  '[role="textbox"]',
] as const;

export const ICON_PRESERVE_SELECTORS = [
  "[data-message-author-role] svg",
  "[data-message-author-role] svg *",
  "[data-message-role] svg",
  "[data-message-role] svg *",
  "[data-dil-widget-copy-target] svg",
  "[data-dil-widget-copy-target] svg *",
  ".markdown.markdown-new-styling svg",
  ".markdown.markdown-new-styling svg *",
  "[data-writing-block-fullscreen-editor-region] svg",
  "[data-writing-block-fullscreen-editor-region] svg *",
  "[data-writing-block] .ProseMirror svg",
  "[data-writing-block] .ProseMirror svg *",
] as const;
