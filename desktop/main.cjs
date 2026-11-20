// Kitobim — Windows (kompyuter) versiyasi.
// Veb-ilova "app://" manzili orqali ochiladi, shunda kitob fayllari va
// katalog xuddi telefondagidek yuklanadi.
const { app, BrowserWindow, protocol, net, shell, session } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const WEB = path.join(__dirname, 'web');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

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
  win.loadURL('app://kitobim/index.html');
  // Tashqi havolalar oddiy brauzerda ochiladi
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // Telegram kabi tashqi havolalar ilova oynasini almashtirmasdan brauzerda/ilovada ochiladi
  win.webContents.on('will-navigate', (e, url) => {
    if (/^https?:/.test(url)) { e.preventDefault(); shell.openExternal(url); }
  });
}

app.whenReady().then(() => {
  // Kitob fayllari GitHub'dan olinadi; ilova ularni o'qiy olishi uchun ruxsat sarlavhasini qo'shamiz
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    const h = Object.assign({}, details.responseHeaders);
    for (const k of Object.keys(h)) if (k.toLowerCase() === 'access-control-allow-origin') delete h[k];
    h['Access-Control-Allow-Origin'] = ['*'];
    cb({ responseHeaders: h });
  });
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    let p = decodeURIComponent(u.pathname);
    if (!p || p === '/') p = '/index.html';
    const file = path.normalize(path.join(WEB, p));
    if (!file.startsWith(WEB)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
