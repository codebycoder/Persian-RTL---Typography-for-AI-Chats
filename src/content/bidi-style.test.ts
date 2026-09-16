import assert from "node:assert/strict";
import { test } from "node:test";
import { INJECTED_BIDI_STYLE_ELEMENT_ID } from "@shared/constants";
import {
  BIDI_BLOCK_ELEMENTS,
  buildConversationBidiCss,
  buildConversationBidiSelectorList,
  syncConversationBidiStyle,
} from "./bidi-style";
import { chatgptAdapter } from "./platforms/chatgpt/adapter";
import type { PlatformAdapter, PlatformSelectors } from "./platforms/types";
import type { InjectedStyleElement, StyleHost } from "./style-lifecycle";
import {
  assertNoAccidentalGlobalElementSelectors,
  assertNoEmptySelectorRule,
  assertNoMalformedSelectorList,
} from "./test-support/css-assertions";

const FULL_FIXTURE_SELECTORS: PlatformSelectors = {
  conversationReading: ["[data-fixture-reading]"],
  bidiLeaf: ["[data-fixture-reading]"],
  composer: ["#fixture-composer"],
  canvasEditors: ["[data-fixture-editor]"],
  codePreserve: ["[data-fixture-code]"],
  iconPreserve: ["[data-fixture-icon]"],
  exclusions: ["#fixture-composer", "textarea", "input"],
  uiSurfaces: [],
};

const fixtureAdapter: PlatformAdapter = {
  id: "fixture",
  matchesHostname: () => false,
  selectors: FULL_FIXTURE_SELECTORS,
};

/**
 * Fixture with one or more empty selector groups, matching the shape a
 * future platform (e.g. Claude) may legitimately provide.
 */
function fixtureAdapterWith(overrides: Partial<PlatformSelectors>): PlatformAdapter {
  return {
    id: "fixture-empty",
    matchesHostname: () => false,
    selectors: { ...FULL_FIXTURE_SELECTORS, ...overrides },
  };
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

function bidiDeclarationBlock(css: string): string {
  const marker = "unicode-bidi:";
  const start = css.indexOf(marker);
  assert.ok(start >= 0, "expected a unicode-bidi declaration");
  const open = css.lastIndexOf("{", start);
  const close = css.indexOf("}", start);
  assert.ok(open >= 0 && close > open, "expected a bidi rule block");
  return css.slice(open, close + 1);
}

function bidiSelectorList(): string {
  return buildConversationBidiSelectorList(chatgptAdapter);
}

test("syncConversationBidiStyle creates a single tagged style element", () => {
  const { host, mounted } = createMemoryHost();

  const created = syncConversationBidiStyle(host, true, chatgptAdapter);

  assert.equal(mounted.length, 1);
  assert.equal(created, mounted[0]);
  assert.equal(mounted[0]?.id, INJECTED_BIDI_STYLE_ELEMENT_ID);
  assert.match(mounted[0]?.textContent ?? "", /unicode-bidi:\s*plaintext/);
});

test("syncConversationBidiStyle never creates duplicate style nodes", () => {
  const { host, mounted } = createMemoryHost();

  const first = syncConversationBidiStyle(host, true, chatgptAdapter);
  const second = syncConversationBidiStyle(host, true, chatgptAdapter);

  assert.equal(mounted.length, 1);
  assert.equal(first, second);
  assert.equal(mounted[0]?.id, INJECTED_BIDI_STYLE_ELEMENT_ID);
});

test("syncConversationBidiStyle updates the existing style element", () => {
  const { host, mounted } = createMemoryHost();

  syncConversationBidiStyle(host, true, chatgptAdapter);
  const existing = mounted[0];
  assert.ok(existing);
  existing.textContent = "stale {}";

  const updated = syncConversationBidiStyle(host, true, chatgptAdapter);

  assert.equal(mounted.length, 1);
  assert.equal(updated, existing);
  assert.match(existing.textContent ?? "", /text-align:\s*start/);
  assert.doesNotMatch(existing.textContent ?? "", /stale/);
});

test("syncConversationBidiStyle removes the style when disabled", () => {
  const { host, mounted } = createMemoryHost();

  syncConversationBidiStyle(host, true, chatgptAdapter);
  const removed = syncConversationBidiStyle(host, false, chatgptAdapter);

  assert.equal(removed, null);
  assert.equal(mounted.length, 0);
});

test("disabling restores the host to its pre-injection state", () => {
  const { host, mounted } = createMemoryHost();

  syncConversationBidiStyle(host, true, chatgptAdapter);
  syncConversationBidiStyle(host, false, chatgptAdapter);
  syncConversationBidiStyle(host, true, chatgptAdapter);
  syncConversationBidiStyle(host, false, chatgptAdapter);

  assert.equal(mounted.length, 0);
  assert.equal(host.getElementById(INJECTED_BIDI_STYLE_ELEMENT_ID), null);
});

test("bidi CSS targets assistant and user paragraph selectors", () => {
  const selectors = bidiSelectorList();

  assert.match(selectors, /\[data-message-author-role="assistant"\] \.markdown[^\n]*:is\(/);
  assert.match(selectors, /\[data-message-role="assistant"\] \[data-assistant-markdown\][^\n]*:is\(/);
  assert.match(selectors, /\[data-message-author-role="assistant"\] \[data-assistant-markdown\][^\n]*:is\(/);
  assert.match(selectors, /\[data-message-author-role="user"\] \.markdown[^\n]*:is\(/);
  assert.match(selectors, /\[data-message-role="user"\] \[data-user-message-copy\]/);
  assert.match(selectors, /\[data-message-author-role="user"\] \.whitespace-pre-wrap/);
});

test("bidi CSS targets headings, list items, blockquotes, and table cells", () => {
  const selectors = bidiSelectorList();
  const blockList = selectors.match(/:is\(([^)]+)\)/)?.[1] ?? "";

  for (const element of ["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "th", "td"]) {
    assert.match(blockList, new RegExp(`(?:^|, )${element}(?:,|$)`));
    assert.ok(BIDI_BLOCK_ELEMENTS.includes(element as (typeof BIDI_BLOCK_ELEMENTS)[number]));
  }
});

test("bidi CSS does not create independent rules for inline elements", () => {
  const selectors = bidiSelectorList();
  const isLists = [...selectors.matchAll(/:is\(([^)]+)\)/g)].map((match) => match[1] ?? "");

  assert.ok(isLists.length > 0, "expected :is(...) block targets");

  for (const list of isLists) {
    for (const inline of ["span", "a", "strong", "em", "b", "i"]) {
      assert.equal(
        new RegExp(`(?:^|, )${inline}(?:,|$)`).test(list),
        false,
        `inline ${inline} must not receive an independent bidi context`,
      );
    }
  }

  assert.doesNotMatch(selectors, /(?:^|,\n)\s*(?:span|a|strong|em|b|i)\s*(?:,|:|\{)/);
});

test("bidi CSS excludes code, pre, and composer controls", () => {
  const selectors = bidiSelectorList();
  const css = buildConversationBidiCss(chatgptAdapter);
  const isLists = [...selectors.matchAll(/:is\(([^)]+)\)/g)].map((match) => match[1] ?? "");

  for (const list of isLists) {
    for (const excluded of ["pre", "code", "kbd", "samp", "tt", "textarea", "input", "button"]) {
      assert.equal(
        new RegExp(`(?:^|, )${excluded}(?:,|$)`).test(list),
        false,
        `bidi block list must not include ${excluded}`,
      );
    }
  }

  assert.match(selectors, /:not\(#prompt-textarea\)/);
  assert.match(selectors, /:not\(textarea\)/);
  assert.match(selectors, /:not\(input\)/);
  assert.match(selectors, /:not\(\[contenteditable="true"\]\)/);
  assert.match(selectors, /:not\(\[contenteditable="true"\] \*\)/);
  assert.doesNotMatch(selectors, /(?:^|,\n)#prompt-textarea(?:\s|:|\{|,)/);
  assert.doesNotMatch(selectors, /(?:^|,\n)textarea(?:\s|:|\{|,)/);
  assert.doesNotMatch(css, /(?:^|\n)\s*html\s*\{/);
  assert.doesNotMatch(css, /(?:^|\n)\s*body\s*\{/);
  assert.doesNotMatch(css, /(?:^|\n)\s*\*\s*\{/);
});

test("generated bidi CSS uses plaintext isolation and start alignment", () => {
  const css = buildConversationBidiCss(chatgptAdapter);
  const block = bidiDeclarationBlock(css);

  assert.match(block, /unicode-bidi:\s*plaintext/);
  assert.match(block, /text-align:\s*start/);
  assert.match(css, /:not\(\[data-rasttext-dir\]\)/);
  assert.doesNotMatch(css, /direction\s*:\s*rtl/);
  assert.doesNotMatch(css, /direction\s*:\s*ltr/);
  assert.doesNotMatch(css, /bidi-override/);
});

test("bidi CSS covers current, DIL, and Work chat conversation markup", () => {
  const selectors = bidiSelectorList();

  assert.match(selectors, /\[data-dil-widget-copy-target\] \[data-d-component="text"\]/);
  assert.match(selectors, /\[data-dil-widget-copy-target\] \[data-d-component="title"\]/);
  assert.match(selectors, /\[data-message-author-role="assistant"\] \[data-d-component="text"\]/);
  assert.match(selectors, /\.markdown\.markdown-new-styling[^\n]*:is\(/);

  const leafSelectors = selectors.split(",\n").filter((selector) => !selector.includes(" :is("));
  assert.ok(leafSelectors.length > 0, "expected leaf reading selectors");
  for (const selector of leafSelectors) {
    assert.equal(selector.includes(".markdown"), false, "markdown wrappers must not be isolated");
    assert.equal(
      selector.includes("[data-assistant-markdown]"),
      false,
      "assistant-markdown wrappers must not be isolated",
    );
  }
});

test("bidi CSS stays on conversation text and does not style sidebar chrome", () => {
  const css = buildConversationBidiCss(chatgptAdapter);

  assert.match(css, /unicode-bidi:\s*plaintext/);
  assert.match(css, /text-align:\s*start/);
  assert.doesNotMatch(css, /data-sidebar-item/);
  assert.doesNotMatch(css, /data-marquee-text/);
});

test("bidi engine uses adapter-provided block selectors", () => {
  const selectors = buildConversationBidiSelectorList(fixtureAdapter);
  const css = buildConversationBidiCss(fixtureAdapter);

  assert.match(selectors, /\[data-fixture-reading\]/);
  assert.match(selectors, /:not\(#fixture-composer\)/);
  assert.match(selectors, /:not\(#fixture-composer \*\)/);
  assert.match(css, /\[data-fixture-code\]/);
  assert.match(css, /unicode-bidi:\s*plaintext/);
  assert.match(css, /text-align:\s*start/);
  assert.doesNotMatch(css, /data-message-author-role/);
  assert.doesNotMatch(css, /data-assistant-markdown/);
  assert.doesNotMatch(css, /direction\s*:\s*rtl/);
  assert.doesNotMatch(css, /direction\s*:\s*ltr/);
  assert.doesNotMatch(css, /bidi-override/);
});

// --- Empty selector-group hardening -----------------------------------
//
// A future platform (e.g. Claude) may legitimately provide an empty array
// for any of these selector groups. The generic BiDi engine must emit no
// rule for that group rather than invalid or accidentally global CSS.

test("empty bidiLeaf emits no leaf BiDi rule, but conversationReading descendants remain", () => {
  const platform = fixtureAdapterWith({ bidiLeaf: [] });
  const selectors = buildConversationBidiSelectorList(platform);
  const css = buildConversationBidiCss(platform);
  const parts = selectors.split(",\n");

  // Only the descendant form (via conversationReading) remains; the bare
  // leaf entry (no `:is(...)`) is gone.
  assert.equal(parts.length, 1, `expected exactly one selector entry, got: ${selectors}`);
  assert.match(parts[0] ?? "", /:is\(/);
  assert.match(css, /unicode-bidi:\s*plaintext/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("empty conversationReading removes the descendant BiDi form, leaf selectors remain", () => {
  const platform = fixtureAdapterWith({ conversationReading: [] });
  const selectors = buildConversationBidiSelectorList(platform);
  const css = buildConversationBidiCss(platform);
  const parts = selectors.split(",\n");

  assert.equal(parts.length, 1, `expected exactly one selector entry, got: ${selectors}`);
  assert.doesNotMatch(parts[0] ?? "", /:is\(/);
  assert.match(selectors, /\[data-fixture-reading\]/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("empty conversationReading and bidiLeaf together emit no BiDi block rule at all", () => {
  const platform = fixtureAdapterWith({ conversationReading: [], bidiLeaf: [] });
  const selectors = buildConversationBidiSelectorList(platform);
  const css = buildConversationBidiCss(platform);

  assert.equal(selectors, "");
  assert.doesNotMatch(css, /unicode-bidi/);
  // The code-preservation rule (independent group) still emits.
  assert.match(css, /\[data-fixture-code\]/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
  assertNoAccidentalGlobalElementSelectors(css);
});

test("empty codePreserve emits no code text-align override rule", () => {
  const platform = fixtureAdapterWith({ codePreserve: [] });
  const css = buildConversationBidiCss(platform);

  assert.doesNotMatch(css, /fixture-code/);
  assert.match(css, /unicode-bidi:\s*plaintext/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("empty exclusions produce no malformed :not() clauses", () => {
  const platform = fixtureAdapterWith({ exclusions: [] });
  const selectors = buildConversationBidiSelectorList(platform);
  const css = buildConversationBidiCss(platform);

  assert.doesNotMatch(selectors, /:not\(\)/);
  assert.doesNotMatch(selectors, /:not\(\s*\)/);
  assert.match(selectors, /\[data-fixture-reading\]/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("every selector group empty at once produces empty BiDi CSS, never malformed or global rules", () => {
  const platform: PlatformAdapter = {
    id: "fixture-all-empty",
    matchesHostname: () => false,
    selectors: {
      conversationReading: [],
      bidiLeaf: [],
      composer: [],
      canvasEditors: [],
      codePreserve: [],
      iconPreserve: [],
      exclusions: [],
      uiSurfaces: [],
    },
  };

  const selectors = buildConversationBidiSelectorList(platform);
  const css = buildConversationBidiCss(platform);

  assert.equal(selectors, "");
  assert.equal(css, "");
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
  assertNoAccidentalGlobalElementSelectors(css);
});

test("generated BiDi CSS never contains a rule beginning with an empty selector", () => {
  for (const css of [
    buildConversationBidiCss(chatgptAdapter),
    buildConversationBidiCss(fixtureAdapter),
    buildConversationBidiCss(fixtureAdapterWith({ conversationReading: [], bidiLeaf: [] })),
  ]) {
    assertNoEmptySelectorRule(css);
  }
});

test("generated BiDi CSS never contains malformed comma-separated selector lists", () => {
  for (const css of [
    buildConversationBidiCss(chatgptAdapter),
    buildConversationBidiCss(fixtureAdapter),
    buildConversationBidiCss(fixtureAdapterWith({ exclusions: [] })),
    buildConversationBidiCss(fixtureAdapterWith({ codePreserve: [] })),
  ]) {
    assertNoMalformedSelectorList(css);
  }
});

test("an empty parent selector never broadens BiDi rules into a global element selector", () => {
  const platform = fixtureAdapterWith({ conversationReading: [], bidiLeaf: [] });
  const css = buildConversationBidiCss(platform);

  assertNoAccidentalGlobalElementSelectors(css);
  assertNoEmptySelectorRule(css);
});

test("regression: ChatGPT-generated BiDi CSS still contains its meaningful selectors after hardening", () => {
  const selectors = bidiSelectorList();
  const css = buildConversationBidiCss(chatgptAdapter);

  assert.match(selectors, /\[data-message-author-role="assistant"\] \.markdown[^\n]*:is\(/);
  assert.match(selectors, /\[data-message-role="user"\] \[data-user-message-copy\]/);
  assert.match(css, /unicode-bidi:\s*plaintext !important/);
  assert.match(css, /text-align:\s*start !important/);
  assert.match(css, /:not\(\[data-rasttext-dir\]\)/);
  assert.match(css, /:is\(pre, code, kbd, samp, tt\)/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});
