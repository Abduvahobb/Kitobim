// Kitobim — Windows (kompyuter) versiyasi.
// Veb-ilova kompyuterning o'zida ishlaydigan kichik server orqali (http://localhost) ochiladi:
// SMS orqali kirish (Google reCAPTCHA) faqat shunday manzilda ishlaydi.
// Server faqat shu kompyuterdan ochiladi (127.0.0.1 / ::1), tarmoqqa chiqmaydi.
const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const WEB = path.join(__dirname, 'web');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.wasm': 'application/wasm' };

function handler(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (!p || p === '/') p = '/index.html';
  const file = path.normalize(path.join(WEB, p));
  if (!file.startsWith(WEB)) { res.writeHead(404); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}

// Doimiy port: manzil o'zgarmasa, kompyuterdagi ma'lumotlar (o'qish joyi, sertifikatlar) saqlanib qoladi
function listenOn(port) {
  return new Promise((resolve, reject) => {
    const v4 = http.createServer(handler);
    v4.once('error', reject);
    v4.listen(port, '127.0.0.1', () => {
      const v6 = http.createServer(handler);
      v6.once('error', () => resolve(port)); // IPv6 bo'lmasa ham ishlayveradi
      v6.listen(port, '::1', () => resolve(port));
    });
  });
}
async function startServer() {
  for (let port = 47913; port < 47933; port++) {
    try { return await listenOn(port); } catch (e) { /* band — keyingisi */ }
  }
  throw new Error('port');
}
let PORT = 47913;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    show: false,
    minWidth: 380,
    minHeight: 600,
    title: 'Kitobim',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    backgroundColor: '#F3F6F5',
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  win.setMenu(null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadURL(`http://localhost:${PORT}/index.html`);
  // Tashqi havolalar oddiy brauzerda ochiladi
  const own = (url) => url.startsWith(`http://localhost:${PORT}/`);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url) && !own(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // Telegram kabi tashqi havolalar ilova oynasini almashtirmasdan brauzerda/ilovada ochiladi
  win.webContents.on('will-navigate', (e, url) => {
    if (/^https?:/.test(url) && !own(url)) { e.preventDefault(); shell.openExternal(url); }
  });
}

app.whenReady().then(async () => {
  PORT = await startServer();
  // Kitob fayllari GitHub'dan olinadi; ilova ularni o'qiy olishi uchun ruxsat sarlavhasini qo'shamiz
  // (Google/Firebase manzillariga tegilmaydi — SMS kirish va bulut o'z sarlavhalari bilan ishlaydi)
  const GOOGLE = /(^|\.)(googleapis\.com|google\.com|gstatic\.com|firebaseapp\.com|recaptcha\.net)$/i;
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    let host = '';
    try { host = new URL(details.url).hostname; } catch (e) { /* e'tiborsiz */ }
    if (GOOGLE.test(host) || host === 'localhost') return cb({ responseHeaders: details.responseHeaders });
    const h = Object.assign({}, details.responseHeaders);
    for (const k of Object.keys(h)) if (k.toLowerCase() === 'access-control-allow-origin') delete h[k];
    h['Access-Control-Allow-Origin'] = ['*'];
    cb({ responseHeaders: h });
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
