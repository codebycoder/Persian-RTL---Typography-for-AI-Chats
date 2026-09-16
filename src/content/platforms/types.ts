/**
 * Platform-specific selector contract used by the generic font and BiDi
 * engines. ChatGPT DOM details belong in a platform adapter, not in those
 * engines.
 */

export type UiSurface = {
  readonly id: string;
  readonly selectors: readonly string[];
  readonly textDescendants: readonly string[];
};

export type PlatformSelectors = {
  /** Conversation reading containers (assistant and user text). */
  readonly conversationReading: readonly string[];
  /**
   * Reading nodes that are themselves text blocks. Wrapper containers that
   * hold many blocks are omitted so BiDi isolation stays per paragraph.
   */
  readonly bidiLeaf: readonly string[];
  readonly composer: readonly string[];
  readonly canvasEditors: readonly string[];
  readonly codePreserve: readonly string[];
  /**
   * Fenced code blocks that should use the conversation font stack with
   * `!important` (for example Claude `pre` blocks with inline monospace).
   * Inline `code` stays on `codePreserve` monospace.
   */
  readonly codeFont?: readonly string[];
  readonly iconPreserve: readonly string[];
  /**
   * Claude CDS icon ligatures (`[data-cds="Icon"]`) use the host-loaded
   * Anthropicons face. Restore that stack explicitly instead of `revert`.
   */
  readonly cdsIconPreserve?: readonly string[];
  readonly cdsIconFontFamily?: string;
  readonly exclusions: readonly string[];
  readonly uiSurfaces: readonly UiSurface[];
};

export type PlatformAdapter = {
  readonly id: string;
  matchesHostname(hostname: string): boolean;
  readonly selectors: PlatformSelectors;
  /** Optional, idempotent page-scoped setup. */
  mount?(doc: Document): void;
  /** Optional teardown. Removes only platform-owned page state. */
  unmount?(doc: Document): void;
};

/**
 * Container selectors plus tightly scoped descendants so site
 * `font-family` declarations on nested title text still lose to the
 * extension rule. Does not emit a subtree-wide `*` selector.
 *
 * A surface with an empty (or blank-only) `selectors` list contributes no
 * output — it must never fall back to some broader/global selector. A
 * surface with empty `textDescendants` still emits its bare selector, but
 * never an empty `:is()` group.
 */
export function buildUiSurfaceTextSelectors(surfaces: readonly UiSurface[]): string[] {
  return surfaces.flatMap((surface) => {
    const selectors = surface.selectors.filter((selector) => selector.trim().length > 0);
    const textDescendants = surface.textDescendants.filter(
      (descendant) => descendant.trim().length > 0,
    );

    return selectors.flatMap((selector) => {
      if (textDescendants.length === 0) {
        return [selector];
      }

      const descendants = textDescendants.join(", ");
      return [selector, `${selector} :is(${descendants})`];
    });
  });
}
