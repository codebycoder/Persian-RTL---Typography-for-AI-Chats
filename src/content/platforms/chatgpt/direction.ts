import { RASTTEXT_DIR_ATTRIBUTE } from "@shared/constants";
import {
  CANVAS_EDITOR_ROOT_SELECTOR,
  CANVAS_EDITOR_SELECTORS,
  CHATGPT_COMPOSER_EDITOR,
  CONVERSATION_READING_SELECTORS,
} from "./selectors";

export const CHATGPT_DIRECTION_STYLE_ID = "rasttext-chatgpt-direction-style";
const DIRECTION_ROOTS = [...CONVERSATION_READING_SELECTORS, "[data-dil-widget-copy-target]"];
const STYLE_ROOTS = [...DIRECTION_ROOTS, CHATGPT_COMPOSER_EDITOR, ...CANVAS_EDITOR_SELECTORS];
const ROOTS = STYLE_ROOTS.join(", ");
/** @deprecated Kept only so disable/cleanup can strip older builds. */
const LTR_LIST_TEXT = "data-rasttext-ltr-item";
/**
 * Leaf text blocks. `ul`/`ol` are intentionally omitted — annotating a whole
 * list from mixed Persian/English content was forcing English source links
 * to RTL / right-aligned.
 */
const BLOCKS = "p, h1, h2, h3, h4, h5, h6, li, blockquote, th, td";
const EXCLUDED = 'pre, code, kbd, samp, tt, svg, button, input, textarea, [role="textbox"], [contenteditable="true"], [contenteditable="plaintext-only"]';
const EDITOR_INNER_EXCLUDED = 'pre, code, kbd, samp, tt, svg, button, input, textarea, [contenteditable="plaintext-only"]';
const MANAGED_EDITOR_SELECTOR = [CHATGPT_COMPOSER_EDITOR, CANVAS_EDITOR_ROOT_SELECTOR]
  .filter(Boolean)
  .join(", ");

// Technical Persian frequently starts with an English identifier. First-strong
// and Latin character counts both misclassify those sentences.
export function detectChatGptDirection(text: string): "rtl" | "ltr" | null {
  if (/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(text.replace(/[^\p{L}]/gu, ""))) return "rtl";
  return /\p{L}/u.test(text) ? "ltr" : null;
}

function closestManagedEditor(element: Element): Element | null {
  if (!MANAGED_EDITOR_SELECTOR) return null;
  if (element.matches(MANAGED_EDITOR_SELECTOR)) return element;
  return element.closest(MANAGED_EDITOR_SELECTOR);
}

function readableText(element: Element, skipLists = false): string {
  const editorRoot = closestManagedEditor(element) === element;
  if ((!editorRoot && element.matches(EXCLUDED)) || (skipLists && element.matches("ul, ol"))) {
    return "";
  }
  return Array.from(element.childNodes, (node) => {
    if (node.nodeType === 3) return node.nodeValue ?? "";
    return node.nodeType === 1 ? readableText(node as Element, skipLists) : "";
  }).join("");
}

function isDirectionSkipped(block: Element): boolean {
  const editor = closestManagedEditor(block);
  if (editor) return block.closest(EDITOR_INNER_EXCLUDED) !== null;
  return block.closest(EXCLUDED) !== null;
}

/**
 * Direction targets inside a reading/editor root.
 * Wrapper roots (assistant Markdown, file viewer, …) must not receive one
 * aggregate direction — that made English sections inherit RTL.
 */
function collectDirectionBlocks(root: Element): Element[] {
  const nested = Array.from(root.querySelectorAll(BLOCKS));
  if (nested.length > 0) return nested;
  return [root];
}

export function resolveChatGptRoot(root: Element): void {
  for (const block of collectDirectionBlocks(root)) {
    if (isDirectionSkipped(block)) continue;
    // Decide from this block alone. Never promote a list-wide Persian signal
    // onto English-only items such as official source links.
    const direction = detectChatGptDirection(readableText(block));
    block.removeAttribute(LTR_LIST_TEXT);
    // Persian/Arabic → RTL. Latin-only → explicit LTR so it does not inherit
    // a parent RTL base (file viewer / mixed lists). Neutral → leave alone.
    if (direction === "rtl" || direction === "ltr") {
      if (block.getAttribute(RASTTEXT_DIR_ATTRIBUTE) !== direction) {
        block.setAttribute(RASTTEXT_DIR_ATTRIBUTE, direction);
      }
    } else {
      block.removeAttribute(RASTTEXT_DIR_ATTRIBUTE);
    }
  }
}

export function buildChatGptDirectionCss(): string {
  const scoped = (suffix: string) => STYLE_ROOTS.flatMap((root) => [
    `${root}${suffix}`, `${root} ${suffix}`,
  ]).join(",\n");
  const editorCodeSelectors = [CHATGPT_COMPOSER_EDITOR, ...CANVAS_EDITOR_SELECTORS]
    .map((root) => `${root} :is(pre, code, kbd, samp, tt)`)
    .join(",\n");
  return [
    ...(["rtl", "ltr"] as const).map((direction) => `${scoped(`[${RASTTEXT_DIR_ATTRIBUTE}="${direction}"]`)} {
  direction: ${direction} !important;
  unicode-bidi: isolate !important;
  text-align: start !important;
}`),
    // Physical site padding must not leave RTL markers outside the content.
    // Target lists that contain our RTL items rather than forcing the whole
    // list node from aggregate mixed-language text.
    `${STYLE_ROOTS.map((root) => `${root} :is(ul, ol):has(> [${RASTTEXT_DIR_ATTRIBUTE}="rtl"])`).join(",\n")} {
  padding-inline-start: 1.5em !important;
  padding-inline-end: 0 !important;
}`,
    `${[
      ...DIRECTION_ROOTS.map((root) => `${root} :is(pre, code, kbd, samp, tt):not([contenteditable="true"] *):not([contenteditable="plaintext-only"] *)`),
      editorCodeSelectors,
    ].filter(Boolean).join(",\n")} {
  direction: ltr !important;
  unicode-bidi: isolate !important;
}`,
  ].join("\n\n");
}

let teardown: (() => void) | undefined;
let mountedDocument: Document | undefined;

export function mountChatGptDirection(doc: Document): void {
  if (mountedDocument === doc || !doc.defaultView) return;
  const view = doc.defaultView;
  teardown?.();
  mountedDocument = doc;
  const style = doc.createElement("style");
  style.id = CHATGPT_DIRECTION_STYLE_ID;
  style.textContent = buildChatGptDirectionCss();
  (doc.head ?? doc.documentElement).append(style);
  const observers = new Map<Element, MutationObserver>();
  const pending = new Set<Element>();
  let frame: number | undefined;
  const flush = () => {
    frame = undefined;
    for (const root of pending) if (root.isConnected) resolveChatGptRoot(root);
    pending.clear();
  };
  const attach = (root: Element) => {
    if (observers.has(root)) return;
    const managedEditor = Boolean(MANAGED_EDITOR_SELECTOR && root.matches(MANAGED_EDITOR_SELECTOR));
    if (!managedEditor && root.closest(EXCLUDED)) return;
    resolveChatGptRoot(root);
    const observer = new MutationObserver(() => {
      pending.add(root);
      frame ??= view.requestAnimationFrame(flush);
    });
    observer.observe(root, { childList: true, characterData: true, subtree: true });
    observers.set(root, observer);
  };
  const discover = (node: ParentNode) => {
    if (node.nodeType === 1 && (node as Element).matches(ROOTS)) attach(node as Element);
    node.querySelectorAll(ROOTS).forEach(attach);
  };
  discover(doc);
  const discovery = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) if (node.nodeType === 1) discover(node as Element);
    }
    for (const [root, observer] of observers) {
      if (!root.isConnected) {
        observer.disconnect();
        observers.delete(root);
        pending.delete(root);
      }
    }
  });
  discovery.observe(doc.body ?? doc.documentElement, { childList: true, subtree: true });
  teardown = () => {
    discovery.disconnect();
    if (frame !== undefined) view.cancelAnimationFrame(frame);
    for (const [root, observer] of observers) {
      observer.disconnect();
      for (const attribute of [RASTTEXT_DIR_ATTRIBUTE, LTR_LIST_TEXT]) {
        root.removeAttribute(attribute);
        root.querySelectorAll(`[${attribute}]`).forEach((el) => el.removeAttribute(attribute));
      }
    }
    pending.clear();
    style.remove();
    mountedDocument = undefined;
  };
}

export function unmountChatGptDirection(): void {
  teardown?.();
  teardown = undefined;
}
