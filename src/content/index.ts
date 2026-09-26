import {
  APPLY_CURRENT_SETTINGS_MESSAGE,
  CONTENT_SCRIPT_LOG_PREFIX,
} from "@shared/constants";
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

function listenForApplyRequests(): void {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (
      typeof message !== "object" ||
      message === null ||
      !("type" in message) ||
      message.type !== APPLY_CURRENT_SETTINGS_MESSAGE
    ) {
      return false;
    }

    void applyCurrentSettings()
      .then(() => sendResponse({ applied: true, platform: platform?.id ?? null }))
      .catch((error: unknown) => {
        console.error(`${CONTENT_SCRIPT_LOG_PREFIX} Failed to apply settings.`, error);
        sendResponse({ applied: false, platform: platform?.id ?? null });
      });
    return true;
  });
}

function initializeContentScript(): void {
  if (!chrome.runtime?.id || initialized || !platform) {
    return;
  }

  initialized = true;
  subscribeToFontSettings(applyPageSettings);
  listenForApplyRequests();
  void applyCurrentSettings();
  console.info(`${CONTENT_SCRIPT_LOG_PREFIX} Content script initialized.`);
}

initializeContentScript();
