import { RASTTEXT_DIR_ATTRIBUTE } from "@shared/constants";
import { buildCssRule, joinCssBlocks } from "../../css-rule";
import {
  ASK_USER_PLAINTEXT_BIDI_SELECTORS,
  ASSISTANT_PROSE_ROOT,
  ASSISTANT_ROW_ROOT,
  ASSISTANT_TURN_STATUS_PLAINTEXT_BIDI_SELECTORS,
  CLAUDE_COMPOSER_EDITOR,
  CLAUDE_DESIGN_ASSISTANT_PROSE_ROOT,
  CLAUDE_DESIGN_USER_MESSAGE_ROOT,
  CLAUDE_SKILL_FILE_VIEWER,
  FENCED_CODE_BIDI_SELECTORS,
  USER_MESSAGE_ROOT,
} from "./selectors";

/**
 * Claude-only block direction resolver.
 *
 * Why this exists: Claude often sets `dir="ltr"` on Persian-dominant
 * mixed prose when the paragraph begins with English (first-strong).
 * `unicode-bidi: plaintext` has the same first-strong limitation, so
 * CSS alone cannot fix those blocks. The composer has the same
 * first-strong gap when a Persian-dominant prompt starts with English.
 *
 * Scope:
 * - logical text blocks inside authenticated assistant prose
 *   (`[data-testid="transcript-row"][data-perf-row="assistant"] [data-cds="Prose"]`)
 * - logical text blocks inside the Skills / Outputs file viewer
 *   (`[data-skill-file-viewer="true"]`)
 * - logical assistant Markdown blocks inside Design / Design System chat
 *   (`[data-testid="chat-messages"][data-chat-id] ... .om-md-content`)
 * - logical editable blocks inside the normal composer
 *   (`[data-testid="chat-input"][contenteditable="true"][role="textbox"]`)
 *
 * Fenced `pre` blocks, AskUserQuestion span text units, and the assistant
 * TurnStatus morphing label use CSS `unicode-bidi: plaintext` so mixed
 * Persian/English content can resolve direction locally. The pre-wrapped
 * Design user-message span uses the same CSS-only path. Inline `code` inside
 * paragraphs is not scanned.
 * Sidebar, toolbars, and composer chrome are never scanned. Composer typing uses
 * `input` / `focusin` events (see `lifecycle.ts`); the assistant
 * MutationObserver is not reused for the composer.
 *
 * Detection: walk visible letters only. Digits, punctuation,
 * whitespace, emoji, and symbols do not vote. Descendants `code`,
 * `pre`, `kbd`, and `samp` are omitted before counting. First-strong
 * / first-character detection is not used.
 *
 * Dominance is the script with more letter-runs (maximal consecutive
 * Arabic-script or Latin letters). Long English product names would
 * otherwise outvote Persian prose by raw character count even when
 * the sentence is Persian-dominant. Raw letter counts break run
 * ties. Equal/empty results leave direction unset.
 *
 * DOM: only `data-rasttext-dir="rtl"|"ltr"` is written. Claude's own
 * `dir` attributes are never changed, and message text is never
 * rewritten or wrapped.
 *
 * Privacy: block text is read in memory for the current resolution
 * pass only. It is never stored, logged, transmitted, persisted in
 * chrome.storage, included in analytics, or exposed outside this
 * content-script module. The only residue is the direction attribute.
 */

export const CLAUDE_DIRECTION_STYLE_ELEMENT_ID = "chat-font-customizer-claude-direction-style";

export const CLAUDE_DIRECTION_BLOCK_ELEMENTS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "th",
  "td",
] as const;

/**
 * Verified composer blocks only. Do not guess ProseMirror node classes.
 */
export const CLAUDE_COMPOSER_DIRECTION_BLOCKS = ["p", "ul", "ol", "li", "blockquote"] as const;

export type ResolvedBlockDirection = "rtl" | "ltr";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

const BLOCK_TAGS = new Set<string>(
  CLAUDE_DIRECTION_BLOCK_ELEMENTS.map((tag) => tag.toUpperCase()),
);

const CODE_EXCLUSION_TAGS = new Set(["CODE", "PRE", "KBD", "SAMP"]);

const BLOCK_SELECTOR = CLAUDE_DIRECTION_BLOCK_ELEMENTS.join(", ");
const COMPOSER_BLOCK_TAGS = new Set<string>(
  CLAUDE_COMPOSER_DIRECTION_BLOCKS.map((tag) => tag.toUpperCase()),
);
const COMPOSER_BLOCK_SELECTOR = CLAUDE_COMPOSER_DIRECTION_BLOCKS.join(", ");
const PLACEHOLDER_GHOST_ATTRIBUTE = "data-composer-placeholder-ghost";
const LTR_LIST_TEXT_ATTRIBUTE = "data-rasttext-ltr-item";

const PROSE_SELECTOR = '[data-cds="Prose"]';

const ARABIC_LETTER = /\p{Script=Arabic}/u;
const RTL_LETTER = /[\p{Script=Arabic}\p{Script=Hebrew}]/u;
const LATIN_LETTER = /\p{Script=Latin}/u;
const LETTER = /\p{L}/u;

const pendingBlocks = new Set<Element>();
/** Observers on normal/Design assistant prose and skill file-viewer roots. */
const readingRootObservers = new Map<Element, MutationObserver>();

let active = false;
let mountedDoc: Document | null = null;
let discoveryObserver: MutationObserver | null = null;
let styleElement: HTMLStyleElement | null = null;
let scheduled = false;
let flushGeneration = 0;

export function countDirectionalLetters(text: string): { arabic: number; latin: number } {
  let arabic = 0;
  let latin = 0;

  for (const character of text) {
    if (!LETTER.test(character)) {
      continue;
    }

    if (ARABIC_LETTER.test(character)) {
      arabic += 1;
    } else if (LATIN_LETTER.test(character)) {
      latin += 1;
    }
  }

  return { arabic, latin };
}

/**
 * Maximal same-script letter sequences. Non-letters break a run.
 */
export function countDirectionalRuns(text: string): { arabic: number; latin: number } {
  let arabic = 0;
  let latin = 0;
  let current: "arabic" | "latin" | null = null;

  for (const character of text) {
    if (!LETTER.test(character)) {
      current = null;
      continue;
    }

    let script: "arabic" | "latin" | null = null;
    if (ARABIC_LETTER.test(character)) {
      script = "arabic";
    } else if (LATIN_LETTER.test(character)) {
      script = "latin";
    }

    if (script === null) {
      current = null;
      continue;
    }

    if (script !== current) {
      if (script === "arabic") {
        arabic += 1;
      } else {
        latin += 1;
      }
      current = script;
    }
  }

  return { arabic, latin };
}

/**
 * Dominant-script direction from already-collected plain text.
 * First-character / first-strong detection is intentionally unused.
 */
export function detectBlockDirection(text: string): ResolvedBlockDirection | null {
  const letters = countDirectionalLetters(text);

  if (letters.arabic === 0 && letters.latin === 0) {
    return null;
  }

  const runs = countDirectionalRuns(text);

  if (runs.arabic > runs.latin) {
    return "rtl";
  }

  if (runs.latin > runs.arabic) {
    return "ltr";
  }

  if (letters.arabic > letters.latin) {
    return "rtl";
  }

  if (letters.latin > letters.arabic) {
    return "ltr";
  }

  return null;
}

function detectListDirection(text: string): ResolvedBlockDirection | null {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (RTL_LETTER.test(letters)) {
    return "rtl";
  }

  return LETTER.test(text) ? "ltr" : null;
}

export function getDetectableText(root: Element, options: { skipLists?: boolean } = {}): string {
  if (CODE_EXCLUSION_TAGS.has(root.tagName) || isPlaceholderGhost(root)) {
    return "";
  }

  const parts: string[] = [];

  const visit = (node: Node): void => {
    if (node.nodeType === TEXT_NODE) {
      parts.push(node.nodeValue ?? "");
      return;
    }

    if (node.nodeType !== ELEMENT_NODE) {
      return;
    }

    const element = node as Element;
    if (CODE_EXCLUSION_TAGS.has(element.tagName) || isPlaceholderGhost(element)) {
      return;
    }
    if (options.skipLists === true && isListElement(element)) {
      return;
    }

    const children = element.childNodes;
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (child) {
        visit(child);
      }
    }
  };

  visit(root);
  return parts.join("");
}

export function applyBlockDirection(element: Element, direction: ResolvedBlockDirection | null): void {
  if (direction === null) {
    if (element.hasAttribute(RASTTEXT_DIR_ATTRIBUTE)) {
      element.removeAttribute(RASTTEXT_DIR_ATTRIBUTE);
    }
    return;
  }

  if (element.getAttribute(RASTTEXT_DIR_ATTRIBUTE) !== direction) {
    element.setAttribute(RASTTEXT_DIR_ATTRIBUTE, direction);
  }
}

function applyLtrListTextMarker(element: Element, enabled: boolean): void {
  if (enabled) {
    if (!element.hasAttribute(LTR_LIST_TEXT_ATTRIBUTE)) {
      element.setAttribute(LTR_LIST_TEXT_ATTRIBUTE, "");
    }
    return;
  }

  if (element.hasAttribute(LTR_LIST_TEXT_ATTRIBUTE)) {
    element.removeAttribute(LTR_LIST_TEXT_ATTRIBUTE);
  }
}

function removeOwnedDirectionAttributes(element: Element): void {
  element.removeAttribute(RASTTEXT_DIR_ATTRIBUTE);
  element.removeAttribute(LTR_LIST_TEXT_ATTRIBUTE);
}

export function isAssistantProseRoot(element: Element): boolean {
  return (
    element.getAttribute("data-cds") === "Prose" &&
    element.closest(ASSISTANT_ROW_ROOT) !== null
  );
}

export function isSkillFileViewerRoot(element: Element): boolean {
  return element.getAttribute("data-skill-file-viewer") === "true";
}

function hasClassToken(element: Element, token: string): boolean {
  return (element.getAttribute("class") ?? "").split(/\s+/u).includes(token);
}

/**
 * Design uses semantic `om-*` class tokens for assistant Markdown but no
 * `data-cds="Prose"`. Require both tokens plus the attributed chat root so
 * similarly named nodes elsewhere on claude.ai are never scanned.
 */
export function isDesignAssistantProseRoot(element: Element): boolean {
  if (!hasClassToken(element, "om-md-content")) {
    return false;
  }

  let current = element.parentElement;
  let insideAssistantGroup = false;
  while (current) {
    if (hasClassToken(current, "om-assistant-group")) {
      insideAssistantGroup = true;
    }

    if (
      current.getAttribute("data-testid") === "chat-messages" &&
      current.hasAttribute("data-chat-id")
    ) {
      return insideAssistantGroup;
    }
    current = current.parentElement;
  }

  return false;
}

export function isDirectionReadingRoot(element: Element): boolean {
  return (
    isAssistantProseRoot(element) ||
    isSkillFileViewerRoot(element) ||
    isDesignAssistantProseRoot(element)
  );
}

export function isSupportedAssistantBlock(element: Element): boolean {
  if (!BLOCK_TAGS.has(element.tagName)) {
    return false;
  }

  if (!isInsideDirectionReadingRoot(element)) {
    return false;
  }

  if (isInsideExcludedCodeContainer(element)) {
    return false;
  }

  if (
    element.closest(
      'button, textarea, input, [contenteditable="true"], [contenteditable="plaintext-only"]',
    )
  ) {
    return false;
  }

  return true;
}

export function resolveAssistantBlock(element: Element): void {
  if (!active) {
    return;
  }

  if (!isSupportedAssistantBlock(element)) {
    return;
  }

  resolveBlockAndListState(element);
}

export function isComposerEditor(element: Element): boolean {
  return (
    element.getAttribute("data-testid") === "chat-input" &&
    element.getAttribute("contenteditable") === "true" &&
    element.getAttribute("role") === "textbox"
  );
}

export function isSupportedComposerBlock(element: Element): boolean {
  if (!COMPOSER_BLOCK_TAGS.has(element.tagName)) {
    return false;
  }

  if (nearestComposerEditor(element) === null) {
    return false;
  }

  if (isInsideExcludedCodeContainer(element)) {
    return false;
  }

  if (element.closest(`[${PLACEHOLDER_GHOST_ATTRIBUTE}]`)) {
    return false;
  }

  return true;
}

export function resolveComposerBlock(element: Element): void {
  if (!active) {
    return;
  }

  if (!isSupportedComposerBlock(element)) {
    return;
  }

  resolveBlockAndListState(element);
}

/**
 * Resolve direction on verified composer blocks. Does not rewrite
 * Claude `dir` attributes. Empty / no-strong content drops RastText
 * state so Claude's own default can take over.
 */
export function processComposerEditor(editor: Element): void {
  if (!active || !isComposerEditor(editor)) {
    return;
  }

  const blocks = editor.querySelectorAll(COMPOSER_BLOCK_SELECTOR);
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block) {
      resolveComposerBlock(block);
    }
  }

  if (detectBlockDirection(getDetectableText(editor)) === null) {
    applyBlockDirection(editor, null);
  }
}

export function clearComposerDirectionState(editor: Element): void {
  applyBlockDirection(editor, null);
  const marked = editor.querySelectorAll(`[${RASTTEXT_DIR_ATTRIBUTE}]`);
  for (let index = 0; index < marked.length; index += 1) {
    const element = marked[index];
    if (element) {
      removeOwnedDirectionAttributes(element);
    }
  }
  const ltrListText = editor.querySelectorAll(`[${LTR_LIST_TEXT_ATTRIBUTE}]`);
  for (let index = 0; index < ltrListText.length; index += 1) {
    const element = ltrListText[index];
    if (element) {
      removeOwnedDirectionAttributes(element);
    }
  }
}

export function buildClaudeDirectionCss(): string {
  const plaintextBidi = [
    ...FENCED_CODE_BIDI_SELECTORS,
    ...ASK_USER_PLAINTEXT_BIDI_SELECTORS,
    CLAUDE_DESIGN_USER_MESSAGE_ROOT,
    ...ASSISTANT_TURN_STATUS_PLAINTEXT_BIDI_SELECTORS,
  ].join(",\n");
  const rtl = [
    `${ASSISTANT_PROSE_ROOT} [${RASTTEXT_DIR_ATTRIBUTE}="rtl"]`,
    `${CLAUDE_SKILL_FILE_VIEWER} [${RASTTEXT_DIR_ATTRIBUTE}="rtl"]`,
    `${CLAUDE_DESIGN_ASSISTANT_PROSE_ROOT} [${RASTTEXT_DIR_ATTRIBUTE}="rtl"]`,
    `${CLAUDE_COMPOSER_EDITOR} [${RASTTEXT_DIR_ATTRIBUTE}="rtl"]`,
    `${CLAUDE_COMPOSER_EDITOR}[${RASTTEXT_DIR_ATTRIBUTE}="rtl"]`,
  ].join(",\n");
  const ltr = [
    `${ASSISTANT_PROSE_ROOT} [${RASTTEXT_DIR_ATTRIBUTE}="ltr"]`,
    `${CLAUDE_SKILL_FILE_VIEWER} [${RASTTEXT_DIR_ATTRIBUTE}="ltr"]`,
    `${CLAUDE_DESIGN_ASSISTANT_PROSE_ROOT} [${RASTTEXT_DIR_ATTRIBUTE}="ltr"]`,
    `${CLAUDE_COMPOSER_EDITOR} [${RASTTEXT_DIR_ATTRIBUTE}="ltr"]`,
    `${CLAUDE_COMPOSER_EDITOR}[${RASTTEXT_DIR_ATTRIBUTE}="ltr"]`,
  ].join(",\n");
  const ltrListText = [
    `${ASSISTANT_PROSE_ROOT} :is(li)[${LTR_LIST_TEXT_ATTRIBUTE}]`,
    `${CLAUDE_SKILL_FILE_VIEWER} :is(li)[${LTR_LIST_TEXT_ATTRIBUTE}]`,
    `${CLAUDE_DESIGN_ASSISTANT_PROSE_ROOT} :is(li)[${LTR_LIST_TEXT_ATTRIBUTE}]`,
    `${CLAUDE_COMPOSER_EDITOR} :is(li)[${LTR_LIST_TEXT_ATTRIBUTE}]`,
  ].join(",\n");
  const listSpacing = [
    `${ASSISTANT_PROSE_ROOT} :is(ul, ol)[${RASTTEXT_DIR_ATTRIBUTE}]`,
    `${CLAUDE_SKILL_FILE_VIEWER} :is(ul, ol)[${RASTTEXT_DIR_ATTRIBUTE}]`,
    `${CLAUDE_DESIGN_ASSISTANT_PROSE_ROOT} :is(ul, ol)[${RASTTEXT_DIR_ATTRIBUTE}]`,
    `${CLAUDE_COMPOSER_EDITOR} :is(ul, ol)[${RASTTEXT_DIR_ATTRIBUTE}]`,
  ].join(",\n");
  const inlineCode = [
    `${ASSISTANT_ROW_ROOT} :is(code, kbd, samp, tt):not(pre *)`,
    `${USER_MESSAGE_ROOT} :is(code, kbd, samp, tt):not(pre *)`,
    `${CLAUDE_SKILL_FILE_VIEWER} :is(code, kbd, samp, tt):not(pre *)`,
    `${CLAUDE_DESIGN_ASSISTANT_PROSE_ROOT} :is(code, kbd, samp, tt):not(pre *)`,
    `${CLAUDE_COMPOSER_EDITOR} :is(code, kbd, samp, tt):not(pre *)`,
  ].join(",\n");

  return joinCssBlocks([
    buildCssRule(
      plaintextBidi,
      [
        "  unicode-bidi: plaintext !important;",
        "  direction: auto !important;",
        "  text-align: start !important;",
      ].join("\n"),
    ),
    buildCssRule(
      rtl,
      "  direction: rtl;\n  text-align: start !important;\n  unicode-bidi: normal;",
    ),
    buildCssRule(
      ltr,
      "  direction: ltr;\n  text-align: start !important;\n  unicode-bidi: normal;",
    ),
    buildCssRule(
      ltrListText,
      "  unicode-bidi: plaintext !important;\n  text-align: right !important;",
    ),
    buildCssRule(
      listSpacing,
      "  padding-inline-start: 1.5em !important;\n  padding-inline-end: 0 !important;",
    ),
    buildCssRule(
      inlineCode,
      "  direction: ltr !important;\n  unicode-bidi: isolate !important;",
    ),
  ]);
}

export function removeRastTextDirAttributes(root: ParentNode): void {
  if ((root as Node).nodeType === ELEMENT_NODE) {
    removeOwnedDirectionAttributes(root as Element);
  }

  const marked = root.querySelectorAll(`[${RASTTEXT_DIR_ATTRIBUTE}]`);
  for (let index = 0; index < marked.length; index += 1) {
    const element = marked[index];
    if (element) {
      removeOwnedDirectionAttributes(element);
    }
  }
  const ltrListText = root.querySelectorAll(`[${LTR_LIST_TEXT_ATTRIBUTE}]`);
  for (let index = 0; index < ltrListText.length; index += 1) {
    const element = ltrListText[index];
    if (element) {
      removeOwnedDirectionAttributes(element);
    }
  }
}

/**
 * Idempotent setup. Observes assistant prose and skill file-viewer roots
 * (plus a childList discovery observer so newly streamed rows / opened
 * panes can be attached). Does not observe characterData on the whole
 * document.
 */
export function mountClaudeDirection(doc: Document): void {
  if (active && mountedDoc === doc) {
    ensureDirectionStyle(doc);
    scanExistingReadingRoots(doc);
    return;
  }

  if (active && mountedDoc && mountedDoc !== doc) {
    unmountClaudeDirection(mountedDoc);
  }

  active = true;
  mountedDoc = doc;
  ensureDirectionStyle(doc);
  scanExistingReadingRoots(doc);
  startDiscoveryObserver(doc);
}

export function unmountClaudeDirection(doc: Document): void {
  active = false;
  flushGeneration += 1;
  scheduled = false;
  pendingBlocks.clear();
  stopObservers();
  removeDirectionStyle();
  removeRastTextDirAttributes(doc);
  if (mountedDoc === doc) {
    mountedDoc = null;
  }
}

export function flushClaudeDirectionUpdates(): void {
  flushGeneration += 1;
  scheduled = false;
  processPendingBlocks();
}

function isPlaceholderGhost(element: Element): boolean {
  return element.hasAttribute(PLACEHOLDER_GHOST_ATTRIBUTE);
}

function nearestComposerEditor(element: Element): Element | null {
  let current: Element | null = element;

  while (current) {
    if (isComposerEditor(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

function isListElement(element: Element): boolean {
  return element.tagName === "UL" || element.tagName === "OL";
}

function nearestList(element: Element): Element | null {
  let current: Element | null = element;
  while (current) {
    if (isListElement(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function isSupportedBlockInCurrentSurface(element: Element): boolean {
  return isSupportedAssistantBlock(element) || isSupportedComposerBlock(element);
}

function resolveBlockAndListState(element: Element): void {
  if (isListElement(element)) {
    resolveList(element);
    return;
  }

  const list = element.tagName === "LI" ? nearestList(element) : null;
  if (!list || !isSupportedBlockInCurrentSurface(list)) {
    applyLtrListTextMarker(element, false);
    applyBlockDirection(element, detectBlockDirection(getDetectableText(element)));
    return;
  }

  resolveList(list);
}

function resolveList(list: Element): void {
  const listDirection = detectListDirection(getDetectableText(list));
  applyBlockDirection(list, listDirection);

  const items = list.querySelectorAll("li");
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item || !isSupportedBlockInCurrentSurface(item)) {
      continue;
    }

    const itemList = nearestList(item);
    const direction =
      itemList === list ? listDirection : detectListDirection(getDetectableText(itemList ?? item));
    applyBlockDirection(item, direction);
    applyLtrListTextMarker(
      item,
      direction === "rtl" && detectBlockDirection(getDetectableText(item, { skipLists: true })) === "ltr",
    );
  }
}

function isInsideAssistantProse(element: Element): boolean {
  const prose = element.closest(PROSE_SELECTOR);
  return prose !== null && isAssistantProseRoot(prose);
}

function isInsideSkillFileViewer(element: Element): boolean {
  return element.closest(CLAUDE_SKILL_FILE_VIEWER) !== null;
}

function isInsideDesignAssistantProse(element: Element): boolean {
  const prose = element.closest(CLAUDE_DESIGN_ASSISTANT_PROSE_ROOT);
  return prose !== null && isDesignAssistantProseRoot(prose);
}

function isInsideDirectionReadingRoot(element: Element): boolean {
  return (
    isInsideAssistantProse(element) ||
    isInsideSkillFileViewer(element) ||
    isInsideDesignAssistantProse(element)
  );
}

function scanExistingReadingRoots(doc: Document): void {
  const proseNodes = doc.querySelectorAll(ASSISTANT_PROSE_ROOT);
  for (let index = 0; index < proseNodes.length; index += 1) {
    const root = proseNodes[index];
    if (root) {
      attachReadingRootObserver(root);
    }
  }

  const viewerNodes = doc.querySelectorAll(CLAUDE_SKILL_FILE_VIEWER);
  for (let index = 0; index < viewerNodes.length; index += 1) {
    const root = viewerNodes[index];
    if (root) {
      attachReadingRootObserver(root);
    }
  }

  const designProseNodes = doc.querySelectorAll(CLAUDE_DESIGN_ASSISTANT_PROSE_ROOT);
  for (let index = 0; index < designProseNodes.length; index += 1) {
    const root = designProseNodes[index];
    if (root && isDesignAssistantProseRoot(root)) {
      attachReadingRootObserver(root);
    }
  }
}

function attachReadingRootObserver(root: Element): void {
  if (!active || readingRootObservers.has(root)) {
    resolveReadingRootBlocks(root);
    return;
  }

  if (typeof MutationObserver !== "function") {
    resolveReadingRootBlocks(root);
    return;
  }

  const observer = new MutationObserver((mutations) => {
    if (!active) {
      return;
    }

    collectBlocksFromMutations(mutations);
  });

  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
  });

  readingRootObservers.set(root, observer);
  resolveReadingRootBlocks(root);
}

function resolveReadingRootBlocks(root: Element): void {
  const blocks = root.querySelectorAll(BLOCK_SELECTOR);
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block) {
      resolveAssistantBlock(block);
    }
  }
}

function collectBlocksFromMutations(mutations: MutationRecord[]): void {
  for (const mutation of mutations) {
    if (mutation.type === "characterData") {
      enqueueNearestBlock(mutation.target);
      continue;
    }

    if (mutation.type !== "childList") {
      continue;
    }

    enqueueNearestBlock(mutation.target);

    const added = mutation.addedNodes;
    for (let index = 0; index < added.length; index += 1) {
      const node = added[index];
      if (!node) {
        continue;
      }

      if (node.nodeType === TEXT_NODE) {
        enqueueNearestBlock(node);
        continue;
      }

      if (node.nodeType !== ELEMENT_NODE) {
        continue;
      }

      const element = node as Element;
      if (isSupportedAssistantBlock(element)) {
        enqueueBlock(element);
      }

      const nested = element.querySelectorAll(BLOCK_SELECTOR);
      for (let nestedIndex = 0; nestedIndex < nested.length; nestedIndex += 1) {
        const block = nested[nestedIndex];
        if (block) {
          enqueueBlock(block);
        }
      }
    }
  }
}

function enqueueNearestBlock(node: Node): void {
  const block = nearestSupportedBlock(node);
  if (block) {
    enqueueBlock(block);
  }
}

function nearestSupportedBlock(node: Node): Element | null {
  let current: Element | null =
    node.nodeType === ELEMENT_NODE ? (node as Element) : node.parentElement;

  while (current) {
    if (isSupportedAssistantBlock(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

function enqueueBlock(block: Element): void {
  if (!active || !isSupportedAssistantBlock(block)) {
    return;
  }

  pendingBlocks.add(block);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (scheduled) {
    return;
  }

  scheduled = true;
  const generation = flushGeneration;
  const run = (): void => {
    if (generation !== flushGeneration) {
      return;
    }
    scheduled = false;
    processPendingBlocks();
  };

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(run);
    return;
  }

  setTimeout(run, 0);
}

function processPendingBlocks(): void {
  const batch = [...pendingBlocks];
  pendingBlocks.clear();

  if (!active) {
    return;
  }

  for (const block of batch) {
    if (!block.isConnected) {
      continue;
    }
    resolveAssistantBlock(block);
  }
}

function isInsideExcludedCodeContainer(element: Element): boolean {
  return element.closest("code, pre, kbd, samp") !== null;
}

function startDiscoveryObserver(doc: Document): void {
  if (typeof MutationObserver !== "function") {
    return;
  }

  const root = doc.body ?? doc.documentElement;
  discoveryObserver = new MutationObserver((mutations) => {
    if (!active) {
      return;
    }

    for (const mutation of mutations) {
      const added = mutation.addedNodes;
      for (let index = 0; index < added.length; index += 1) {
        const node = added[index];
        if (node) {
          attachReadingRootsInTree(node);
        }
      }

      const removed = mutation.removedNodes;
      for (let index = 0; index < removed.length; index += 1) {
        const node = removed[index];
        if (node) {
          detachReadingRootsInTree(node);
        }
      }
    }
  });

  discoveryObserver.observe(root, { childList: true, subtree: true });
}

function attachReadingRootsInTree(node: Node): void {
  for (const root of collectDirectionReadingRoots(node)) {
    attachReadingRootObserver(root);
  }
}

function detachReadingRootsInTree(node: Node): void {
  for (const root of collectDirectionReadingRoots(node)) {
    const observer = readingRootObservers.get(root);
    observer?.disconnect();
    readingRootObservers.delete(root);
  }
}

function collectDirectionReadingRoots(node: Node): Element[] {
  if (node.nodeType !== ELEMENT_NODE) {
    return [];
  }

  const element = node as Element;
  const found: Element[] = [];

  if (isDirectionReadingRoot(element)) {
    found.push(element);
  }

  const nestedProse = element.querySelectorAll(
    `${PROSE_SELECTOR}, ${CLAUDE_DESIGN_ASSISTANT_PROSE_ROOT}`,
  );
  for (let index = 0; index < nestedProse.length; index += 1) {
    const candidate = nestedProse[index];
    if (
      candidate &&
      (isAssistantProseRoot(candidate) || isDesignAssistantProseRoot(candidate))
    ) {
      found.push(candidate);
    }
  }

  const nestedViewers = element.querySelectorAll(CLAUDE_SKILL_FILE_VIEWER);
  for (let index = 0; index < nestedViewers.length; index += 1) {
    const candidate = nestedViewers[index];
    if (candidate && isSkillFileViewerRoot(candidate) && candidate !== element) {
      found.push(candidate);
    }
  }

  return found;
}

function stopObservers(): void {
  discoveryObserver?.disconnect();
  discoveryObserver = null;

  for (const observer of readingRootObservers.values()) {
    observer.disconnect();
  }
  readingRootObservers.clear();
}

function ensureDirectionStyle(doc: Document): void {
  if (styleElement?.isConnected) {
    styleElement.textContent = buildClaudeDirectionCss();
    return;
  }

  const created = doc.createElement("style");
  created.id = CLAUDE_DIRECTION_STYLE_ELEMENT_ID;
  created.textContent = buildClaudeDirectionCss();
  (doc.head ?? doc.documentElement).appendChild(created);
  styleElement = created;
}

function removeDirectionStyle(): void {
  styleElement?.remove();
  styleElement = null;
}
