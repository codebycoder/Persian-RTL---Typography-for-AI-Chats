import assert from "node:assert/strict";
import { test } from "node:test";
import { getRegisteredFont } from "@shared/font-registry";
import { buildConversationFontCss } from "./font-style";

test("conversation CSS targets message reading text and uses only local() faces", () => {
  const css = buildConversationFontCss(getRegisteredFont("peyda"));

  assert.match(css, /@font-face/);
  assert.match(css, /src: local\(/);
  assert.doesNotMatch(css, /url\(/);
  assert.match(css, /data-message-author-role="assistant"/);
  assert.match(css, /data-message-author-role="user"/);
  assert.match(css, /\.markdown/);
  assert.match(css, /font-family:[\s\S]*!important/);
});

test("conversation CSS does not restyle the whole page, generic controls, or code with !important", () => {
  const css = buildConversationFontCss(getRegisteredFont("yekan-bakh"));

  assert.doesNotMatch(css, /(?:^|\n)\s*html\s*\{/);
  assert.doesNotMatch(css, /(?:^|\n)\s*body\s*\{/);
  assert.doesNotMatch(css, /(?:^|\n)\s*\*\s*\{/);
  assert.match(css, /:not\(#prompt-textarea\)/);
  assert.match(css, /:not\(textarea\)/);
  assert.match(css, /:is\(pre, code, kbd, samp, tt\)/);
  assert.doesNotMatch(css, /(?:^|\n)\s*\[contenteditable="true"\]\s*\{/);

  const codeBlock = css.slice(css.indexOf(":is(pre, code, kbd, samp, tt)"));
  assert.doesNotMatch(codeBlock, /!important/);
});

test("conversation CSS restyles the prompt composer, including typed paragraphs", () => {
  const css = buildConversationFontCss(getRegisteredFont("peyda"));

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
  const css = buildConversationFontCss(getRegisteredFont("peyda"));

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
  const css = buildConversationFontCss(getRegisteredFont("peyda"));

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
  const css = buildConversationFontCss(getRegisteredFont("peyda"));

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
  const css = buildConversationFontCss(getRegisteredFont("peyda"));

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
  const css = buildConversationFontCss(getRegisteredFont("peyda"));

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
  const css = buildConversationFontCss(getRegisteredFont("peyda"));

  assert.match(css, /\.markdown\.markdown-new-styling:not\(#prompt-textarea\)/);
  assert.match(
    css,
    /\.markdown\.markdown-new-styling[^\n]*:is\(p, h1, h2, h3, h4, h5, h6/,
  );
  assert.match(css, /\.markdown\.markdown-new-styling :is\(pre, code, kbd, samp, tt\)/);
});

test("descendant font rule excludes code, icons, and composer elements", () => {
  const css = buildConversationFontCss(getRegisteredFont("peyda"));

  const descendantRule = css.split("\n").find((line) => line.includes(":is(p,"));
  assert.ok(descendantRule, "expected a descendant :is(p, ...) rule");

  for (const excluded of ["pre", "code", "kbd", "samp", "tt", "svg", "span", "textarea", "input", "button"]) {
    assert.ok(
      !new RegExp(`:is\\([^)]*\\b${excluded}\\b[^)]*\\)`).test(descendantRule),
      `descendant rule must not target ${excluded}`,
    );
  }
});
