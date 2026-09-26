import { INJECTED_STYLE_ELEMENT_ID } from "@shared/constants";
import { resolveSettingsFont, type FontSettings } from "@shared/settings";
import { buildConversationFontCss } from "./font-style";
import type { PlatformAdapter } from "./platforms/types";
import { createDocumentStyleHost, syncInjectedStyle, type StyleHost } from "./style-lifecycle";

let documentHost: StyleHost | undefined;

function resolveStyleHost(styleHost?: StyleHost): StyleHost {
  if (styleHost) {
    return styleHost;
  }

  documentHost ??= createDocumentStyleHost(document);
  return documentHost;
}

export function applyFontSettingsToPage(
  settings: FontSettings,
  platform: PlatformAdapter,
  styleHost?: StyleHost,
): void {
  const host = resolveStyleHost(styleHost);

  if (!settings.enabled) {
    syncInjectedStyle(host, INJECTED_STYLE_ELEMENT_ID, null);
    return;
  }

  const font = resolveSettingsFont(settings);
  const css = buildConversationFontCss(font, platform, (assetPath) => {
    if (assetPath.startsWith("data:")) return assetPath;
    return typeof chrome !== "undefined" && chrome.runtime?.id
      ? chrome.runtime.getURL(assetPath)
      : assetPath;
  });
  syncInjectedStyle(host, INJECTED_STYLE_ELEMENT_ID, css);
}
