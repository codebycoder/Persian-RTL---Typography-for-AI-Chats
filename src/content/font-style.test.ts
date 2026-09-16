import assert from "node:assert/strict";
import { test } from "node:test";
import { FONT_REGISTRY, getRegisteredFont, type FontId } from "@shared/font-registry";
import {
  PERSIAN_ARABIC_UNICODE_RANGES,
  PERSIAN_GLYPH_FONT_FAMILY_ALIAS,
  buildConversationFontCss,
  buildPersianGlyphFontFaceCss,
  buildUiSurfaceFontStack,
  buildUiSurfaceSelectorList,
} from "./font-style";
import { chatgptAdapter } from "./platforms/chatgpt/adapter";
import type { PlatformAdapter, PlatformSelectors } from "./platforms/types";
import {
  assertNoAccidentalGlobalElementSelectors,
  assertNoEmptySelectorRule,
  assertNoMalformedSelectorList,
} from "./test-support/css-assertions";

function fontCss(fontId: FontId = "peyda"): string {
  return buildConversationFontCss(getRegisteredFont(fontId), chatgptAdapter);
}

const FULL_FIXTURE_SELECTORS: PlatformSelectors = {
  conversationReading: ["[data-fixture-reading]"],
  bidiLeaf: ["[data-fixture-reading]"],
  composer: ["#fixture-composer"],
  canvasEditors: ["[data-fixture-editor]"],
  codePreserve: ["[data-fixture-code]"],
  iconPreserve: ["[data-fixture-icon]"],
  exclusions: ["#fixture-composer", "textarea", "input"],
  uiSurfaces: [
    {
      id: "fixture-ui",
      selectors: ["[data-fixture-ui]"],
      textDescendants: ["span"],
    },
  ],
};

const fixtureAdapter: PlatformAdapter = {
  id: "fixture",
  matchesHostname: () => false,
  selectors: FULL_FIXTURE_SELECTORS,
};

/**
 * Fixture with several empty selector groups, matching the shape a future
 * platform (e.g. Claude) may legitimately provide. Used to verify the
 * generic engines never turn an empty group into invalid CSS or an
 * accidentally global selector.
 */
function fixtureAdapterWith(overrides: Partial<PlatformSelectors>): PlatformAdapter {
  return {
    id: "fixture-empty",
    matchesHostname: () => false,
    selectors: { ...FULL_FIXTURE_SELECTORS, ...overrides },
  };
}

test("conversation CSS targets message reading text and uses only local() faces", () => {
  const css = fontCss();

  assert.match(css, /@font-face/);
  assert.match(css, /src: local\(/);
  assert.doesNotMatch(css, /url\(/);
  assert.match(css, /data-message-author-role="assistant"/);
  assert.match(css, /data-message-author-role="user"/);
  assert.match(css, /\.markdown/);
  assert.match(css, /font-family:[\s\S]*!important/);
});

test("conversation CSS does not restyle the whole page, generic controls, or code with !important", () => {
  const css = fontCss("yekan-bakh");

  assert.doesNotMatch(css, /(?:^|\n)\s*html\s*\{/);
  assert.doesNotMatch(css, /(?:^|\n)\s*body\s*\{/);
  assert.doesNotMatch(css, /(?:^|\n)\s*\*\s*\{/);
  assert.match(css, /:not\(#prompt-textarea\)/);
  assert.match(css, /:not\(textarea\)/);
  assert.match(css, /:is\(pre, code, kbd, samp, tt\)/);
  assert.doesNotMatch(css, /(?:^|\n)\s*\[contenteditable="true"\]\s*\{/);

  const codeBlockStart = css.indexOf(":is(pre, code, kbd, samp, tt)");
  const codeBlockEnd = css.indexOf("}", codeBlockStart);
  const codeBlock = css.slice(codeBlockStart, codeBlockEnd + 1);
  assert.doesNotMatch(codeBlock, /!important/);
});

test("conversation CSS restyles the prompt composer, including typed paragraphs", () => {
  const css = fontCss();

  assert.match(css, /(?:^|\n)#prompt-textarea \{\n {2}font-family:[\s\S]*!important/);
  assert.match(css, /#prompt-textarea :is\([^)]*\bp\b[^)]*\)/);
  assert.match(css, /#prompt-textarea :is\([^)]*\bspan\b[^)]*\)/);
  assert.match(css, /#prompt-textarea :is\([^)]*\):not\(pre \*\):not\(code \*\)/);
  assert.match(
    css,
    /#prompt-textarea::placeholder,\n#prompt-textarea p::before \{\n {2}font-family:[\s\S]*!important/,
  );
});

test("conversation CSS restyles ChatGPT Canvas writing-block editors", () => {
  const css = fontCss();

  assert.match(
    css,
    /(?:^|\n)\[data-writing-block-fullscreen-editor-region\],\n\[data-writing-block\] \.ProseMirror \{\n {2}font-family:[\s\S]*!important/,
  );
  assert.match(
    css,
    /\[data-writing-block-fullscreen-editor-region\] :is\([^)]*\bp\b[^)]*\)/,
  );
  assert.match(css, /\[data-writing-block-fullscreen-editor-region\] :is\([^)]*\bspan\b[^)]*\)/);
  assert.match(css, /\[data-writing-block\] \.ProseMirror :is\([^)]*\bspan\b[^)]*\)/);
  assert.match(
    css,
    /\[data-writing-block-fullscreen-editor-region\] :is\([^)]*\):not\(pre \*\):not\(code \*\)/,
  );
  assert.match(
    css,
    /\[data-writing-block-fullscreen-editor-region\] :is\(pre, code, kbd, samp, tt\)/,
  );
  assert.match(css, /\[data-writing-block-fullscreen-editor-region\] svg/);
});

test("conversation CSS restyles ordinary Markdown descendants, not just the container", () => {
  const css = fontCss();

  // Site typography declares font-family directly on these elements, so the
  // container rule alone cannot reach assistant reading text.
  for (const element of ["p", "h1", "h2", "li", "blockquote", "td", "th", "a", "em", "strong"]) {
    assert.match(
      css,
      new RegExp(`:is\\([^)]*\\b${element}\\b[^)]*\\) \\{\\n  font-family:[^}]*!important`),
    );
  }

  // The descendant rule must stay scoped to both assistant and user messages.
  const descendantRules = css.match(/\[data-message-author-role="[a-z]+"\][^\n]*:is\(/g) ?? [];
  assert.ok(descendantRules.some((rule) => rule.includes('role="assistant"')));
  assert.ok(descendantRules.some((rule) => rule.includes('role="user"')));
});

test("conversation CSS covers the current frontend's message markup", () => {
  const css = fontCss();

  // Verified against a live logged-out conversation (2026-09): turns use
  // data-message-role, assistant Markdown lives in [data-assistant-markdown],
  // and user reading text is [data-user-message-copy].
  assert.match(css, /\[data-message-role="assistant"\] \[data-assistant-markdown\]/);
  assert.match(css, /\[data-message-role="user"\] \[data-user-message-copy\]/);

  // Code preservation must extend to the current frontend's containers.
  assert.match(
    css,
    /\[data-message-role\] \[data-assistant-markdown\] :is\(pre, code, kbd, samp, tt\)/,
  );
});

test("conversation CSS covers logged-in hybrid assistant markup", () => {
  const css = fontCss();

  assert.match(
    css,
    /\[data-message-author-role="assistant"\] \[data-assistant-markdown\]/,
  );
  assert.match(
    css,
    /\[data-message-author-role\] \[data-assistant-markdown\] :is\(pre, code, kbd, samp, tt\)/,
  );
});

test("conversation CSS covers logged-in DIL assistant reading components", () => {
  const css = fontCss();

  assert.match(css, /\[data-dil-widget-copy-target\] \[data-d-component="text"\]/);
  assert.match(css, /\[data-dil-widget-copy-target\] \[data-d-component="title"\]/);
  assert.match(css, /\[data-dil-widget-copy-target\] \[data-d-component="badge"\]/);
  assert.match(css, /\[data-dil-widget-copy-target\] \[data-d-component="code"\]/);
  assert.match(css, /\[data-message-author-role="assistant"\] \[data-d-component="text"\]/);
  assert.match(css, /\[data-message-author-role="assistant"\] \[data-d-component="badge"\]/);

  // Target semantic DIL components directly; do not restyle the whole widget root.
  assert.doesNotMatch(css, /\[data-dil-widget-copy-target\]:not\(/);
});

test("conversation CSS covers Work chat markdown outside message-role wrappers", () => {
  const css = fontCss();

  assert.match(css, /\.markdown\.markdown-new-styling:not\(#prompt-textarea\)/);
  assert.match(
    css,
    /\.markdown\.markdown-new-styling[^\n]*:is\(p, h1, h2, h3, h4, h5, h6/,
  );
  assert.match(css, /\.markdown\.markdown-new-styling :is\(pre, code, kbd, samp, tt\)/);
});

test("descendant font rule excludes code, icons, and composer elements", () => {
  const css = fontCss();

  const descendantRule = css.split("\n").find((line) => line.includes(":is(p,"));
  assert.ok(descendantRule, "expected a descendant :is(p, ...) rule");

  for (const excluded of ["pre", "code", "kbd", "samp", "tt", "svg", "span", "textarea", "input", "button"]) {
    assert.ok(
      !new RegExp(`:is\\([^)]*\\b${excluded}\\b[^)]*\\)`).test(descendantRule),
      `descendant rule must not target ${excluded}`,
    );
  }
});

test("sidebar CSS targets stable title attributes and nested title spans", () => {
  const css = fontCss();
  const selectors = buildUiSurfaceSelectorList(chatgptAdapter);

  assert.match(selectors, /\[data-sidebar-item="true"\] \[data-marquee-text="true"\]/);
  assert.match(selectors, /\[data-sidebar-item="true"\] \[data-marquee-text="true"\] :is\(span\)/);
  assert.match(
    css,
    /\[data-sidebar-item="true"\] \[data-marquee-text="true"\],\n\[data-sidebar-item="true"\] \[data-marquee-text="true"\] :is\(span\) \{\n {2}font-family:/,
  );
});

test("sidebar CSS does not use generated ChatGPT classes", () => {
  const css = fontCss();

  assert.doesNotMatch(css, /_NCija_/);
  assert.doesNotMatch(css, /clipViewport/);
});

test("sidebar CSS does not target the item options button or SVG", () => {
  const css = fontCss();
  const sidebarRules = css
    .split("}")
    .filter((block) => block.includes("data-sidebar-item"))
    .join("}");

  assert.ok(sidebarRules.length > 0, "expected sidebar title rules");
  assert.doesNotMatch(sidebarRules, /\[data-sidebar-item="true"\][^\n{]*\bbutton\b/);
  assert.doesNotMatch(sidebarRules, /\[data-sidebar-item="true"\][^\n{]*\bsvg\b/);
});

test("Persian glyph faces use unicode-range so English can keep the UI fallback", () => {
  const peyda = getRegisteredFont("peyda");
  const faces = buildPersianGlyphFontFaceCss(peyda);
  const stack = buildUiSurfaceFontStack();
  const css = buildConversationFontCss(peyda, chatgptAdapter);

  assert.match(faces, /unicode-range:/);
  assert.match(faces, /U\+0600-06FF/);
  for (const range of PERSIAN_ARABIC_UNICODE_RANGES) {
    assert.ok(faces.includes(range), `expected unicode-range ${range}`);
  }

  assert.match(faces, new RegExp(`font-family: "${PERSIAN_GLYPH_FONT_FAMILY_ALIAS}"`));
  assert.match(stack, new RegExp(`^"${PERSIAN_GLYPH_FONT_FAMILY_ALIAS}"`));
  assert.match(stack, /ui-sans-serif|system-ui|sans-serif/);
  assert.doesNotMatch(stack, /"CFC Peyda"|Peyda/);

  const sidebarBlock = css.split("}").find((block) => block.includes("data-sidebar-item"));
  assert.ok(sidebarBlock, "expected a sidebar font-family rule");
  assert.match(sidebarBlock, new RegExp(`font-family: "${PERSIAN_GLYPH_FONT_FAMILY_ALIAS}"`));
  assert.match(sidebarBlock, /ui-sans-serif/);
  assert.doesNotMatch(sidebarBlock, /"CFC Peyda"/);
});

test("Persian glyph faces still resolve through the selected registry font", () => {
  for (const font of FONT_REGISTRY) {
    const faces = buildPersianGlyphFontFaceCss(font);
    const css = buildConversationFontCss(font, chatgptAdapter);

    assert.match(css, new RegExp(`font-family: ${font.cssFamilyAlias.includes(" ") ? `"${font.cssFamilyAlias}"` : font.cssFamilyAlias}`));
    assert.match(faces, /src: local\(/);
    assert.doesNotMatch(faces, /url\(/);

    for (const candidate of font.candidateFamilyNames) {
      assert.ok(
        faces.includes(`local(${candidate.includes(" ") ? `"${candidate}"` : candidate})`),
        `${font.id} faces must include candidate ${candidate}`,
      );
    }

    for (const face of font.localFaceNames) {
      assert.ok(
        face.localNames.some((name) =>
          faces.includes(`local(${name.includes(" ") ? `"${name}"` : name})`),
        ),
        `${font.id} faces must include a local() name from the registry`,
      );
    }
  }
});

test("conversation selectors and exclusions remain intact after sidebar support", () => {
  const css = fontCss();

  assert.match(css, /\[data-message-author-role="assistant"\] \.markdown:not\(#prompt-textarea\)/);
  assert.match(css, /\[data-message-role="user"\] \[data-user-message-copy\]/);
  assert.match(css, /:not\(#prompt-textarea\)/);
  assert.match(css, /:not\(textarea\)/);
  assert.match(css, /:is\(pre, code, kbd, samp, tt\)/);
  assert.doesNotMatch(css, /(?:^|\n)\s*html\s*\{/);
  assert.doesNotMatch(css, /(?:^|\n)\s*body\s*\{/);
  assert.doesNotMatch(css, /(?:^|\n)\s*\*\s*\{/);
});

test("font engine generates styles from adapter-provided selectors", () => {
  const css = buildConversationFontCss(getRegisteredFont("peyda"), fixtureAdapter);

  assert.match(css, /\[data-fixture-reading\]:not\(#fixture-composer\)/);
  assert.match(css, /#fixture-composer \{\n {2}font-family:/);
  assert.match(css, /\[data-fixture-editor\] \{\n {2}font-family:/);
  assert.match(css, /\[data-fixture-ui\]/);
  assert.match(css, /\[data-fixture-code\]/);
  assert.match(css, /\[data-fixture-icon\]/);
  assert.doesNotMatch(css, /data-message-author-role/);
  assert.doesNotMatch(css, /data-sidebar-item/);
  assert.doesNotMatch(css, /chatgpt\.com/);
});

// --- Empty selector-group hardening -----------------------------------
//
// A future platform (e.g. Claude) may legitimately provide an empty array
// for any of these selector groups. The generic font engine must emit no
// rule for that group rather than invalid or accidentally global CSS.

test("empty conversationReading emits no reading or markdown-descendant font rule", () => {
  const platform = fixtureAdapterWith({ conversationReading: [] });
  const css = buildConversationFontCss(getRegisteredFont("peyda"), platform);

  assert.doesNotMatch(css, /data-fixture-reading/);
  // The other groups are still present and untouched.
  assert.match(css, /#fixture-composer \{\n {2}font-family:/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("empty bidiLeaf does not affect font-engine output (font engine does not read bidiLeaf)", () => {
  const platform = fixtureAdapterWith({ bidiLeaf: [] });
  const css = buildConversationFontCss(getRegisteredFont("peyda"), platform);

  assert.match(css, /\[data-fixture-reading\]/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("empty composer emits no composer, composer-text, or composer-placeholder rule", () => {
  const platform = fixtureAdapterWith({ composer: [] });
  const css = buildConversationFontCss(getRegisteredFont("peyda"), platform);

  // No composer-specific rule remains (the exclusions group still legally
  // references "#fixture-composer" inside :not(), and canvasEditors still
  // legitimately emits its own "::placeholder"/"p::before" rules, so only
  // assert on composer-specific rules, not on the raw substrings).
  assert.doesNotMatch(css, /#fixture-composer \{/);
  assert.doesNotMatch(css, /#fixture-composer::placeholder/);
  assert.doesNotMatch(css, /#fixture-composer p::before/);
  assert.doesNotMatch(css, /#fixture-composer :is\(/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("empty canvasEditors emits no canvas, canvas-text, or canvas-placeholder rule", () => {
  const platform = fixtureAdapterWith({ canvasEditors: [] });
  const css = buildConversationFontCss(getRegisteredFont("peyda"), platform);

  assert.doesNotMatch(css, /fixture-editor/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("empty codePreserve emits no code-preservation rule", () => {
  const platform = fixtureAdapterWith({ codePreserve: [] });
  const css = buildConversationFontCss(getRegisteredFont("peyda"), platform);

  assert.doesNotMatch(css, /fixture-code/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("empty iconPreserve emits no icon-preservation rule", () => {
  const platform = fixtureAdapterWith({ iconPreserve: [] });
  const css = buildConversationFontCss(getRegisteredFont("peyda"), platform);

  assert.doesNotMatch(css, /fixture-icon/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("empty exclusions produce no malformed :not() and do not break other rules", () => {
  const platform = fixtureAdapterWith({ exclusions: [] });
  const css = buildConversationFontCss(getRegisteredFont("peyda"), platform);

  assert.doesNotMatch(css, /:not\(\)/);
  assert.doesNotMatch(css, /:not\(\s*\)/);
  // Reading rule still targets the fixture reading selector, just without
  // any exclusion suffix.
  assert.match(css, /\[data-fixture-reading\] \{\n {2}font-family:/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("empty uiSurfaces emits no UI-surface font rule", () => {
  const platform = fixtureAdapterWith({ uiSurfaces: [] });
  const css = buildConversationFontCss(getRegisteredFont("peyda"), platform);

  assert.doesNotMatch(css, /fixture-ui/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("a UiSurface with empty selectors emits nothing for that surface", () => {
  const platform = fixtureAdapterWith({
    uiSurfaces: [{ id: "empty-surface", selectors: [], textDescendants: ["span"] }],
  });
  const css = buildConversationFontCss(getRegisteredFont("peyda"), platform);

  assert.doesNotMatch(css, /empty-surface/);
  // No UI-surface font-family rule at all: the surface list collapses to
  // "". The UI font stack always leads with the Persian-glyph alias under
  // `!important` (unlike the @font-face declarations for that same alias,
  // which never use `!important`), so its absence confirms no UI rule ran.
  assert.doesNotMatch(css, /font-family: "CFC Persian Glyphs"[^;]*!important/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("a UiSurface with empty textDescendants does not generate a global descendant selector", () => {
  const platform = fixtureAdapterWith({
    uiSurfaces: [{ id: "fixture-ui", selectors: ["[data-fixture-ui]"], textDescendants: [] }],
  });
  const css = buildConversationFontCss(getRegisteredFont("peyda"), platform);

  assert.match(css, /\[data-fixture-ui\] \{\n {2}font-family:/);
  assert.doesNotMatch(css, /:is\(\)/);
  assert.doesNotMatch(css, /:is\(\s*\)/);
  assertNoAccidentalGlobalElementSelectors(css);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});

test("every selector group empty at once produces no reading/composer/editor/ui/code/icon rules and no malformed CSS", () => {
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

  const css = buildConversationFontCss(getRegisteredFont("peyda"), platform);

  // Only the @font-face blocks (independent of adapter selectors) remain.
  assert.match(css, /@font-face/);
  assert.doesNotMatch(css, /fixture/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
  assertNoAccidentalGlobalElementSelectors(css);
});

test("generated CSS never contains a rule beginning with an empty selector (ChatGPT and fixtures)", () => {
  for (const css of [
    fontCss(),
    buildConversationFontCss(getRegisteredFont("peyda"), fixtureAdapter),
    buildConversationFontCss(getRegisteredFont("peyda"), fixtureAdapterWith({ conversationReading: [] })),
  ]) {
    assertNoEmptySelectorRule(css);
  }
});

test("generated CSS never contains malformed comma-separated selector lists", () => {
  for (const css of [
    fontCss(),
    buildConversationFontCss(getRegisteredFont("peyda"), fixtureAdapter),
    buildConversationFontCss(getRegisteredFont("peyda"), fixtureAdapterWith({ composer: [] })),
    buildConversationFontCss(getRegisteredFont("peyda"), fixtureAdapterWith({ exclusions: [] })),
  ]) {
    assertNoMalformedSelectorList(css);
  }
});

test("an empty parent selector never broadens into a global element selector like bare span/p/div", () => {
  const platform = fixtureAdapterWith({
    canvasEditors: [],
    uiSurfaces: [{ id: "fixture-ui", selectors: [], textDescendants: ["span"] }],
  });
  const css = buildConversationFontCss(getRegisteredFont("peyda"), platform);

  assertNoAccidentalGlobalElementSelectors(css);
  assertNoEmptySelectorRule(css);
});

test("regression: ChatGPT-generated CSS still contains its meaningful selectors after hardening", () => {
  const css = fontCss();

  assert.match(css, /\[data-message-author-role="assistant"\] \.markdown:not\(#prompt-textarea\)/);
  assert.match(css, /\[data-message-role="user"\] \[data-user-message-copy\]/);
  assert.match(css, /#prompt-textarea \{\n {2}font-family:/);
  assert.match(
    css,
    /\[data-writing-block-fullscreen-editor-region\],\n\[data-writing-block\] \.ProseMirror \{\n {2}font-family:/,
  );
  assert.match(css, /\[data-sidebar-item="true"\] \[data-marquee-text="true"\]/);
  assert.match(css, /:is\(pre, code, kbd, samp, tt\)/);
  assert.match(css, /\[data-message-author-role\] svg/);
  assertNoEmptySelectorRule(css);
  assertNoMalformedSelectorList(css);
});
