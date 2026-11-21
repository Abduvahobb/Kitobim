// Android emulyatorida ilovani ochib, kitoblarni sinash (WebView DevTools, to'g'ridan-to'g'ri CDP).
const WebSocket = require('ws');
const fs = require('fs');
const ids = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const tgt = list.find((t) => t.type === 'page') || list[0];
  console.log('target:', tgt.url);
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
  let id = 0; const pend = new Map(); const logs = [];
  ws.on('message', (m) => {
    const d = JSON.parse(m);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.consoleAPICalled') logs.push(`[${d.params.type}] ` + d.params.args.map((a) => a.value !== undefined ? a.value : (a.description || a.type)).join(' ').slice(0, 300));
    if (d.method === 'Runtime.exceptionThrown') logs.push('[exc] ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300));
  });
  const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : r; };
  await cmd('Runtime.enable');
  console.log('isNative:', await ev('!!(window.Capacitor && Capacitor.isNativePlatform() && Capacitor.Plugins.Filesystem)'));
  await ev(`location.hash = '#/login'`); await sleep(3000);
  const login = await ev(`(async () => {
    const nm = document.querySelector('#nm'); if (!nm) return 'login yo\\'q: ' + location.hash;
    const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(nm, 'Sinov Oquvchi'); set(document.querySelector('#pw'), 'sinov1234');
    document.querySelector('.grade[data-g="5"]').click();
    document.querySelector('form [type=submit]').click();
    await new Promise((r) => setTimeout(r, 4000)); return 'ok ' + location.hash; })()`);
  console.log('login:', login);
  for (const b of ids) {
    logs.length = 0;
    await ev(`location.hash = '#/read/${b}'`);
    const t0 = Date.now(); let st = '';
    while (Date.now() - t0 < 240000) {
      await sleep(3000);
      st = await ev(`(() => { const c = [...document.querySelectorAll('canvas')].filter((x) => x.width > 50).length;
        const m = document.querySelector('.reader-msg'); return (c ? 'OCHILDI ' : '') + (m ? m.innerText.replace(/\\s+/g, ' ') : ''); })()`);
      if (String(st).startsWith('OCHILDI') || /bo.lmadi/.test(st)) break;
    }
    console.log(`== ${b} (${Math.round((Date.now() - t0) / 1000)}s): ${st}`);
    for (const l of logs.slice(-15)) console.log('   ', l);
    const shot = await cmd('Page.captureScreenshot', { format: 'png' });
    if (shot.result) fs.writeFileSync(`emu-${b}.png`, Buffer.from(shot.result.data, 'base64'));
    await ev(`location.hash = '#/home'`); await sleep(1500);
  }
  ws.close();
})().catch((e) => { console.error('XATO', e); process.exit(1); });
