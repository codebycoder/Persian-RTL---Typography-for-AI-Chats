import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { chatgptAdapter } from "../chatgpt/adapter";
import { claudeAdapter } from "./adapter";
import { mountClaudePlatformSupport, unmountClaudePlatformSupport } from "./lifecycle";

test("Claude composer lifecycle is event-driven and does not observe the whole document", () => {
  const directory = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(directory, "lifecycle.ts"), "utf8");

  assert.match(source, /addEventListener\("input"/);
  assert.match(source, /addEventListener\("focusin"/);
  assert.match(source, /removeEventListener\("input"/);
  assert.match(source, /removeEventListener\("focusin"/);
  assert.match(source, /processComposerEditor/);
  assert.match(source, /clearComposerDirectionState/);
  assert.equal(source.includes("MutationObserver"), false, "lifecycle must not construct a DOM observer");
  assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)\(/);
  assert.doesNotMatch(source, /chrome\.storage\.(local|sync|session)/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\blocalStorage\b/);
  assert.match(source, /never logs, stores, or transmits/);
});

test("platform support mount and unmount stay wired through the Claude adapter", () => {
  assert.equal(typeof claudeAdapter.mount, "function");
  assert.equal(typeof claudeAdapter.unmount, "function");
  assert.equal(chatgptAdapter.mount, undefined);
  assert.equal(chatgptAdapter.unmount, undefined);
  assert.equal(typeof mountClaudePlatformSupport, "function");
  assert.equal(typeof unmountClaudePlatformSupport, "function");
});
