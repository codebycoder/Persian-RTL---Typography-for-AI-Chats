import assert from "node:assert/strict";
import { test } from "node:test";
import { buildChatGptDirectionCss, detectChatGptDirection } from "./direction";
import {
  CANVAS_EDITOR_SELECTORS,
  CHATGPT_COMPOSER_EDITOR,
  CHATGPT_FILE_VIEWER_PANEL,
} from "./selectors";

test("technical Persian stays RTL even when English words lead or outnumber Persian", () => {
  for (const text of [
    "پروژه SEO + GEO کامل Audit",
    "Technical SEO، indexability، metadata، canonical، robots، sitemap بررسی",
    "API/network failure دیگر memorial جعلی render نمی‌کند",
    "missing profile به HTTP تبدیل شد",
    "از هم مستقل شدند follow و index",
  ]) assert.equal(detectChatGptDirection(text), "rtl", text);
});

test("English stays LTR and neutral content does not acquire a forced direction", () => {
  assert.equal(detectChatGptDirection("12 test suite / 75 test PASS"), "ltr");
  assert.equal(detectChatGptDirection("SEO Phase 1 — Memorial Safety + Robots / Noindex"), "ltr");
  assert.equal(detectChatGptDirection("Develop in Swift — Apple"), "ltr");
  for (const text of ["", "404", "۱۲۳", "... ✅"]) assert.equal(detectChatGptDirection(text), null);
});

test("direction CSS forces RTL for Persian and LTR for English without right-align hacks", () => {
  const css = buildChatGptDirectionCss();

  assert.match(css, /data-rasttext-dir="rtl"/);
  assert.match(css, /data-rasttext-dir="ltr"/);
  assert.doesNotMatch(css, /data-rasttext-ltr-item/);
  assert.doesNotMatch(css, /text-align:\s*right/);
  assert.match(css, /text-align:\s*start/);
  assert.match(css, new RegExp(`${CHATGPT_COMPOSER_EDITOR.replaceAll("[", "\\[")} :is\\(pre, code, kbd, samp, tt\\)`));
  assert.doesNotMatch(css, /RichTextInput-|composer-NYb0tQ|aria-label/);
});

test("direction CSS covers file viewer and Canvas writing-block editors", () => {
  const css = buildChatGptDirectionCss();

  assert.ok(css.includes(`${CHATGPT_FILE_VIEWER_PANEL} [data-rasttext-dir="rtl"]`));
  for (const selector of CANVAS_EDITOR_SELECTORS) {
    assert.ok(css.includes(`${selector} [data-rasttext-dir="rtl"]`));
    assert.ok(css.includes(`${selector} :is(pre, code, kbd, samp, tt)`));
  }
});
