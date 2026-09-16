/**
 * CSS-rule assembly helpers shared by the font and BiDi engines.
 *
 * Platform adapters may legitimately provide an empty selector list for
 * any selector group in `PlatformSelectors` (a platform might simply not
 * have, say, canvas editors or icon-only nodes). These helpers guarantee
 * that an empty — or blank-only — selector list can never produce
 * malformed CSS and can never silently widen a rule into an unscoped or
 * global selector.
 */

/**
 * Drops blank/whitespace-only entries so a stray empty string in an
 * adapter-provided array never produces a malformed leading, trailing, or
 * doubled comma in a selector list.
 */
export function nonBlankSelectors(selectors: readonly string[]): string[] {
  return selectors.filter((selector) => selector.trim().length > 0);
}

/**
 * Joins selectors into a comma-separated CSS selector list, dropping
 * blank entries first. Returns `""` when there are no usable selectors —
 * callers must treat that as "no rule", never fall back to a broader
 * selector.
 */
export function joinSelectors(selectors: readonly string[], separator = ",\n"): string {
  return nonBlankSelectors(selectors).join(separator);
}

/**
 * Builds a single `selector { declarations }` rule. When `selectorList`
 * is blank this returns `""` instead of emitting a rule with an empty (or
 * missing) selector, which either breaks CSS parsing or — worse — can be
 * interpreted as a broader/global selector than intended.
 */
export function buildCssRule(selectorList: string, declarations: string): string {
  if (selectorList.trim().length === 0) {
    return "";
  }

  return `${selectorList} {\n${declarations}\n}`;
}

/**
 * Joins already-built CSS chunks (rules, @font-face blocks, etc.) with a
 * blank line between each, dropping empty chunks so no stray blank rule
 * or extraneous whitespace block appears in the output.
 */
export function joinCssBlocks(blocks: readonly string[]): string {
  return blocks.filter((block) => block.trim().length > 0).join("\n\n");
}
