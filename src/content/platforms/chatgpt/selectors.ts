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
 *    font engine descendant rule exists for this reason.
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
 * 6. Thread shell frontend (verified live 2026-09 on chatgpt.com Work):
 *    turns use `data-turn-key`, user bubbles are
 *    `[data-user-message-bubble="true"]` with
 *    `.text-size-chat.whitespace-pre-wrap`, and assistant Markdown is
 *    `[data-markdown-text-style="assistant-message"]` (hashed classes such
 *    as `MarkdownRoot-*` / `Paragraph-*` must not be selectors). Ordinary
 *    assistant text is wrapped in many `span` nodes; there is no
 *    `data-message-author-role`, `.markdown`, or `.prose` on this markup.
 *
 * 7. File / document viewer (Canvas-adjacent, verified live 2026-09):
 *    opening a generated `.md` opens a right `role="tabpanel"` whose
 *    `data-tab-id` starts with `chatgpt-file:`. Body text is MarkdownRoot
 *    without `data-markdown-text-style`. Stable hook is the tabpanel id
 *    prefix — not hashed `MarkdownRoot-*` / `header-*` classes.
 *
 * The prompt composer sits outside message-role nodes. Older frontends
 * use `#prompt-textarea`. The current logged-in composer (verified
 * 2026-09) is a ProseMirror textbox with `data-composer-markdown` inside
 * `[data-composer-input-layout]` / `[data-rich-text-layout]`. Reading
 * selectors below still exclude it and other controls; a dedicated
 * composer rule restyles that prompt editor. Classic Canvas writing-block
 * editors (`[data-writing-block-fullscreen-editor-region]`,
 * `[data-writing-block] .ProseMirror`) are restyled by their own rule.
 * Hashed classes such as `RichTextInput-*` and `composer-*` are not
 * selectors.
 *
 * Manual verification: see README "Manual DOM verification".
 */

/**
 * Right-hand file / document viewer opened from chat Outputs.
 * Verified live 2026-09: `data-tab-id` values look like
 * `chatgpt-file:<conversationId>:...:<fileName>`.
 */
export const CHATGPT_FILE_VIEWER_PANEL =
  '[role="tabpanel"][data-tab-id^="chatgpt-file:"]';

export const CONVERSATION_READING_SELECTORS = [
  // Thread shell frontend (verified live 2026-09 on chatgpt.com Work).
  '[data-markdown-text-style="assistant-message"]',
  '[data-user-message-bubble="true"]',
  '[data-user-message-bubble="true"] .whitespace-pre-wrap',
  // File / document viewer (Canvas-adjacent Outputs panel).
  CHATGPT_FILE_VIEWER_PANEL,
  // Classic frontend. User messages confirmed working with these selectors.
  '[data-message-author-role="assistant"] .markdown',
  '[data-message-author-role="assistant"] .prose',
  '[data-message-author-role="user"] .markdown',
  '[data-message-author-role="user"] .prose',
  '[data-message-author-role="user"] .whitespace-pre-wrap',
  // Message content wrapper used by some ChatGPT builds when `.markdown`
  // is absent or nested differently.
  '[data-message-author-role="assistant"] [data-message-content]',
  '[data-message-author-role="user"] [data-message-content]',
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
 * Markdown / assistant-markdown nodes wrap many blocks. Isolating the
 * wrapper would give the whole message one inferred base direction.
 */
export function isBidiWrapperSelector(selector: string): boolean {
  return (
    selector.includes(".markdown") ||
    selector.includes("[data-assistant-markdown]") ||
    // Match both `[data-markdown-text-style]` and
    // `[data-markdown-text-style="assistant-message"]`.
    selector.includes("[data-markdown-text-style") ||
    // File viewer tabpanel wraps many Markdown blocks.
    selector.includes('data-tab-id^="chatgpt-file:"') ||
    selector.includes(CHATGPT_FILE_VIEWER_PANEL)
  );
}

export const BIDI_LEAF_SELECTORS = CONVERSATION_READING_SELECTORS.filter(
  (selector) => !isBidiWrapperSelector(selector),
);

/**
 * Current logged-in prompt editor (verified 2026-09). The text lives in
 * a ProseMirror contenteditable:
 *
 * `[data-composer-input-layout]` > `.ProseMirror[data-composer-markdown][role="textbox"]`
 *
 * `data-composer-markdown` is the stable hook. Do not use hashed classes
 * (`RichTextInput-*`, `composer-*`), `aria-label`, or a bare `.ProseMirror`
 * — Canvas writing-blocks are also ProseMirror and have their own selectors.
 */
export const CHATGPT_COMPOSER_EDITOR =
  '[data-composer-markdown][contenteditable="true"][role="textbox"]';

export const CODE_PRESERVE_SELECTORS = [
  // Thread shell frontend (verified 2026-09): inline code uses
  // `data-markdown-copy="inline-code"`; fenced blocks still use pre/code.
  '[data-markdown-text-style="assistant-message"] :is(pre, code, kbd, samp, tt)',
  '[data-markdown-text-style="assistant-message"] :is(pre, code, kbd, samp, tt) *',
  `${CHATGPT_FILE_VIEWER_PANEL} :is(pre, code, kbd, samp, tt)`,
  `${CHATGPT_FILE_VIEWER_PANEL} :is(pre, code, kbd, samp, tt) *`,
  `${CHATGPT_FILE_VIEWER_PANEL} [data-markdown-copy="inline-code"]`,
  `${CHATGPT_FILE_VIEWER_PANEL} [data-markdown-copy="inline-code"] *`,
  '[data-markdown-copy="inline-code"]',
  '[data-markdown-copy="inline-code"] *',
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
  `${CHATGPT_COMPOSER_EDITOR} :is(pre, code, kbd, samp, tt)`,
  `${CHATGPT_COMPOSER_EDITOR} :is(pre, code, kbd, samp, tt) *`,
] as const;

/**
 * Prompt composer only. Older frontends use `#prompt-textarea` (a
 * ProseMirror contenteditable or a `textarea`). The current editor is
 * `CHATGPT_COMPOSER_EDITOR`. Do not broaden this to every contenteditable.
 */
export const COMPOSER_SELECTORS = ["#prompt-textarea", CHATGPT_COMPOSER_EDITOR] as const;

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
 * The newer Outputs file viewer is read-only Markdown inside
 * {@link CHATGPT_FILE_VIEWER_PANEL} and lives in
 * `CONVERSATION_READING_SELECTORS`, not here.
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

/** Selector list used to recognize managed Canvas editors for BiDi. */
export const CANVAS_EDITOR_ROOT_SELECTOR = CANVAS_EDITOR_SELECTORS.join(", ");

/**
 * Reading-text exclusions. The composer and Canvas editors are restyled
 * separately; these `:not()` clauses keep conversation rules off the
 * prompt editor, generic form controls, and writing-block editors.
 */
export const COMPOSER_AND_CONTROL_EXCLUSIONS = [
  "#prompt-textarea",
  CHATGPT_COMPOSER_EDITOR,
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  "textarea",
  "input",
  "button",
  '[role="textbox"]',
] as const;

export const ICON_PRESERVE_SELECTORS = [
  '[data-markdown-text-style="assistant-message"] svg',
  '[data-markdown-text-style="assistant-message"] svg *',
  `${CHATGPT_FILE_VIEWER_PANEL} svg`,
  `${CHATGPT_FILE_VIEWER_PANEL} svg *`,
  "[data-user-message-bubble] svg",
  "[data-user-message-bubble] svg *",
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

/**
 * ChatGPT chrome surfaces (not conversation reading text). Add one surface
 * at a time from authenticated DOM evidence. Planned later, not in this
 * list until markup is verified: sidebar section titles, project names,
 * menus, dialog body copy, settings, search results, tooltips.
 */
export const CHATGPT_UI_SURFACE_IDS = ["sidebar-chat-titles", "dialog-heading"] as const;

export type ChatGptUiSurfaceId = (typeof CHATGPT_UI_SURFACE_IDS)[number];

export type ChatGptUiSurface = {
  readonly id: ChatGptUiSurfaceId;
  readonly selectors: readonly string[];
  readonly textDescendants: readonly string[];
};

/**
 * Sidebar conversation titles.
 *
 * Older authenticated markup (2026-09): each row is
 * `[data-sidebar-item="true"]` and the visible title is
 * `[data-marquee-text="true"]`, with overflow/marquee implemented as
 * nested spans.
 *
 * Current thread-shell sidebar (verified live 2026-09): rows use class
 * `sidebar-item` (no `data-sidebar-item`) and the title lives under
 * `[data-thread-title-trigger="true"]` as `[data-thread-title="true"]`
 * (still paired with `[data-marquee-text="true"]` on the same span).
 *
 * `dir="auto"` on the marquee is a BiDi hint, not a font selector.
 *
 * Do not target generated classes such as `_NCija_viewport` /
 * `_NCija_content`, Tailwind utilities, the row `<a>` itself, or the
 * options button/SVG in the same item.
 */
export const SIDEBAR_CHAT_TITLE_SELECTORS = [
  '[data-sidebar-item="true"] [data-marquee-text="true"]',
  '[data-thread-title-trigger="true"] [data-thread-title="true"]',
] as const;

export const SIDEBAR_CHAT_TITLE_TEXT_DESCENDANTS = ["span"] as const;

/**
 * Dialog title. Verified against authenticated ChatGPT markup (2026-09):
 * the visible heading, including «پیشنهاد نام پروژه», is an `h2` inside
 * `.heading-dialog`. The `h2` often uses `display: contents`, and the site
 * may set `font-family` on the heading itself, so both the wrapper and the
 * `h2` are targeted.
 *
 * The same dialog can contain share copy and action labels. Those strings
 * in the verified markup are Latin and stay on the host face. Do not use
 * CSS-module hashes (`body-*`, `section-*`, `largeSection-*`, `footer-*`,
 * `Root-*`, `Icon-*`), Radix ids (`radix-_r_*`), or Tailwind utilities
 * (`truncate`, `font-semibold`, `contents`, `text-xs`).
 */
export const DIALOG_HEADING_SELECTORS = [".heading-dialog"] as const;

export const DIALOG_HEADING_TEXT_DESCENDANTS = ["h2"] as const;

export const CHATGPT_UI_SURFACES: readonly ChatGptUiSurface[] = [
  {
    id: "sidebar-chat-titles",
    selectors: SIDEBAR_CHAT_TITLE_SELECTORS,
    textDescendants: SIDEBAR_CHAT_TITLE_TEXT_DESCENDANTS,
  },
  {
    id: "dialog-heading",
    selectors: DIALOG_HEADING_SELECTORS,
    textDescendants: DIALOG_HEADING_TEXT_DESCENDANTS,
  },
];
