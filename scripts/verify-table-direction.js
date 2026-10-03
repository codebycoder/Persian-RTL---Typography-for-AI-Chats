async (page) => {
  // Run after pnpm build. All page and font requests are fulfilled locally.
  const rows = [
    ['قیمت فعلی', '✅', '❌'],
    ['درصد تغییر لحظه‌ای', '⚠️ نیاز به قیمت قبلی', '❌'],
    ['Moving Average', '❌', '✅ Close'],
    ['RSI', '❌', '✅ Close'],
    ['MACD', '❌', '✅ Close'],
    ['Bollinger Bands', '❌', '✅ Close'],
    ['ATR', '❌', '✅ OHLC'],
    ['Candlestick Patterns', '❌', '✅ OHLC'],
    ['Support / Resistance', '❌', '✅ OHLC'],
    ['Trend Analysis', '❌', '✅'],
    ['Order Block', '❌', '✅ بسیار مهم'],
    ['Breakout Detection', '❌', '✅'],
    ['Market Structure', '❌', '✅'],
    ['AI Technical Analysis', '❌', '✅'],
    ['Volume Analysis', '❌', '✅ OHLCV'],
  ];
  const table = `<table id="technical" class="Table-LqdUhs" dir="auto">
    <thead><tr class="TableRow-ENsaGm">${['تحلیل', 'قیمت لحظه‌ای کافی؟', 'کندل لازم؟'].map((text, i) =>
      `<th class="TableHeaderCell-esYSpn SingleChildTableCell-Sv7jTC" dir="auto" data-col-size="sm" ${i ? 'align="right"' : ''}><span>${text}</span></th>`
    ).join('')}</tr></thead>
    <tbody class="TableBody-A5sMNL">${rows.map(row => `<tr class="TableRow-ENsaGm">${row.map((text, i) =>
      `<td class="TableCell-WcsygL SingleChildTableCell-Sv7jTC" dir="auto" data-col-size="sm" ${i ? 'align="right"' : ''}><span>${text}</span></td>`
    ).join('')}</tr>`).join('')}</tbody></table>`;
  for (const platform of ['claude', 'chatgpt']) {
    const origin = platform === 'claude' ? 'https://claude.ai' : 'https://chatgpt.com';
    const open = platform === 'claude'
      ? '<div data-testid="transcript-row" data-perf-row="assistant"><div data-cds="Prose" id="response">'
      : '<div data-message-author-role="assistant"><div class="markdown" id="response">';
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body {background:#080808;color:white;font:14px Arial;line-height:1.6;margin:24px}
      main {max-width:780px;margin:auto} table {width:100%;border-collapse:collapse}
      th,td {padding:12px 8px;border-bottom:1px solid #222;font-weight:normal}
      th {border-color:#444} p {margin:0} .scroll {overflow-x:auto}
      </style></head><body><main>${open}<h3>هر نوع تحلیل چه دیتایی می‌خواهد؟</h3>
      <div class="scroll">${table}</div>
      <table id="english" dir="rtl"><thead><tr><th dir="auto">Analysis</th><th dir="auto">Data</th></tr></thead><tbody><tr><td dir="auto"><p>Moving Average</p></td><td dir="auto">قیمت فعلی</td></tr></tbody></table>
      <table id="headerless" dir="ltr"><tbody><tr><td dir="auto">تحلیل</td><td dir="auto">داده</td></tr><tr><td dir="auto">Moving Average</td><td dir="auto">Close</td></tr></tbody></table>
      <table id="neutral" dir="auto"><tbody><tr><td>✅</td><td>❌</td></tr></tbody></table>
      </div></div><table id="outside" dir="ltr"><tbody><tr><td>جدول رابط</td></tr></tbody></table>
      </main><script>window.chrome={runtime:{id:'fixture',onMessage:{addListener(){}},getURL:p=>p},storage:{local:{get:async()=>({})},onChanged:{addListener:f=>window.changeSettings=f,removeListener(){}}}};</script></body></html>`;
    await page.route(origin+'/**', route => {
      const path = new URL(route.request().url()).pathname;
      return path.startsWith('/fonts/')
        ? route.fulfill({path:'dist'+path})
        : route.fulfill({contentType:'text/html',body:html});
    });
    await page.goto(origin+'/fixture');
    await page.setViewportSize({width:900,height:950});
    const hostCellAlignment = await page.evaluate(() => getComputedStyle(document.querySelector('#technical tbody tr').cells[1]).textAlign);
    await page.addScriptTag({path:'dist/content.js'});
    await page.waitForFunction(() => document.getElementById('technical').getAttribute('data-rasttext-dir') === 'rtl');
    await page.evaluate(() => document.fonts.ready);
    const verify = () => page.evaluate(() => {
      const table = document.getElementById('technical');
      const style = element => getComputedStyle(element);
      const headers = [...table.querySelectorAll('th')];
      if(style(table).direction !== 'rtl') throw Error('Persian table not RTL');
      if(headers.some((cell, i) => i > 0 && cell.getBoundingClientRect().left >= headers[i-1].getBoundingClientRect().left)) throw Error('column order not RTL');
      for(const row of table.querySelectorAll('tbody tr')) {
        [...row.cells].forEach((cell, i) => {
          if(Math.abs(cell.getBoundingClientRect().left - headers[i].getBoundingClientRect().left) > 1) throw Error('header/body column mismatch');
          if(style(cell).textAlign !== 'right') throw Error('cell not aligned with RTL header: '+cell.textContent);
          const range = document.createRange();
          range.selectNodeContents(cell.firstElementChild);
          const expectedRight = cell.getBoundingClientRect().right - parseFloat(style(cell).paddingRight);
          if(Math.abs(range.getBoundingClientRect().right - expectedRight) > 2) throw Error('cell text/emoji misplaced: '+cell.textContent);
          if(cell.getAttribute('dir') !== 'auto') throw Error('host cell dir rewritten');
        });
      }
      for(const header of headers) if(style(header).textAlign !== 'right') throw Error('header alignment wrong');
      const englishCell = table.querySelectorAll('tbody tr')[2].cells[0];
      if(style(englishCell).direction !== 'ltr') throw Error('English cell direction changed');
      if(style(table.querySelector('tbody tr').cells[1]).direction !== 'rtl') throw Error('neutral emoji does not inherit table direction');
      if(style(document.getElementById('english')).direction !== 'ltr') throw Error('English headers do not determine LTR table');
      if(style(document.querySelector('#english td p')).textAlign !== 'left') throw Error('nested paragraph not aligned with column');
      if(style(document.getElementById('headerless')).direction !== 'rtl') throw Error('headerless first row not used');
      if(document.getElementById('neutral').hasAttribute('data-rasttext-dir')) throw Error('neutral table forced');
      if(document.querySelector('#outside[data-rasttext-dir], #outside [data-rasttext-dir]')) throw Error('UI table modified');
      if(table.getAttribute('dir') !== 'auto') throw Error('host table dir rewritten');
    });
    await verify();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({path:`output/playwright/${platform}-table-rtl-desktop.png`});
    await page.setViewportSize({width:390,height:844});
    await verify();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({path:`output/playwright/${platform}-table-rtl-mobile.png`});
    // Header streaming must update column layout, including childList removal.
    await page.evaluate(() => {
      document.querySelectorAll('#technical th').forEach((header, i) => { header.firstChild.textContent = ['Analysis', 'Current price enough?', 'Candles needed?'][i]; });
    });
    await page.waitForFunction(() => getComputedStyle(document.getElementById('technical')).direction === 'ltr');
    await page.evaluate(() => { document.querySelector('#technical thead').remove(); });
    await page.waitForFunction(() => getComputedStyle(document.getElementById('technical')).direction === 'rtl');
    await page.evaluate(() => window.changeSettings({fontSettings:{newValue:{enabled:false}}},'local'));
    await page.waitForFunction(() => !document.querySelector('[data-rasttext-dir]'));
    await page.evaluate((hostAlignment) => {
      if(document.getElementById('technical').getAttribute('dir') !== 'auto') throw Error('disable changed host attributes');
      if(getComputedStyle(document.querySelector('#technical tbody tr').cells[1]).textAlign !== hostAlignment) throw Error('host alignment not restored');
    }, hostCellAlignment);
    await page.evaluate(() => window.changeSettings({fontSettings:{newValue:{enabled:true}}},'local'));
    await page.waitForFunction(() => document.getElementById('technical').getAttribute('data-rasttext-dir') === 'rtl');
    await page.unroute(origin+'/**');
  }
  return 'PASS: Claude + ChatGPT RTL column order, header/body alignment, mixed cells, emoji placement, English/headerless/neutral tables, streaming, host attributes, desktop/mobile, disable/re-enable';
}
