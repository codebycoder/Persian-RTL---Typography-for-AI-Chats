import {
  CUSTOM_FONT_ID,
  MAX_CUSTOM_FONT_BYTES,
  customFontDisplayName,
  customFontMime,
  detectFontFormat,
  type StoredCustomFont,
} from "@shared/custom-font";
import { APPLY_CURRENT_SETTINGS_MESSAGE } from "@shared/constants";
import {
  FONT_REGISTRY,
  buildFontFaceCss,
  buildFontFamilyStack,
  getRegisteredFont,
  isFontId,
} from "@shared/font-registry";
import {
  DEFAULT_FONT_SETTINGS,
  parseFontSettings,
  resolveSettingsFont,
  type FontSettings,
} from "@shared/settings";
import { loadFontSettings, saveFontSettings, subscribeToFontSettings } from "@shared/storage";

const enabledToggle = document.querySelector("[data-enabled-toggle]");
const enabledState = document.querySelector("[data-enabled-state]");
const settingsForm = document.querySelector("[data-settings-form]");
const fontPicker = document.querySelector("[data-font-picker]");
const fontTrigger = document.querySelector("[data-font-trigger]");
const fontValue = document.querySelector("[data-font-value]");
const fontPickerMeta = document.querySelector("[data-font-picker-meta]");
const fontPopover = document.querySelector("[data-font-popover]");
const fontOptions = document.querySelector("[data-font-options]");
const previewFa = document.querySelector("[data-preview-fa]");
const previewEn = document.querySelector("[data-preview-en]");
const previewFontStyle = document.querySelector("[data-preview-font-style]");
const uploadButton = document.querySelector("[data-upload-button]");
const fontFileInput = document.querySelector("[data-font-file]");
const customFontDetails = document.querySelector("[data-custom-font-details]");
const customFontName = document.querySelector("[data-custom-font-name]");
const customFontMeta = document.querySelector("[data-custom-font-meta]");
const removeCustomButton = document.querySelector("[data-remove-custom]");
const statusElement = document.querySelector("[data-status]");
const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-tab-button]"));
const tabPanels = Array.from(document.querySelectorAll<HTMLElement>("[data-tab-panel]"));

let currentSettings = DEFAULT_FONT_SETTINGS;

type PopupTabId = "font" | "settings";

function isPopupTabId(value: string | undefined): value is PopupTabId {
  return value === "font" || value === "settings";
}

function isCheckbox(element: Element | null): element is HTMLInputElement {
  return element instanceof HTMLInputElement && element.type === "checkbox";
}

function isFileInput(element: Element | null): element is HTMLInputElement {
  return element instanceof HTMLInputElement && element.type === "file";
}

function formatBytes(bytes: number): string {
  const integer = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });
  if (bytes < 1024 * 1024) {
    return `${integer.format(Math.max(1, Math.round(bytes / 1024)))} کیلوبایت`;
  }
  const decimal = new Intl.NumberFormat("fa-IR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${decimal.format(bytes / (1024 * 1024))} مگابایت`;
}

function resolveAssetUrl(assetPath: string): string {
  return assetPath.startsWith("data:") ? assetPath : chrome.runtime.getURL(assetPath);
}

function applyPreviewFont(settings: FontSettings): void {
  const font = resolveSettingsFont(settings);
  const stack = buildFontFamilyStack(font);
  if (previewFontStyle instanceof HTMLStyleElement) {
    const builtInFontCss = FONT_REGISTRY.map((availableFont) =>
      buildFontFaceCss(availableFont, resolveAssetUrl),
    );
    const customFontCss = settings.customFont
      ? buildFontFaceCss(
          resolveSettingsFont({ ...settings, fontId: CUSTOM_FONT_ID }),
          resolveAssetUrl,
        )
      : "";
    previewFontStyle.textContent = [...builtInFontCss, customFontCss]
      .filter(Boolean)
      .join("\n\n");
  }
  if (previewFa instanceof HTMLElement) {
    previewFa.style.fontFamily = stack;
  }
  if (previewEn instanceof HTMLElement) {
    previewEn.style.fontFamily = stack;
  }
}

function isAvailableFontId(value: string): value is FontSettings["fontId"] {
  return isFontId(value) || (value === CUSTOM_FONT_ID && currentSettings.customFont !== null);
}

function optionElements(): HTMLElement[] {
  if (!(fontOptions instanceof HTMLElement)) return [];
  return Array.from(fontOptions.querySelectorAll<HTMLElement>("[role='option']"));
}

function closeFontPicker(restoreFocus = false): void {
  if (fontPopover instanceof HTMLElement) fontPopover.hidden = true;
  if (fontPicker instanceof HTMLElement) fontPicker.dataset.open = "false";
  if (fontTrigger instanceof HTMLButtonElement) {
    fontTrigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) fontTrigger.focus();
  }
}

function focusFontOption(position: "selected" | "first" | "last" = "selected"): void {
  const options = optionElements();
  if (options.length === 0) return;
  const selectedIndex = options.findIndex((option) => option.getAttribute("aria-selected") === "true");
  const index =
    position === "first"
      ? 0
      : position === "last"
        ? options.length - 1
        : Math.max(0, selectedIndex);
  options[index]?.focus();
}

function openFontPicker(position: "selected" | "first" | "last" = "selected"): void {
  if (!(fontTrigger instanceof HTMLButtonElement) || fontTrigger.disabled) return;
  if (fontPopover instanceof HTMLElement) fontPopover.hidden = false;
  if (fontPicker instanceof HTMLElement) fontPicker.dataset.open = "true";
  fontTrigger.setAttribute("aria-expanded", "true");
  focusFontOption(position);
}

function selectFont(fontId: string): void {
  if (!isAvailableFontId(fontId)) return;
  closeFontPicker(true);
  if (fontId === currentSettings.fontId) return;
  void persist({ ...currentSettings, fontId });
}

function handleFontOptionKeydown(event: KeyboardEvent): void {
  const options = optionElements();
  const currentIndex = options.findIndex((option) => option === event.currentTarget);
  if (currentIndex < 0) return;

  let targetIndex: number | null = null;
  if (event.key === "ArrowDown") targetIndex = (currentIndex + 1) % options.length;
  if (event.key === "ArrowUp") targetIndex = (currentIndex - 1 + options.length) % options.length;
  if (event.key === "Home") targetIndex = 0;
  if (event.key === "End") targetIndex = options.length - 1;
  if (targetIndex !== null) {
    event.preventDefault();
    options[targetIndex]?.focus();
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    const fontId = (event.currentTarget as HTMLElement).dataset.fontId;
    if (fontId) selectFont(fontId);
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeFontPicker(true);
    return;
  }

  if (event.key === "Tab") closeFontPicker();
}

function createFontOption(
  fontId: FontSettings["fontId"],
  name: string,
  description: string,
  fontFamily: string,
): HTMLElement {
  const option = document.createElement("div");
  option.className = "font-option";
  option.dataset.fontId = fontId;
  option.setAttribute("role", "option");
  option.setAttribute("aria-selected", fontId === currentSettings.fontId ? "true" : "false");
  option.tabIndex = -1;

  const sample = document.createElement("span");
  sample.className = "font-option-sample";
  sample.textContent = "آ";
  sample.style.fontFamily = fontFamily;
  sample.setAttribute("aria-hidden", "true");

  const copy = document.createElement("span");
  copy.className = "font-option-copy";
  const title = document.createElement("strong");
  title.className = "font-option-name";
  title.textContent = name;
  title.style.fontFamily = fontFamily;
  const meta = document.createElement("span");
  meta.className = "font-option-meta";
  meta.textContent = description;
  copy.append(title, meta);

  const check = document.createElement("span");
  check.className = "font-option-check";
  check.textContent = "✓";
  check.setAttribute("aria-hidden", "true");
  option.append(sample, copy, check);

  option.addEventListener("click", () => selectFont(fontId));
  option.addEventListener("keydown", handleFontOptionKeydown);
  return option;
}

function renderFontPicker(settings: FontSettings): void {
  const selectedFont = resolveSettingsFont(settings);
  const selectedName =
    settings.fontId === CUSTOM_FONT_ID && settings.customFont
      ? settings.customFont.name
      : getRegisteredFont(settings.fontId === CUSTOM_FONT_ID ? "vazirmatn" : settings.fontId)
          .displayNameFa;

  if (fontValue instanceof HTMLElement) {
    fontValue.textContent = selectedName;
    fontValue.style.fontFamily = buildFontFamilyStack(selectedFont);
  }
  if (fontPickerMeta) {
    fontPickerMeta.textContent = settings.fontId === CUSTOM_FONT_ID ? "فونت شخصی" : "فونت آماده";
  }
  if (!(fontOptions instanceof HTMLElement)) return;

  const options = FONT_REGISTRY.map((font) =>
    createFontOption(font.id, font.displayNameFa, "فونت آماده", buildFontFamilyStack(font)),
  );
  if (settings.customFont) {
    const customFont = resolveSettingsFont({ ...settings, fontId: CUSTOM_FONT_ID });
    options.push(
      createFontOption(
        CUSTOM_FONT_ID,
        settings.customFont.name,
        "فونت شخصی",
        buildFontFamilyStack(customFont),
      ),
    );
  }
  fontOptions.replaceChildren(...options);
}

function initializeFontPicker(): void {
  if (fontTrigger instanceof HTMLButtonElement) {
    fontTrigger.addEventListener("click", () => {
      const isOpen = fontTrigger.getAttribute("aria-expanded") === "true";
      if (isOpen) closeFontPicker(true);
      else openFontPicker();
    });
    fontTrigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        openFontPicker(event.key === "ArrowDown" ? "selected" : "last");
      }
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        openFontPicker(event.key === "Home" ? "first" : "last");
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeFontPicker(true);
      }
    });
  }

  document.addEventListener("pointerdown", (event) => {
    if (fontPicker instanceof HTMLElement && !fontPicker.contains(event.target as Node)) {
      closeFontPicker();
    }
  });
}

function renderStatus(message: string, kind: "ok" | "warning" | "error" = "ok"): void {
  if (!(statusElement instanceof HTMLElement)) return;
  statusElement.hidden = message.length === 0;
  statusElement.textContent = message;
  if (message) statusElement.dataset.kind = kind;
  else statusElement.removeAttribute("data-kind");
}

function renderEnabledUi(enabled: boolean): void {
  if (isCheckbox(enabledToggle)) {
    enabledToggle.checked = enabled;
    enabledToggle.setAttribute("aria-checked", enabled ? "true" : "false");
  }
  if (enabledState) enabledState.textContent = enabled ? "روشن" : "خاموش";
  if (settingsForm instanceof HTMLElement) {
    settingsForm.dataset.enabled = enabled ? "true" : "false";
  }
  if (fontTrigger instanceof HTMLButtonElement) fontTrigger.disabled = !enabled;
  if (!enabled) closeFontPicker();
}

function renderCustomFont(customFont: StoredCustomFont | null): void {
  if (customFontDetails instanceof HTMLElement) customFontDetails.hidden = !customFont;
  if (customFontName) customFontName.textContent = customFont?.name ?? "";
  if (customFontMeta) {
    customFontMeta.textContent = customFont
      ? `${customFont.fileName} · ${formatBytes(customFont.size)}`
      : "";
  }
  if (uploadButton instanceof HTMLElement) {
    uploadButton.textContent = customFont ? "جایگزینی فونت" : "افزودن فونت";
    uploadButton.removeAttribute("aria-busy");
  }
}

function setUploadBusy(busy: boolean): void {
  if (!(uploadButton instanceof HTMLButtonElement)) return;
  uploadButton.disabled = busy;
  if (busy) {
    uploadButton.setAttribute("aria-busy", "true");
    uploadButton.textContent = "در حال افزودن…";
    return;
  }
  uploadButton.removeAttribute("aria-busy");
  uploadButton.textContent = currentSettings.customFont ? "جایگزینی فونت" : "افزودن فونت";
}

function activateTab(tabId: PopupTabId, moveFocus = false): void {
  closeFontPicker();
  for (const button of tabButtons) {
    const selected = button.dataset.tabButton === tabId;
    button.setAttribute("aria-selected", selected ? "true" : "false");
    button.tabIndex = selected ? 0 : -1;
    if (selected && moveFocus) button.focus();
  }
  for (const panel of tabPanels) {
    panel.hidden = panel.dataset.tabPanel !== tabId;
  }
}

function initializeTabs(): void {
  for (const [index, button] of tabButtons.entries()) {
    button.addEventListener("click", () => {
      const tabId = button.dataset.tabButton;
      if (isPopupTabId(tabId)) activateTab(tabId);
    });

    button.addEventListener("keydown", (event) => {
      let targetIndex: number | null = null;
      if (event.key === "ArrowLeft") targetIndex = (index + 1) % tabButtons.length;
      if (event.key === "ArrowRight") {
        targetIndex = (index - 1 + tabButtons.length) % tabButtons.length;
      }
      if (event.key === "Home") targetIndex = 0;
      if (event.key === "End") targetIndex = tabButtons.length - 1;
      if (targetIndex === null) return;

      const target = tabButtons[targetIndex];
      const tabId = target?.dataset.tabButton;
      if (!target || !isPopupTabId(tabId)) return;
      event.preventDefault();
      activateTab(tabId, true);
    });
  }
}

function renderSettings(settings: FontSettings): void {
  currentSettings = settings;
  renderEnabledUi(settings.enabled);
  renderFontPicker(settings);
  renderCustomFont(settings.customFont);
  applyPreviewFont(settings);
}

async function persist(settings: FontSettings): Promise<void> {
  const parsed = parseFontSettings(settings);
  await saveFontSettings(parsed);
  renderSettings(parsed);
  await reportApplyResult();
}

async function requestApplyOnActiveTab(): Promise<boolean> {
  if (!chrome.tabs?.query || !chrome.tabs.sendMessage) return false;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (typeof tab?.id !== "number") return false;

    const response: unknown = await chrome.tabs.sendMessage(tab.id, {
      type: APPLY_CURRENT_SETTINGS_MESSAGE,
    });
    return (
      typeof response === "object" &&
      response !== null &&
      "applied" in response &&
      response.applied === true
    );
  } catch {
    return false;
  }
}

async function reportApplyResult(): Promise<void> {
  const applied = await requestApplyOnActiveTab();
  if (applied) {
    renderStatus("روی این تب اعمال شد.");
    return;
  }
  renderStatus(
    "یک تب چت‌جی‌پی‌تی یا کلود را باز یا تازه‌سازی کنید؛ فونت ذخیره‌شده خودکار اعمال می‌شود.",
    "warning",
  );
}

function fileToDataUrl(file: File, format: StoredCustomFont["format"]): Promise<string> {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return `data:${customFontMime(format)};base64,${btoa(binary)}`;
  });
}

async function validateBrowserCanLoadFont(file: File): Promise<void> {
  if (typeof FontFace !== "function") return;
  const face = new FontFace("CFC Upload Validation", await file.arrayBuffer());
  await face.load();
}

async function importCustomFont(file: File): Promise<void> {
  renderStatus("");
  setUploadBusy(true);
  try {
    if (file.size <= 0 || file.size > MAX_CUSTOM_FONT_BYTES) {
      renderStatus("لطفاً یک فایل فونت کوچک‌تر از ۴ مگابایت انتخاب کنید.", "error");
      return;
    }

    const format = detectFontFormat(new Uint8Array(await file.slice(0, 4).arrayBuffer()));
    if (!format) {
      renderStatus("این فایل فونت پشتیبانی نمی‌شود؛ فرمت‌های مجاز WOFF2، WOFF، TTF و OTF هستند.", "error");
      return;
    }

    await validateBrowserCanLoadFont(file);
    const customFont: StoredCustomFont = {
      name: customFontDisplayName(file.name),
      fileName: file.name.slice(0, 120),
      format,
      size: file.size,
      dataUrl: await fileToDataUrl(file, format),
    };
    const settings: FontSettings = {
      schemaVersion: 2,
      enabled: currentSettings.enabled,
      fontId: CUSTOM_FONT_ID,
      customFont,
    };
    await saveFontSettings(settings);
    renderSettings(settings);
    const applied = await requestApplyOnActiveTab();
    renderStatus(
      applied
        ? `فونت «${customFont.name}» آماده و روی این تب اعمال شد.`
        : `فونت «${customFont.name}» ذخیره شد؛ تب چت‌جی‌پی‌تی یا کلود را یک‌بار تازه‌سازی کنید.`,
      applied ? "ok" : "warning",
    );
  } catch {
    renderStatus("مرورگر نتوانست این فونت را بخواند؛ فایل دیگری را امتحان کنید.", "error");
  } finally {
    setUploadBusy(false);
  }
}

function initializePopup(): void {
  if (!chrome.runtime?.id) return;

  initializeTabs();
  initializeFontPicker();

  if (isCheckbox(enabledToggle)) {
    enabledToggle.addEventListener("change", () => {
      void persist({ ...currentSettings, enabled: enabledToggle.checked });
    });
  }

  if (uploadButton instanceof HTMLButtonElement && isFileInput(fontFileInput)) {
    uploadButton.addEventListener("click", () => fontFileInput.click());
    fontFileInput.addEventListener("change", () => {
      const file = fontFileInput.files?.[0];
      if (file) void importCustomFont(file);
      fontFileInput.value = "";
    });
  }

  if (removeCustomButton instanceof HTMLButtonElement) {
    removeCustomButton.addEventListener("click", () => {
      void persist({
        ...currentSettings,
        fontId: currentSettings.fontId === CUSTOM_FONT_ID ? "vazirmatn" : currentSettings.fontId,
        customFont: null,
      });
    });
  }

  subscribeToFontSettings(renderSettings);
  void loadFontSettings().then((settings) => {
    renderSettings(settings);
    void reportApplyResult();
  });
}

initializePopup();
