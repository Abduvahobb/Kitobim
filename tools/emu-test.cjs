// Android emulyatorida ilovani ochib, kitoblarni sinash (WebView DevTools orqali).
const { chromium } = require('playwright-core');
const ids = process.argv.slice(2);
(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = b.contexts()[0];
  const p = ctx.pages()[0];
  const logs = [];
  p.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`.slice(0, 300)));
  p.on('pageerror', (e) => logs.push('[pageerror] ' + String(e).slice(0, 300)));
  console.log('url:', p.url());
  await p.evaluate(() => { location.hash = '#/login'; });
  await p.waitForTimeout(3000);
  if (await p.$('#nm')) {
    await p.fill('#nm', 'Sinov Oquvchi'); await p.fill('#pw', 'sinov1234');
    await p.click('.grade[data-g="5"]'); await p.click('form [type=submit]');
    await p.waitForTimeout(4000);
  }
  for (const id of ids) {
    logs.length = 0;
    await p.evaluate((i) => { location.hash = '#/read/' + i; }, id);
    const t0 = Date.now(); let st = '';
    while (Date.now() - t0 < 240000) {
      await p.waitForTimeout(3000);
      st = await p.evaluate(() => {
        const c = [...document.querySelectorAll('canvas')].filter((x) => x.width > 50).length;
        const m = document.querySelector('.reader-msg');
        return (c ? 'OCHILDI ' : '') + (m ? m.innerText.replace(/\s+/g, ' ') : '');
      });
      if (st.startsWith('OCHILDI') || /bo.lmadi/.test(st)) break;
    }
    console.log(`== ${id} (${Math.round((Date.now() - t0) / 1000)}s): ${st}`);
    for (const l of logs.slice(-12)) console.log('   ', l);
    await p.screenshot({ path: `emu-${id}.png` }).catch(() => {});
    await p.evaluate(() => { location.hash = '#/home'; });
    await p.waitForTimeout(1500);
  }
  await b.close();
})().catch((e) => { console.error('XATO', e); process.exit(1); });
