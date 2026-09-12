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

test("each registered font has display names, candidates, local faces, and fallbacks", () => {
  for (const font of FONT_REGISTRY) {
    assert.ok(font.displayNameFa.length > 0);
    assert.ok(font.displayNameEn.length > 0);
    assert.ok(font.candidateFamilyNames.length > 0);
    assert.ok(font.localFaceNames.length > 0);
    assert.ok(font.fallbackStack.includes("sans-serif"));
    assert.equal(getRegisteredFont(font.id).id, font.id);
  }
});

test("isFontId accepts only registry identifiers", () => {
  assert.equal(isFontId("yekan-bakh"), true);
  assert.equal(isFontId("YekanBakh"), false);
  assert.equal(isFontId("IRANYekanX"), false);
});

test("quoteCssFontFamily quotes names with spaces and leaves CSS generics bare", () => {
  assert.equal(quoteCssFontFamily("Yekan Bakh"), '"Yekan Bakh"');
  assert.equal(quoteCssFontFamily("sans-serif"), "sans-serif");
  assert.equal(quoteCssFontFamily("ui-sans-serif"), "ui-sans-serif");
});

test("font stack leads with the alias then inspected family names", () => {
  const yekan = getRegisteredFont("yekan-bakh");
  const stack = buildFontFamilyStack(yekan);
  assert.match(stack, /^"CFC Yekan Bakh", "Yekan Bakh"/);
  assert.ok(!stack.includes("Yekan Bakh FaNum"));

  const iran = buildFontFamilyStack(getRegisteredFont("iran-yekan"));
  assert.ok(iran.includes("IRANYekanRd"));
  assert.ok(!iran.includes("IRANYekanX"));
});
