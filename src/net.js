// Internetdan fayl olish.
// Android'da fayllar telefonning o'z vositasi bilan yuklab olinadi va telefonda saqlanadi
// (shunda ochilgan kitob keyin internetsiz ham ochiladi). Kompyuterda oddiy yuklash ishlatiladi.

const cap = () => window.Capacitor;
const FS = () => cap() && cap().Plugins && cap().Plugins.Filesystem;

export function isNative() {
  const c = cap();
  return !!(c && c.isNativePlatform && c.isNativePlatform() && FS());
}

const isRemote = (url) => /^https?:/i.test(url) && !url.startsWith(location.origin);

async function nativeDownload(url, path, onProgress) {
  const fs = FS();
  let handle = null;
  if (onProgress && fs.addListener) {
    try {
      handle = await fs.addListener('progress', (e) => {
        if (e && e.contentLength) onProgress(Math.min(1, e.bytes / e.contentLength));
      });
    } catch (e) { handle = null; }
  }
  try {
    await fs.downloadFile({ url, path, directory: 'DATA', recursive: true, progress: !!onProgress });
  } finally {
    if (handle && handle.remove) handle.remove();
  }
}

async function nativeRead(path) {
  const { uri } = await FS().getUri({ path, directory: 'DATA' });
  const res = await fetch(cap().convertFileSrc(uri));
  if (!res.ok) throw new Error('read ' + res.status);
  return res.arrayBuffer();
}

export async function nativeExists(path) {
  try { const s = await FS().stat({ path, directory: 'DATA' }); return !!s && (s.size === undefined || s.size > 0); } catch (e) { return false; }
}

export async function nativeDelete(path) {
  try { await FS().deleteFile({ path, directory: 'DATA' }); } catch (e) { /* allaqachon yo'q */ }
}

export const bookPath = (id) => `kitoblar/${id.replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;

// Kitobni olish (Android): telefonda bo'lsa — o'sha yerdan, bo'lmasa yuklab olib saqlaydi.
export async function nativeBook(book, onProgress) {
  const path = bookPath(book.id);
  if (!(await nativeExists(path))) {
    if (!isRemote(book.file)) {
      const r = await fetch(book.file);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return { buffer: await r.arrayBuffer(), downloaded: false };
    }
    await nativeDownload(book.file, path, onProgress);
    return { buffer: await nativeRead(path), downloaded: true };
  }
  return { buffer: await nativeRead(path), downloaded: true };
}

// Oddiy yuklash, foizni ko'rsatib (kompyuter va brauzer uchun)
export async function fetchBytes(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const total = +res.headers.get('content-length') || 0;
  if (!res.body || !total || !onProgress) return res.arrayBuffer();
  const reader = res.body.getReader();
  const out = new Uint8Array(total);
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (got + value.length > out.length) { // hajm noto'g'ri ko'rsatilgan bo'lsa
      const big = new Uint8Array(Math.max(out.length * 2, got + value.length));
      big.set(out.subarray(0, got)); return finishGrow(big, got, value, reader, onProgress, total);
    }
    out.set(value, got); got += value.length;
    onProgress(Math.min(1, got / total));
  }
  return out.buffer.slice(0, got);
}

async function finishGrow(buf, got, value, reader, onProgress, total) {
  let b = buf; b.set(value, got); got += value.length;
  for (;;) {
    const { done, value: v } = await reader.read();
    if (done) break;
    if (got + v.length > b.length) { const n = new Uint8Array(b.length * 2); n.set(b.subarray(0, got)); b = n; }
    b.set(v, got); got += v.length;
    onProgress(Math.min(1, got / total));
  }
  return b.buffer.slice(0, got);
}

// JSON olish (katalog). Android'da tashqi manzil telefonning o'z vositasi bilan olinadi.
export async function getJson(url) {
  if (isNative() && isRemote(url)) {
    const path = 'cache/catalog.json';
    await nativeDelete(path);
    await nativeDownload(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), path);
    return JSON.parse(new TextDecoder('utf-8').decode(await nativeRead(path)));
  }
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}
