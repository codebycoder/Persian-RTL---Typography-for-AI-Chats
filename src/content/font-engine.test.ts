import assert from "node:assert/strict";
import { test } from "node:test";
import { INJECTED_STYLE_ELEMENT_ID } from "@shared/constants";
import { DEFAULT_FONT_SETTINGS } from "@shared/settings";
import { applyFontSettingsToPage } from "./font-engine";
import { chatgptAdapter } from "./platforms/chatgpt/adapter";
import type { InjectedStyleElement, StyleHost } from "./style-lifecycle";

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

test("applyFontSettingsToPage creates a single tagged style element from adapter selectors", () => {
  const { host, mounted } = createMemoryHost();

  applyFontSettingsToPage(DEFAULT_FONT_SETTINGS, chatgptAdapter, host);

  assert.equal(mounted.length, 1);
  assert.equal(mounted[0]?.id, INJECTED_STYLE_ELEMENT_ID);
  assert.match(mounted[0]?.textContent ?? "", /font-family:/);
  assert.match(mounted[0]?.textContent ?? "", /data-message-author-role="assistant"/);
});

test("applyFontSettingsToPage is idempotent and never creates duplicate style nodes", () => {
  const { host, mounted } = createMemoryHost();

  applyFontSettingsToPage(DEFAULT_FONT_SETTINGS, chatgptAdapter, host);
  const first = mounted[0];
  applyFontSettingsToPage(DEFAULT_FONT_SETTINGS, chatgptAdapter, host);

  assert.equal(mounted.length, 1);
  assert.equal(mounted[0], first);
});

test("applyFontSettingsToPage updates the existing style element", () => {
  const { host, mounted } = createMemoryHost();

  applyFontSettingsToPage(DEFAULT_FONT_SETTINGS, chatgptAdapter, host);
  const existing = mounted[0];
  assert.ok(existing);
  existing.textContent = "stale {}";

  applyFontSettingsToPage(
    { ...DEFAULT_FONT_SETTINGS, fontId: "peyda" },
    chatgptAdapter,
    host,
  );

  assert.equal(mounted.length, 1);
  assert.equal(mounted[0], existing);
  assert.match(existing.textContent ?? "", /CFC Peyda/);
  assert.doesNotMatch(existing.textContent ?? "", /stale/);
});

test("applyFontSettingsToPage removes the style when disabled", () => {
  const { host, mounted } = createMemoryHost();

  applyFontSettingsToPage(DEFAULT_FONT_SETTINGS, chatgptAdapter, host);
  applyFontSettingsToPage({ ...DEFAULT_FONT_SETTINGS, enabled: false }, chatgptAdapter, host);

  assert.equal(mounted.length, 0);
  assert.equal(host.getElementById(INJECTED_STYLE_ELEMENT_ID), null);
});

test("disabling then enabling restores a single style element", () => {
  const { host, mounted } = createMemoryHost();

  applyFontSettingsToPage(DEFAULT_FONT_SETTINGS, chatgptAdapter, host);
  applyFontSettingsToPage({ ...DEFAULT_FONT_SETTINGS, enabled: false }, chatgptAdapter, host);
  applyFontSettingsToPage(DEFAULT_FONT_SETTINGS, chatgptAdapter, host);

  assert.equal(mounted.length, 1);
  assert.equal(mounted[0]?.id, INJECTED_STYLE_ELEMENT_ID);
  assert.match(mounted[0]?.textContent ?? "", /@font-face/);
});
