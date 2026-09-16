import type { PlatformAdapter } from "../types";
import { mountClaudePlatformSupport, unmountClaudePlatformSupport } from "./lifecycle";
import {
  BIDI_LEAF_SELECTORS,
  CANVAS_EDITOR_SELECTORS,
  CLAUDE_UI_SURFACES,
  CLAUDE_CDS_ICON_FONT_FAMILY,
  CLAUDE_CDS_ICON_PRESERVE_SELECTORS,
  CODE_FONT_SELECTORS,
  CODE_PRESERVE_SELECTORS,
  COMPOSER_AND_CONTROL_EXCLUSIONS,
  COMPOSER_SELECTORS,
  CONVERSATION_READING_SELECTORS,
  ICON_PRESERVE_SELECTORS,
} from "./selectors";

export const CLAUDE_PLATFORM_ID = "claude";

/**
 * Exact host or a subdomain of claude.ai. Avoids substring lookalikes
 * such as notclaude.ai or claude.ai.example.com.
 */
export function matchesClaudeHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "claude.ai" || normalized.endsWith(".claude.ai");
}

export const claudeAdapter: PlatformAdapter = {
  id: CLAUDE_PLATFORM_ID,
  matchesHostname: matchesClaudeHostname,
  selectors: {
    conversationReading: CONVERSATION_READING_SELECTORS,
    bidiLeaf: BIDI_LEAF_SELECTORS,
    composer: COMPOSER_SELECTORS,
    canvasEditors: CANVAS_EDITOR_SELECTORS,
    codePreserve: CODE_PRESERVE_SELECTORS,
    codeFont: CODE_FONT_SELECTORS,
    iconPreserve: ICON_PRESERVE_SELECTORS,
    cdsIconPreserve: CLAUDE_CDS_ICON_PRESERVE_SELECTORS,
    cdsIconFontFamily: CLAUDE_CDS_ICON_FONT_FAMILY,
    exclusions: COMPOSER_AND_CONTROL_EXCLUSIONS,
    uiSurfaces: CLAUDE_UI_SURFACES,
  },
  mount(doc) {
    mountClaudePlatformSupport(doc);
  },
  unmount(doc) {
    unmountClaudePlatformSupport(doc);
  },
};
