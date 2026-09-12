import { CONTENT_SCRIPT_LOG_PREFIX } from "@shared/constants";
import {
  detectFontAvailability,
  type FontAvailabilityStatus,
} from "@shared/font-availability";
import {
  FONT_REGISTRY,
  buildFontFamilyStack,
  describeFontRegistryForDiagnostics,
  getRegisteredFont,
  isFontId,
} from "@shared/font-registry";
import { parseFontSettings, type FontSettings } from "@shared/settings";
import { loadFontSettings, saveFontSettings, subscribeToFontSettings } from "@shared/storage";

const nameElement = document.querySelector("[data-extension-name]");
const enabledToggle = document.querySelector("[data-enabled-toggle]");
const enabledState = document.querySelector("[data-enabled-state]");
const settingsForm = document.querySelector("[data-settings-form]");
const fontSelect = document.querySelector("[data-font-select]");
const previewFa = document.querySelector("[data-preview-fa]");
const previewEn = document.querySelector("[data-preview-en]");
const statusElement = document.querySelector("[data-status]");

const STATUS_MESSAGES: Record<FontAvailabilityStatus, string> = {
  "likely-available": "",
  "likely-unavailable":
    "This font was not detected on this device. A readable fallback will be used. You can choose another font.",
  uncertain:
    "This font could not be confirmed on this device. A readable fallback will be used if it is missing.",
};

function isCheckbox(element: Element | null): element is HTMLInputElement {
  return element instanceof HTMLInputElement && element.type === "checkbox";
}

function isSelect(element: Element | null): element is HTMLSelectElement {
  return element instanceof HTMLSelectElement;
}

function populateFontOptions(select: HTMLSelectElement, selectedId: FontSettings["fontId"]): void {
  select.replaceChildren();
  for (const font of FONT_REGISTRY) {
    const option = document.createElement("option");
    option.value = font.id;
    option.textContent = `${font.displayNameFa} — ${font.displayNameEn}`;
    option.selected = font.id === selectedId;
    select.append(option);
  }
}

function applyPreviewFont(settings: FontSettings): void {
  const font = getRegisteredFont(settings.fontId);
  const stack = buildFontFamilyStack(font);
  if (previewFa instanceof HTMLElement) {
    previewFa.style.fontFamily = stack;
  }
  if (previewEn instanceof HTMLElement) {
    previewEn.style.fontFamily = stack;
  }
}

function renderStatus(status: FontAvailabilityStatus, fontLabel: string): void {
  if (!(statusElement instanceof HTMLElement)) {
    return;
  }

  const message = STATUS_MESSAGES[status];
  if (!message) {
    statusElement.hidden = true;
    statusElement.textContent = "";
    statusElement.removeAttribute("data-kind");
    return;
  }

  statusElement.hidden = false;
  statusElement.dataset.kind = "warning";
  statusElement.textContent = `${fontLabel}: ${message}`;
}

async function refreshAvailability(settings: FontSettings): Promise<void> {
  const font = getRegisteredFont(settings.fontId);
  const result = await detectFontAvailability(font);
  renderStatus(result.status, `${font.displayNameFa} (${font.displayNameEn})`);

  if (result.status !== "likely-available") {
    console.info(`${CONTENT_SCRIPT_LOG_PREFIX} Font diagnostics`, {
      ...describeFontRegistryForDiagnostics(font.id),
      availability: result,
    });
  }
}

function readFormSettings(): FontSettings {
  const enabled = isCheckbox(enabledToggle) ? enabledToggle.checked : true;
  const rawFontId = isSelect(fontSelect) ? fontSelect.value : "";
  return parseFontSettings({
    schemaVersion: 1,
    enabled,
    fontId: isFontId(rawFontId) ? rawFontId : undefined,
  });
}

function renderEnabledUi(enabled: boolean): void {
  if (isCheckbox(enabledToggle)) {
    enabledToggle.checked = enabled;
    enabledToggle.setAttribute("aria-checked", enabled ? "true" : "false");
  }
  if (enabledState) {
    enabledState.textContent = enabled ? "On" : "Off";
  }
  if (settingsForm instanceof HTMLElement) {
    settingsForm.dataset.enabled = enabled ? "true" : "false";
  }
  if (isSelect(fontSelect)) {
    fontSelect.disabled = !enabled;
  }
}

function renderSettings(settings: FontSettings): void {
  renderEnabledUi(settings.enabled);
  if (isSelect(fontSelect)) {
    fontSelect.value = settings.fontId;
  }
  applyPreviewFont(settings);
}

async function persistFromForm(): Promise<void> {
  const settings = readFormSettings();
  renderEnabledUi(settings.enabled);
  applyPreviewFont(settings);
  void refreshAvailability(settings);
  await saveFontSettings(settings);
}

function initializePopup(): void {
  if (!chrome.runtime?.id) {
    return;
  }

  const manifest = chrome.runtime.getManifest();
  if (nameElement) {
    nameElement.textContent = manifest.name;
  }

  if (isSelect(fontSelect)) {
    populateFontOptions(fontSelect, "yekan-bakh");
  }

  if (isCheckbox(enabledToggle)) {
    enabledToggle.addEventListener("change", () => {
      void persistFromForm();
    });
  }

  if (isSelect(fontSelect)) {
    fontSelect.addEventListener("change", () => {
      void persistFromForm();
    });
  }

  subscribeToFontSettings((settings) => {
    renderSettings(settings);
    void refreshAvailability(settings);
  });

  void loadFontSettings().then((settings) => {
    renderSettings(settings);
    void refreshAvailability(settings);
  });
}

initializePopup();
