export type InjectedStyleElement = {
  id: string;
  textContent: string | null;
  remove: () => void;
};

export type StyleHost = {
  getElementById(id: string): InjectedStyleElement | null;
  createElement(tagName: "style"): InjectedStyleElement;
  mount(element: InjectedStyleElement): void;
};

/**
 * Idempotent style element lifecycle: reuse one tagged element, update its
 * text, or remove it when CSS is null (customization disabled).
 */
export function syncInjectedStyle(
  host: StyleHost,
  elementId: string,
  css: string | null,
): InjectedStyleElement | null {
  const existing = host.getElementById(elementId);

  if (css === null) {
    existing?.remove();
    return null;
  }

  if (existing) {
    existing.textContent = css;
    return existing;
  }

  const created = host.createElement("style");
  created.id = elementId;
  created.textContent = css;
  host.mount(created);
  return created;
}

export function createDocumentStyleHost(doc: Document): StyleHost {
  return {
    getElementById(id) {
      const el = doc.getElementById(id);
      return el instanceof HTMLStyleElement ? el : null;
    },
    createElement() {
      return doc.createElement("style");
    },
    mount(element) {
      const parent = doc.head ?? doc.documentElement;
      parent.appendChild(element as unknown as Node);
    },
  };
}
