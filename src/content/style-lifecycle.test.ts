import assert from "node:assert/strict";
import { test } from "node:test";
import { INJECTED_STYLE_ELEMENT_ID } from "@shared/constants";
import {
  syncInjectedStyle,
  type InjectedStyleElement,
  type StyleHost,
} from "./style-lifecycle";

function createMemoryHost(): { host: StyleHost; mounted: InjectedStyleElement[] } {
  const mounted: InjectedStyleElement[] = [];
  const host: StyleHost = {
    getElementById(id) {
      return mounted.find((element) => element.id === id) ?? null;
    },
    createElement() {
      return {
        id: "",
        textContent: "",
        remove() {
          const index = mounted.indexOf(this);
          if (index >= 0) {
            mounted.splice(index, 1);
          }
        },
      };
    },
    mount(element) {
      mounted.push(element);
    },
  };

  return { host, mounted };
}

test("syncInjectedStyle creates a single style element and reuses it", () => {
  const { host, mounted } = createMemoryHost();

  const first = syncInjectedStyle(host, INJECTED_STYLE_ELEMENT_ID, "a {}");
  const second = syncInjectedStyle(host, INJECTED_STYLE_ELEMENT_ID, "b {}");

  assert.equal(mounted.length, 1);
  assert.equal(first, second);
  assert.equal(mounted[0]?.textContent, "b {}");
  assert.equal(mounted[0]?.id, INJECTED_STYLE_ELEMENT_ID);
});

test("syncInjectedStyle removes the injected style when disabled", () => {
  const { host, mounted } = createMemoryHost();

  syncInjectedStyle(host, INJECTED_STYLE_ELEMENT_ID, "a {}");
  const removed = syncInjectedStyle(host, INJECTED_STYLE_ELEMENT_ID, null);

  assert.equal(removed, null);
  assert.equal(mounted.length, 0);
});
