/**
 * Shared invariant checks for generated CSS strings. Used by the font and
 * BiDi engine tests to guard against the specific failure mode this
 * module exists to prevent: an adapter-provided empty selector list
 * silently turning into invalid CSS or an accidentally global selector.
 *
 * This module intentionally avoids `node:assert` (and any Node-only
 * types) so it type-checks cleanly under the non-test `tsconfig.json`,
 * which does not include Node types. Failures throw a plain `Error`,
 * which `node:test` reports the same way as an assertion failure.
 */

function fail(message: string): never {
  throw new Error(message);
}

/**
 * Splits a comma-separated selector list on top-level commas only —
 * commas nested inside a `:is(...)`/`:not(...)` group do not start a new
 * selector. Without this, legitimate groups like `:is(p, span)` would
 * look identical to a malformed or accidentally-global bare `span`.
 */
function splitTopLevelSelectors(selectorList: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of selectorList) {
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    }

    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  parts.push(current);
  return parts;
}

/**
 * No rule in `css` may open with an empty (or blank-only) selector. That
 * would either be dropped by the CSS parser (a `{...}` block with no
 * selector at all is a syntax error) or, worse, be salvaged by the parser
 * in a way that behaves like an unscoped/global rule.
 */
export function assertNoEmptySelectorRule(css: string): void {
  if (/(^|\n)[ \t]*\{/.test(css)) {
    fail("found a CSS rule block with an empty selector");
  }
}

/**
 * No selector list (the comma-separated text before a `{`) may contain a
 * blank entry. A blank entry means a leading, trailing, or doubled comma,
 * which is either invalid CSS or silently drops part of the intended
 * scoping.
 */
export function assertNoMalformedSelectorList(css: string): void {
  const preambles = [...css.matchAll(/([^{}]*)\{/g)].map((match) => match[1] ?? "");

  for (const preamble of preambles) {
    // Only the last line before `{` is the actual selector list; earlier
    // lines are prior rules' closing braces/blank separators already
    // excluded by the `[^{}]*` match boundary.
    const selectorList = preamble.trim();
    if (selectorList.length === 0) {
      // Covered by assertNoEmptySelectorRule.
      continue;
    }

    const parts = splitTopLevelSelectors(selectorList).map((part) => part.trim());
    for (const part of parts) {
      if (part === "") {
        fail(
          `found a blank entry in a comma-separated selector list: ${JSON.stringify(selectorList)}`,
        );
      }
    }
  }
}

/**
 * Bare/global element selectors (e.g. a lone `span`) must never appear as
 * a full top-level selector segment. Legitimate uses always scope these
 * elements under a parent (`... :is(span)`, `#composer span`, etc.); a
 * bare top-level occurrence is the signature of an empty parent selector
 * collapsing into `"" + " span"`.
 */
export function assertNoAccidentalGlobalElementSelectors(
  css: string,
  elements: readonly string[] = ["span", "p", "div", "a", "li"],
): void {
  const preambles = [...css.matchAll(/([^{}]*)\{/g)].map((match) => match[1]?.trim() ?? "");

  for (const preamble of preambles) {
    if (preamble.length === 0) {
      continue;
    }

    // Only top-level selectors matter here — `:is(p, span)` is a
    // legitimate scoped group, not a bare global selector. A real failure
    // looks like a *top-level* selector that is exactly "span" (i.e. an
    // empty parent selector collapsed into `"" + " span"`).
    const selectors = splitTopLevelSelectors(preamble).map((part) => part.trim());
    for (const selector of selectors) {
      for (const element of elements) {
        if (selector === element) {
          fail(
            `found an accidental global "${element}" selector (likely from an empty parent selector)`,
          );
        }
      }
    }
  }
}
