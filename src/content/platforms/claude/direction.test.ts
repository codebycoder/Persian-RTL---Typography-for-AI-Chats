import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { RASTTEXT_DIR_ATTRIBUTE } from "@shared/constants";
import { buildConversationBidiCss } from "../../bidi-style";
import { chatgptAdapter } from "../chatgpt/adapter";
import { claudeAdapter } from "./adapter";
import {
  applyBlockDirection,
  buildClaudeDirectionCss,
  CLAUDE_DIRECTION_STYLE_ELEMENT_ID,
  clearComposerDirectionState,
  countDirectionalLetters,
  countDirectionalRuns,
  detectBlockDirection,
  flushClaudeDirectionUpdates,
  getDetectableText,
  mountClaudeDirection,
  processComposerEditor,
  removeRastTextDirAttributes,
  resolveAssistantBlock,
  unmountClaudeDirection,
} from "./direction";
import { mountClaudePlatformSupport, unmountClaudePlatformSupport } from "./lifecycle";

type FakeNode = FakeElement | FakeText;

type MockObserverState = {
  callback: MutationCallback;
  target: Node | null;
  options: MutationObserverInit | null;
  disconnected: boolean;
};

const mockObservers: MockObserverState[] = [];

class MockMutationObserver {
  private readonly state: MockObserverState;

  constructor(callback: MutationCallback) {
    this.state = { callback, target: null, options: null, disconnected: false };
    mockObservers.push(this.state);
  }

  observe(target: Node, options: MutationObserverInit): void {
    this.state.target = target;
    this.state.options = options;
  }

  disconnect(): void {
    this.state.disconnected = true;
  }

  takeRecords(): MutationRecord[] {
    return [];
  }
}

(globalThis as { MutationObserver: typeof MutationObserver }).MutationObserver =
  MockMutationObserver as unknown as typeof MutationObserver;

class FakeText {
  readonly nodeType = 3;
  parentElement: FakeElement | null = null;
  nodeValue: string;

  constructor(value: string) {
    this.nodeValue = value;
  }

  get textContent(): string {
    return this.nodeValue;
  }
}

class FakeElement {
  readonly nodeType = 1;
  readonly tagName: string;
  readonly childNodes: FakeNode[] = [];
  readonly ownerDocument: FakeDocument;
  parentElement: FakeElement | null = null;
  private readonly attributes = new Map<string, string>();

  constructor(tagName: string, ownerDocument: FakeDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
  }

  get id(): string {
    return this.getAttribute("id") ?? "";
  }

  set id(value: string) {
    this.setAttribute("id", value);
  }

  get textContent(): string {
    return this.childNodes.map((node) => node.textContent).join("");
  }

  set textContent(value: string) {
    for (const child of this.childNodes) {
      child.parentElement = null;
    }
    this.childNodes.length = 0;
    if (value.length > 0) {
      this.appendChild(new FakeText(value));
    }
  }

  get isConnected(): boolean {
    return isFakeElementConnected(this);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  appendChild<T extends FakeNode>(child: T): T {
    child.parentElement = this;
    this.childNodes.push(child);
    return child;
  }

  remove(): void {
    const parent = this.parentElement;
    if (!parent) {
      return;
    }
    const index = parent.childNodes.indexOf(this);
    if (index >= 0) {
      parent.childNodes.splice(index, 1);
    }
    this.parentElement = null;
  }

  closest(selector: string): FakeElement | null {
    return closestFakeElement(this, selector);
  }

  querySelectorAll(selector: string): FakeElement[] {
    return queryDescendants(this, selector, false);
  }
}

class FakeDocument {
  readonly documentElement: FakeElement;
  readonly head: FakeElement;
  readonly body: FakeElement;
  private readonly listeners = new Map<string, Set<EventListener>>();

  constructor() {
    this.documentElement = new FakeElement("html", this);
    this.head = new FakeElement("head", this);
    this.body = new FakeElement("body", this);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }

  addEventListener(type: string, listener: EventListener): void {
    const bucket = this.listeners.get(type) ?? new Set();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  dispatchDelegated(type: string, target: FakeNode): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ target } as unknown as Event);
    }
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }

  getElementById(id: string): FakeElement | null {
    return queryDescendants(this.documentElement, `[id="${id}"]`, true)[0] ?? null;
  }

  querySelector(selector: string): FakeElement | null {
    return queryDescendants(this.documentElement, selector, true)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    return queryDescendants(this.documentElement, selector, true);
  }
}

function isFakeElementConnected(element: FakeElement): boolean {
  let current: FakeElement | null = element;
  while (current) {
    if (
      current === element.ownerDocument.documentElement ||
      current === element.ownerDocument.body ||
      current === element.ownerDocument.head
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

function closestFakeElement(element: FakeElement, selector: string): FakeElement | null {
  let current: FakeElement | null = element;
  while (current) {
    if (matchesSelectorList(current, selector)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function matchesSelectorList(element: FakeElement, selector: string): boolean {
  return splitTopLevel(selector, ",").some((part) => matchesComplex(element, part));
}

function matchesComplex(element: FakeElement, selector: string): boolean {
  const parts = splitTopLevel(selector.trim(), " ").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return false;
  }

  const last = parts[parts.length - 1];
  if (!last || !matchesSimple(element, last)) {
    return false;
  }

  let ancestor = element.parentElement;
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    const part = parts[index];
    if (!part) {
      return false;
    }
    while (ancestor && !matchesSimple(ancestor, part)) {
      ancestor = ancestor.parentElement;
    }
    if (!ancestor) {
      return false;
    }
    ancestor = ancestor.parentElement;
  }

  return true;
}

function matchesSimple(element: FakeElement, selector: string): boolean {
  const attributes: Array<{ name: string; value: string | null }> = [];
  const attrPattern = /\[([a-zA-Z0-9_-]+)(?:=["']([^"']*)["'])?\]/g;
  let match = attrPattern.exec(selector);
  while (match) {
    attributes.push({ name: match[1] ?? "", value: match[2] ?? null });
    match = attrPattern.exec(selector);
  }

  const tag = selector.replace(/\[.*?\]/g, "").trim().toLowerCase();
  if (tag && element.tagName.toLowerCase() !== tag) {
    return false;
  }

  for (const attribute of attributes) {
    const actual = element.getAttribute(attribute.name);
    if (attribute.value === null) {
      if (actual === null) {
        return false;
      }
    } else if (actual !== attribute.value) {
      return false;
    }
  }

  return true;
}

function splitTopLevel(value: string, separator: "," | " "): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const character of value) {
    if (character === "[") {
      depth += 1;
    } else if (character === "]") {
      depth -= 1;
    }

    const isSeparator =
      depth === 0 &&
      (separator === "," ? character === "," : /\s/.test(character));

    if (isSeparator) {
      if (current.trim().length > 0) {
        parts.push(current.trim());
      }
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim().length > 0) {
    parts.push(current.trim());
  }

  return parts;
}

function queryDescendants(root: FakeElement, selector: string, includeRoot: boolean): FakeElement[] {
  const results: FakeElement[] = [];

  const visit = (element: FakeElement, considerSelf: boolean): void => {
    if (considerSelf && matchesSelectorList(element, selector)) {
      results.push(element);
    }
    for (const child of element.childNodes) {
      if (child instanceof FakeElement) {
        visit(child, true);
      }
    }
  };

  visit(root, includeRoot);
  return results;
}

function asDocument(doc: FakeDocument): Document {
  return doc as unknown as Document;
}

function asElement(element: FakeElement): Element {
  return element as unknown as Element;
}

function el(doc: FakeDocument, tag: string, attributes: Record<string, string> = {}): FakeElement {
  const element = doc.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}

function createAssistantBlock(
  text: string,
  options: { dir?: string; tag?: string; doc?: FakeDocument } = {},
): { doc: FakeDocument; block: FakeElement; prose: FakeElement } {
  const doc = options.doc ?? new FakeDocument();
  const row = el(doc, "div", {
    "data-testid": "transcript-row",
    "data-perf-row": "assistant",
  });
  const prose = el(doc, "div", { "data-cds": "Prose" });
  const block = el(doc, options.tag ?? "p", options.dir ? { dir: options.dir } : {});
  block.textContent = text;
  prose.appendChild(block);
  row.appendChild(prose);
  doc.body.appendChild(row);
  return { doc, block, prose };
}

function createComposerBlock(
  text: string,
  options: { dir?: string; tag?: string; doc?: FakeDocument; editorDir?: string } = {},
): { doc: FakeDocument; editor: FakeElement; block: FakeElement } {
  const doc = options.doc ?? new FakeDocument();
  const editor = el(doc, "div", {
    "data-testid": "chat-input",
    contenteditable: "true",
    role: "textbox",
    dir: options.editorDir ?? "rtl",
  });
  const block = el(doc, options.tag ?? "p", { dir: options.dir ?? "auto" });
  block.textContent = text;
  editor.appendChild(block);
  doc.body.appendChild(editor);
  return { doc, editor, block };
}

function characterDataMutation(target: FakeText): MutationRecord {
  return {
    type: "characterData",
    target: target as unknown as Node,
    addedNodes: [] as unknown as NodeList,
    removedNodes: [] as unknown as NodeList,
    previousSibling: null,
    nextSibling: null,
    attributeName: null,
    attributeNamespace: null,
    oldValue: null,
  };
}

function childListMutation(target: FakeElement, added: FakeNode[]): MutationRecord {
  return {
    type: "childList",
    target: target as unknown as Node,
    addedNodes: added as unknown as NodeList,
    removedNodes: [] as unknown as NodeList,
    previousSibling: null,
    nextSibling: null,
    attributeName: null,
    attributeNamespace: null,
    oldValue: null,
  };
}

function activeProseObservers(): MockObserverState[] {
  return mockObservers.filter((observer) => observer.options?.characterData && !observer.disconnected);
}

function activeDiscoveryObservers(): MockObserverState[] {
  return mockObservers.filter(
    (observer) => observer.options && !observer.options.characterData && !observer.disconnected,
  );
}

afterEach(() => {
  unmountClaudePlatformSupport(asDocument(new FakeDocument()));
  mockObservers.length = 0;
});

test("pure Persian text is rtl", () => {
  assert.equal(detectBlockDirection("این یک متن فارسی است"), "rtl");
});

test("pure English text is ltr", () => {
  assert.equal(detectBlockDirection("This is an English paragraph"), "ltr");
});

test("Persian-dominant Present Perfect explanation is rtl", () => {
  assert.equal(
    detectBlockDirection("برای تجربه‌های زندگی از Present Perfect استفاده می‌کنیم"),
    "rtl",
  );
});

test("English-leading Persian-dominant paragraph is rtl, not first-strong", () => {
  const text = "Input فشرده و روزانه باعث پیشرفت می‌شود";
  assert.equal(text[0], "I");
  assert.equal(detectBlockDirection(text), "rtl");
});

test("English-dominant grammar explanation is ltr", () => {
  assert.equal(
    detectBlockDirection("Use Present Perfect when talking about life experiences"),
    "ltr",
  );
});

test("Persian sentence with English product names is rtl", () => {
  const text = "Claude به TypeScript و React هم اشاره کرد";
  const letters = countDirectionalLetters(text);
  const runs = countDirectionalRuns(text);

  assert.ok(letters.latin > 0 && letters.arabic > 0);
  assert.ok(runs.arabic > runs.latin, `arabic runs ${runs.arabic} vs latin runs ${runs.latin}`);
  assert.equal(detectBlockDirection(text), "rtl");
});

test("mixed useful/است paragraph is deterministic from counted scripts", () => {
  const text = "This feature در بعضی شرایط useful است";
  const letters = countDirectionalLetters(text);
  const runs = countDirectionalRuns(text);

  assert.equal(letters.latin, 17);
  assert.equal(letters.arabic, 14);
  assert.equal(runs.latin, 3);
  assert.equal(runs.arabic, 4);
  assert.equal(detectBlockDirection(text), "rtl");
});

test("digits and punctuation produce no direction", () => {
  assert.equal(detectBlockDirection("12345 !!!"), null);
});

test("empty text produces no direction", () => {
  assert.equal(detectBlockDirection(""), null);
  assert.equal(detectBlockDirection("   \n\t"), null);
});

test("equal letter-run ties fall back to letter counts", () => {
  assert.equal(detectBlockDirection("Hi سلام"), "rtl");
});

test("inline code is excluded from direction votes", () => {
  const doc = new FakeDocument();
  const paragraph = el(doc, "p");
  paragraph.appendChild(new FakeText("برای نصب اجرا کن "));
  const code = el(doc, "code");
  code.textContent = "pnpm install typescript react webpack babel eslint prettier";
  paragraph.appendChild(code);

  assert.equal(getDetectableText(asElement(paragraph)), "برای نصب اجرا کن ");
  assert.equal(detectBlockDirection(getDetectableText(asElement(paragraph))), "rtl");
});

test("pre, kbd, and samp descendants are also excluded", () => {
  const doc = new FakeDocument();
  const paragraph = el(doc, "p");
  paragraph.appendChild(new FakeText("متن فارسی "));
  for (const tag of ["pre", "kbd", "samp"] as const) {
    const excluded = el(doc, tag);
    excluded.textContent = "Lots of English source text that must not vote";
    paragraph.appendChild(excluded);
  }

  assert.equal(getDetectableText(asElement(paragraph)), "متن فارسی ");
  assert.equal(detectBlockDirection(getDetectableText(asElement(paragraph))), "rtl");
});

test("applyBlockDirection is idempotent and never writes dir", () => {
  const { block } = createAssistantBlock("این یک متن فارسی است", { dir: "ltr" });

  applyBlockDirection(asElement(block), "rtl");
  applyBlockDirection(asElement(block), "rtl");

  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");
  assert.equal(block.getAttribute("dir"), "ltr");
});

test("stale RastText direction can change rtl to ltr and back", () => {
  const { block } = createAssistantBlock("placeholder");

  applyBlockDirection(asElement(block), "rtl");
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");

  applyBlockDirection(asElement(block), "ltr");
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "ltr");

  applyBlockDirection(asElement(block), "rtl");
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");
});

test("null direction removes only the RastText attribute", () => {
  const { block } = createAssistantBlock("این متن", { dir: "rtl" });
  applyBlockDirection(asElement(block), "ltr");
  applyBlockDirection(asElement(block), null);

  assert.equal(block.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
  assert.equal(block.getAttribute("dir"), "rtl");
});

test("mount annotates existing assistant blocks and preserves Claude dir", () => {
  const { doc, block } = createAssistantBlock("Input فشرده و روزانه باعث پیشرفت می‌شود", {
    dir: "ltr",
  });

  mountClaudeDirection(asDocument(doc));

  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");
  assert.equal(block.getAttribute("dir"), "ltr");
  assert.equal(doc.getElementById(CLAUDE_DIRECTION_STYLE_ELEMENT_ID)?.tagName, "STYLE");
});

test("headings and list items are resolved", () => {
  const heading = createAssistantBlock("TypeScript و React ابزارهای مهمی برای من هستند", {
    tag: "h3",
  });
  mountClaudeDirection(asDocument(heading.doc));
  assert.equal(heading.block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");
  unmountClaudeDirection(asDocument(heading.doc));

  const item = createAssistantBlock("Use Present Perfect when talking about experiences.", {
    tag: "li",
  });
  mountClaudeDirection(asDocument(item.doc));
  assert.equal(item.block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "ltr");
});

test("Claude direction CSS isolates fenced pre blocks with plaintext BiDi", () => {
  const css = buildClaudeDirectionCss();

  assert.match(css, /\[data-perf-row="assistant"\] pre,/);
  assert.match(css, /\[data-perf-row="assistant"\] pre code,/);
  assert.match(css, /\[data-testid="user-message"\] pre,/);
  assert.match(css, /\[data-testid="chat-input"\][^\n]* pre,/);
});

test("Claude direction CSS isolates Ask User Q/A spans with plaintext BiDi", () => {
  const css = buildClaudeDirectionCss();

  assert.match(css, /\[data-testid="ask-user-answers-card"\] span:not\(\[data-cds="Icon"\]\):not\(\[aria-hidden="true"\]\)/);
  assert.match(
    css,
    /\[data-ask-user-input-banner\] span:not\(\[data-cds="Icon"\]\):not\(\[aria-hidden="true"\]\)[\s\S]*\{\n {2}unicode-bidi: plaintext !important/,
  );
});

test("Claude direction CSS isolates assistant TurnStatus with plaintext BiDi", () => {
  const css = buildClaudeDirectionCss();

  assert.match(
    css,
    /\[data-testid="transcript-row"\]\[data-perf-row="assistant"\] :has\(\[data-morph-key\]\):not\(:has\(\[data-cds="Prose"\]\)\),/,
  );
  assert.match(css, /\[data-perf-row="assistant"\] \[data-morph-key\],/);
  assert.match(css, /\[data-perf-row="assistant"\] \[data-morph-key\] span,/);
  assert.match(
    css,
    /\[data-perf-row="assistant"\] \[data-morph-key\] bdi \{\n {2}unicode-bidi: plaintext !important/,
  );
  assert.doesNotMatch(css, /_r_[A-Za-z0-9]+_/);
  assert.doesNotMatch(css, /font-sans|turn-status-hang/);
});

test("user messages, sidebar, and ChatGPT markup are not annotated", () => {
  const doc = new FakeDocument();

  const user = el(doc, "div", { "data-testid": "user-message" });
  const userParagraph = el(doc, "p", { dir: "ltr" });
  userParagraph.textContent = "این پیام کاربر است";
  user.appendChild(userParagraph);
  doc.body.appendChild(user);

  const sidebar = el(doc, "div", { "data-testid": "sidebar" });
  const title = el(doc, "span", { "data-row-label": "" });
  title.textContent = "گفتگوی فارسی";
  sidebar.appendChild(title);
  doc.body.appendChild(sidebar);

  const chatgpt = el(doc, "div", { "data-message-author-role": "assistant" });
  const chatgptParagraph = el(doc, "p");
  chatgptParagraph.textContent = "این پاسخ ChatGPT است";
  chatgpt.appendChild(chatgptParagraph);
  doc.body.appendChild(chatgpt);

  const assistant = createAssistantBlock(
    "برای تجربه‌های زندگی معمولاً از Present Perfect استفاده می‌کنیم.",
    { doc },
  );

  mountClaudeDirection(asDocument(doc));

  assert.equal(userParagraph.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
  assert.equal(userParagraph.getAttribute("dir"), "ltr");
  assert.equal(title.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
  assert.equal(chatgptParagraph.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
  assert.equal(assistant.block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");
});

test("disabled extension performs no direction processing", () => {
  const { doc, block } = createAssistantBlock("این یک متن فارسی است", { dir: "ltr" });

  resolveAssistantBlock(asElement(block));
  assert.equal(block.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
  assert.equal(block.getAttribute("dir"), "ltr");

  mountClaudeDirection(asDocument(doc));
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");

  unmountClaudeDirection(asDocument(doc));
  assert.equal(block.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
  assert.equal(block.getAttribute("dir"), "ltr");

  block.textContent = "This is now English only";
  resolveAssistantBlock(asElement(block));
  assert.equal(block.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
});

test("cleanup removes only RastText-owned attributes", () => {
  const { doc, block } = createAssistantBlock("متن فارسی", { dir: "ltr" });
  block.setAttribute("data-other", "keep");
  mountClaudeDirection(asDocument(doc));
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");

  removeRastTextDirAttributes(asDocument(doc));

  assert.equal(block.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
  assert.equal(block.getAttribute("dir"), "ltr");
  assert.equal(block.getAttribute("data-other"), "keep");
});

test("streaming characterData updates can flip resolved direction", () => {
  const { doc, block } = createAssistantBlock("Input");
  mountClaudeDirection(asDocument(doc));
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "ltr");

  const textNode = block.childNodes[0];
  assert.ok(textNode instanceof FakeText);
  textNode.nodeValue = "Input فشرده و روزانه یکی از بهترین روش‌ها برای یادگیری است.";

  const observer = activeProseObservers()[0];
  assert.ok(observer);
  observer.callback([characterDataMutation(textNode)], observer as unknown as MutationObserver);
  flushClaudeDirectionUpdates();

  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");
  assert.equal(block.hasAttribute("dir"), false);
});

test("newly added assistant blocks are discovered without a full rescan API", () => {
  const { doc } = createAssistantBlock("Use Present Perfect when talking about experiences.");
  mountClaudeDirection(asDocument(doc));

  const row = el(doc, "div", {
    "data-testid": "transcript-row",
    "data-perf-row": "assistant",
  });
  const prose = el(doc, "div", { "data-cds": "Prose" });
  const paragraph = el(doc, "p");
  paragraph.textContent = "Shadowing برای تلفظ و ریتم خیلی مفید است.";
  prose.appendChild(paragraph);
  row.appendChild(prose);

  const discovery = activeDiscoveryObservers()[0];
  assert.ok(discovery);
  doc.body.appendChild(row);
  discovery.callback([childListMutation(doc.body, [row])], discovery as unknown as MutationObserver);

  assert.equal(paragraph.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");
});

test("empty and digit-only assistant blocks keep Claude dir and drop stale markers", () => {
  const { doc, block } = createAssistantBlock("این متن فارسی است", { dir: "ltr" });
  mountClaudeDirection(asDocument(doc));
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");

  block.textContent = "12345 !!!";
  resolveAssistantBlock(asElement(block));
  assert.equal(block.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
  assert.equal(block.getAttribute("dir"), "ltr");
});

test("Claude direction CSS scopes resolved blocks and avoids override/global important", () => {
  const css = buildClaudeDirectionCss();

  assert.match(css, /\[data-rasttext-dir="rtl"\]/);
  assert.match(css, /\[data-rasttext-dir="ltr"\]/);
  assert.match(css, /data-cds="Prose"/);
  assert.match(css, /data-perf-row="assistant"/);
  assert.match(css, /data-testid="chat-input"/);
  assert.match(css, /unicode-bidi:\s*normal/);
  assert.match(css, /direction:\s*rtl/);
  assert.match(css, /direction:\s*ltr/);
  assert.match(css, /text-align:\s*start/);
  assert.doesNotMatch(css, /bidi-override/);
  assert.doesNotMatch(css, /direction\s*:\s*rtl\s*!important/);
  assert.doesNotMatch(css, /direction\s*:\s*ltr\s*!important/);
  assert.doesNotMatch(css, /(?:^|\n)\s*html\s*\{/);
  assert.doesNotMatch(css, /(?:^|\n)\s*body\s*\{/);
  assert.match(css, /\[data-testid="user-message"\] pre,/);
  assert.doesNotMatch(css, /\[data-testid="user-message"\] \[data-rasttext-dir=/);
  assert.doesNotMatch(css, /data-message-author-role/);
});

test("ChatGPT BiDi CSS remains CSS-only plaintext and is unchanged in behavior", () => {
  const css = buildConversationBidiCss(chatgptAdapter);

  assert.match(css, /unicode-bidi:\s*plaintext !important/);
  assert.match(css, /text-align:\s*start !important/);
  assert.match(css, /:not\(\[data-rasttext-dir\]\)/);
  assert.doesNotMatch(css, /direction\s*:\s*rtl/);
  assert.doesNotMatch(css, /direction\s*:\s*ltr/);
  assert.doesNotMatch(css, /bidi-override/);
  assert.doesNotMatch(css, /data-cds="Prose"/);
  assert.doesNotMatch(css, /data-perf-row="assistant"/);
  assert.doesNotMatch(css, /data-testid="user-message"/);
  assert.doesNotMatch(css, /data-testid="chat-input"/);
});

test("ChatGPT adapter still has no direction lifecycle", () => {
  assert.equal(chatgptAdapter.mount, undefined);
  assert.equal(chatgptAdapter.unmount, undefined);
  assert.equal(typeof claudeAdapter.mount, "function");
  assert.equal(typeof claudeAdapter.unmount, "function");
});

test("direction module stays local-only and does not persist or log message text", () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "direction.ts"), "utf8");

  assert.doesNotMatch(source, /chrome\.storage\.(local|sync|session)/);
  assert.doesNotMatch(source, /\blocalStorage\b/);
  assert.doesNotMatch(source, /\bsessionStorage\b/);
  assert.doesNotMatch(source, /\bindexedDB\b/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)\(/);
  assert.match(source, /never stored, logged, transmitted/);
});

test("composer Persian text resolves rtl through the shared detector", () => {
  const { doc, editor, block } = createComposerBlock("این یک پیام فارسی است", { dir: "auto" });
  mountClaudeDirection(asDocument(doc));
  processComposerEditor(asElement(editor));

  assert.equal(detectBlockDirection("این یک پیام فارسی است"), "rtl");
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");
  assert.equal(block.getAttribute("dir"), "auto");
  assert.equal(editor.getAttribute("dir"), "rtl");
});

test("composer English text resolves ltr through the shared detector", () => {
  const { doc, editor, block } = createComposerBlock("This is a normal English message", {
    dir: "auto",
  });
  mountClaudeDirection(asDocument(doc));
  processComposerEditor(asElement(editor));

  assert.equal(detectBlockDirection("This is a normal English message"), "ltr");
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "ltr");
  assert.equal(block.getAttribute("dir"), "auto");
});

test("composer Persian-dominant text beginning with English resolves rtl", () => {
  const text = "Input فشرده برای یادگیری زبان مفید است";
  const { doc, editor, block } = createComposerBlock(text, { dir: "auto" });
  mountClaudeDirection(asDocument(doc));
  processComposerEditor(asElement(editor));

  assert.equal(text[0], "I");
  assert.equal(detectBlockDirection(text), "rtl");
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");
});

test("composer English-dominant mixed text resolves ltr", () => {
  const text = "This is a mostly English sentence with کلمه";
  const { doc, editor, block } = createComposerBlock(text);
  mountClaudeDirection(asDocument(doc));
  processComposerEditor(asElement(editor));

  assert.equal(detectBlockDirection(text), "ltr");
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "ltr");
});

test("composer inline code does not affect direction counting", () => {
  const { doc, editor, block } = createComposerBlock("");
  block.textContent = "";
  block.appendChild(new FakeText("برای نصب از "));
  const code = el(doc, "code");
  code.textContent = "pnpm install typescript react webpack babel eslint prettier";
  block.appendChild(code);
  block.appendChild(new FakeText(" استفاده کن"));

  mountClaudeDirection(asDocument(doc));
  processComposerEditor(asElement(editor));

  assert.equal(getDetectableText(asElement(block)), "برای نصب از  استفاده کن");
  assert.equal(detectBlockDirection(getDetectableText(asElement(block))), "rtl");
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");
});

test("composer digits and punctuation do not vote", () => {
  const { doc, editor, block } = createComposerBlock("12345 !!!", { dir: "auto" });
  mountClaudeDirection(asDocument(doc));
  processComposerEditor(asElement(editor));

  assert.equal(detectBlockDirection("12345 !!!"), null);
  assert.equal(block.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
  assert.equal(block.getAttribute("dir"), "auto");
});

test("empty composer removes RastText direction state", () => {
  const { doc, editor, block } = createComposerBlock("این یک متن کاملاً فارسی است", {
    dir: "auto",
  });
  editor.setAttribute(RASTTEXT_DIR_ATTRIBUTE, "rtl");
  mountClaudeDirection(asDocument(doc));
  processComposerEditor(asElement(editor));
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");

  block.textContent = "";
  processComposerEditor(asElement(editor));

  assert.equal(block.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
  assert.equal(editor.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
  assert.equal(editor.getAttribute("dir"), "rtl");
  assert.equal(block.getAttribute("dir"), "auto");
});

test("composer direction updates rtl to ltr and ltr to rtl", () => {
  const { doc, editor, block } = createComposerBlock("این یک پیام فارسی است");
  mountClaudeDirection(asDocument(doc));
  processComposerEditor(asElement(editor));
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");

  block.textContent = "This is a normal English message";
  processComposerEditor(asElement(editor));
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "ltr");
  assert.equal(block.getAttribute("dir"), "auto");

  block.textContent = "برای این پروژه از TypeScript و React استفاده می‌کنم";
  processComposerEditor(asElement(editor));
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");
});

test("repeated composer processing is idempotent and leaves Claude dir untouched", () => {
  const { doc, editor, block } = createComposerBlock("این یک پیام فارسی است", { dir: "auto" });
  mountClaudeDirection(asDocument(doc));
  processComposerEditor(asElement(editor));
  processComposerEditor(asElement(editor));
  processComposerEditor(asElement(editor));

  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");
  assert.equal(block.getAttribute("dir"), "auto");
  assert.equal(editor.getAttribute("dir"), "rtl");
});

test("placeholder ghost text is not used for composer direction", () => {
  const { doc, editor, block } = createComposerBlock("12345");
  const ghost = el(doc, "div", { "data-composer-placeholder-ghost": "" });
  ghost.textContent = "این متنplaceholder فارسی نباید جهت را عوض کند";
  editor.appendChild(ghost);

  mountClaudeDirection(asDocument(doc));
  processComposerEditor(asElement(editor));

  assert.equal(getDetectableText(asElement(editor)), "12345");
  assert.equal(block.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
  assert.equal(ghost.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
});

test("assistant direction still resolves when a composer is present on the same page", () => {
  const assistant = createAssistantBlock("Input فشرده و روزانه باعث پیشرفت می‌شود", {
    dir: "ltr",
  });
  const composer = createComposerBlock("This is a normal English message", {
    doc: assistant.doc,
    dir: "auto",
  });

  mountClaudePlatformSupport(asDocument(assistant.doc));

  assert.equal(assistant.block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");
  assert.equal(assistant.block.getAttribute("dir"), "ltr");
  assert.equal(composer.block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "ltr");
  assert.equal(composer.block.getAttribute("dir"), "auto");
});

test("assistant-only mount does not annotate the composer", () => {
  const { doc, block } = createComposerBlock("این یک پیام فارسی است");
  mountClaudeDirection(asDocument(doc));

  assert.equal(block.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
});

test("platform mount processes existing composer content without rewriting dir", () => {
  const { doc, editor, block } = createComposerBlock(
    "Input فشرده برای یادگیری زبان مفید است",
    { dir: "auto" },
  );

  mountClaudePlatformSupport(asDocument(doc));

  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");
  assert.equal(block.getAttribute("dir"), "auto");
  assert.equal(editor.getAttribute("dir"), "rtl");
  assert.equal(doc.listenerCount("input"), 1);
  assert.equal(doc.listenerCount("focusin"), 1);
});

test("composer remount on the same document does not stack listeners", () => {
  const { doc } = createComposerBlock("این یک پیام فارسی است");
  mountClaudePlatformSupport(asDocument(doc));
  mountClaudePlatformSupport(asDocument(doc));

  assert.equal(doc.listenerCount("input"), 1);
  assert.equal(doc.listenerCount("focusin"), 1);
});

test("delegated input and focusin update composer direction", () => {
  const { doc, editor, block } = createComposerBlock("This is a normal English message");
  mountClaudePlatformSupport(asDocument(doc));
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "ltr");

  block.textContent = "این یک پیام فارسی است";
  doc.dispatchDelegated("input", editor);
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");

  block.textContent = "Use React and TypeScript for this project";
  doc.dispatchDelegated("focusin", block);
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "ltr");
});

test("composer cleanup removes listeners and RastText-owned attributes", () => {
  const { doc, editor, block } = createComposerBlock("این یک پیام فارسی است", { dir: "auto" });
  mountClaudePlatformSupport(asDocument(doc));
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");

  unmountClaudePlatformSupport(asDocument(doc));

  assert.equal(doc.listenerCount("input"), 0);
  assert.equal(doc.listenerCount("focusin"), 0);
  assert.equal(block.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
  assert.equal(editor.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
  assert.equal(block.getAttribute("dir"), "auto");
  assert.equal(editor.getAttribute("dir"), "rtl");

  block.textContent = "This is now English";
  doc.dispatchDelegated("input", editor);
  assert.equal(block.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
});

test("clearComposerDirectionState removes only RastText attributes", () => {
  const { doc, editor, block } = createComposerBlock("متن فارسی", { dir: "auto" });
  block.setAttribute("data-other", "keep");
  mountClaudeDirection(asDocument(doc));
  processComposerEditor(asElement(editor));
  assert.equal(block.getAttribute(RASTTEXT_DIR_ATTRIBUTE), "rtl");

  clearComposerDirectionState(asElement(editor));

  assert.equal(block.hasAttribute(RASTTEXT_DIR_ATTRIBUTE), false);
  assert.equal(block.getAttribute("dir"), "auto");
  assert.equal(block.getAttribute("data-other"), "keep");
});
