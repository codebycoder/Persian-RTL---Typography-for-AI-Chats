import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_FONT_SETTINGS, parseFontSettings } from "./settings";

test("parseFontSettings returns defaults for missing values", () => {
  assert.deepEqual(parseFontSettings(undefined), DEFAULT_FONT_SETTINGS);
  assert.deepEqual(parseFontSettings(null), DEFAULT_FONT_SETTINGS);
  assert.deepEqual(parseFontSettings("nope"), DEFAULT_FONT_SETTINGS);
});

test("parseFontSettings keeps valid enabled and fontId", () => {
  assert.deepEqual(
    parseFontSettings({ schemaVersion: 1, enabled: false, fontId: "peyda" }),
    { schemaVersion: 1, enabled: false, fontId: "peyda" },
  );
});

test("parseFontSettings rejects unknown font ids and non-boolean enabled", () => {
  assert.deepEqual(
    parseFontSettings({ enabled: "yes", fontId: "IRANYekanX" }),
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
    schemaVersion: 1,
    enabled: true,
    fontId: "estedad",
  });
});
