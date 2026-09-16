import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCssRule, joinCssBlocks, joinSelectors, nonBlankSelectors } from "./css-rule";

test("nonBlankSelectors drops empty and whitespace-only entries", () => {
  assert.deepEqual(nonBlankSelectors([]), []);
  assert.deepEqual(nonBlankSelectors([".foo", "", "  ", ".bar"]), [".foo", ".bar"]);
  assert.deepEqual(nonBlankSelectors([".foo", ".bar"]), [".foo", ".bar"]);
});

test("joinSelectors returns an empty string for an empty selector list", () => {
  assert.equal(joinSelectors([]), "");
});

test("joinSelectors drops blank entries so no malformed comma survives", () => {
  assert.equal(joinSelectors(["", ".foo", "", ".bar", ""]), ".foo,\n.bar");
});

test("joinSelectors joins non-empty selectors with the default separator", () => {
  assert.equal(joinSelectors([".foo", ".bar"]), ".foo,\n.bar");
});

test("buildCssRule returns an empty string for an empty selector list", () => {
  assert.equal(buildCssRule("", "  font-family: sans-serif;"), "");
});

test("buildCssRule returns an empty string for a blank/whitespace-only selector list", () => {
  assert.equal(buildCssRule("   ", "  font-family: sans-serif;"), "");
});

test("buildCssRule never falls back to a broader selector for empty input", () => {
  // The specific failure mode this task guards against: `[] -> "" -> "${selector} span"`
  // must never produce a bare/global `span` (or any other unscoped) rule.
  const rule = buildCssRule("", "  font-family: sans-serif;");

  assert.equal(rule, "");
  assert.doesNotMatch(rule, /span/);
  assert.doesNotMatch(rule, /\{/);
});

test("buildCssRule emits a valid rule for a non-empty selector list", () => {
  const rule = buildCssRule(".foo,\n.bar", "  font-family: sans-serif;");

  assert.equal(rule, ".foo,\n.bar {\n  font-family: sans-serif;\n}");
});

test("joinCssBlocks drops empty blocks and joins the rest with a blank line", () => {
  assert.equal(joinCssBlocks(["", "a { b: c; }", "", "d { e: f; }", ""]), "a { b: c; }\n\nd { e: f; }");
});

test("joinCssBlocks returns an empty string when every block is empty", () => {
  assert.equal(joinCssBlocks(["", "  ", ""]), "");
});
