// Android emulyatorida ilovani ochib, kitoblarni sinash (WebView DevTools, to'g'ridan-to'g'ri CDP).
const WebSocket = require('ws');
const fs = require('fs');
let ids = process.argv.slice(2);
const { execSync } = require('child_process');
const ALL = ids[0] === 'ALL' || /^ALL:\d+$/.test(ids[0] || '');
const LIMIT = /^ALL:(\d+)$/.test(ids[0] || '') ? +ids[0].slice(4) : 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let ws, id = 0; const pend = new Map(); const logs = [];
  async function connect() {
    for (let k = 0; k < 20; k++) {
      try {
        const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
        const tgt = list.find((t) => t.type === 'page' && /localhost/.test(t.url)) || list.find((t) => t.type === 'page');
        if (!tgt) throw new Error('page yo\'q');
        ws = new WebSocket(tgt.webSocketDebuggerUrl);
        await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
        ws.on('message', (m) => {
          const d = JSON.parse(m);
          if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
          if (d.method === 'Runtime.consoleAPICalled') logs.push(`[${d.params.type}] ` + d.params.args.map((a) => a.value !== undefined ? a.value : (a.description || a.type)).join(' ').slice(0, 300));
          if (d.method === 'Runtime.exceptionThrown') logs.push('[exc] ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300));
        });
        ws.on('close', () => { console.log('   (DevTools ulanishi uzildi)'); for (const [, r] of pend) r({ closed: true }); pend.clear(); });
        console.log('target:', tgt.url);
        await new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: 'Runtime.enable' })); });
        return;
      } catch (e) { console.log('   ulanish:', e.message); await sleep(3000); }
    }
    throw new Error('DevTools ga ulanib bo\'lmadi');
  }
  await connect();
  const keep = setInterval(() => {}, 1 << 30); // jarayon jim chiqib ketmasin
  const cmd = async (method, params = {}) => {
    if (!ws || ws.readyState !== 1) await connect();
    return new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); r({ timeout: true }); } }, 60000); });
  };
  const ev = async (expr) => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : r; };
  console.log('UA:', await ev('navigator.userAgent'));
  await ev(`location.hash = '#/login'`); await sleep(3000);
  const login = await ev(`(async () => {
    const nm = document.querySelector('#nm'); if (!nm) return 'login yo\\'q: ' + location.hash;
    const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(nm, 'Sinov Oquvchi'); set(document.querySelector('#pw'), 'sinov1234');
    document.querySelector('.grade[data-g="5"]').click();
    document.querySelector('form [type=submit]').click();
    await new Promise((r) => setTimeout(r, 4000)); return 'ok ' + location.hash; })()`);
  console.log('login:', login);
  if (ALL) {
    ids = await ev(`fetch('catalog.json').then(r => r.json()).then(c => c.grades.flatMap(g => g.subjects.flatMap(s => s.books.map(b => b.id))))`);
    if (LIMIT) ids = ids.slice(0, LIMIT);
    console.log('jami kitob:', ids.length);
  }
  const bad = [];
  for (const b of ids) {
    logs.length = 0;
    await ev(`location.hash = '#/read/${b}'`);
    const t0 = Date.now(); let st = '';
    while (Date.now() - t0 < (ALL ? 180000 : 240000)) {
      await sleep(3000);
      st = await ev(`(() => { const c = [...document.querySelectorAll('canvas')].filter((x) => x.width > 50).length;
        const m = document.querySelector('.reader-msg'); return (c ? 'OCHILDI ' : '') + (m ? m.innerText.replace(/\\s+/g, ' ') : ''); })()`);
      if (String(st).startsWith('OCHILDI') || /bo.lmadi/.test(st)) break;
    }
    let mem = '';
    try {
      const h = await cmd('Runtime.getHeapUsage');
      const rss = execSync('adb shell ps -A -o RSS,NAME', { timeout: 15000 }).toString().split('\n')
        .filter((l) => /sandboxed|uz\.kitobim/.test(l)).map((l) => Math.round(parseInt(l.trim(), 10) / 1024)).join('+');
      mem = ` [heap ${h.result ? Math.round(h.result.usedSize / 1048576) : '?'}MB, rss ${rss}MB]`;
    } catch (e) { mem = ' [mem ?]'; }
    console.log(`== ${b} (${Math.round((Date.now() - t0) / 1000)}s)${mem}: ${st}`);
    if (!String(st).startsWith('OCHILDI')) { bad.push(b); for (const l of logs.filter((x) => !/Group|\[dir\]|console\.group/.test(x)).slice(-8)) console.log('   ', l); }
    if (ALL) { try { execSync(`adb shell "run-as uz.kitobim.app sh -c 'rm -f files/kitoblar/*'" < /dev/null`, { stdio: 'ignore', timeout: 20000 }); } catch (e) { /* */ } }
    await ev(`location.hash = '#/home'`); await sleep(1500);
  }
  console.log('OCHILMAGAN:', bad.length, bad.join(' '));
  clearInterval(keep);
  ws.close();
})().catch((e) => { console.error('XATO', e); process.exit(1); });
