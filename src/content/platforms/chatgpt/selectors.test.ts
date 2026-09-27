import assert from "node:assert/strict";
import { test } from "node:test";
import { buildUiSurfaceTextSelectors } from "../types";
import {
  CANVAS_EDITOR_SELECTORS,
  CHATGPT_FILE_VIEWER_PANEL,
  CHATGPT_UI_SURFACES,
  CODE_PRESERVE_SELECTORS,
  CHATGPT_COMPOSER_EDITOR,
  COMPOSER_AND_CONTROL_EXCLUSIONS,
  COMPOSER_SELECTORS,
  CONVERSATION_READING_SELECTORS,
  ICON_PRESERVE_SELECTORS,
  DIALOG_HEADING_SELECTORS,
  DIALOG_HEADING_TEXT_DESCENDANTS,
  SIDEBAR_CHAT_TITLE_SELECTORS,
  SIDEBAR_CHAT_TITLE_TEXT_DESCENDANTS,
  BIDI_LEAF_SELECTORS,
} from "./selectors";

function allChatGptSelectors(): string[] {
  return [
    ...CONVERSATION_READING_SELECTORS,
    ...BIDI_LEAF_SELECTORS,
    ...CODE_PRESERVE_SELECTORS,
    ...COMPOSER_SELECTORS,
    ...CANVAS_EDITOR_SELECTORS,
    ...COMPOSER_AND_CONTROL_EXCLUSIONS,
    ...ICON_PRESERVE_SELECTORS,
    ...SIDEBAR_CHAT_TITLE_SELECTORS,
    ...buildUiSurfaceTextSelectors(CHATGPT_UI_SURFACES),
  ];
}

test("assistant reading selectors are preserved across frontend generations", () => {
  assert.ok(
    CONVERSATION_READING_SELECTORS.includes('[data-markdown-text-style="assistant-message"]'),
  );
  assert.ok(CONVERSATION_READING_SELECTORS.includes('[data-user-message-bubble="true"]'));
  assert.ok(
    CONVERSATION_READING_SELECTORS.includes(
      '[data-user-message-bubble="true"] .whitespace-pre-wrap',
    ),
  );
  assert.ok(CONVERSATION_READING_SELECTORS.includes(CHATGPT_FILE_VIEWER_PANEL));
  assert.deepEqual(
    [...CANVAS_EDITOR_SELECTORS],
    ["[data-writing-block-fullscreen-editor-region]", "[data-writing-block] .ProseMirror"],
  );
  assert.ok(CONVERSATION_READING_SELECTORS.includes('[data-message-author-role="assistant"] .markdown'));
  assert.ok(CONVERSATION_READING_SELECTORS.includes('[data-message-author-role="assistant"] .prose'));
  assert.ok(
    CONVERSATION_READING_SELECTORS.includes(
      '[data-message-author-role="assistant"] [data-message-content]',
    ),
  );
  assert.ok(
    CONVERSATION_READING_SELECTORS.includes(
      '[data-message-author-role="assistant"] [data-assistant-markdown]',
    ),
  );
  assert.ok(
    CONVERSATION_READING_SELECTORS.includes(
      '[data-message-role="assistant"] [data-assistant-markdown]',
    ),
  );
  assert.ok(
    CONVERSATION_READING_SELECTORS.includes(
      '[data-dil-widget-copy-target] [data-d-component="text"]',
    ),
  );
  assert.ok(
    CONVERSATION_READING_SELECTORS.includes(
      '[data-dil-widget-copy-target] [data-d-component="shimmer-text"]',
    ),
  );
  assert.ok(
    CONVERSATION_READING_SELECTORS.includes('[data-d-component="shimmer-text"]'),
  );
  assert.ok(
    CONVERSATION_READING_SELECTORS.includes(
      '[data-d-component="pressable"] ~ [data-d-component="box"] [data-d-component="text"]',
    ),
  );
  assert.ok(
    CONVERSATION_READING_SELECTORS.includes(
      '[data-message-author-role="assistant"] [data-d-component="text"]',
    ),
  );
  assert.ok(CONVERSATION_READING_SELECTORS.includes(".markdown.markdown-new-styling"));
});

test("user reading selectors are preserved across frontend generations", () => {
  assert.ok(CONVERSATION_READING_SELECTORS.includes('[data-message-author-role="user"] .markdown'));
  assert.ok(
    CONVERSATION_READING_SELECTORS.includes(
      '[data-message-author-role="user"] .whitespace-pre-wrap',
    ),
  );
  assert.ok(
    CONVERSATION_READING_SELECTORS.includes('[data-message-role="user"] [data-user-message-copy]'),
  );
});

test("sidebar title selectors use stable semantic attributes", () => {
  assert.deepEqual(SIDEBAR_CHAT_TITLE_SELECTORS, [
    '[data-sidebar-item="true"] [data-marquee-text="true"]',
    '[data-thread-title-trigger="true"] [data-thread-title="true"]',
  ]);
  assert.ok(SIDEBAR_CHAT_TITLE_SELECTORS[0]?.includes('[data-sidebar-item="true"]'));
  assert.ok(SIDEBAR_CHAT_TITLE_SELECTORS[0]?.includes('[data-marquee-text="true"]'));
  assert.ok(SIDEBAR_CHAT_TITLE_SELECTORS[1]?.includes('[data-thread-title-trigger="true"]'));
  assert.ok(SIDEBAR_CHAT_TITLE_SELECTORS[1]?.includes('[data-thread-title="true"]'));
});

test("sidebar title selector generation covers the marquee and nested spans", () => {
  const selectors = buildUiSurfaceTextSelectors(CHATGPT_UI_SURFACES);

  assert.ok(selectors.includes('[data-sidebar-item="true"] [data-marquee-text="true"]'));
  assert.ok(selectors.includes('[data-sidebar-item="true"] [data-marquee-text="true"] :is(span)'));
  assert.ok(
    selectors.includes('[data-thread-title-trigger="true"] [data-thread-title="true"]'),
  );
  assert.ok(
    selectors.includes('[data-thread-title-trigger="true"] [data-thread-title="true"] :is(span)'),
  );
  assert.deepEqual(SIDEBAR_CHAT_TITLE_TEXT_DESCENDANTS, ["span"]);
});

test("sidebar title selectors do not use generated ChatGPT classes or Tailwind utilities", () => {
  const selectors = [
    ...SIDEBAR_CHAT_TITLE_SELECTORS,
    ...buildUiSurfaceTextSelectors(CHATGPT_UI_SURFACES),
  ].join("\n");

  assert.doesNotMatch(selectors, /_NCija_/);
  assert.doesNotMatch(selectors, /clipViewport|marquee-text="true"\]\./);
  assert.doesNotMatch(selectors, /\b(?:truncate|group|__menu-item)\b/);
});

test("ChatGPT selectors do not introduce generated _NCija_ classes", () => {
  const selectors = allChatGptSelectors().join("\n");

  assert.doesNotMatch(selectors, /_NCija_/);
  assert.doesNotMatch(selectors, /clipViewport/);
});

test("sidebar title selectors do not target the options button or SVG", () => {
  const selectors = buildUiSurfaceTextSelectors(CHATGPT_UI_SURFACES);

  for (const selector of selectors) {
    assert.equal(/\bbutton\b/.test(selector), false, `must not target button: ${selector}`);
    assert.equal(/\bsvg\b/.test(selector), false, `must not target svg: ${selector}`);
    const isSidebarRowSelector =
      selector.includes('[data-sidebar-item="true"]') ||
      selector.includes('[data-thread-title-trigger="true"]');
    assert.equal(
      isSidebarRowSelector && /(?:^|\s)a(?:\s|:|,|$)/.test(selector),
      false,
      `must not restyle the row link: ${selector}`,
    );
  }
});

test("dialog heading selectors use the stable heading class and the title element", () => {
  assert.deepEqual(DIALOG_HEADING_SELECTORS, [".heading-dialog"]);
  assert.deepEqual(DIALOG_HEADING_TEXT_DESCENDANTS, ["h2"]);

  const dialog = CHATGPT_UI_SURFACES.find((surface) => surface.id === "dialog-heading");
  assert.ok(dialog, "expected a dialog-heading UiSurface");
  assert.deepEqual([...dialog.selectors], [...DIALOG_HEADING_SELECTORS]);
  assert.deepEqual([...dialog.textDescendants], [...DIALOG_HEADING_TEXT_DESCENDANTS]);

  const selectors = buildUiSurfaceTextSelectors(
    CHATGPT_UI_SURFACES.filter((surface) => surface.id === "dialog-heading"),
  );

  assert.deepEqual(selectors, [".heading-dialog", ".heading-dialog :is(h2)"]);
});

test("dialog heading selectors do not use hashed classes, Radix ids, or Tailwind utilities", () => {
  const selectors = buildUiSurfaceTextSelectors(
    CHATGPT_UI_SURFACES.filter((surface) => surface.id === "dialog-heading"),
  ).join("\n");

  assert.doesNotMatch(selectors, /body-ADRAW0|section-zmz5Xf|largeSection-|footer-laIpwZ|Root-wrAjJZ|Icon-X4VkKC/);
  assert.doesNotMatch(selectors, /radix-_r_/);
  assert.doesNotMatch(selectors, /\b(?:truncate|font-semibold|contents|text-xs|text-default|flex)\b/);
  assert.doesNotMatch(selectors, /\b(?:button|svg|form)\b/);
  assert.doesNotMatch(selectors, /share-destination-icon|text-codex-description/);
});

test("UI surface architecture lists sidebar titles and dialog headings separately from conversation text", () => {
  assert.deepEqual(
    CHATGPT_UI_SURFACES.map((surface) => surface.id),
    ["sidebar-chat-titles", "dialog-heading"],
  );
  assert.deepEqual([...CHATGPT_UI_SURFACES[0]?.selectors ?? []], [...SIDEBAR_CHAT_TITLE_SELECTORS]);

  for (const selector of CONVERSATION_READING_SELECTORS) {
    assert.equal(
      selector.includes("data-sidebar-item"),
      false,
      "conversation selectors must stay separate from sidebar chrome",
    );
    assert.equal(
      selector.includes("heading-dialog"),
      false,
      "conversation selectors must stay separate from dialog headings",
    );
  }
});

test("UI surface selector generation does not emit a global or subtree-wide * rule", () => {
  const selectors = buildUiSurfaceTextSelectors(CHATGPT_UI_SURFACES);

  for (const selector of selectors) {
    assert.doesNotMatch(selector, /(?:^|[\s,])\*(?:\s|:|,|$)/);
    assert.doesNotMatch(selector, /(?:^|\s)(?:html|body)(?:\s|:|,|$)/);
  }
});

test("code and composer exclusions remain present", () => {
  assert.deepEqual([...COMPOSER_SELECTORS], ["#prompt-textarea", CHATGPT_COMPOSER_EDITOR]);
  assert.equal(
    CHATGPT_COMPOSER_EDITOR,
    '[data-composer-markdown][contenteditable="true"][role="textbox"]',
  );
  assert.ok(COMPOSER_AND_CONTROL_EXCLUSIONS.includes("#prompt-textarea"));
  assert.ok(COMPOSER_AND_CONTROL_EXCLUSIONS.includes(CHATGPT_COMPOSER_EDITOR));
  assert.ok(COMPOSER_AND_CONTROL_EXCLUSIONS.includes("textarea"));
  assert.ok(COMPOSER_AND_CONTROL_EXCLUSIONS.includes("input"));
  assert.ok(COMPOSER_AND_CONTROL_EXCLUSIONS.includes('[contenteditable="true"]'));
  assert.ok(COMPOSER_AND_CONTROL_EXCLUSIONS.includes("button"));

  const code = CODE_PRESERVE_SELECTORS.join("\n");
  assert.match(code, /:is\(pre, code, kbd, samp, tt\)/);
  assert.match(code, /\[data-markdown-text-style="assistant-message"\] :is\(pre, code, kbd, samp, tt\)/);
  assert.match(code, /\[role="tabpanel"\]\[data-tab-id\^="chatgpt-file:"\] :is\(pre, code, kbd, samp, tt\)/);
  assert.match(code, /\[data-markdown-copy="inline-code"\]/);
  assert.match(code, /\[data-message-author-role\] \.markdown :is\(pre, code, kbd, samp, tt\)/);
  assert.match(code, /\[data-message-role\] \[data-assistant-markdown\] :is\(pre, code, kbd, samp, tt\)/);
  assert.match(code, /\[data-dil-widget-copy-target\] \[data-d-component="code"\]/);
  assert.match(code, /\[data-writing-block-fullscreen-editor-region\] :is\(pre, code, kbd, samp, tt\)/);
  assert.match(code, /\[data-composer-markdown\]\[contenteditable="true"\]\[role="textbox"\] :is\(pre, code, kbd, samp, tt\)/);
});

test("current composer selector uses stable attributes, not hashed classes", () => {
  const selectors = [...COMPOSER_SELECTORS, ...CODE_PRESERVE_SELECTORS].join("\n");

  assert.match(selectors, /\[data-composer-markdown\]/);
  assert.doesNotMatch(selectors, /RichTextInput-|composer-NYb0tQ|composerTables-|composerHorizontalRules-/);
  assert.doesNotMatch(selectors, /aria-label|data-virtualkeyboard|data-rich-text-layout/);
  assert.doesNotMatch(COMPOSER_SELECTORS.join("\n"), /\.ProseMirror/);
});

test("bidi leaf selectors exclude markdown wrappers", () => {
  assert.ok(BIDI_LEAF_SELECTORS.includes('[data-message-role="user"] [data-user-message-copy]'));
  assert.ok(BIDI_LEAF_SELECTORS.includes('[data-message-author-role="user"] .whitespace-pre-wrap'));
  assert.ok(BIDI_LEAF_SELECTORS.includes('[data-user-message-bubble="true"]'));
  assert.equal(
    BIDI_LEAF_SELECTORS.includes('[data-markdown-text-style="assistant-message"]'),
    false,
  );
  assert.equal(BIDI_LEAF_SELECTORS.includes(CHATGPT_FILE_VIEWER_PANEL), false);

  for (const selector of BIDI_LEAF_SELECTORS) {
    assert.equal(selector.includes(".markdown"), false, `wrapper must not be a leaf: ${selector}`);
    assert.equal(
      selector.includes("[data-assistant-markdown]"),
      false,
      `wrapper must not be a leaf: ${selector}`,
    );
    assert.equal(
      selector.includes("[data-markdown-text-style]"),
      false,
      `wrapper must not be a leaf: ${selector}`,
    );
  }
});
