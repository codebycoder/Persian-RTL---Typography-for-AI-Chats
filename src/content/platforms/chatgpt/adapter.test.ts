import assert from "node:assert/strict";
import { test } from "node:test";
import { chatgptAdapter, CHATGPT_PLATFORM_ID, matchesChatGptHostname } from "./adapter";
import {
  BIDI_LEAF_SELECTORS,
  CANVAS_EDITOR_SELECTORS,
  CHATGPT_UI_SURFACES,
  CODE_PRESERVE_SELECTORS,
  COMPOSER_AND_CONTROL_EXCLUSIONS,
  COMPOSER_SELECTORS,
  CONVERSATION_READING_SELECTORS,
  ICON_PRESERVE_SELECTORS,
} from "./selectors";

test("ChatGPT adapter identity and selector wiring", () => {
  assert.equal(chatgptAdapter.id, CHATGPT_PLATFORM_ID);
  assert.equal(chatgptAdapter.id, "chatgpt");
  assert.equal(chatgptAdapter.selectors.conversationReading, CONVERSATION_READING_SELECTORS);
  assert.equal(chatgptAdapter.selectors.bidiLeaf, BIDI_LEAF_SELECTORS);
  assert.equal(chatgptAdapter.selectors.composer, COMPOSER_SELECTORS);
  assert.equal(chatgptAdapter.selectors.canvasEditors, CANVAS_EDITOR_SELECTORS);
  assert.equal(chatgptAdapter.selectors.codePreserve, CODE_PRESERVE_SELECTORS);
  assert.equal(chatgptAdapter.selectors.iconPreserve, ICON_PRESERVE_SELECTORS);
  assert.equal(chatgptAdapter.selectors.exclusions, COMPOSER_AND_CONTROL_EXCLUSIONS);
  assert.equal(chatgptAdapter.selectors.uiSurfaces, CHATGPT_UI_SURFACES);
  assert.equal(chatgptAdapter.mount, undefined);
  assert.equal(chatgptAdapter.unmount, undefined);
});

test("ChatGPT adapter matches chatgpt.com hostnames only", () => {
  assert.equal(matchesChatGptHostname("chatgpt.com"), true);
  assert.equal(matchesChatGptHostname("www.chatgpt.com"), true);
  assert.equal(matchesChatGptHostname("CHATGPT.COM"), true);
  assert.equal(chatgptAdapter.matchesHostname("chatgpt.com"), true);

  assert.equal(matchesChatGptHostname("claude.ai"), false);
  assert.equal(matchesChatGptHostname("gemini.google.com"), false);
  assert.equal(matchesChatGptHostname("localhost"), false);
  assert.equal(matchesChatGptHostname("notchatgpt.com"), false);
  assert.equal(matchesChatGptHostname("chatgpt.com.evil.com"), false);
});
