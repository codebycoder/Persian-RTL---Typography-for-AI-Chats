async (page) => {
  // Local fixture only: no request reaches Claude. Run after pnpm build.
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { background:#080808;color:white;font:16px Arial;line-height:1.65;margin:32px }
  main {max-width:760px;margin:auto} ul,ol {padding-left:32px;padding-right:0} code {background:#444;padding:2px 5px} pre {background:#222;padding:12px}
  [data-testid="chat-input"] {border:1px solid #555;padding:10px;margin-top:24px}
  .om-rich-input .ProseMirror, .om-rich-input p {font-family:Georgia;text-align:left}
  .om-rich-input p.is-empty::before {content:attr(data-placeholder);font-family:Georgia;color:#888}
  [class^="ai-"] {font-family:fixture-icons}
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
  <div data-testid="question-receipt" id="receipt" class="py-2 px-3 max-w-[85%] w-fit text-left" style="padding:8px 12px;max-width:85%;width:fit-content;text-align:left;background:#222;border:0.5px solid #555;border-radius:8px;box-shadow:rgba(0,0,0,0.04) 0px 1px 2px">
    <div id="receipt-header" style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;margin-bottom:4px"><i id="receipt-icon" class="ai-CheckCircle leading-none not-italic w-[1em] h-[1em] inline-flex items-center justify-center shrink-0" style="font-size:13px;flex-shrink:0">✓</i>You answered</div>
    <div style="font-size:12px;line-height:1.55;overflow-wrap:anywhere">
      <div data-testid="question-receipt-line" id="receipt-location" dir="ltr"><span id="receipt-label" style="font-weight:600">location: </span>صفحه‌ی جدید Catering در سایدبار (تب Meals) — کارت «Meals so far» هم به آن لینک می‌شود</div>
      <div data-testid="question-receipt-line" id="receipt-structure"><span style="font-weight:600">structure: </span>چند کورس (پیش‌غذا، اصلی، دسر)</div>
      <div data-testid="question-receipt-line" id="receipt-fields"><span style="font-weight:600">fields: </span>نام (برای مهمان), برچسب رژیمی (V، VG، GF…), آلرژن‌های موجود, چه کسی می‌تواند انتخاب کند (بزرگسال / کودک), کد یا یادداشت برای آشپزخانه</div>
      <div data-testid="question-receipt-line" id="receipt-screens"><span style="font-weight:600">screens: </span>فهرست غذاها با تعداد انتخاب‌ها, افزودن / ویرایش غذا</div>
      <div data-testid="question-receipt-line" id="receipt-editor"><span style="font-weight:600">editor: </span>دیالوگ وسط صفحه</div>
      <div data-testid="question-receipt-line" id="receipt-devices"><span style="font-weight:600">devices: </span>دسکتاپ + موبایل</div>
      <div data-testid="question-receipt-line" id="receipt-english"><span style="font-weight:600">notes: </span>Keep this answer in English</div>
    </div>
  </div>
  <div data-testid="question-receipt-line" id="receipt-outside">این متن بیرون از کارت است</div>
  <div data-skill-file-viewer="true" id="file-viewer">
    <p id="file-persian" dir="ltr">SwiftUI را نباید مثل یک فریم‌ورک کاملاً جدید یاد گرفت؛ باید آن را روی نقشه ذهنی موجودت از React سوار کرد.</p>
    <ul id="file-list" dir="ltr"><li id="file-mixed" dir="ltr">هدف: <strong>iOS 17+</strong> به‌عنوان minimum deployment target</li></ul>
    <p id="file-english" dir="rtl">English paragraph remains left to right.</p>
    <pre id="file-code"><code>struct User { var name: String }</code></pre>
  </div>
  <div data-testid="chat-input" contenteditable="true" role="textbox" dir="rtl" id="composer">
    <ul id="composer-list" dir="auto"><li>SEO Phase 1 برای robots و noindex تکمیل شد</li><li id="composer-english">type-check, ESLint and web build PASS</li></ul>
  </div>
  <div id="design-composer-shell" style="border:1px solid #555;border-radius:14px;padding:12px;margin:24px 0">
    <button data-testid="composer-ds-picker-trigger" id="design-picker"><span>Ana &amp; Houman Design System</span><i class="ai-CaretDown" id="design-icon">⌄</i></button>
    <div class="om-rich-input" style="--om-ri-min-rows:3;--om-ri-max-rows:8">
      <div contenteditable="true" role="textbox" aria-multiline="true" aria-label="Describe what you want to create..." data-testid="chat-composer-input" translate="no" class="ProseMirror" id="design-composer">
        <p data-placeholder="Describe what you want to create..." id="design-prompt">React برای ساخت این صفحه استفاده می‌شود</p>
        <p id="design-english">Build this page using React</p>
        <p><code id="design-inline-code">const value = 1</code></p>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between"><button data-testid="composer-import-button" id="design-import"><i class="ai-Add">+</i></button><button data-testid="live-voice-mic-button" id="design-mic">Voice input</button><button title="Send (Enter)" id="design-send"><i class="ai-PaperPlane">➤</i></button></div>
  </div>
  <table style="width:100%"><tbody>
    <tr data-hoverable data-clickable><td style="position:relative">
      <a href="/chat/fixture-chat" aria-label="Design system رنگی" style="position:absolute;inset:0"></a>
      <span style="display:contents"><div style="display:flex;align-items:center;gap:12px">
        <div style="display:flex;flex:1;min-width:0;flex-direction:column">
          <div id="chat-title-container" style="display:flex;min-width:0;align-items:center">
            <span id="chat-title" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Design system رنگی</span>
          </div>
        </div>
        <div style="position:relative;display:flex;align-items:center">
          <span id="chat-time-wrapper"><time id="chat-time" data-cds="RelativeTime" datetime="2026-09-28T13:21:43.617Z">4 days ago</time></span>
          <div><button id="chat-options" aria-label="More options for Design system رنگی"><span aria-hidden="true"><span data-cds-part="paint"></span></span><span><span id="chat-icon" data-cds="Icon" aria-hidden="true"></span></span></button></div>
        </div>
      </div></span>
    </td></tr>
    <tr data-hoverable data-clickable><td><a href="/chat/fixture-persian" aria-label="طراحی Design system رنگی"></a><div style="display:flex"><span id="chat-title-persian">طراحی Design system رنگی</span></div></td></tr>
    <tr data-hoverable data-clickable><td><a href="/chat/fixture-number" aria-label="2026 طراحی API رنگی"></a><div style="display:flex"><span id="chat-title-number">2026 طراحی API رنگی</span></div></td></tr>
    <tr data-hoverable data-clickable><td><a href="/chat/fixture-english" aria-label="Design system 2026"></a><div style="display:flex"><span id="chat-title-english">Design system 2026</span></div></td></tr>
    <tr data-hoverable data-clickable><td><a href="/project/fixture-project" aria-label="Project"></a><div><span id="project-title">پروژه فارسی</span></div></td></tr>
  </tbody></table>
  </main><script>
  window.chrome={runtime:{id:'fixture',onMessage:{addListener(){}},getURL:p=>p},storage:{local:{get:async()=>({})},onChanged:{addListener:f=>window.changeSettings=f,removeListener(){}}}};
  </script></body></html>`;
  await page.route('https://claude.ai/**', route => route.fulfill({contentType:'text/html',body:html}));
  await page.route('https://claude.ai/fonts/**', route => route.fulfill({path:'dist'+new URL(route.request().url()).pathname}));
  await page.goto('https://claude.ai/fixture');
  await page.addScriptTag({path:'dist/content.js'});
  await page.waitForFunction(() =>
    document.querySelector('#mixed').getAttribute('data-rasttext-dir') === 'rtl' &&
    document.querySelector('#file-persian').getAttribute('data-rasttext-dir') === 'rtl'
  );
  const verify = async () => page.evaluate(() => {
    const css = id => getComputedStyle(document.getElementById(id));
    for(const id of ['receipt-location','receipt-structure','receipt-fields','receipt-screens','receipt-editor','receipt-devices']) {
      if(css(id).direction !== 'rtl' || css(id).textAlign !== 'start') throw Error(id+' not RTL/start-aligned');
      if(!css(id).fontFamily.includes('CFC Vazirmatn')) throw Error(id+' font not applied');
    }
    if(css('receipt-english').direction !== 'ltr') throw Error('English receipt answer not LTR');
    for(const id of ['receipt-header','receipt-label','receipt-english']) {
      if(!css(id).fontFamily.includes('CFC Vazirmatn')) throw Error(id+' font not applied');
    }
    if(css('receipt-icon').fontFamily !== 'fixture-icons') throw Error('receipt icon font changed');
    if(css('receipt-label').unicodeBidi !== 'isolate' || css('receipt-label').direction !== 'ltr') throw Error('receipt label not isolated');
    if(parseFloat(css('receipt-label').paddingInlineStart) <= 0) throw Error('receipt label has no gap before Persian answer');
    if(css('receipt').direction !== 'ltr' || css('receipt').textAlign !== 'left') throw Error('receipt shell direction changed');
    if(document.getElementById('receipt-location').getAttribute('dir') !== 'ltr') throw Error('receipt host dir rewritten');
    if(document.getElementById('receipt-outside').hasAttribute('data-rasttext-dir') || css('receipt-outside').fontFamily.includes('CFC Vazirmatn')) throw Error('receipt selector escaped card');
    if(css('design-prompt').direction !== 'rtl' || !['start','right'].includes(css('design-prompt').textAlign)) throw Error('Design prompt not right-aligned');
    if(css('design-english').direction !== 'ltr') throw Error('Design English paragraph not LTR');
    for(const id of ['design-composer','design-prompt','design-english']) {
      if(!css(id).fontFamily.includes('CFC Vazirmatn')) throw Error(id+' font not applied');
    }
    if(css('design-inline-code').direction !== 'ltr' || css('design-inline-code').unicodeBidi !== 'isolate' || !css('design-inline-code').fontFamily.includes('monospace')) throw Error('Design inline code changed');
    for(const id of ['design-composer-shell','design-picker','design-import','design-mic','design-send','design-icon']) {
      if(css(id).fontFamily.includes('CFC Vazirmatn') || css(id).direction !== 'ltr') throw Error(id+' chrome changed');
    }
    if(css('design-icon').fontFamily !== 'fixture-icons') throw Error('Design icon font changed');
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
    if(!css('chat-title').fontFamily.includes('CFC Persian Glyphs')) throw Error('chat-list title font not applied');
    if(css('chat-title').direction !== 'ltr' || css('chat-title').textAlign === 'right') throw Error('chat title host direction/alignment changed');
    if(css('chat-title-container').justifyContent === 'flex-end') throw Error('chat title flex placement changed');
    const title = document.getElementById('chat-title').getBoundingClientRect();
    const container = document.getElementById('chat-title-container').getBoundingClientRect();
    if(Math.abs(title.left - container.left) > 1) throw Error('chat title is not placed at left edge');
    const wordLeft = (id, word) => {
      const node = document.getElementById(id).firstChild;
      const start = node.textContent.indexOf(word);
      if(start < 0) throw Error('missing title word: '+word);
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + word.length);
      return range.getBoundingClientRect().left;
    };
    const assertWordOrder = (id, words) => {
      const positions = words.map(word => wordLeft(id, word));
      if(positions.some((left, i) => i > 0 && left <= positions[i-1])) throw Error(id+' mixed-script word order incorrect');
      const element = document.getElementById(id);
      if(css(id).unicodeBidi !== 'plaintext' || css(id).textAlign !== 'left') throw Error(id+' BiDi/alignment incorrect');
      if(Math.abs(element.getBoundingClientRect().left - element.parentElement.getBoundingClientRect().left) > 1) throw Error(id+' not left-aligned');
    };
    assertWordOrder('chat-title', ['Design', 'system', 'رنگی']);
    assertWordOrder('chat-title-persian', ['رنگی', 'Design', 'system', 'طراحی']);
    assertWordOrder('chat-title-number', ['رنگی', 'API', 'طراحی', '2026']);
    assertWordOrder('chat-title-english', ['Design', 'system', '2026']);
    for(const id of ['chat-time-wrapper','chat-time','chat-options','project-title']) {
      if(css(id).fontFamily.includes('CFC Persian Glyphs') || css(id).direction !== 'ltr') throw Error(id+' was restyled with title');
    }
    if(!css('chat-icon').fontFamily.includes('Anthropicons')) throw Error('chat-list icon font overwritten');
  });
  await verify();
  const setDesignPrompt = async (text) => {
    await page.evaluate((value) => {
      const prompt = document.getElementById('design-prompt');
      const range = document.createRange();
      range.selectNodeContents(prompt);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.getElementById('design-composer').focus();
      if(!value) {
        prompt.replaceChildren(document.createElement('br'));
        prompt.classList.add('is-empty');
        prompt.dispatchEvent(new InputEvent('input', {bubbles:true}));
      } else {
        prompt.classList.remove('is-empty');
      }
    }, text);
    if(text) await page.keyboard.insertText(text);
  };
  await setDesignPrompt('Now write an English prompt');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('design-prompt')).direction === 'ltr');
  await setDesignPrompt('');
  await page.evaluate(() => {
    const prompt = document.getElementById('design-prompt');
    if(prompt.hasAttribute('data-rasttext-dir')) throw Error('empty Design prompt retains direction');
    if(!getComputedStyle(prompt,'::before').fontFamily.includes('CFC Vazirmatn')) throw Error('Design placeholder font not applied');
  });
  await setDesignPrompt('React برای ساخت این صفحه استفاده می‌شود');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('design-prompt')).direction === 'rtl');
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
  await page.evaluate(() => {
    const title = getComputedStyle(document.getElementById('chat-title'));
    if(title.fontFamily.includes('CFC Persian Glyphs') || title.direction !== 'ltr') throw Error('chat-list styling not removed on disable');
    const prompt = getComputedStyle(document.getElementById('design-prompt'));
    if(prompt.fontFamily.includes('CFC Vazirmatn') || prompt.direction !== 'ltr') throw Error('Design composer styling not removed on disable');
    const receipt = getComputedStyle(document.getElementById('receipt-location'));
    if(receipt.fontFamily.includes('CFC Vazirmatn') || receipt.direction !== 'ltr' || receipt.textAlign !== 'left') throw Error('receipt styling not removed on disable');
    if(getComputedStyle(document.getElementById('receipt-label')).unicodeBidi !== 'normal') throw Error('receipt label isolation not removed on disable');
    for(const id of ['chat-title','chat-title-persian','chat-title-number','chat-title-english']) {
      if(getComputedStyle(document.getElementById(id)).unicodeBidi !== 'normal') throw Error('chat-list BiDi not removed on disable');
    }
  });
  await page.evaluate(() => window.changeSettings({fontSettings:{newValue:{enabled:true}}},'local'));
  await page.waitForFunction(() => document.querySelector('#mixed').getAttribute('data-rasttext-dir') === 'rtl');
  await verify();
  return 'PASS: Claude question receipts font+per-answer RTL+label isolation+icon preservation, Design composer font+RTL+typing+placeholder+chrome preservation, mixed lists, English-only items, skill file viewer font+RTL, chat-list titles, inline code isolation, streaming, disable/re-enable, desktop/mobile';
}
