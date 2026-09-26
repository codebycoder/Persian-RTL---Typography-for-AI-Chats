import assert from "node:assert/strict";
import { test } from "node:test";
import { CUSTOM_FONT_ID, detectFontFormat } from "./custom-font";
import { DEFAULT_FONT_SETTINGS, parseFontSettings } from "./settings";

test("parseFontSettings returns defaults for missing values", () => {
  assert.deepEqual(parseFontSettings(undefined), DEFAULT_FONT_SETTINGS);
  assert.deepEqual(parseFontSettings(null), DEFAULT_FONT_SETTINGS);
  assert.deepEqual(parseFontSettings("nope"), DEFAULT_FONT_SETTINGS);
});

test("parseFontSettings keeps a valid custom font selection", () => {
  const customFont = {
    name: "My Persian Font",
    fileName: "my-font.woff2",
    format: "woff2",
    size: 4,
    dataUrl: "data:font/woff2;base64,d09GMg==",
  };

  assert.deepEqual(
    parseFontSettings({ enabled: true, fontId: CUSTOM_FONT_ID, customFont }),
    { schemaVersion: 2, enabled: true, fontId: CUSTOM_FONT_ID, customFont },
  );
});

test("parseFontSettings falls back to Vazirmatn when custom font data is invalid", () => {
  assert.deepEqual(
    parseFontSettings({ enabled: true, fontId: CUSTOM_FONT_ID, customFont: { dataUrl: "nope" } }),
    DEFAULT_FONT_SETTINGS,
  );
});

test("detectFontFormat recognizes supported font signatures", () => {
  assert.equal(detectFontFormat(Uint8Array.from([0x77, 0x4f, 0x46, 0x32])), "woff2");
  assert.equal(detectFontFormat(Uint8Array.from([0x77, 0x4f, 0x46, 0x46])), "woff");
  assert.equal(detectFontFormat(Uint8Array.from([0x4f, 0x54, 0x54, 0x4f])), "opentype");
  assert.equal(detectFontFormat(Uint8Array.from([0x00, 0x01, 0x00, 0x00])), "truetype");
  assert.equal(detectFontFormat(Uint8Array.from([0x25, 0x50, 0x44, 0x46])), null);
});

test("parseFontSettings keeps valid enabled and fontId", () => {
  assert.deepEqual(
    parseFontSettings({ schemaVersion: 1, enabled: false, fontId: "estedad" }),
    { schemaVersion: 2, enabled: false, fontId: "estedad", customFont: null },
  );
});

test("parseFontSettings rejects unknown font ids and non-boolean enabled", () => {
  assert.deepEqual(
    parseFontSettings({ enabled: "yes", fontId: "Noto Sans Arabic UI" }),
    DEFAULT_FONT_SETTINGS,
  );
});

test("parseFontSettings ignores outdated extra fields and unknown schema", () => {
  const parsed = parseFontSettings({
    schemaVersion: 9,
    enabled: true,
    fontId: "estedad",
    fontSize: 22,
    conversation: "should not be stored or read",
  });

  assert.deepEqual(parsed, {
    schemaVersion: 2,
    enabled: true,
    fontId: "estedad",
    customFont: null,
  });
});
