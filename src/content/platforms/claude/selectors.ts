/**
 * Claude-specific selectors, isolated so they can be updated when the site
 * changes. Authenticated conversation DOM only (2026-09).
 *
 * User messages (verified):
 *   [data-testid="user-message"]
 *   Contains a descendant <p>, often with dir="rtl" or dir="ltr". RastText
 *   must not mutate those attributes. Do not depend on Tailwind classes or
 *   the current wrapper depth beyond this stable root.
 *
 * Assistant reading (verified):
 *   [data-testid="transcript-row"][data-perf-row="assistant"] [data-cds="Prose"]
 *   Scoped under assistant transcript rows so the message action toolbar,
 *   timestamps, buttons, and icons outside Prose are not restyled. Do not
 *   apply the font to the entire transcript row. The morphing TurnStatus
 *   label is a separate UI surface (see ASSISTANT_TURN_STATUS_ROOT).
 *
 * Claude already sets dir="rtl" or dir="ltr" on many generated blocks
 * (p, h3, ul, …). RastText must not replace those attributes. The generic
 * BiDi engine still applies unicode-bidi: plaintext and text-align: start
 * to logical prose blocks. That CSS-only first-strong path is not enough
 * for Claude assistant prose that begins with English but is
 * Persian-dominant; `platforms/claude/direction.ts` resolves those
 * blocks locally and stores the result in `data-rasttext-dir` without
 * rewriting Claude's `dir`.
 *
 * Composer (verified 2026-09, authenticated Claude):
 *   [data-testid="chat-input"][contenteditable="true"][role="textbox"]
 *   Logical typed blocks are descendant p / li / blockquote. Claude may
 *   set dir="rtl" on the editor and dir="auto" on paragraphs; RastText
 *   must not rewrite those. Do not depend on ProseMirror, tiptap,
 *   marlin, Tailwind, generated IDs, wrapper depth, or
 *   data-chat-host-shape. Do not target [data-cds="ChatComposerEditor"],
 *   [data-cds="ChatComposerActions"], send/attach/voice controls, or
 *   [data-composer-placeholder-ghost].
 *
 * [data-ask-user-input-banner] is the active AskUserQuestion UI, not the
 * composer. Question and option text live in nested spans.
 *
 * Completed AskUserQuestion answers [data-testid="ask-user-answers-card"]:
 * verified UI surface. Question and answer text live in nested spans.
 * Font support is implemented through UiSurface. UI-surface-specific BiDi
 * is deferred: the generic BiDi engine only isolates conversation blocks
 * and bidiLeaf selectors, and extending that contract is out of scope.
 *
 * Sidebar conversation titles (verified 2026-09):
 *   [data-testid="sidebar"] [data-row-key^="chat:"] [data-row-label]
 *   The visible title is nested in spans under [data-row-label]. The
 *   More Options control is a sibling [data-row-action] and must not be
 *   targeted. Do not style the whole sidebar, the whole chat row, or
 *   [data-cds="Icon"]. Do not depend on [data-testid="sidebar-recents"]
 *   alone — Claude may render multiple recents containers for hidden
 *   modes. The chat: prefix is semantic; never hardcode a conversation
 *   UUID. Out of scope for this surface: project labels, nav items
 *   (New / Projects / Artifacts / Code / Customize), and the account
 *   footer.
 *
 * Code: fenced `pre` blocks (including `pre.code-block__code` rendered
 * outside `[data-cds="Prose"]`) use the conversation font. Claude sets
 * inline `font-family: var(--font-mono)` on `pre`/`code`. Inline `code`,
 * `kbd`, `samp`, and `tt` outside `pre` keep the monospace rule.
 *
 * Streaming attributes (data-perf-row-streaming, data-is-streaming) are
 * not used as selectors. Font CSS still covers streaming and completed
 * messages alike. Assistant-block direction resolution may observe
 * `[data-cds="Prose"]` under assistant transcript rows (see
 * `direction.ts`); do not observe the whole document for characterData
 * and do not put that observer in this file.
 *
 * Do not use generated or utility classes such as font-claude-response,
 * standard-markdown, progressive-markdown, _blocks_*, Tailwind utilities,
 * or random IDs such as _r_59_.
 */

export const USER_MESSAGE_ROOT = '[data-testid="user-message"]';

export const ASSISTANT_ROW_ROOT =
  '[data-testid="transcript-row"][data-perf-row="assistant"]';

export const ASSISTANT_PROSE_ROOT = `${ASSISTANT_ROW_ROOT} [data-cds="Prose"]`;

export const CONVERSATION_READING_SELECTORS = [
  ASSISTANT_PROSE_ROOT,
  USER_MESSAGE_ROOT,
] as const;

/**
 * Both conversation roots wrap one or more prose blocks. Isolating a
 * wrapper would give the whole message one inferred base direction.
 */
export function isBidiWrapperSelector(selector: string): boolean {
  return (
    selector.includes('[data-cds="Prose"]') || selector.includes(USER_MESSAGE_ROOT)
  );
}

export const BIDI_LEAF_SELECTORS = CONVERSATION_READING_SELECTORS.filter(
  (selector) => !isBidiWrapperSelector(selector),
);

/**
 * Stable Claude prompt editor. Do not substitute ProseMirror/tiptap
 * classes or the ChatComposerEditor wrapper.
 */
export const CLAUDE_COMPOSER_EDITOR =
  '[data-testid="chat-input"][contenteditable="true"][role="textbox"]';

export const FENCED_CODE_BIDI_SELECTORS = [
  `${ASSISTANT_ROW_ROOT} pre`,
  `${ASSISTANT_ROW_ROOT} pre code`,
  `${USER_MESSAGE_ROOT} pre`,
  `${USER_MESSAGE_ROOT} pre code`,
  `${CLAUDE_COMPOSER_EDITOR} pre`,
  `${CLAUDE_COMPOSER_EDITOR} pre code`,
] as const;

export const CODE_FONT_SELECTORS = [
  `${ASSISTANT_ROW_ROOT} pre`,
  `${ASSISTANT_ROW_ROOT} pre *`,
  `${USER_MESSAGE_ROOT} pre`,
  `${USER_MESSAGE_ROOT} pre *`,
  `${CLAUDE_COMPOSER_EDITOR} pre`,
  `${CLAUDE_COMPOSER_EDITOR} pre *`,
] as const;

export const CODE_PRESERVE_SELECTORS = [
  `${ASSISTANT_ROW_ROOT} :is(code, kbd, samp, tt):not(pre *)`,
  `${ASSISTANT_ROW_ROOT} :is(code, kbd, samp, tt):not(pre *) *`,
  `${USER_MESSAGE_ROOT} :is(code, kbd, samp, tt):not(pre *)`,
  `${USER_MESSAGE_ROOT} :is(code, kbd, samp, tt):not(pre *) *`,
  `${CLAUDE_COMPOSER_EDITOR} :is(code, kbd, samp, tt):not(pre *)`,
  `${CLAUDE_COMPOSER_EDITOR} :is(code, kbd, samp, tt):not(pre *) *`,
] as const;

/**
 * Normal Claude prompt editor only. The composer wrapper and action
 * chrome are intentionally omitted so attach/send/voice stay untouched.
 */
export const COMPOSER_SELECTORS = [CLAUDE_COMPOSER_EDITOR] as const;

/**
 * Claude has no verified Canvas / writing-block editor in this task.
 */
export const CANVAS_EDITOR_SELECTORS = [] as const;

/**
 * Keep conversation rules off the prompt editor and generic form
 * controls if any appear inside a reading root.
 */
export const COMPOSER_AND_CONTROL_EXCLUSIONS = [
  CLAUDE_COMPOSER_EDITOR,
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  "textarea",
  "input",
  "button",
  '[role="textbox"]',
] as const;

/**
 * Claude chrome surfaces (not conversation reading text). Add one surface
 * at a time from authenticated DOM evidence. Planned later, not in this
 * list until markup is verified: project group labels, "Chats and tasks",
 * nav labels (New / Projects / Artifacts / Code / Customize), account
 * footer, and other sidebar buttons.
 */
export const CLAUDE_UI_SURFACE_IDS = [
  "sidebar-chat-titles",
  "ask-user-answers-card",
  "ask-user-input-banner",
  "assistant-turn-status",
] as const;

export type ClaudeUiSurfaceId = (typeof CLAUDE_UI_SURFACE_IDS)[number];

export type ClaudeUiSurface = {
  readonly id: ClaudeUiSurfaceId;
  readonly selectors: readonly string[];
  readonly textDescendants: readonly string[];
};

/**
 * Text spans inside AskUserQuestion UI. Icons are often plain spans with
 * ligature fonts (no `data-cds="Icon"`, no `svg`). Exclude decorative and
 * icon wrapper nodes, and spans that only exist to host an icon child.
 */
export const ASK_USER_TEXT_SPAN_SELECTOR = [
  "span",
  ':not([data-cds="Icon"])',
  ':not([aria-hidden="true"])',
  ':not([role="img"])',
  ":not(:has(svg))",
  ':not(:has([aria-hidden="true"]))',
  ':not(:has([data-cds="Icon"]))',
].join("");

/**
 * Sidebar conversation titles. Verified against authenticated Claude
 * markup (2026-09): chat rows expose `data-row-key="chat:<uuid>"` and the
 * visible title is `[data-row-label]`, with overflow implemented as
 * nested spans. Scoped under `[data-testid="sidebar"]` so other
 * `data-row-key` / `data-row-label` uses outside the sidebar are ignored.
 *
 * Do not target generated classes such as `_r_4o_`, `dframe-*` / `df-*`
 * utilities, Tailwind classes, the row `<a>`, `[data-row-action]`,
 * `[data-cds="Icon"]`, or a concrete conversation UUID.
 */
export const SIDEBAR_CHAT_TITLE_SELECTORS = [
  '[data-testid="sidebar"] [data-row-key^="chat:"] [data-row-label]',
] as const;

export const SIDEBAR_CHAT_TITLE_TEXT_DESCENDANTS = ["span"] as const;

/**
 * Completed AskUserQuestion answers card. Verified against authenticated
 * Claude markup (2026-09): the rendered Q/A list is
 * `[data-testid="ask-user-answers-card"]`, with each question and answer
 * in a nested `span`. This is not the composer and not the active
 * AskUserQuestion input banner (`[data-ask-user-input-banner]`).
 *
 * Do not depend on Tailwind utilities (`text-secondary`, `text-primary`,
 * `font-base`, `flex`, `contents`), wrapper depth, or generated IDs.
 *
 * BiDi: each span is an independent question/answer text unit. Plaintext
 * isolation is applied in `direction.ts` (see `ASK_USER_PLAINTEXT_BIDI_SELECTORS`).
 */
export const ASK_USER_ANSWERS_CARD_SELECTORS = [
  '[data-testid="ask-user-answers-card"]',
] as const;

export const ASK_USER_ANSWERS_CARD_TEXT_DESCENDANTS = ["span"] as const;

/**
 * Active AskUserQuestion input banner. Verified against authenticated
 * Claude markup (2026-09): Persian question and option text render inside
 * `[data-ask-user-input-banner]` in nested spans. This is not the composer
 * and not the completed answers card (`ask-user-answers-card`).
 *
 * Do not depend on Tailwind utilities, wrapper depth, or generated IDs.
 */
export const ASK_USER_INPUT_BANNER_SELECTORS = ["[data-ask-user-input-banner]"] as const;

export const ASK_USER_INPUT_BANNER_TEXT_DESCENDANTS = ["span"] as const;

/**
 * Independent question/answer text units inside AskUserQuestion UI.
 * Scoped span selectors only — never a global `span` rule.
 */
export const ASK_USER_PLAINTEXT_BIDI_SELECTORS = [
  `${ASK_USER_ANSWERS_CARD_SELECTORS[0]} ${ASK_USER_TEXT_SPAN_SELECTOR}`,
  `${ASK_USER_INPUT_BANNER_SELECTORS[0]} ${ASK_USER_TEXT_SPAN_SELECTOR}`,
] as const;

/**
 * Assistant TurnStatus morphing label (verified 2026-09). Lives in
 * assistant transcript rows, outside `[data-cds="Prose"]`. Visible text
 * is nested spans plus a `<bdi>` under `[data-morph-key]`.
 *
 * Do not use generated React Aria IDs (`_r_*_-text`, `_r_*_-label`),
 * Tailwind utilities (`font-sans`, `text-muted`, `truncate`, `flex`),
 * wrapper depth, or CSS variables such as `--cds-turn-status-hang`.
 *
 * The container selector stays on ancestors that contain the morphing
 * label and do not also wrap Prose, so plaintext direction can follow
 * the status row without flipping the whole assistant turn.
 */
export const ASSISTANT_TURN_STATUS_ROOT = `${ASSISTANT_ROW_ROOT} [data-morph-key]`;

export const ASSISTANT_TURN_STATUS_CONTAINER = `${ASSISTANT_ROW_ROOT} :has([data-morph-key]):not(:has([data-cds="Prose"]))`;

export const ASSISTANT_TURN_STATUS_SELECTORS = [ASSISTANT_TURN_STATUS_ROOT] as const;

export const ASSISTANT_TURN_STATUS_TEXT_DESCENDANTS = ["span", "bdi"] as const;

export const ASSISTANT_TURN_STATUS_PLAINTEXT_BIDI_SELECTORS = [
  ASSISTANT_TURN_STATUS_CONTAINER,
  ASSISTANT_TURN_STATUS_ROOT,
  `${ASSISTANT_TURN_STATUS_ROOT} span`,
  `${ASSISTANT_TURN_STATUS_ROOT} bdi`,
] as const;

/**
 * AskUserQuestion UI often renders inside assistant Prose, so children
 * inherit the conversation font stack. Revert only the shell and svg nodes;
 * CDS icon ligatures are restored via `CLAUDE_CDS_ICON_*` below.
 */
export const ASK_USER_ICON_PRESERVE_SELECTORS = [
  ASK_USER_ANSWERS_CARD_SELECTORS[0],
  ASK_USER_INPUT_BANNER_SELECTORS[0],
  `${ASK_USER_ANSWERS_CARD_SELECTORS[0]} svg`,
  `${ASK_USER_ANSWERS_CARD_SELECTORS[0]} svg *`,
  `${ASK_USER_INPUT_BANNER_SELECTORS[0]} svg`,
  `${ASK_USER_INPUT_BANNER_SELECTORS[0]} svg *`,
] as const;

export const ASSISTANT_TURN_STATUS_ICON_PRESERVE_SELECTORS = [
  `${ASSISTANT_TURN_STATUS_ROOT} svg`,
  `${ASSISTANT_TURN_STATUS_ROOT} svg *`,
] as const;

/**
 * Claude renders UI icons as Private Use Area ligatures from the host-loaded
 * Anthropicons variable font (`[data-cds="Icon"]`). Do not `revert` these;
 * name the face explicitly so Peyda / Persian-glyphs stacks cannot win.
 */
export const CLAUDE_CDS_ICON_FONT_FAMILY = [
  '"Anthropicons-Variable"',
  '"Anthropicons"',
  "ui-sans-serif",
  "system-ui",
  "sans-serif",
].join(", ");

export const CLAUDE_CDS_ICON_PRESERVE_SELECTORS = ['[data-cds="Icon"]'] as const;

export const ICON_PRESERVE_SELECTORS = [
  `${ASSISTANT_PROSE_ROOT} svg`,
  `${ASSISTANT_PROSE_ROOT} svg *`,
  `${USER_MESSAGE_ROOT} svg`,
  `${USER_MESSAGE_ROOT} svg *`,
  `${CLAUDE_COMPOSER_EDITOR} svg`,
  `${CLAUDE_COMPOSER_EDITOR} svg *`,
  ...ASK_USER_ICON_PRESERVE_SELECTORS,
  ...ASSISTANT_TURN_STATUS_ICON_PRESERVE_SELECTORS,
] as const;

export const CLAUDE_UI_SURFACES: readonly ClaudeUiSurface[] = [
  {
    id: "sidebar-chat-titles",
    selectors: SIDEBAR_CHAT_TITLE_SELECTORS,
    textDescendants: SIDEBAR_CHAT_TITLE_TEXT_DESCENDANTS,
  },
  {
    id: "ask-user-answers-card",
    selectors: [`${ASK_USER_ANSWERS_CARD_SELECTORS[0]} ${ASK_USER_TEXT_SPAN_SELECTOR}`],
    textDescendants: [],
  },
  {
    id: "ask-user-input-banner",
    selectors: [`${ASK_USER_INPUT_BANNER_SELECTORS[0]} ${ASK_USER_TEXT_SPAN_SELECTOR}`],
    textDescendants: [],
  },
  {
    id: "assistant-turn-status",
    selectors: ASSISTANT_TURN_STATUS_SELECTORS,
    textDescendants: ASSISTANT_TURN_STATUS_TEXT_DESCENDANTS,
  },
];
