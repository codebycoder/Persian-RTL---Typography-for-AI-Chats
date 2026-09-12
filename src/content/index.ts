import { CONTENT_SCRIPT_LOG_PREFIX } from "@shared/constants";
import { loadFontSettings, subscribeToFontSettings } from "@shared/storage";
import { applyFontSettingsToPage } from "./font-engine";

let initialized = false;

async function applyCurrentSettings(): Promise<void> {
  const settings = await loadFontSettings();
  applyFontSettingsToPage(settings);
}

function initializeContentScript(): void {
  if (!chrome.runtime?.id || initialized) {
    return;
  }

  initialized = true;
  subscribeToFontSettings(applyFontSettingsToPage);
  void applyCurrentSettings();
  console.info(`${CONTENT_SCRIPT_LOG_PREFIX} Content script initialized.`);
}

initializeContentScript();
