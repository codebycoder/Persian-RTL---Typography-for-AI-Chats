import assert from "node:assert/strict";
import { test } from "node:test";
import { buildUiSurfaceTextSelectors } from "../types";
import {
  ASK_USER_ANSWERS_CARD_SELECTORS,
  ASK_USER_ANSWERS_CARD_TEXT_DESCENDANTS,
  ASK_USER_INPUT_BANNER_SELECTORS,
  ASK_USER_INPUT_BANNER_TEXT_DESCENDANTS,
  ASK_USER_PLAINTEXT_BIDI_SELECTORS,
  ASK_USER_TEXT_SPAN_SELECTOR,
  ASSISTANT_PROSE_ROOT,
  ASSISTANT_ROW_ROOT,
  ASSISTANT_TURN_STATUS_CONTAINER,
  ASSISTANT_TURN_STATUS_PLAINTEXT_BIDI_SELECTORS,
  ASSISTANT_TURN_STATUS_ROOT,
  ASSISTANT_TURN_STATUS_SELECTORS,
  ASSISTANT_TURN_STATUS_TEXT_DESCENDANTS,
  BIDI_LEAF_SELECTORS,
  CANVAS_EDITOR_SELECTORS,
  CLAUDE_COMPOSER_EDITOR,
  CLAUDE_UI_SURFACES,
  CODE_FONT_SELECTORS,
  CODE_PRESERVE_SELECTORS,
  COMPOSER_AND_CONTROL_EXCLUSIONS,
  COMPOSER_SELECTORS,
  CONVERSATION_READING_SELECTORS,
  ICON_PRESERVE_SELECTORS,
  SIDEBAR_CHAT_TITLE_SELECTORS,
  SIDEBAR_CHAT_TITLE_TEXT_DESCENDANTS,
  USER_MESSAGE_ROOT,
  isBidiWrapperSelector,
} from "./selectors";

const GENERATED_CLASS_PATTERNS = [
  /font-claude-response/,
  /standard-markdown/,
  /progressive-markdown/,
  /_blocks_/,
  /_r_[A-Za-z0-9]+_/,
  /dframe-/,
  /\bdf-/,
] as const;

function allClaudeSelectors(): string[] {
  return [
    ...CONVERSATION_READING_SELECTORS,
    ...BIDI_LEAF_SELECTORS,
    ...CODE_PRESERVE_SELECTORS,
    ...CODE_FONT_SELECTORS,
    ...COMPOSER_SELECTORS,
    ...CANVAS_EDITOR_SELECTORS,
    ...COMPOSER_AND_CONTROL_EXCLUSIONS,
    ...ICON_PRESERVE_SELECTORS,
    ...SIDEBAR_CHAT_TITLE_SELECTORS,
    ...buildUiSurfaceTextSelectors(CLAUDE_UI_SURFACES),
  ];
}

function conversationSelectors(): string[] {
  return [
    ...CONVERSATION_READING_SELECTORS,
    ...BIDI_LEAF_SELECTORS,
    ...CODE_PRESERVE_SELECTORS,
    ...CODE_FONT_SELECTORS,
    ...COMPOSER_SELECTORS,
    ...CANVAS_EDITOR_SELECTORS,
    ...COMPOSER_AND_CONTROL_EXCLUSIONS,
  ];
}

test("Claude assistant selector uses verified Prose under assistant transcript rows", () => {
  assert.equal(
    ASSISTANT_PROSE_ROOT,
    '[data-testid="transcript-row"][data-perf-row="assistant"] [data-cds="Prose"]',
  );
  assert.ok(CONVERSATION_READING_SELECTORS.includes(ASSISTANT_PROSE_ROOT));
  assert.ok(ASSISTANT_PROSE_ROOT.includes('[data-testid="transcript-row"]'));
  assert.ok(ASSISTANT_PROSE_ROOT.includes('[data-perf-row="assistant"]'));
  assert.ok(ASSISTANT_PROSE_ROOT.includes('[data-cds="Prose"]'));
});

test("Claude assistant styling does not target the entire transcript row", () => {
  for (const selector of CONVERSATION_READING_SELECTORS) {
    assert.notEqual(selector.trim(), '[data-testid="transcript-row"]');
    assert.notEqual(selector.trim(), '[data-testid="transcript-row"][data-perf-row="assistant"]');
  }

  assert.match(ASSISTANT_PROSE_ROOT, /\[data-testid="transcript-row"\].+\[data-cds="Prose"\]/);
});

test("Claude user selector uses the verified user-message root", () => {
  assert.equal(USER_MESSAGE_ROOT, '[data-testid="user-message"]');
  assert.ok(CONVERSATION_READING_SELECTORS.includes(USER_MESSAGE_ROOT));
});

test("Claude selectors do not use generated classes or random IDs", () => {
  const selectors = allClaudeSelectors().join("\n");

  for (const pattern of GENERATED_CLASS_PATTERNS) {
    assert.doesNotMatch(selectors, pattern);
  }

  for (const selector of CONVERSATION_READING_SELECTORS) {
    assert.doesNotMatch(selector, /\.[A-Za-z_-]/);
  }
});

test("Claude conversation selectors stay on verified roots and omit uncaptured chrome", () => {
  const selectors = conversationSelectors().join("\n");

  assert.doesNotMatch(selectors, /data-ask-user-input-banner/);
  assert.doesNotMatch(selectors, /ask-user-answers-card/);
  assert.doesNotMatch(selectors, /data-morph-key/);
  assert.doesNotMatch(selectors, /data-perf-row-streaming/);
  assert.doesNotMatch(selectors, /data-is-streaming/);
  assert.doesNotMatch(selectors, /data-sidebar-item/);
  assert.doesNotMatch(selectors, /sidebar-recents/);
  assert.doesNotMatch(selectors, /#prompt-textarea/);
  assert.doesNotMatch(selectors, /font-claude-response/);
});

test("Claude composer selector uses the verified chat-input textbox", () => {
  assert.equal(
    CLAUDE_COMPOSER_EDITOR,
    '[data-testid="chat-input"][contenteditable="true"][role="textbox"]',
  );
  assert.deepEqual([...COMPOSER_SELECTORS], [CLAUDE_COMPOSER_EDITOR]);
  assert.ok(CLAUDE_COMPOSER_EDITOR.includes('[data-testid="chat-input"]'));
  assert.ok(CLAUDE_COMPOSER_EDITOR.includes('[contenteditable="true"]'));
  assert.ok(CLAUDE_COMPOSER_EDITOR.includes('[role="textbox"]'));
  assert.ok(COMPOSER_AND_CONTROL_EXCLUSIONS.includes(CLAUDE_COMPOSER_EDITOR));
});

test("Claude composer selector does not depend on ProseMirror, tiptap, or generated IDs", () => {
  const selectors = [...COMPOSER_SELECTORS, ...CODE_PRESERVE_SELECTORS, ...ICON_PRESERVE_SELECTORS].join(
    "\n",
  );

  assert.doesNotMatch(selectors, /ProseMirror|tiptap|marlin/i);
  assert.doesNotMatch(selectors, /ChatComposerEditor|ChatComposerActions/);
  assert.doesNotMatch(selectors, /chat-input-send|chat-input-attach/);
  assert.doesNotMatch(selectors, /data-chat-host-shape|data-composer-editor/);
  assert.doesNotMatch(selectors, /_r_[A-Za-z0-9]+_/);
  assert.deepEqual([...CANVAS_EDITOR_SELECTORS], []);
});

test("Claude sidebar UiSurface exists and uses verified conversation title attributes", () => {
  const sidebar = CLAUDE_UI_SURFACES.find((surface) => surface.id === "sidebar-chat-titles");

  assert.ok(sidebar, "expected a sidebar-chat-titles UiSurface");
  assert.deepEqual([...SIDEBAR_CHAT_TITLE_SELECTORS], [
    '[data-testid="sidebar"] [data-row-key^="chat:"] [data-row-label]',
  ]);
  assert.deepEqual([...sidebar.selectors], [...SIDEBAR_CHAT_TITLE_SELECTORS]);

  const selector = SIDEBAR_CHAT_TITLE_SELECTORS[0] ?? "";
  assert.ok(selector.includes('[data-testid="sidebar"]'));
  assert.ok(selector.includes('[data-row-key^="chat:"]'));
  assert.ok(selector.includes("[data-row-label]"));
});

test("Claude sidebar title selector generation covers the label and nested spans", () => {
  const selectors = buildUiSurfaceTextSelectors(CLAUDE_UI_SURFACES);

  assert.ok(selectors.includes('[data-testid="sidebar"] [data-row-key^="chat:"] [data-row-label]'));
  assert.ok(
    selectors.includes('[data-testid="sidebar"] [data-row-key^="chat:"] [data-row-label] :is(span)'),
  );
  assert.deepEqual([...SIDEBAR_CHAT_TITLE_TEXT_DESCENDANTS], ["span"]);
});

test("Claude sidebar selectors stay on chat titles and omit generated classes, UUIDs, and chrome", () => {
  const selectors = [
    ...SIDEBAR_CHAT_TITLE_SELECTORS,
    ...buildUiSurfaceTextSelectors(CLAUDE_UI_SURFACES),
  ];
  const joined = selectors.join("\n");

  for (const pattern of GENERATED_CLASS_PATTERNS) {
    assert.doesNotMatch(joined, pattern);
  }

  assert.doesNotMatch(joined, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.doesNotMatch(joined, /sidebar-recents/);
  assert.doesNotMatch(joined, /data-row-action/);
  assert.doesNotMatch(joined, /\[data-testid="sidebar"\][^\n]*data-cds="Icon"/);
  assert.doesNotMatch(joined, /dframe-|df-drag|df-leading|df-fade/);

  const sidebarSelectors = [
    ...SIDEBAR_CHAT_TITLE_SELECTORS,
    ...buildUiSurfaceTextSelectors(
      CLAUDE_UI_SURFACES.filter((surface) => surface.id === "sidebar-chat-titles"),
    ),
  ];

  for (const selector of sidebarSelectors) {
    assert.doesNotMatch(selector, /\.[A-Za-z_-]/);
    assert.notEqual(selector.trim(), '[data-testid="sidebar"]');
    assert.notEqual(selector.trim(), '[data-row-key^="chat:"]');
    assert.equal(/\bbutton\b/.test(selector), false, `must not target button: ${selector}`);
    assert.equal(/\bsvg\b/.test(selector), false, `must not target svg: ${selector}`);
    assert.equal(
      /(?:^|\s)a(?:\s|:|,|$)/.test(selector),
      false,
      `must not restyle the row link: ${selector}`,
    );
  }
});

test("Claude sidebar titles stay separate from conversation reading selectors", () => {
  for (const selector of CONVERSATION_READING_SELECTORS) {
    assert.equal(
      selector.includes("data-row-label") || selector.includes("data-row-key"),
      false,
      "conversation selectors must stay separate from sidebar chrome",
    );
  }
});

test("Claude Ask User Answers UiSurface exists and uses the verified answers-card root", () => {
  assert.deepEqual(
    CLAUDE_UI_SURFACES.map((surface) => surface.id),
    ["sidebar-chat-titles", "ask-user-answers-card", "ask-user-input-banner", "assistant-turn-status"],
  );

  const answersCard = CLAUDE_UI_SURFACES.find((surface) => surface.id === "ask-user-answers-card");

  assert.ok(answersCard, "expected an ask-user-answers-card UiSurface");
  assert.deepEqual([...ASK_USER_ANSWERS_CARD_SELECTORS], [
    '[data-testid="ask-user-answers-card"]',
  ]);
  assert.deepEqual([...ASK_USER_ANSWERS_CARD_TEXT_DESCENDANTS], ["span"]);
  assert.deepEqual([...answersCard.textDescendants], []);
  assert.deepEqual([...answersCard.selectors], [
    `[data-testid="ask-user-answers-card"] ${ASK_USER_TEXT_SPAN_SELECTOR}`,
  ]);
});

test("Claude Ask User Answers selector generation covers text spans and excludes icons", () => {
  const selectors = buildUiSurfaceTextSelectors(
    CLAUDE_UI_SURFACES.filter((surface) => surface.id === "ask-user-answers-card"),
  );

  assert.ok(
    selectors.includes(
      `[data-testid="ask-user-answers-card"] ${ASK_USER_TEXT_SPAN_SELECTOR}`,
    ),
  );
  assert.equal(
    selectors.some((selector) => selector === '[data-testid="ask-user-answers-card"]'),
    false,
    "must not apply font to the whole card root",
  );
  assert.equal(
    selectors.some((selector) => selector.trim() === "span"),
    false,
    "must not emit a global span selector",
  );
});

test("Claude Ask User Answers selectors stay on the card and omit Tailwind, wrapper depth, and chrome", () => {
  const selectors = [
    ...ASK_USER_ANSWERS_CARD_SELECTORS,
    ...buildUiSurfaceTextSelectors(
      CLAUDE_UI_SURFACES.filter((surface) => surface.id === "ask-user-answers-card"),
    ),
  ];
  const joined = selectors.join("\n");

  for (const pattern of GENERATED_CLASS_PATTERNS) {
    assert.doesNotMatch(joined, pattern);
  }

  assert.doesNotMatch(joined, /text-secondary|text-primary|font-base/);
  assert.doesNotMatch(joined, /(?:^|[\s.[])(?:flex|contents)(?:\s|[.\]]|$)/);
  assert.doesNotMatch(joined, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.doesNotMatch(joined, /data-ask-user-input-banner/);
  assert.doesNotMatch(joined, /#prompt-textarea/);
  assert.doesNotMatch(joined, /data-testid="transcript-row"/);
  assert.doesNotMatch(joined, /data-testid="user-message"/);

  for (const selector of selectors) {
    assert.doesNotMatch(selector, /\.[A-Za-z_-]/);
    assert.doesNotMatch(selector, />/);
    assert.notEqual(selector.trim(), "span");
    assert.notEqual(selector.trim(), '[data-testid="ask-user-answers-card"] *');
    assert.equal(/\bbutton\b/.test(selector), false, `must not target button: ${selector}`);
    assert.equal(
      /\bsvg\b/.test(selector.replace(/:has\(svg\)/g, "")),
      false,
      `must not target svg: ${selector}`,
    );
    assert.equal(/\binput\b/.test(selector), false, `must not target input: ${selector}`);
    assert.equal(/\btextarea\b/.test(selector), false, `must not target textarea: ${selector}`);
  }
});

test("Claude Ask User input banner UiSurface exists and uses the verified banner root", () => {
  const banner = CLAUDE_UI_SURFACES.find((surface) => surface.id === "ask-user-input-banner");

  assert.ok(banner, "expected an ask-user-input-banner UiSurface");
  assert.deepEqual([...ASK_USER_INPUT_BANNER_SELECTORS], ["[data-ask-user-input-banner]"]);
  assert.deepEqual([...ASK_USER_INPUT_BANNER_TEXT_DESCENDANTS], ["span"]);
  assert.deepEqual([...banner.textDescendants], []);
  assert.deepEqual([...banner.selectors], [
    `[data-ask-user-input-banner] ${ASK_USER_TEXT_SPAN_SELECTOR}`,
  ]);

  const selectors = buildUiSurfaceTextSelectors([banner]);
  assert.ok(
    selectors.includes(`[data-ask-user-input-banner] ${ASK_USER_TEXT_SPAN_SELECTOR}`),
  );
  assert.equal(
    selectors.some((selector) => selector === "[data-ask-user-input-banner]"),
    false,
    "must not apply font to the whole banner root",
  );
});

test("Claude Ask User plaintext BiDi selectors stay scoped to verified Q/A spans", () => {
  const joined = ASK_USER_PLAINTEXT_BIDI_SELECTORS.join("\n");

  assert.ok(
    joined.includes(`[data-testid="ask-user-answers-card"] ${ASK_USER_TEXT_SPAN_SELECTOR}`),
  );
  assert.ok(
    joined.includes(`[data-ask-user-input-banner] ${ASK_USER_TEXT_SPAN_SELECTOR}`),
  );
  assert.doesNotMatch(joined, /(?:^|,\n)\s*span\s*(?:,|$)/);
});

test("Claude assistant TurnStatus UiSurface exists and uses the verified morph-key root", () => {
  const status = CLAUDE_UI_SURFACES.find((surface) => surface.id === "assistant-turn-status");

  assert.ok(status, "expected an assistant-turn-status UiSurface");
  assert.equal(
    ASSISTANT_TURN_STATUS_ROOT,
    '[data-testid="transcript-row"][data-perf-row="assistant"] [data-morph-key]',
  );
  assert.equal(
    ASSISTANT_TURN_STATUS_CONTAINER,
    '[data-testid="transcript-row"][data-perf-row="assistant"] :has([data-morph-key]):not(:has([data-cds="Prose"]))',
  );
  assert.deepEqual([...ASSISTANT_TURN_STATUS_SELECTORS], [ASSISTANT_TURN_STATUS_ROOT]);
  assert.deepEqual([...ASSISTANT_TURN_STATUS_TEXT_DESCENDANTS], ["span", "bdi"]);
  assert.deepEqual([...status.selectors], [ASSISTANT_TURN_STATUS_ROOT]);
  assert.deepEqual([...status.textDescendants], ["span", "bdi"]);
});

test("Claude assistant TurnStatus selector generation covers the morph label and nested text", () => {
  const selectors = buildUiSurfaceTextSelectors(
    CLAUDE_UI_SURFACES.filter((surface) => surface.id === "assistant-turn-status"),
  );

  assert.ok(selectors.includes(ASSISTANT_TURN_STATUS_ROOT));
  assert.ok(selectors.includes(`${ASSISTANT_TURN_STATUS_ROOT} :is(span, bdi)`));
  assert.equal(
    selectors.some((selector) => selector === ASSISTANT_ROW_ROOT),
    false,
    "must not apply font to the whole assistant transcript row",
  );
  assert.equal(
    selectors.some((selector) => selector.trim() === "[data-morph-key]"),
    false,
    "must not emit an unscoped morph-key selector",
  );
});

test("Claude assistant TurnStatus selectors stay on the morphing label and omit generated IDs and Tailwind", () => {
  const selectors = [
    ...ASSISTANT_TURN_STATUS_SELECTORS,
    ASSISTANT_TURN_STATUS_CONTAINER,
    ...ASSISTANT_TURN_STATUS_PLAINTEXT_BIDI_SELECTORS,
    ...buildUiSurfaceTextSelectors(
      CLAUDE_UI_SURFACES.filter((surface) => surface.id === "assistant-turn-status"),
    ),
  ];
  const joined = selectors.join("\n");

  for (const pattern of GENERATED_CLASS_PATTERNS) {
    assert.doesNotMatch(joined, pattern);
  }

  assert.doesNotMatch(joined, /font-sans|text-muted|text-body|truncate/);
  assert.doesNotMatch(joined, /turn-status-hang|cds-outset-x|cds-assistant-message-text/);
  assert.doesNotMatch(joined, /_r_[A-Za-z0-9]+_/);
  assert.doesNotMatch(joined, /ask-user-answers-card|data-ask-user-input-banner/);
  assert.doesNotMatch(joined, /data-testid="user-message"/);
  assert.doesNotMatch(joined, /data-testid="sidebar"/);

  for (const selector of selectors) {
    assert.ok(selector.includes("[data-morph-key]"));
    assert.ok(selector.includes('[data-testid="transcript-row"]'));
    assert.ok(selector.includes('[data-perf-row="assistant"]'));
    assert.doesNotMatch(selector, /\.[A-Za-z_-]/);
    assert.notEqual(selector.trim(), ASSISTANT_ROW_ROOT);
    assert.notEqual(selector.trim(), "[data-morph-key]");
    assert.notEqual(selector.trim(), "span");
    assert.notEqual(selector.trim(), "bdi");
    assert.equal(/\bbutton\b/.test(selector), false, `must not target button: ${selector}`);
    assert.equal(/\binput\b/.test(selector), false, `must not target input: ${selector}`);
  }
});

test("Claude assistant TurnStatus stays separate from conversation reading and composer selectors", () => {
  for (const selector of [
    ...CONVERSATION_READING_SELECTORS,
    ...BIDI_LEAF_SELECTORS,
    ...COMPOSER_SELECTORS,
  ]) {
    assert.equal(
      selector.includes("data-morph-key"),
      false,
      "conversation/composer selectors must stay separate from TurnStatus chrome",
    );
  }
});

test("Claude assistant TurnStatus plaintext BiDi stays scoped to the status label", () => {
  const joined = ASSISTANT_TURN_STATUS_PLAINTEXT_BIDI_SELECTORS.join("\n");

  assert.ok(joined.includes(ASSISTANT_TURN_STATUS_CONTAINER));
  assert.ok(joined.includes(ASSISTANT_TURN_STATUS_ROOT));
  assert.ok(joined.includes(`${ASSISTANT_TURN_STATUS_ROOT} span`));
  assert.ok(joined.includes(`${ASSISTANT_TURN_STATUS_ROOT} bdi`));
  assert.doesNotMatch(joined, /(?:^|,\n)\s*(?:span|bdi)\s*(?:,|$)/);
  assert.ok(joined.includes(":not(:has([data-cds=\"Prose\"]))"));
});

test("Claude Ask User Answers stays separate from conversation, composer, and the input banner", () => {
  for (const selector of [
    ...CONVERSATION_READING_SELECTORS,
    ...BIDI_LEAF_SELECTORS,
    ...COMPOSER_SELECTORS,
  ]) {
    assert.equal(
      selector.includes("ask-user-answers-card") || selector.includes("data-ask-user-input-banner"),
      false,
      "conversation/composer selectors must stay separate from Ask User Answers chrome",
    );
  }
});

test("Claude UI surface selector generation does not emit a global or subtree-wide * rule", () => {
  const selectors = buildUiSurfaceTextSelectors(CLAUDE_UI_SURFACES);

  for (const selector of selectors) {
    assert.doesNotMatch(selector, /(?:^|[\s,])\*(?:\s|:|,|$)/);
    assert.doesNotMatch(selector, /(?:^|\s)(?:html|body)(?:\s|:|,|$)/);
  }
});

test("Claude code font and preservation use only generic semantic selectors", () => {
  const codeFont = CODE_FONT_SELECTORS.join("\n");
  const code = CODE_PRESERVE_SELECTORS.join("\n");

  assert.ok(codeFont.includes(`${ASSISTANT_ROW_ROOT} pre`));
  assert.ok(codeFont.includes(`${USER_MESSAGE_ROOT} pre`));
  assert.ok(codeFont.includes(`${CLAUDE_COMPOSER_EDITOR} pre`));
  assert.match(code, /:is\(code, kbd, samp, tt\)/);
  assert.ok(code.includes(`${ASSISTANT_ROW_ROOT} :is(code, kbd, samp, tt):not(pre *)`));
  assert.ok(code.includes(`${USER_MESSAGE_ROOT} :is(code, kbd, samp, tt)`));
  assert.ok(code.includes(`${CLAUDE_COMPOSER_EDITOR} :is(code, kbd, samp, tt)`));
  assert.doesNotMatch(
    code,
    /standard-markdown|progressive-markdown|font-claude-response|_blocks_/,
  );
});

test("Claude bidi leaf selectors omit conversation wrappers", () => {
  assert.deepEqual([...BIDI_LEAF_SELECTORS], []);
  assert.equal(isBidiWrapperSelector(ASSISTANT_PROSE_ROOT), true);
  assert.equal(isBidiWrapperSelector(USER_MESSAGE_ROOT), true);

  for (const selector of CONVERSATION_READING_SELECTORS) {
    assert.equal(
      BIDI_LEAF_SELECTORS.includes(selector),
      false,
      `wrapper must not be a leaf: ${selector}`,
    );
  }
});

test("Claude icon preservation stays on svg nodes and Ask User shells", () => {
  const icons = ICON_PRESERVE_SELECTORS.join("\n");

  assert.ok(icons.includes(`${ASSISTANT_PROSE_ROOT} svg`));
  assert.ok(icons.includes(`${USER_MESSAGE_ROOT} svg`));
  assert.ok(icons.includes(`${CLAUDE_COMPOSER_EDITOR} svg`));
  assert.ok(icons.includes('[data-testid="ask-user-answers-card"]'));
  assert.ok(icons.includes("[data-ask-user-input-banner]"));
  assert.ok(icons.includes('[data-testid="ask-user-answers-card"] svg'));
  assert.ok(icons.includes("[data-ask-user-input-banner] svg"));
  assert.ok(icons.includes(`${ASSISTANT_TURN_STATUS_ROOT} svg`));
  assert.doesNotMatch(icons, /\[aria-hidden="true"\]/);
  assert.doesNotMatch(icons, /\[data-cds="Icon"\]/);
  assert.doesNotMatch(icons, /standard-markdown|_blocks_|_r_\d+_/);
  assert.doesNotMatch(icons, /chat-input-send|chat-input-attach|ChatComposerActions/);
});
