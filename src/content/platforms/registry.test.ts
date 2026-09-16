import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { chatgptAdapter } from "./chatgpt/adapter";
import { claudeAdapter } from "./claude/adapter";
import { resolvePlatform } from "./registry";

const contentRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const CHATGPT_DOM_TOKENS = [
  "data-message-role",
  "data-assistant-markdown",
  "data-sidebar-item",
  "data-marquee-text",
  "data-message-author-role",
  "data-user-message-copy",
  "chatgpt.com",
];

const CLAUDE_DOM_TOKENS = [
  "claude.ai",
  "data-perf-row",
  'data-testid="user-message"',
  'data-cds="Prose"',
  "data-row-label",
  "data-row-key",
  "ask-user-answers-card",
  "ask-user-input-banner",
  "data-morph-key",
  'data-testid="chat-input"',
];

const HOSTNAME_DETECTION_TOKENS = [
  "location.hostname",
  "chatgpt.com",
  "claude.ai",
  "resolvePlatform",
  "matchesHostname",
];

function readContentSource(relativePath: string): string {
  return readFileSync(join(contentRoot, relativePath), "utf8");
}

test("chatgpt.com resolves to the ChatGPT adapter", () => {
  assert.equal(resolvePlatform("chatgpt.com"), chatgptAdapter);
  assert.equal(resolvePlatform("www.chatgpt.com"), chatgptAdapter);
  assert.equal(resolvePlatform("chatgpt.com")?.id, "chatgpt");
});

test("claude.ai resolves to the Claude adapter", () => {
  assert.equal(resolvePlatform("claude.ai"), claudeAdapter);
  assert.equal(resolvePlatform("www.claude.ai"), claudeAdapter);
  assert.equal(resolvePlatform("claude.ai")?.id, "claude");
});

test("unsupported and lookalike hostnames return no adapter", () => {
  assert.equal(resolvePlatform("gemini.google.com"), undefined);
  assert.equal(resolvePlatform("localhost"), undefined);
  assert.equal(resolvePlatform("example.com"), undefined);
  assert.equal(resolvePlatform("notchatgpt.com"), undefined);
  assert.equal(resolvePlatform("notclaude.ai"), undefined);
  assert.equal(resolvePlatform("claude.ai.example.com"), undefined);
  assert.equal(resolvePlatform("notclaude.ai.example.com"), undefined);
});

test("generic style engines do not detect hostnames or embed ChatGPT or Claude DOM selectors", () => {
  const engineFiles = ["font-style.ts", "bidi-style.ts", "font-engine.ts"] as const;

  for (const file of engineFiles) {
    const source = readContentSource(file);

    for (const token of [...CHATGPT_DOM_TOKENS, ...CLAUDE_DOM_TOKENS]) {
      assert.equal(source.includes(token), false, `${file} must not contain ${token}`);
    }

    for (const token of HOSTNAME_DETECTION_TOKENS) {
      assert.equal(source.includes(token), false, `${file} must not contain ${token}`);
    }

    assert.equal(source.includes("MutationObserver"), false, `${file} must not observe the DOM`);
    assert.equal(source.includes("detectBlockDirection"), false, `${file} must not detect language`);
    assert.equal(source.includes("Script=Arabic"), false, `${file} must not count scripts`);
  }
});

test("content script uses optional platform lifecycle instead of importing Claude direction", () => {
  const source = readContentSource("index.ts");

  assert.match(source, /platform\.mount\?/);
  assert.match(source, /platform\.unmount\?/);
  assert.equal(source.includes("platforms/claude/direction"), false);
  assert.equal(source.includes("detectBlockDirection"), false);
  assert.equal(source.includes("MutationObserver"), false);
});

test("Claude composer selector knowledge stays under platforms/claude/", () => {
  const token = 'data-testid="chat-input"';
  const forbidden = [
    "font-style.ts",
    "bidi-style.ts",
    "font-engine.ts",
    "platforms/types.ts",
    "platforms/chatgpt/adapter.ts",
    "platforms/chatgpt/selectors.ts",
  ] as const;

  for (const file of forbidden) {
    assert.equal(
      readContentSource(file).includes(token),
      false,
      `${file} must not contain ${token}`,
    );
  }
});

test("Claude Ask User Answers selector knowledge stays under platforms/claude/", () => {
  const token = "ask-user-answers-card";
  const forbidden = [
    "font-style.ts",
    "bidi-style.ts",
    "font-engine.ts",
    "platforms/types.ts",
    "platforms/chatgpt/adapter.ts",
    "platforms/chatgpt/selectors.ts",
  ] as const;

  for (const file of forbidden) {
    assert.equal(
      readContentSource(file).includes(token),
      false,
      `${file} must not contain ${token}`,
    );
  }
});

test("Claude TurnStatus selector knowledge stays under platforms/claude/", () => {
  const token = "data-morph-key";
  const forbidden = [
    "font-style.ts",
    "bidi-style.ts",
    "font-engine.ts",
    "platforms/types.ts",
    "platforms/chatgpt/adapter.ts",
    "platforms/chatgpt/selectors.ts",
  ] as const;

  for (const file of forbidden) {
    assert.equal(
      readContentSource(file).includes(token),
      false,
      `${file} must not contain ${token}`,
    );
  }
});
