async (page) => {
  // Local fixture only: no request reaches ChatGPT. Run after pnpm build.
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { background:#080808;color:white;font:16px Arial;line-height:1.65;margin:32px }
  main {max-width:760px;margin:auto} ul,ol {padding-left:32px;padding-right:0} code {background:#444;padding:2px 5px} pre {background:#222;padding:12px}
  </style></head><body><main>
  <div data-message-author-role="assistant"><div class="markdown" id="response">
  <p>تا اینجا کارهای SEO/GEO که انجام دادیم، به ترتیب، این‌ها بوده:</p>
  <ul id="outer"><li>پروژه SEO + GEO کامل Audit<ul id="nested">
  <li id="mixed">بررسی Technical SEO، indexability، metadata، canonical، robots، sitemap، structured data</li>
  <li>مشخص شدن مشکلات اصلی مثل block شدن <code id="path">/profiles/...</code> با robots، soft-404، پروفایل‌های mock</li>
  <li>حذف fallback جعلی <code>John Doe</code> در production</li>
  <li>API/network failure دیگر memorial جعلی render نمی‌کند</li>
  <li>missing profile به HTTP <code>404</code> واقعی تبدیل شد</li>
  <li>از هم مستقل شدند <code>follow</code> و <code>index</code></li>
  <li id="english-item">12 test suite / 75 test PASS</li></ul></li></ul>
  <p id="english">English paragraph remains left to right.</p>
  <p id="stream">API/network failure</p>
  <pre id="code"><code>const path = '/profiles/...'; // نمونه</code></pre>
  <div contenteditable="true" id="editor"><p>متن ویرایشگر</p></div>
  </div></div><div id="prompt-textarea" contenteditable="true"><p>متن ورودی</p></div>
  <div data-rich-text-layout="multiline" data-composer-input-layout="multiline" role="presentation">
    <div id="composer" class="ProseMirror" contenteditable="true" role="textbox" data-composer-markdown="" dir="auto" aria-label="Work with ChatGPT">
      <p id="composer-fa">میخوام </p>
      <p id="composer-en">Write in English</p>
      <ul id="composer-list"><li id="composer-li">مرحله فارسی</li><li id="composer-en-li">12 tests PASS</li></ul>
      <pre id="composer-code"><code>const x = 1; // نمونه</code></pre>
    </div>
  </div>
  <div class="ProseMirror" id="canvas-editor" contenteditable="true"><p id="canvas-text">متن کانواس</p></div>
  <div data-dil-widget-copy-target><ol id="dil-list"><li><p data-d-component="text">مرحله فارسی جدید</p></li></ol></div></main><script>window.chrome={runtime:{id:'fixture',getURL:(path)=>path,onMessage:{addListener(){}}},storage:{local:{get:async()=>({})},onChanged:{addListener:f=>window.changeSettings=f}}};</script></body></html>`;
  await page.route('https://chatgpt.com/**', route => route.fulfill({contentType:'text/html',body:html}));
  await page.goto('https://chatgpt.com/fixture');
  await page.addScriptTag({path:'dist/content.js'});
  await page.waitForFunction(() => document.querySelector('#mixed').getAttribute('data-rasttext-dir') === 'rtl');
  const verify = async () => page.evaluate(() => {
    const css = id => getComputedStyle(document.getElementById(id));
    const dilText = document.querySelector('[data-d-component="text"]');
    for (const id of ['mixed', 'composer-li']) if (css(id).direction !== 'rtl') throw Error(id + ' not RTL');
    if (dilText && getComputedStyle(dilText).direction !== 'rtl') throw Error('dil text not RTL');
    for (const id of ['english', 'english-item', 'path', 'code', 'composer-en', 'composer-en-li']) {
      if (css(id).direction !== 'ltr') throw Error(id + ' not LTR');
      if (document.getElementById(id)?.getAttribute('data-rasttext-dir') === 'rtl') {
        throw Error(id + ' incorrectly forced RTL');
      }
    }
    if (document.getElementById('english-item')?.getAttribute('data-rasttext-dir') !== 'ltr') {
      throw Error('english-item should be explicit LTR, not list-inherited RTL');
    }
    if (document.getElementById('composer-en')?.getAttribute('data-rasttext-dir') !== 'ltr') {
      throw Error('composer-en should be explicit LTR');
    }
    const text = document.getElementById('english-item').firstChild;
    const number = document.createRange(); number.setStart(text, 0); number.setEnd(text, 2);
    const word = document.createRange(); word.setStart(text, 3); word.setEnd(text, 7);
    if (number.getBoundingClientRect().left >= word.getBoundingClientRect().left) {
      throw Error('leading number moved after English');
    }
    if (css('path').unicodeBidi !== 'isolate') throw Error('code not isolated');
    if (css('outer').paddingRight === '0px' || css('outer').paddingLeft !== '0px') {
      throw Error('list gutter incorrect');
    }
    if (document.querySelector('#editor [data-rasttext-dir], #prompt-textarea [data-rasttext-dir], #canvas-editor [data-rasttext-dir]')) {
      throw Error('editor modified');
    }
    if (css('composer-fa').direction !== 'rtl') throw Error('composer Persian not RTL');
    if (!css('composer-fa').fontFamily.includes('CFC Vazirmatn')) throw Error('composer font missing');
    if (document.getElementById('composer').getAttribute('dir') !== 'auto') throw Error('composer dir rewritten');
    if (css('composer-code').direction !== 'ltr' || css('composer-code').unicodeBidi !== 'isolate') {
      throw Error('composer code not isolated');
    }
    if (document.querySelector('#canvas-text').getAttribute('data-rasttext-dir')) throw Error('canvas annotated');
  });
  await verify();
  await page.evaluate(() => { document.querySelector('#composer-en').textContent = 'حالا فارسی'; });
  await page.waitForFunction(() => document.querySelector('#composer-en').getAttribute('data-rasttext-dir') === 'rtl');
  await page.evaluate(() => { document.querySelector('#composer-en').textContent = 'Write in English'; });
  await page.waitForFunction(() => document.querySelector('#composer-en').getAttribute('data-rasttext-dir') === 'ltr');
  await page.evaluate(() => {
    document.querySelector('#stream').firstChild.appendData(' دیگر خطای جعلی نشان نمی‌دهد');
    const root = document.createElement('div'); root.setAttribute('data-assistant-markdown', '');
    root.innerHTML = '<ol id="new-list"><li id="new-item">مرحله جدید</li></ol>';
    document.querySelector('[data-message-author-role]').append(root);
  });
  await page.waitForFunction(() => (
    document.querySelector('#stream').getAttribute('data-rasttext-dir') === 'rtl' &&
    document.querySelector('#new-item').getAttribute('data-rasttext-dir') === 'rtl' &&
    !document.querySelector('#new-list').getAttribute('data-rasttext-dir')
  ));
  await page.setViewportSize({ width: 900, height: 950 });
  await page.screenshot({ path: '.playwright-cli/chatgpt-rtl-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await verify();
  await page.screenshot({ path: '.playwright-cli/chatgpt-rtl-mobile.png', fullPage: true });
  await page.evaluate(() => window.changeSettings({ fontSettings: { newValue: { enabled: false } } }, 'local'));
  await page.waitForFunction(() => !document.querySelector('[data-rasttext-dir], [data-rasttext-ltr-item]') && !document.querySelector('#rasttext-chatgpt-direction-style'));
  await page.evaluate(() => window.changeSettings({ fontSettings: { newValue: { enabled: true } } }, 'local'));
  await page.waitForFunction(() => document.querySelector('#mixed').getAttribute('data-rasttext-dir') === 'rtl');
  await verify();
  console.log('PASS: Persian RTL only, English untouched, code isolation, list gutters, streaming, editors, disable/re-enable');
}
