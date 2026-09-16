import {
  clearComposerDirectionState,
  mountClaudeDirection,
  processComposerEditor,
  unmountClaudeDirection,
} from "./direction";
import { CLAUDE_COMPOSER_EDITOR } from "./selectors";

/**
 * Claude platform lifecycle.
 *
 * Assistant streaming stays on the narrow observer in `direction.ts`.
 * Composer typing is event-driven: delegated `input` plus `focusin`,
 * filtered immediately to the verified editor.
 *
 * Privacy: composer text is read only inside `processComposerEditor`
 * for the current pass. This file never logs, stores, or transmits
 * typed content.
 */

type ComposerListenerBinding = {
  readonly doc: Document;
  readonly onInput: EventListener;
  readonly onFocusIn: EventListener;
};

let composerListeners: ComposerListenerBinding | null = null;

function isElementLike(value: EventTarget | null): value is Element {
  return (
    !!value &&
    typeof value === "object" &&
    "closest" in value &&
    typeof (value as Element).closest === "function"
  );
}

function closestComposerEditor(target: EventTarget | null): Element | null {
  if (isElementLike(target)) {
    return target.closest(CLAUDE_COMPOSER_EDITOR);
  }

  if (target && typeof target === "object" && "parentElement" in target) {
    const parent = (target as { parentElement: EventTarget | null }).parentElement;
    if (isElementLike(parent)) {
      return parent.closest(CLAUDE_COMPOSER_EDITOR);
    }
  }

  return null;
}

function processAllComposers(doc: Document): void {
  const editors = doc.querySelectorAll(CLAUDE_COMPOSER_EDITOR);
  for (let index = 0; index < editors.length; index += 1) {
    const editor = editors[index];
    if (editor) {
      processComposerEditor(editor);
    }
  }
}

function clearAllComposers(doc: Document): void {
  const editors = doc.querySelectorAll(CLAUDE_COMPOSER_EDITOR);
  for (let index = 0; index < editors.length; index += 1) {
    const editor = editors[index];
    if (editor) {
      clearComposerDirectionState(editor);
    }
  }
}

function detachComposerListeners(doc: Document, binding: ComposerListenerBinding): void {
  doc.removeEventListener("input", binding.onInput, false);
  doc.removeEventListener("focusin", binding.onFocusIn, false);
}

export function mountClaudeComposer(doc: Document): void {
  if (composerListeners?.doc === doc) {
    processAllComposers(doc);
    return;
  }

  if (composerListeners) {
    detachComposerListeners(composerListeners.doc, composerListeners);
    composerListeners = null;
  }

  const onInput: EventListener = (event) => {
    const editor = closestComposerEditor(event.target);
    if (editor) {
      processComposerEditor(editor);
    }
  };

  const onFocusIn: EventListener = (event) => {
    const editor = closestComposerEditor(event.target);
    if (editor) {
      processComposerEditor(editor);
    }
  };

  doc.addEventListener("input", onInput, false);
  doc.addEventListener("focusin", onFocusIn, false);
  composerListeners = { doc, onInput, onFocusIn };
  processAllComposers(doc);
}

export function unmountClaudeComposer(doc: Document): void {
  if (composerListeners) {
    detachComposerListeners(composerListeners.doc, composerListeners);
    if (doc !== composerListeners.doc) {
      detachComposerListeners(doc, composerListeners);
    }
    composerListeners = null;
  }

  clearAllComposers(doc);
}

export function mountClaudePlatformSupport(doc: Document): void {
  mountClaudeDirection(doc);
  mountClaudeComposer(doc);
}

export function unmountClaudePlatformSupport(doc: Document): void {
  unmountClaudeComposer(doc);
  unmountClaudeDirection(doc);
}
