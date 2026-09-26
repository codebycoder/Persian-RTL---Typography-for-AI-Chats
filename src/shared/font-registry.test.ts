import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FONT_IDS,
  FONT_REGISTRY,
  buildFontFamilyStack,
  getRegisteredFont,
  isFontId,
  quoteCssFontFamily,
} from "./font-registry";

test("registry includes exactly the four supported fonts", () => {
  assert.deepEqual(
    FONT_REGISTRY.map((font) => font.id),
    [...FONT_IDS],
  );
});

test("each registered font has display names, bundled faces, and fallbacks", () => {
  for (const font of FONT_REGISTRY) {
    assert.ok(font.displayNameFa.length > 0);
    assert.ok(font.displayNameEn.length > 0);
    assert.ok(font.candidateFamilyNames.length > 0);
    assert.ok(font.faces.length > 0);
    assert.ok(font.faces.every((face) => face.assetPath.startsWith("fonts/")));
    assert.ok(font.fallbackStack.includes("sans-serif"));
    assert.equal(getRegisteredFont(font.id).id, font.id);
  }
});

test("isFontId accepts only registry identifiers", () => {
  assert.equal(isFontId("vazirmatn"), true);
  assert.equal(isFontId("YekanBakh"), false);
  assert.equal(isFontId("Noto Sans Arabic UI"), false);
});

test("quoteCssFontFamily quotes names with spaces and leaves CSS generics bare", () => {
  assert.equal(quoteCssFontFamily("Vazirmatn"), "Vazirmatn");
  assert.equal(quoteCssFontFamily("sans-serif"), "sans-serif");
  assert.equal(quoteCssFontFamily("ui-sans-serif"), "ui-sans-serif");
});

test("font stack leads with the alias then family names", () => {
  const vazirmatn = getRegisteredFont("vazirmatn");
  const stack = buildFontFamilyStack(vazirmatn);
  assert.match(stack, /^"CFC Vazirmatn", Vazirmatn/);
  assert.ok(!stack.includes("Vazirmatn FaNum"));

  const noto = buildFontFamilyStack(getRegisteredFont("noto-sans-arabic"));
  assert.ok(noto.includes("Noto Sans Arabic"));
  assert.ok(!noto.includes("Noto Sans Arabic UI"));
});
