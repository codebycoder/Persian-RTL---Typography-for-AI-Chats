import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { claudeAdapter, CLAUDE_PLATFORM_ID, matchesClaudeHostname } from "./adapter";
import {
  BIDI_LEAF_SELECTORS,
  CANVAS_EDITOR_SELECTORS,
  CLAUDE_CDS_ICON_FONT_FAMILY,
  CLAUDE_CDS_ICON_PRESERVE_SELECTORS,
  CLAUDE_UI_SURFACES,
  CODE_FONT_SELECTORS,
  CODE_PRESERVE_SELECTORS,
  COMPOSER_AND_CONTROL_EXCLUSIONS,
  COMPOSER_SELECTORS,
  CONVERSATION_READING_SELECTORS,
  ICON_PRESERVE_SELECTORS,
} from "./selectors";

test("Claude adapter identity and selector wiring", () => {
  assert.equal(claudeAdapter.id, CLAUDE_PLATFORM_ID);
  assert.equal(claudeAdapter.id, "claude");
  assert.equal(claudeAdapter.selectors.conversationReading, CONVERSATION_READING_SELECTORS);
  assert.equal(claudeAdapter.selectors.bidiLeaf, BIDI_LEAF_SELECTORS);
  assert.equal(claudeAdapter.selectors.composer, COMPOSER_SELECTORS);
  assert.equal(claudeAdapter.selectors.canvasEditors, CANVAS_EDITOR_SELECTORS);
  assert.equal(claudeAdapter.selectors.codePreserve, CODE_PRESERVE_SELECTORS);
  assert.equal(claudeAdapter.selectors.codeFont, CODE_FONT_SELECTORS);
  assert.equal(claudeAdapter.selectors.iconPreserve, ICON_PRESERVE_SELECTORS);
  assert.equal(claudeAdapter.selectors.cdsIconPreserve, CLAUDE_CDS_ICON_PRESERVE_SELECTORS);
  assert.equal(claudeAdapter.selectors.cdsIconFontFamily, CLAUDE_CDS_ICON_FONT_FAMILY);
  assert.equal(claudeAdapter.selectors.exclusions, COMPOSER_AND_CONTROL_EXCLUSIONS);
  assert.equal(claudeAdapter.selectors.uiSurfaces, CLAUDE_UI_SURFACES);
  assert.equal(typeof claudeAdapter.mount, "function");
  assert.equal(typeof claudeAdapter.unmount, "function");
});

test("Claude adapter matches claude.ai hostnames only", () => {
  assert.equal(matchesClaudeHostname("claude.ai"), true);
  assert.equal(matchesClaudeHostname("www.claude.ai"), true);
  assert.equal(matchesClaudeHostname("CLAUDE.AI"), true);
  assert.equal(matchesClaudeHostname("  claude.ai  "), true);
  assert.equal(matchesClaudeHostname("chat.claude.ai"), true);
  assert.equal(claudeAdapter.matchesHostname("claude.ai"), true);

  assert.equal(matchesClaudeHostname("chatgpt.com"), false);
  assert.equal(matchesClaudeHostname("www.chatgpt.com"), false);
  assert.equal(matchesClaudeHostname("gemini.google.com"), false);
  assert.equal(matchesClaudeHostname("localhost"), false);
  assert.equal(matchesClaudeHostname("notclaude.ai"), false);
  assert.equal(matchesClaudeHostname("claude.ai.example.com"), false);
  assert.equal(matchesClaudeHostname("notclaude.ai.example.com"), false);
  assert.equal(matchesClaudeHostname("claude.ai.com"), false);
});

test("Claude platform files do not observe the DOM or scan message text", () => {
  const directory = dirname(fileURLToPath(import.meta.url));

  for (const file of ["adapter.ts", "selectors.ts"] as const) {
    const source = readFileSync(join(directory, file), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );

    assert.equal(source.includes("MutationObserver"), false, `${file} must not use MutationObserver`);
    assert.doesNotMatch(source, /textContent/, `${file} must not read element text`);
    assert.doesNotMatch(source, /setAttribute\(\s*["']dir["']/, `${file} must not mutate dir`);
    assert.doesNotMatch(source, /\.dir\s*=/, `${file} must not assign element.dir`);
  }
});
