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
  isFontId,
  quoteCssFontFamily,
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
const previewSamples = document.querySelectorAll<HTMLElement>("[data-preview-sample]");
const previewLoad = document.querySelector("[data-preview-load]");
const fontHint = document.querySelector("[data-font-hint]");
const previewFontStyle = document.querySelector("[data-preview-font-style]");
const uploadButton = document.querySelector("[data-upload-button]");
const fontFileInput = document.querySelector("[data-font-file]");
const customFontDetails = document.querySelector("[data-custom-font-details]");
const customFontName = document.querySelector("[data-custom-font-name]");
const customFontMeta = document.querySelector("[data-custom-font-meta]");
const removeCustomButton = document.querySelector("[data-remove-custom]");
const statusElement = document.querySelector("[data-status]");
const feedback = document.querySelector("[data-feedback]");
const retryButton = document.querySelector("[data-retry]");
const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-tab-button]"));
const tabPanels = Array.from(document.querySelectorAll<HTMLElement>("[data-tab-panel]"));

let currentSettings = DEFAULT_FONT_SETTINGS;
let savedSettings = DEFAULT_FONT_SETTINGS;
let initialized = false;
let saving = false;
let uploading = false;
let feedbackVersion = 0;
let previewVersion = 0;
let retryAction: (() => Promise<void>) | null = null;
let focusAfterBusy: HTMLElement | null = null;
let panelWindowId: number | undefined;
let preferenceError = false;

type PanelTabId = "font" | "settings";

function isPanelTabId(value: string | undefined): value is PanelTabId {
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
    const css = [...builtInFontCss, customFontCss].filter(Boolean).join("\n\n");
    if (previewFontStyle.textContent !== css) previewFontStyle.textContent = css;
  }
  for (const sample of Array.from(previewSamples)) sample.style.fontFamily = stack;
  const version = ++previewVersion;
  if (previewLoad) previewLoad.textContent = "در حال بارگیری…";
  // FontFaceSet.load returns actual matching faces; check() alone can accept fallback.
  void document.fonts.load(`16px ${quoteCssFontFamily(font.cssFamilyAlias)}`, "خواندن").then(
    (faces) => {
      if (version !== previewVersion || !previewLoad) return;
      previewLoad.textContent = faces.length ? "" : "فونت در دسترس نیست؛ پنجره را دوباره باز کنید.";
    },
    () => {
      if (version !== previewVersion || !previewLoad) return;
      previewLoad.textContent = "بارگیری نشد؛ پنجره را دوباره باز کنید.";
    },
  );
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
  if (!initialized || saving || uploading || !currentSettings.enabled || !isAvailableFontId(fontId)) {
    return;
  }
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

  if (event.key === "Tab") {
    // Restore the trigger before native Tab navigation, so focus never falls to body.
    closeFontPicker(true);
  }
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
  title.dir = "auto";
  const meta = document.createElement("span");
  meta.className = "font-option-meta";
  meta.textContent = description;
  meta.dir = fontId === CUSTOM_FONT_ID ? "rtl" : "ltr";
  meta.lang = fontId === CUSTOM_FONT_ID ? "fa" : "en";
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
  if (fontValue instanceof HTMLElement) {
    fontValue.textContent = selectedFont.displayNameFa;
  }
  if (fontPickerMeta instanceof HTMLElement) {
    fontPickerMeta.textContent =
      settings.fontId === CUSTOM_FONT_ID ? "فونت شخصی" : selectedFont.displayNameEn;
    fontPickerMeta.dir = settings.fontId === CUSTOM_FONT_ID ? "rtl" : "ltr";
    fontPickerMeta.lang = settings.fontId === CUSTOM_FONT_ID ? "fa" : "en";
  }
  if (!(fontOptions instanceof HTMLElement)) return;

  const options = FONT_REGISTRY.map((font) =>
    createFontOption(font.id, font.displayNameFa, font.displayNameEn, buildFontFamilyStack(font)),
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

function renderStatus(
  message: string,
  kind: "ok" | "warning" | "error" = "ok",
  retry: (() => Promise<void>) | null = null,
): void {
  if (!(statusElement instanceof HTMLElement)) return;
  statusElement.textContent = message;
  statusElement.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
  if (feedback instanceof HTMLElement) {
    feedback.hidden = message.length === 0;
    feedback.dataset.kind = kind;
  }
  retryAction = retry;
  if (retryButton instanceof HTMLButtonElement) retryButton.hidden = !retry;
}

function syncControls(): void {
  const busy = !initialized || saving || uploading;
  const active = document.activeElement;
  if (
    busy && active instanceof HTMLElement &&
    [enabledToggle, fontTrigger, uploadButton, removeCustomButton].includes(active)
  ) {
    focusAfterBusy = active;
  }
  if (settingsForm instanceof HTMLElement) settingsForm.setAttribute("aria-busy", String(busy));
  if (isCheckbox(enabledToggle)) enabledToggle.disabled = busy;
  if (fontTrigger instanceof HTMLButtonElement) {
    fontTrigger.disabled = busy || !currentSettings.enabled;
  }
  if (uploadButton instanceof HTMLButtonElement) uploadButton.disabled = busy;
  if (removeCustomButton instanceof HTMLButtonElement) removeCustomButton.disabled = busy;
  if (!busy) {
    const target = focusAfterBusy;
    focusAfterBusy = null;
    // A slow native disable blurs the control. Restore it only if the user has
    // not moved elsewhere while the operation was pending.
    if (
      target && document.activeElement === document.body &&
      !target.hasAttribute("disabled") && target.getClientRects().length > 0
    ) {
      target.focus();
    }
  }
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
  if (fontHint) {
    fontHint.textContent = enabled
      ? "تغییرات به‌صورت خودکار ذخیره و اعمال می‌شوند."
      : "تغییر فونت خاموش است؛ انتخابت برای بعد حفظ می‌شود.";
  }
  syncControls();
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
  }
}

function setUploadBusy(busy: boolean): void {
  if (!(uploadButton instanceof HTMLButtonElement)) return;
  uploading = busy;
  syncControls();
  if (busy) {
    uploadButton.setAttribute("aria-busy", "true");
    uploadButton.textContent = "در حال افزودن…";
    return;
  }
  uploadButton.removeAttribute("aria-busy");
  uploadButton.textContent = currentSettings.customFont ? "جایگزینی فونت" : "افزودن فونت";
}

function activateTab(tabId: PanelTabId, moveFocus = false): void {
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
      if (isPanelTabId(tabId)) activateTab(tabId);
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
      if (!target || !isPanelTabId(tabId)) return;
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
  if (!initialized || saving) return;
  const parsed = parseFontSettings(settings);
  preferenceError = false;
  ++feedbackVersion;
  saving = true;
  closeFontPicker();
  renderSettings(parsed); // Preview responds immediately; storage may still be pending.
  renderStatus("در حال ذخیره…");
  try {
    await saveFontSettings(parsed);
    savedSettings = parsed;
  } catch {
    preferenceError = true;
    renderSettings(savedSettings);
    renderStatus(
      "ذخیره نشد؛ تنظیمات قبلی حفظ شد. دوباره تلاش کنید.",
      "error",
      () => persist(parsed),
    );
    return;
  } finally {
    saving = false;
    syncControls();
  }
  await reportApplyResult(true);
}

type ApplyResult = "applied" | "unsupported" | "unconfirmed" | "failed";

async function requestApplyOnActiveTab(): Promise<ApplyResult> {
  if (!chrome.tabs?.query || !chrome.tabs.sendMessage) return "unconfirmed";
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId: panelWindowId });
    if (typeof tab?.id !== "number") return "unconfirmed";
    // URLs may be withheld without tabs permission. Only classify when available,
    // using the existing manifest rather than maintaining another platform list.
    if (tab.url) {
      const url = new URL(tab.url);
      const matches = chrome.runtime.getManifest().content_scripts
        ?.flatMap((script) => script.matches ?? []) ?? [];
      const supported = matches.some((match) => {
        const pattern = new URL(match);
        return pattern.protocol === url.protocol && pattern.hostname === url.hostname;
      });
      if (!supported) return "unsupported";
    }
    const response: unknown = await chrome.tabs.sendMessage(tab.id, {
      type: APPLY_CURRENT_SETTINGS_MESSAGE,
    });
    if (typeof response === "object" && response !== null && "applied" in response) {
      if (response.applied === false) return "failed";
      if (
        response.applied === true &&
        "platform" in response && typeof response.platform === "string" && response.platform.length > 0
      ) {
        return "applied";
      }
    }
    return "unconfirmed";
  } catch {
    return "unconfirmed";
  }
}

async function reportApplyResult(justSaved = false): Promise<void> {
  const version = ++feedbackVersion;
  const prefix = justSaved ? "ذخیره شد. " : "";
  renderStatus(`${prefix}در حال بررسی تب…`);
  // A missing content-script response must not leave the panel waiting forever.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    requestApplyOnActiveTab(),
    new Promise<ApplyResult>((resolve) => {
      timer = setTimeout(() => resolve("unconfirmed"), 4000);
    }),
  ]);
  clearTimeout(timer);
  if (version !== feedbackVersion) return;
  if (result === "applied") {
    const message = currentSettings.enabled
      ? "روی این تب اعمال شد."
      : "تغییر فونت در این تب خاموش شد.";
    renderStatus(`${prefix}${message}`);
  } else if (result === "unsupported") {
    renderStatus(`${prefix}این صفحه پشتیبانی نمی‌شود؛ چت‌جی‌پی‌تی یا کلود را باز کنید.`);
  } else if (result === "failed") {
    renderStatus(
      `${prefix}اعمال روی تب انجام نشد؛ دوباره تلاش کنید.`,
      "error",
      () => reportApplyResult(justSaved),
    );
  } else {
    renderStatus(
      `${prefix}اتصال به تب تأیید نشد؛ تب چت‌جی‌پی‌تی یا کلود را تازه‌سازی کنید.`,
      "warning",
      () => reportApplyResult(justSaved),
    );
  }
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
  if (!initialized || saving || uploading) return;
  preferenceError = false;
  ++feedbackVersion;
  renderStatus("");
  setUploadBusy(true);
  try {
    if (file.size <= 0 || file.size > MAX_CUSTOM_FONT_BYTES) {
      preferenceError = true;
      renderStatus("لطفاً یک فایل فونت کوچک‌تر از ۴ مگابایت انتخاب کنید.", "error");
      return;
    }

    const format = detectFontFormat(new Uint8Array(await file.slice(0, 4).arrayBuffer()));
    if (!format) {
      preferenceError = true;
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
    await persist(settings);
  } catch {
    preferenceError = true;
    renderStatus("مرورگر نتوانست این فونت را بخواند؛ فایل دیگری را انتخاب کنید.", "error");
  } finally {
    setUploadBusy(false);
  }
}

async function initializeSettings(): Promise<void> {
  renderStatus("در حال خواندن تنظیمات…");
  try {
    const [settings, panelWindow] = await Promise.all([
      loadFontSettings(),
      chrome.windows.getCurrent(),
    ]);
    panelWindowId = panelWindow.id;
    initialized = true;
    savedSettings = settings;
    renderSettings(settings);
    await reportApplyResult();
  } catch {
    renderStatus("تنظیمات خوانده نشد؛ دوباره تلاش کنید.", "error", initializeSettings);
  }
}

function initializePanel(): void {
  applyPreviewFont(DEFAULT_FONT_SETTINGS);
  if (!chrome.runtime?.id) {
    renderStatus("افزونه در دسترس نیست؛ پنجره را دوباره باز کنید.", "error");
    return;
  }
  settingsForm?.addEventListener("submit", (event) => event.preventDefault());
  retryButton?.addEventListener("click", () => {
    const retry = retryAction;
    retryAction = null;
    if (retry) {
      void retry().finally(() => {
        if (document.activeElement !== document.body) return;
        if (retryButton instanceof HTMLElement && !retryButton.hidden) retryButton.focus();
        else tabButtons.find((button) => button.getAttribute("aria-selected") === "true")?.focus();
      });
    }
  });

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
      if (!initialized || saving || uploading) return;
      // The remove button disappears after success; keep keyboard focus in Settings.
      if (uploadButton instanceof HTMLButtonElement) uploadButton.focus();
      void persist({
        ...currentSettings,
        fontId: currentSettings.fontId === CUSTOM_FONT_ID ? "vazirmatn" : currentSettings.fontId,
        customFont: null,
      });
    });
  }

  const unsubscribeSettings = subscribeToFontSettings((settings) => {
    if (!initialized || saving) return;
    ++feedbackVersion;
    preferenceError = false;
    savedSettings = settings;
    closeFontPicker();
    renderSettings(settings);
    renderStatus("تنظیمات ذخیره‌شده به‌روز شد.");
  });

  // Unlike a popup, this document stays open across tab switches and navigation.
  // Invalidate old acknowledgements immediately, but retain storage/upload errors.
  function refreshTabFeedback(loading = false): void {
    ++feedbackVersion;
    if (!initialized || saving || uploading || preferenceError) return;
    if (loading) renderStatus("در حال بارگیری صفحه…");
    else void reportApplyResult();
  }
  const onActivated: Parameters<typeof chrome.tabs.onActivated.addListener>[0] = (info) => {
    if (info.windowId === panelWindowId) refreshTabFeedback();
  };
  const onUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (_tabId, change, tab) => {
    if (!tab.active || tab.windowId !== panelWindowId) return;
    if (change.status === "loading") refreshTabFeedback(true);
    if (change.status === "complete") refreshTabFeedback();
  };
  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);
  window.addEventListener("pagehide", () => {
    unsubscribeSettings();
    chrome.tabs.onActivated.removeListener(onActivated);
    chrome.tabs.onUpdated.removeListener(onUpdated);
  }, { once: true });
  void initializeSettings();
}

initializePanel();
