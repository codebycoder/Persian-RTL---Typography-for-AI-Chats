import assert from "node:assert/strict";
import { test } from "node:test";
import { buildUiSurfaceTextSelectors, type UiSurface } from "./types";

test("buildUiSurfaceTextSelectors returns nothing for an empty surface list", () => {
  assert.deepEqual(buildUiSurfaceTextSelectors([]), []);
});

test("a UiSurface with an empty selectors list contributes no selectors", () => {
  const surfaces: readonly UiSurface[] = [
    { id: "empty-surface", selectors: [], textDescendants: ["span"] },
  ];

  assert.deepEqual(buildUiSurfaceTextSelectors(surfaces), []);
});

test("a UiSurface with blank-only selectors contributes no selectors", () => {
  const surfaces: readonly UiSurface[] = [
    { id: "blank-surface", selectors: ["", "   "], textDescendants: ["span"] },
  ];

  assert.deepEqual(buildUiSurfaceTextSelectors(surfaces), []);
});

test("a UiSurface with empty textDescendants emits only the bare selector, never an empty :is()", () => {
  const surfaces: readonly UiSurface[] = [
    { id: "no-descendants", selectors: ["[data-surface]"], textDescendants: [] },
  ];

  const selectors = buildUiSurfaceTextSelectors(surfaces);

  assert.deepEqual(selectors, ["[data-surface]"]);
  for (const selector of selectors) {
    assert.doesNotMatch(selector, /:is\(\s*\)/);
    assert.doesNotMatch(selector, /:is\(\)/);
  }
});

test("a UiSurface with blank-only textDescendants behaves like empty textDescendants", () => {
  const surfaces: readonly UiSurface[] = [
    { id: "blank-descendants", selectors: ["[data-surface]"], textDescendants: ["", "  "] },
  ];

  assert.deepEqual(buildUiSurfaceTextSelectors(surfaces), ["[data-surface]"]);
});

test("a valid surface still emits both the bare selector and the descendant selector", () => {
  const surfaces: readonly UiSurface[] = [
    { id: "valid-surface", selectors: ["[data-surface]"], textDescendants: ["span", "b"] },
  ];

  assert.deepEqual(buildUiSurfaceTextSelectors(surfaces), [
    "[data-surface]",
    "[data-surface] :is(span, b)",
  ]);
});

test("an empty surface never widens into a global descendant selector", () => {
  const surfaces: readonly UiSurface[] = [{ id: "empty", selectors: [], textDescendants: ["span"] }];

  const selectors = buildUiSurfaceTextSelectors(surfaces);

  assert.equal(selectors.length, 0);
  assert.ok(!selectors.some((selector) => selector.trim() === "span"));
});
