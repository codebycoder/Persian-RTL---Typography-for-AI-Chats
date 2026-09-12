import { INJECTED_STYLE_ELEMENT_ID } from "@shared/constants";
import { getRegisteredFont } from "@shared/font-registry";
import type { FontSettings } from "@shared/settings";
import { buildConversationFontCss } from "./font-style";
import { createDocumentStyleHost, syncInjectedStyle } from "./style-lifecycle";

const host = createDocumentStyleHost(document);

export function applyFontSettingsToPage(settings: FontSettings): void {
  if (!settings.enabled) {
    syncInjectedStyle(host, INJECTED_STYLE_ELEMENT_ID, null);
    return;
  }

  const font = getRegisteredFont(settings.fontId);
  const css = buildConversationFontCss(font);
  syncInjectedStyle(host, INJECTED_STYLE_ELEMENT_ID, css);
}
