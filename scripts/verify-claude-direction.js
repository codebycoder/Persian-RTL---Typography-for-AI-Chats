async (page) => {
  // Local fixture only: no request reaches Claude. Run after pnpm build.
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { background:#080808;color:white;font:16px Arial;line-height:1.65;margin:32px }
  main {max-width:760px;margin:auto} ul,ol {padding-left:32px;padding-right:0} code {background:#444;padding:2px 5px} pre {background:#222;padding:12px}
  [data-testid="chat-input"] {border:1px solid #555;padding:10px;margin-top:24px}
  </style></head><body><main>
  <div data-testid="transcript-row" data-perf-row="assistant">
    <div data-cds="Prose" id="response">
      <p>تا اینجا کارهای SEO/GEO که انجام دادیم، به ترتیب، این‌ها بوده:</p>
      <ul id="outer" dir="ltr"><li>پروژه SEO + GEO کامل Audit<ul id="nested" dir="ltr">
        <li id="mixed" dir="ltr">بررسی Technical SEO، indexability، metadata، canonical، robots، sitemap، structured data</li>
        <li>مشخص شدن مشکلات اصلی مثل block شدن <code id="path">/profiles/...</code> با robots، soft-404، پروفایل‌های mock</li>
        <li>حذف fallback جعلی <code>John Doe</code> در production</li>
        <li>API/network failure دیگر memorial جعلی render نمی‌کند</li>
        <li>missing profile به HTTP <code>404</code> واقعی تبدیل شد</li>
        <li>از هم مستقل شدند <code>follow</code> و <code>index</code></li>
        <li id="english-item" dir="ltr">12 test suite / 75 test PASS</li>
      </ul></li></ul>
      <p id="english">English paragraph remains left to right.</p>
      <p id="stream">API/network failure</p>
      <pre id="code"><code>const path = '/profiles/...'; // نمونه</code></pre>
    </div>
  </div>
  <div data-testid="user-message"><p id="user-message">پیام کاربر بدون marker اختصاصی</p></div>
  <div data-skill-file-viewer="true" id="file-viewer">
    <p id="file-persian" dir="ltr">SwiftUI را نباید مثل یک فریم‌ورک کاملاً جدید یاد گرفت؛ باید آن را روی نقشه ذهنی موجودت از React سوار کرد.</p>
    <ul id="file-list" dir="ltr"><li id="file-mixed" dir="ltr">هدف: <strong>iOS 17+</strong> به‌عنوان minimum deployment target</li></ul>
    <p id="file-english" dir="rtl">English paragraph remains left to right.</p>
    <pre id="file-code"><code>struct User { var name: String }</code></pre>
  </div>
  <div data-testid="chat-input" contenteditable="true" role="textbox" dir="rtl" id="composer">
    <ul id="composer-list" dir="auto"><li>SEO Phase 1 برای robots و noindex تکمیل شد</li><li id="composer-english">type-check, ESLint and web build PASS</li></ul>
  </div>
  </main><script>
  window.chrome={runtime:{id:'fixture',onMessage:{addListener(){}},getURL:p=>p},storage:{local:{get:async()=>({})},onChanged:{addListener:f=>window.changeSettings=f,removeListener(){}}}};
  </script></body></html>`;
  await page.route('https://claude.ai/**', route => route.fulfill({contentType:'text/html',body:html}));
  await page.goto('https://claude.ai/fixture');
  await page.addScriptTag({path:'dist/content.js'});
  await page.waitForFunction(() =>
    document.querySelector('#mixed').getAttribute('data-rasttext-dir') === 'rtl' &&
    document.querySelector('#file-persian').getAttribute('data-rasttext-dir') === 'rtl'
  );
  const verify = async () => page.evaluate(() => {
    const css = id => getComputedStyle(document.getElementById(id));
    for (const id of ['outer','nested','mixed','composer-list','file-persian','file-list','file-mixed']) if(css(id).direction !== 'rtl') throw Error(id+' not RTL');
    for (const id of ['english','path','file-english']) if(css(id).direction !== 'ltr') throw Error(id+' not LTR');
    for (const id of ['english-item','composer-english']) {
      if(css(id).unicodeBidi !== 'plaintext' || css(id).direction !== 'rtl') throw Error(id+' English item not preserved');
    }
    const text = document.getElementById('english-item').firstChild;
    const number = document.createRange(); number.setStart(text,0); number.setEnd(text,2);
    const word = document.createRange(); word.setStart(text,3); word.setEnd(text,7);
    if(number.getBoundingClientRect().left >= word.getBoundingClientRect().left) throw Error('leading number moved after English');
    if(css('path').unicodeBidi !== 'isolate') throw Error('inline code not isolated');
    if(css('outer').paddingRight === '0px' || css('outer').paddingLeft !== '0px') throw Error('list gutter incorrect');
    if(document.querySelector('#user-message [data-rasttext-dir], #user-message[data-rasttext-dir]')) throw Error('user message modified');
    if(document.getElementById('file-persian').getAttribute('dir') !== 'ltr') throw Error('file viewer Claude dir rewritten');
    if(!/CFC Vazirmatn|Vazirmatn/i.test(css('file-persian').fontFamily)) throw Error('file viewer font not applied');
  });
  await verify();
  await page.evaluate(() => {
    document.querySelector('#stream').firstChild.appendData(' دیگر خطای جعلی نشان نمی‌دهد');
    const row = document.createElement('div');
    row.setAttribute('data-testid','transcript-row');
    row.setAttribute('data-perf-row','assistant');
    row.innerHTML='<div data-cds="Prose"><ol id="new-list"><li>مرحله جدید فارسی</li></ol></div>';
    document.querySelector('main').append(row);
  });
  await page.waitForFunction(() => document.querySelector('#stream').getAttribute('data-rasttext-dir') === 'rtl' && document.querySelector('#new-list').getAttribute('data-rasttext-dir') === 'rtl');
  await page.setViewportSize({width:900,height:950});
  await page.screenshot({path:'output/playwright/claude-rtl-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await verify();
  await page.screenshot({path:'output/playwright/claude-rtl-mobile.png',fullPage:true});
  await page.evaluate(() => window.changeSettings({fontSettings:{newValue:{enabled:false}}},'local'));
  await page.waitForFunction(() => !document.querySelector('[data-rasttext-dir], [data-rasttext-ltr-item]') && !document.querySelector('#chat-font-customizer-claude-direction-style'));
  await page.evaluate(() => window.changeSettings({fontSettings:{newValue:{enabled:true}}},'local'));
  await page.waitForFunction(() => document.querySelector('#mixed').getAttribute('data-rasttext-dir') === 'rtl');
  await verify();
  console.log('PASS: Claude mixed lists, English-only items, skill file viewer font+RTL, inline code isolation, list gutters, streaming, new roots, user messages, disable/re-enable, desktop/mobile');
}
