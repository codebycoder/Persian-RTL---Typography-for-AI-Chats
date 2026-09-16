import assert from "node:assert/strict";
import { test } from "node:test";
import { INJECTED_STYLE_ELEMENT_ID } from "@shared/constants";
import { getRegisteredFont } from "@shared/font-registry";
import { DEFAULT_FONT_SETTINGS } from "@shared/settings";
import {
  BIDI_BLOCK_ELEMENTS,
  buildConversationBidiCss,
  buildConversationBidiSelectorList,
} from "../../bidi-style";
import { buildClaudeDirectionCss } from "./direction";
import { applyFontSettingsToPage } from "../../font-engine";
import {
  MARKDOWN_TEXT_DESCENDANTS,
  PERSIAN_ARABIC_UNICODE_RANGES,
  PERSIAN_GLYPH_FONT_FAMILY_ALIAS,
  buildConversationFontCss,
  buildPersianGlyphFontFaceCss,
  buildUiSurfaceFontStack,
  buildUiSurfaceSelectorList,
} from "../../font-style";
import type { InjectedStyleElement, StyleHost } from "../../style-lifecycle";
import {
  assertNoAccidentalGlobalElementSelectors,
  assertNoEmptySelectorRule,
  assertNoMalformedSelectorList,
} from "../../test-support/css-assertions";
import { chatgptAdapter } from "../chatgpt/adapter";
import { claudeAdapter } from "./adapter";
import {
  ASK_USER_TEXT_SPAN_SELECTOR,
  ASSISTANT_PROSE_ROOT,
  ASSISTANT_TURN_STATUS_CONTAINER,
  ASSISTANT_TURN_STATUS_ROOT,
  CLAUDE_COMPOSER_EDITOR,
  USER_MESSAGE_ROOT,
} from "./selectors";

function fontCss(): string {
  return buildConversationFontCss(getRegisteredFont("peyda"), claudeAdapter);
}

function bidiCss(): string {
  return buildConversationBidiCss(claudeAdapter);
}

function createMemoryHost(): { host: StyleHost; mounted: InjectedStyleElement[] } {
  const mounted: InjectedStyleElement[] = [];
  const host: StyleHost = {
    getElementById(id) {
      return mounted.find((element) => element.id === id) ?? null;
    },
    createElement() {
      return {
        id: "",
        textContent: "",
        remove() {
          const index = mounted.indexOf(this);
          if (index >= 0) {
            mounted.splice(index, 1);
          }
        },
      };
    },
    mount(element) {
      mounted.push(element);
    },
  };

  return { host, mounted };
}

function selectorListsContaining(css: string, token: string): string[] {
  const preambles = [...css.matchAll(/([^{}]*)\{/g)].map((match) => match[1] ?? "");
  return preambles.flatMap((preamble) =>
    preamble
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.includes(token)),
  );
}

test("Claude adapter works with the generic font engine", () => {
  const css = fontCss();

  assert.match(css, /@font-face/);
  assert.match(css, /src: local\(/);
  assert.match(css, /font-family:[\s\S]*!important/);
  assert.ok(css.includes(ASSISTANT_PROSE_ROOT));
  assert.ok(css.includes(USER_MESSAGE_ROOT));
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("Claude font CSS restyles Markdown descendants inside conversation roots", () => {
  const css = fontCss();

  for (const element of ["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "table", "th", "td", "a", "strong", "em"]) {
    assert.ok(
      MARKDOWN_TEXT_DESCENDANTS.includes(element as (typeof MARKDOWN_TEXT_DESCENDANTS)[number]),
    );
    assert.match(
      css,
      new RegExp(`:is\\([^)]*\\b${element}\\b[^)]*\\) \\{\\n  font-family:[^}]*!important`),
    );
  }

  assert.ok(css.includes(`${ASSISTANT_PROSE_ROOT}:not(`));
  assert.ok(css.includes(`${USER_MESSAGE_ROOT}:not(`));
});

test("Claude font CSS does not target the entire assistant transcript row", () => {
  const css = fontCss();
  const preambles = [...css.matchAll(/([^{}]*)\{/g)].map((match) => match[1] ?? "");
  const rowPreambles = preambles.filter((preamble) =>
    preamble.includes('data-testid="transcript-row"'),
  );

  assert.ok(rowPreambles.length > 0, "expected assistant transcript selectors");

  for (const preamble of rowPreambles) {
    assert.ok(
      preamble.includes('[data-cds="Prose"]') ||
        /\bpre\b/.test(preamble) ||
        preamble.includes("[data-morph-key]"),
      `must not restyle the entire transcript row: ${preamble}`,
    );
    assert.ok(preamble.includes('[data-perf-row="assistant"]'));
    assert.doesNotMatch(
      preamble,
      /\[data-testid="transcript-row"\]\[data-perf-row="assistant"\]\s*$/,
    );
  }
});

test("Claude composer font uses the generic font engine and stays off composer chrome", () => {
  const css = fontCss();
  const escaped = CLAUDE_COMPOSER_EDITOR.replaceAll("[", "\\[").replaceAll("]", "\\]");

  assert.match(css, new RegExp(`${escaped} \\{\\n {2}font-family:[^}]*!important`));
  assert.match(css, new RegExp(`${escaped} :is\\([^)]*\\bp\\b[^)]*\\)`));
  assert.match(css, new RegExp(`${escaped} :is\\([^)]*\\):not\\(pre \\*\\):not\\(code \\*\\)`));
  assert.match(css, new RegExp(`${escaped} :is\\(code, kbd, samp, tt\\)`));
  assert.match(css, new RegExp(`${escaped} pre`));
  assert.match(css, new RegExp(`${escaped}::placeholder`));

  assert.doesNotMatch(css, /ChatComposerEditor|ChatComposerActions/);
  assert.doesNotMatch(css, /chat-input-send|chat-input-attach/);
  assert.doesNotMatch(css, /data-composer-placeholder-ghost/);
  assert.doesNotMatch(css, /#prompt-textarea/);
  assert.doesNotMatch(css, /data-sidebar-item/);
  assert.doesNotMatch(css, /data-marquee-text/);
  assert.doesNotMatch(css, /ProseMirror|tiptap|marlin/i);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
  assertNoAccidentalGlobalElementSelectors(css);
});

test("Claude sidebar CSS targets conversation titles and nested spans, not the whole sidebar", () => {
  const css = fontCss();
  const selectors = buildUiSurfaceSelectorList(claudeAdapter);
  const sidebarSelectors = selectorListsContaining(css, 'data-testid="sidebar"');

  assert.match(selectors, /\[data-testid="sidebar"\] \[data-row-key\^="chat:"\] \[data-row-label\]/);
  assert.match(
    selectors,
    /\[data-testid="sidebar"\] \[data-row-key\^="chat:"\] \[data-row-label\] :is\(span\)/,
  );
  assert.match(
    css,
    /\[data-testid="sidebar"\] \[data-row-key\^="chat:"\] \[data-row-label\],\n\[data-testid="sidebar"\] \[data-row-key\^="chat:"\] \[data-row-label\] :is\(span\)/,
  );
  assert.match(
    css,
    /\[data-testid="sidebar"\] \[data-row-key\^="chat:"\] \[data-row-label\][\s\S]*\{\n {2}font-family:/,
  );

  assert.ok(sidebarSelectors.length > 0, "expected sidebar title selectors");
  for (const selector of sidebarSelectors) {
    assert.ok(
      selector.includes('[data-row-key^="chat:"]') && selector.includes("[data-row-label]"),
      `must not restyle the entire sidebar: ${selector}`,
    );
    assert.notEqual(selector.trim(), '[data-testid="sidebar"]');
  }

  assert.doesNotMatch(css, /\[data-testid="sidebar"\]\s*\{/);
  assert.doesNotMatch(css, /data-row-action/);
  assert.doesNotMatch(css, /\[data-testid="sidebar"\][^\n]*data-cds="Icon"/);
  assert.doesNotMatch(css, /sidebar-recents/);
  assert.doesNotMatch(css, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
});

test("Claude Ask User Answers CSS targets text spans and excludes icons, not the whole page", () => {
  const css = fontCss();
  const selectors = buildUiSurfaceSelectorList(claudeAdapter);
  const cardSelectors = selectorListsContaining(css, 'data-testid="ask-user-answers-card"');
  const cardTextSelector = `[data-testid="ask-user-answers-card"] ${ASK_USER_TEXT_SPAN_SELECTOR}`;

  assert.match(selectors, new RegExp(cardTextSelector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(
    css,
    new RegExp(
      `${cardTextSelector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*font-family:`,
    ),
  );
  assert.doesNotMatch(selectors, /\[data-testid="ask-user-answers-card"\],\n\[data-testid="ask-user-answers-card"\]/);

  assert.ok(cardSelectors.includes(cardTextSelector), "expected Ask User Answers font selector");
  assert.ok(css.includes('[data-testid="ask-user-answers-card"]'));
  assert.ok(css.includes('[data-testid="ask-user-answers-card"] svg'));
  assert.match(css, /\[data-cds="Icon"\][\s\S]*Anthropicons-Variable/);
  assert.doesNotMatch(css, /\[data-ask-user-input-banner\] \[aria-hidden="true"\][\s\S]*font-family:/);

  for (const selector of cardSelectors.filter((part) => part.includes(ASK_USER_TEXT_SPAN_SELECTOR))) {
    assert.ok(
      selector.includes('[data-testid="ask-user-answers-card"]'),
      `must stay scoped to the answers card: ${selector}`,
    );
    assert.doesNotMatch(selector, /(?:^|[\s,])\*(?:\s|:|,|$)/);
    assert.doesNotMatch(selector, /(?:^|\s)(?:html|body)(?:\s|:|,|$)/);
    assert.notEqual(selector.trim(), "span");
    assert.doesNotMatch(selector, />/);
    assert.doesNotMatch(selector, /text-secondary|text-primary|font-base|\.flex|\.contents/);
  }

  assert.doesNotMatch(css, /(?:^|\n)\s*html\s*\{/);
  assert.doesNotMatch(css, /(?:^|\n)\s*body\s*\{/);
  assert.doesNotMatch(css, /(?:^|\n)\s*\*\s*\{/);
  assert.doesNotMatch(css, /(?:^|,\n)\s*span\s*\{/);
  assertNoAccidentalGlobalElementSelectors(css);
});

test("Claude assistant TurnStatus CSS targets the morphing label and nested text, not the whole row", () => {
  const css = fontCss();
  const selectors = buildUiSurfaceSelectorList(claudeAdapter);
  const statusSelectors = selectorListsContaining(css, "data-morph-key");
  const root = ASSISTANT_TURN_STATUS_ROOT;
  const nested = `${root} :is(span, bdi)`;

  assert.match(selectors, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(selectors.includes(nested));
  assert.match(
    css,
    new RegExp(`${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*font-family:`),
  );

  assert.ok(statusSelectors.includes(root), "expected TurnStatus font selector");
  assert.ok(css.includes(`${root} svg`));
  assert.match(css, /\[data-cds="Icon"\][\s\S]*Anthropicons-Variable/);

  for (const selector of [root, nested]) {
    assert.ok(
      selector.includes("[data-morph-key]"),
      `must stay scoped to TurnStatus: ${selector}`,
    );
    assert.ok(selector.includes('[data-testid="transcript-row"]'));
    assert.doesNotMatch(selector, /(?:^|[\s,])\*(?:\s|:|,|$)/);
    assert.notEqual(selector.trim(), "span");
    assert.notEqual(selector.trim(), "bdi");
    assert.notEqual(selector.trim(), ASSISTANT_TURN_STATUS_CONTAINER);
    assert.doesNotMatch(selector, /font-sans|text-muted|_r_[A-Za-z0-9]+_/);
  }

  assert.doesNotMatch(css, /(?:^|\n)\s*html\s*\{/);
  assert.doesNotMatch(css, /(?:^|,\n)\s*bdi\s*\{/);
  assertNoAccidentalGlobalElementSelectors(css);
});

test("Claude Ask User input banner CSS targets text spans and excludes icons", () => {
  const css = fontCss();
  const selectors = buildUiSurfaceSelectorList(claudeAdapter);
  const bannerSelectors = selectorListsContaining(css, "data-ask-user-input-banner");
  const bannerTextSelector = `[data-ask-user-input-banner] ${ASK_USER_TEXT_SPAN_SELECTOR}`;

  assert.match(selectors, new RegExp(bannerTextSelector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(
    css,
    new RegExp(
      `${bannerTextSelector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*font-family:`,
    ),
  );
  assert.doesNotMatch(selectors, /\[data-ask-user-input-banner\],\n\[data-ask-user-input-banner\]/);

  assert.ok(bannerSelectors.includes(bannerTextSelector), "expected Ask User input banner font selector");
  assert.ok(css.includes("[data-ask-user-input-banner]"));
  assert.ok(css.includes("[data-ask-user-input-banner] svg"));
  assert.match(css, /\[data-cds="Icon"\][\s\S]*Anthropicons-Variable/);
  assert.doesNotMatch(css, /\[data-ask-user-input-banner\] \[aria-hidden="true"\][\s\S]*font-family:/);

  for (const selector of bannerSelectors.filter((part) => part.includes(ASK_USER_TEXT_SPAN_SELECTOR))) {
    assert.ok(
      selector.includes("[data-ask-user-input-banner]"),
      `must stay scoped to the input banner: ${selector}`,
    );
    assert.doesNotMatch(selector, /(?:^|[\s,])\*(?:\s|:|,|$)/);
    assert.notEqual(selector.trim(), "span");
  }
});

test("Claude Ask User Answers uses the Persian-glyph unicode-range stack so Latin keeps a fallback", () => {
  const peyda = getRegisteredFont("peyda");
  const faces = buildPersianGlyphFontFaceCss(peyda);
  const stack = buildUiSurfaceFontStack();
  const css = buildConversationFontCss(peyda, claudeAdapter);
  const cardBlock = css.split("}").find((block) => block.includes("ask-user-answers-card"));

  assert.match(faces, /unicode-range:/);
  assert.match(faces, /U\+0600-06FF/);
  for (const range of PERSIAN_ARABIC_UNICODE_RANGES) {
    assert.ok(faces.includes(range), `expected unicode-range ${range}`);
  }

  assert.match(stack, new RegExp(`^"${PERSIAN_GLYPH_FONT_FAMILY_ALIAS}"`));
  assert.match(stack, /ui-sans-serif|system-ui|sans-serif/);
  assert.doesNotMatch(stack, /"CFC Peyda"|Peyda/);

  assert.ok(cardBlock, "expected a Claude Ask User Answers font-family rule");
  assert.match(cardBlock, /data-morph-key/);
  assert.match(cardBlock, new RegExp(`font-family: "${PERSIAN_GLYPH_FONT_FAMILY_ALIAS}"`));
  assert.match(cardBlock, /ui-sans-serif/);
  assert.doesNotMatch(cardBlock, /"CFC Peyda"/);
  assert.doesNotMatch(cardBlock, /direction\s*:\s*rtl/);
  assert.doesNotMatch(cardBlock, /direction\s*:\s*ltr/);
  assert.doesNotMatch(cardBlock, /bidi-override/);
});

test("Claude sidebar titles use the Persian-glyph unicode-range stack so Latin keeps a fallback", () => {
  const peyda = getRegisteredFont("peyda");
  const faces = buildPersianGlyphFontFaceCss(peyda);
  const stack = buildUiSurfaceFontStack();
  const css = buildConversationFontCss(peyda, claudeAdapter);
  const sidebarBlock = css.split("}").find((block) => block.includes("data-row-label"));

  assert.match(faces, /unicode-range:/);
  assert.match(faces, /U\+0600-06FF/);
  for (const range of PERSIAN_ARABIC_UNICODE_RANGES) {
    assert.ok(faces.includes(range), `expected unicode-range ${range}`);
  }

  assert.match(stack, new RegExp(`^"${PERSIAN_GLYPH_FONT_FAMILY_ALIAS}"`));
  assert.match(stack, /ui-sans-serif|system-ui|sans-serif/);
  assert.doesNotMatch(stack, /"CFC Peyda"|Peyda/);

  assert.ok(sidebarBlock, "expected a Claude sidebar font-family rule");
  assert.match(sidebarBlock, new RegExp(`font-family: "${PERSIAN_GLYPH_FONT_FAMILY_ALIAS}"`));
  assert.match(sidebarBlock, /ui-sans-serif/);
  assert.doesNotMatch(sidebarBlock, /"CFC Peyda"/);
});

test("Claude font CSS restyles fenced pre blocks and preserves inline monospace", () => {
  const css = fontCss();

  assert.match(
    css,
    /\[data-testid="transcript-row"\]\[data-perf-row="assistant"\] pre,\n/,
  );
  assert.match(css, /\[data-testid="user-message"\] pre,\n/);
  assert.match(css, /pre \* \{\n {2}font-family:[^}]*!important/);
  assert.match(
    css,
    /\[data-testid="chat-input"\]\[contenteditable="true"\]\[role="textbox"\] :is\(code, kbd, samp, tt\)/,
  );
  assert.match(
    css,
    /\[data-testid="transcript-row"\]\[data-perf-row="assistant"\] :is\(code, kbd, samp, tt\):not\(pre \*\)/,
  );

  const descendantRule = css.split("\n").find((line) => line.includes(":is(p,"));
  assert.ok(descendantRule, "expected a descendant :is(p, ...) rule");

  for (const excluded of ["pre", "code", "kbd", "samp", "tt", "svg", "span"]) {
    assert.ok(
      !new RegExp(`:is\\([^)]*\\b${excluded}\\b[^)]*\\)`).test(descendantRule),
      `descendant rule must not target ${excluded}`,
    );
  }
});

test("Claude font CSS does not use generated Claude classes or force direction", () => {
  const css = fontCss();

  assert.doesNotMatch(css, /font-claude-response/);
  assert.doesNotMatch(css, /standard-markdown/);
  assert.doesNotMatch(css, /progressive-markdown/);
  assert.doesNotMatch(css, /_blocks_/);
  assert.doesNotMatch(css, /_r_[A-Za-z0-9]+_/);
  assert.doesNotMatch(css, /dframe-|df-drag|df-leading/);
  assert.doesNotMatch(css, /direction\s*:\s*rtl/);
  assert.doesNotMatch(css, /direction\s*:\s*ltr/);
  assert.doesNotMatch(css, /bidi-override/);
});

test("applyFontSettingsToPage injects Claude conversation CSS through the generic engine", () => {
  const { host, mounted } = createMemoryHost();

  applyFontSettingsToPage(DEFAULT_FONT_SETTINGS, claudeAdapter, host);

  assert.equal(mounted.length, 1);
  assert.equal(mounted[0]?.id, INJECTED_STYLE_ELEMENT_ID);
  assert.match(mounted[0]?.textContent ?? "", /data-cds="Prose"/);
  assert.match(mounted[0]?.textContent ?? "", /data-testid="user-message"/);
  assert.match(mounted[0]?.textContent ?? "", /data-testid="ask-user-answers-card"/);
  assert.match(mounted[0]?.textContent ?? "", /data-morph-key/);
  assert.match(mounted[0]?.textContent ?? "", /data-testid="chat-input"/);
  assert.doesNotMatch(mounted[0]?.textContent ?? "", /data-message-author-role/);
  assert.doesNotMatch(mounted[0]?.textContent ?? "", /chat-input-send|chat-input-attach/);
});

test("Claude adapter works with the generic BiDi engine", () => {
  const selectors = buildConversationBidiSelectorList(claudeAdapter);
  const css = bidiCss();

  assert.match(
    selectors,
    /\[data-testid="transcript-row"\]\[data-perf-row="assistant"\] \[data-cds="Prose"\][^\n]*:is\(/,
  );
  assert.match(selectors, /\[data-testid="user-message"\][^\n]*:is\(/);
  assert.match(css, /unicode-bidi:\s*plaintext/);
  assert.match(css, /text-align:\s*start/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("generated Claude BiDi CSS uses plaintext isolation without forcing direction", () => {
  const css = bidiCss();

  assert.match(css, /unicode-bidi:\s*plaintext !important/);
  assert.match(css, /text-align:\s*start !important/);
  assert.match(css, /:not\(\[data-rasttext-dir\]\)/);
  assert.doesNotMatch(css, /direction\s*:\s*rtl/);
  assert.doesNotMatch(css, /direction\s*:\s*ltr/);
  assert.doesNotMatch(css, /bidi-override/);
});

test("Claude resolved-direction CSS is scoped, removable, and not a bidi-override", () => {
  const css = buildClaudeDirectionCss();

  assert.match(css, /\[data-perf-row="assistant"\] pre,/);
  assert.match(css, /direction:\s*auto !important/);
  assert.match(css, /unicode-bidi:\s*plaintext !important/);
  assert.match(css, /\[data-testid="transcript-row"\]\[data-perf-row="assistant"\] \[data-cds="Prose"\] \[data-rasttext-dir="rtl"\]/);
  assert.match(
    css,
    /\[data-testid="chat-input"\]\[contenteditable="true"\]\[role="textbox"\] \[data-rasttext-dir="rtl"\]/,
  );
  assert.match(css, /\[data-rasttext-dir="ltr"\]/);
  assert.match(css, /unicode-bidi:\s*normal/);
  assert.match(css, /direction:\s*rtl/);
  assert.match(css, /direction:\s*ltr/);
  assert.doesNotMatch(css, /bidi-override/);
  assert.match(css, /\[data-testid="user-message"\] pre,/);
  assert.doesNotMatch(css, /\[data-testid="user-message"\] \[data-rasttext-dir=/);
  assert.match(
    css,
    new RegExp(
      `\\[data-testid="ask-user-answers-card"\\] ${ASK_USER_TEXT_SPAN_SELECTOR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},`,
    ),
  );
  assert.match(
    css,
    new RegExp(
      `\\[data-ask-user-input-banner\\] ${ASK_USER_TEXT_SPAN_SELECTOR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},`,
    ),
  );
  assert.match(
    css,
    new RegExp(
      `${ASSISTANT_TURN_STATUS_ROOT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} bdi \\{\\n {2}unicode-bidi: plaintext !important`,
    ),
  );
  assert.doesNotMatch(css, /ChatComposerActions|chat-input-send|chat-input-attach/);
});

test("Claude BiDi targets prose blocks and does not isolate inlines or wrappers", () => {
  const selectors = buildConversationBidiSelectorList(claudeAdapter);
  const blockList = selectors.match(/:is\(([^)]+)\)/)?.[1] ?? "";
  const isLists = [...selectors.matchAll(/:is\(([^)]+)\)/g)].map((match) => match[1] ?? "");
  const leafSelectors = selectors.split(",\n").filter((selector) => !selector.includes(" :is("));

  assert.equal(leafSelectors.length, 0, "conversation wrappers must not be BiDi leaves");

  for (const element of ["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "th", "td"]) {
    assert.match(blockList, new RegExp(`(?:^|, )${element}(?:,|$)`));
    assert.ok(BIDI_BLOCK_ELEMENTS.includes(element as (typeof BIDI_BLOCK_ELEMENTS)[number]));
  }

  for (const list of isLists) {
    for (const inline of ["span", "a", "strong", "em", "b", "i"]) {
      assert.equal(
        new RegExp(`(?:^|, )${inline}(?:,|$)`).test(list),
        false,
        `inline ${inline} must not receive an independent bidi context`,
      );
    }
  }
});

test("ChatGPT-generated CSS remains free of Claude conversation selectors", () => {
  const css = buildConversationFontCss(getRegisteredFont("peyda"), chatgptAdapter);
  const bidi = buildConversationBidiCss(chatgptAdapter);

  for (const output of [css, bidi]) {
    assert.doesNotMatch(output, /data-cds="Prose"/);
    assert.doesNotMatch(output, /data-testid="user-message"/);
    assert.doesNotMatch(output, /data-perf-row="assistant"/);
    assert.doesNotMatch(output, /data-row-label/);
    assert.doesNotMatch(output, /data-row-key/);
    assert.doesNotMatch(output, /ask-user-answers-card/);
    assert.doesNotMatch(output, /claude\.ai/);
    assert.doesNotMatch(output, /data-rasttext-dir="rtl"/);
    assert.doesNotMatch(output, /data-rasttext-dir="ltr"/);
    assert.doesNotMatch(output, /data-testid="chat-input"/);
    assert.doesNotMatch(output, /data-morph-key/);
  }
});

test("Claude Ask User Q/A surfaces use Claude direction plaintext BiDi without generic span isolation", () => {
  const font = fontCss();
  const bidi = bidiCss();
  const direction = buildClaudeDirectionCss();
  const bidiSelectors = buildConversationBidiSelectorList(claudeAdapter);

  assert.match(bidi, /unicode-bidi:\s*plaintext !important/);
  assert.match(bidi, /text-align:\s*start !important/);
  assert.doesNotMatch(font, /direction\s*:\s*rtl/);
  assert.doesNotMatch(font, /direction\s*:\s*ltr/);
  assert.doesNotMatch(font, /bidi-override/);
  assert.doesNotMatch(bidi, /direction\s*:\s*rtl/);
  assert.doesNotMatch(bidi, /direction\s*:\s*ltr/);
  assert.doesNotMatch(bidi, /bidi-override/);

  assert.match(
    direction,
    new RegExp(
      `\\[data-testid="ask-user-answers-card"\\] ${ASK_USER_TEXT_SPAN_SELECTOR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},`,
    ),
  );
  assert.match(
    direction,
    new RegExp(
      `\\[data-ask-user-input-banner\\] ${ASK_USER_TEXT_SPAN_SELECTOR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},`,
    ),
  );
  assert.match(
    direction,
    new RegExp(
      `${ASSISTANT_TURN_STATUS_ROOT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} bdi \\{\\n {2}unicode-bidi: plaintext !important`,
    ),
  );
  assert.doesNotMatch(bidi, /ask-user-answers-card/);
  assert.doesNotMatch(bidiSelectors, /ask-user-answers-card/);
  assert.doesNotMatch(bidi, /data-morph-key/);
  assert.doesNotMatch(bidiSelectors, /data-morph-key/);

  const isLists = [...bidiSelectors.matchAll(/:is\(([^)]+)\)/g)].map((match) => match[1] ?? "");
  for (const list of isLists) {
    assert.equal(
      /(?:^|, )span(?:,|$)/.test(list),
      false,
      "generic BiDi must not isolate all inline spans",
    );
  }
});

test("Claude BiDi CSS preserves semantic code exclusions and stays off uncaptured chrome", () => {
  const css = bidiCss();
  const selectors = buildConversationBidiSelectorList(claudeAdapter);

  assert.match(css, /:is\(code, kbd, samp, tt\)/);
  assert.doesNotMatch(selectors, /(?:^|,\n)\s*(?:pre|code|kbd|samp|tt)\s*(?:,|:|\{)/);
  assert.doesNotMatch(css, /data-ask-user-input-banner/);
  assert.doesNotMatch(css, /ask-user-answers-card/);
  assert.doesNotMatch(css, /data-row-label/);
  assert.doesNotMatch(css, /data-row-key/);
  assert.doesNotMatch(css, /data-testid="sidebar"/);
  assert.doesNotMatch(css, /data-morph-key/);
  assert.doesNotMatch(css, /data-perf-row-streaming/);
  assert.doesNotMatch(css, /#prompt-textarea/);
  assertNoAccidentalGlobalElementSelectors(css);
});
