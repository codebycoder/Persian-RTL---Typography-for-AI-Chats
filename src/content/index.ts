import { CONTENT_SCRIPT_LOG_PREFIX } from "@shared/constants";
import type { FontSettings } from "@shared/settings";
import { loadFontSettings, subscribeToFontSettings } from "@shared/storage";
import { syncConversationBidiStyle } from "./bidi-style";
import { applyFontSettingsToPage } from "./font-engine";
import { resolvePlatform } from "./platforms/registry";
import { createDocumentStyleHost } from "./style-lifecycle";

const platform = resolvePlatform(window.location.hostname);
const bidiHost = createDocumentStyleHost(document);

let initialized = false;

function applyPageSettings(settings: FontSettings): void {
  if (!platform) {
    return;
  }

  applyFontSettingsToPage(settings, platform);
  syncConversationBidiStyle(bidiHost, settings.enabled, platform);

  if (settings.enabled) {
    platform.mount?.(document);
  } else {
    platform.unmount?.(document);
  }
}

async function applyCurrentSettings(): Promise<void> {
  const settings = await loadFontSettings();
  applyPageSettings(settings);
}

function initializeContentScript(): void {
  if (!chrome.runtime?.id || initialized || !platform) {
    return;
  }

  initialized = true;
  subscribeToFontSettings(applyPageSettings);
  void applyCurrentSettings();
  console.info(`${CONTENT_SCRIPT_LOG_PREFIX} Content script initialized.`);
}

initializeContentScript();
