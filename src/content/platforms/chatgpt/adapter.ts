import type { PlatformAdapter } from "../types";
import {
  BIDI_LEAF_SELECTORS,
  CANVAS_EDITOR_SELECTORS,
  CHATGPT_UI_SURFACES,
  CODE_PRESERVE_SELECTORS,
  COMPOSER_AND_CONTROL_EXCLUSIONS,
  COMPOSER_SELECTORS,
  CONVERSATION_READING_SELECTORS,
  ICON_PRESERVE_SELECTORS,
} from "./selectors";

export const CHATGPT_PLATFORM_ID = "chatgpt";

export function matchesChatGptHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "chatgpt.com" || normalized.endsWith(".chatgpt.com");
}

export const chatgptAdapter: PlatformAdapter = {
  id: CHATGPT_PLATFORM_ID,
  matchesHostname: matchesChatGptHostname,
  selectors: {
    conversationReading: CONVERSATION_READING_SELECTORS,
    bidiLeaf: BIDI_LEAF_SELECTORS,
    composer: COMPOSER_SELECTORS,
    canvasEditors: CANVAS_EDITOR_SELECTORS,
    codePreserve: CODE_PRESERVE_SELECTORS,
    iconPreserve: ICON_PRESERVE_SELECTORS,
    exclusions: COMPOSER_AND_CONTROL_EXCLUSIONS,
    uiSurfaces: CHATGPT_UI_SURFACES,
  },
};
