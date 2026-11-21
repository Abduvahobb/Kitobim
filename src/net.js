// Internetdan fayl olish.
// Android'da fayllar telefonning o'z vositasi bilan yuklab olinadi va telefonda saqlanadi
// (shunda ochilgan kitob keyin internetsiz ham ochiladi). Kompyuterda oddiy yuklash ishlatiladi.

import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';

// Eslatma: plaginlar @capacitor/core orqali ro'yxatdan o'tkaziladi. window.Capacitor.Plugins
// Capacitor 6 da bo'sh bo'ladi — shuning uchun avval telefon yo'li umuman ishlamay, kitoblar
// brauzer usulida (GitHub'dan CORS sababli "Failed to fetch") yuklanardi.
const cap = () => Capacitor;
const FS = () => Filesystem;

export function isNative() {
  try { return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Filesystem'); } catch (e) { return false; }
}

// downloadFile papkani o'zi yaratmaydi. Har safar tekshiramiz: papka o'chirilgan bo'lishi mumkin
// (masalan, "yuklanganlarni tozalash" yoki telefon xotirasini tozalash).
async function ensureDir(path) {
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  if (!dir) return;
  try { await Filesystem.stat({ path: dir, directory: 'DATA' }); return; } catch (e) { /* yo'q */ }
  try { await Filesystem.mkdir({ path: dir, directory: 'DATA', recursive: true }); } catch (e) { /* allaqachon bor */ }
}

const isRemote = (url) => /^https?:/i.test(url) && !url.startsWith(location.origin);

async function nativeDownload(url, path, onProgress, quick) {
  const fs = FS();
  let handle = null;
  if (onProgress && fs.addListener) {
    try {
      handle = await fs.addListener('progress', (e) => {
        if (e && e.contentLength && (!e.url || e.url === url)) onProgress(Math.min(1, e.bytes / e.contentLength));
      });
    } catch (e) { handle = null; }
  }
  await ensureDir(path);
  try {
    const opts = { url, path, directory: 'DATA', recursive: true, progress: !!onProgress };
    // Asosiy server javob bermasa, uzoq kutmasdan zaxira serverga o'tamiz
    if (quick) { opts.connectTimeout = 10000; opts.readTimeout = 20000; }
    await fs.downloadFile(opts);
  } finally {
    if (handle && handle.remove) handle.remove();
  }
}

// Kitob manzillari: avval O'zbekistondagi server (src), keyin GitHub'dagi zaxira (file)
export function bookUrls(book) {
  return [book.src, book.file].filter((u, i, a) => u && a.indexOf(u) === i);
}

async function nativeRead(path) {
  const { uri } = await FS().getUri({ path, directory: 'DATA' });
  const res = await fetch(cap().convertFileSrc(uri));
  if (!res.ok) throw new Error('read ' + res.status);
  return res.arrayBuffer();
}

// Faylning faqat boshini o'qib, PDF ekanini tekshiradi (butun faylni xotiraga olmaydi)
async function nativeLooksPdf(path) {
  try {
    const { uri } = await FS().getUri({ path, directory: 'DATA' });
    const res = await fetch(cap().convertFileSrc(uri));
    if (!res.body) return isPdf(await res.arrayBuffer());
    const rd = res.body.getReader();
    const { value } = await rd.read();
    try { rd.cancel(); } catch (e) { /* e'tiborsiz */ }
    return !!value && value.length >= 5 && String.fromCharCode(...value.subarray(0, 5)) === '%PDF-';
  } catch (e) { return true; } // tekshirib bo'lmasa, PDF o'quvchining o'zi aniqlaydi
}

// Fayl oxirida %%EOF bormi (yuklash yarmida uzilib qolmaganmi). Tekshirib bo'lmasa — true.
async function nativeLooksComplete(path, n) {
  try {
    const { uri } = await FS().getUri({ path, directory: 'DATA' });
    const res = await fetch(cap().convertFileSrc(uri), { headers: { Range: `bytes=${Math.max(0, n - 4096)}-${n - 1}` } });
    if (res.status !== 206) return true;
    const tail = new Uint8Array(await res.arrayBuffer());
    let txt = '';
    for (let i = 0; i < tail.length; i++) txt += String.fromCharCode(tail[i]);
    return txt.includes('%%EOF');
  } catch (e) { return true; }
}

// Faylni Filesystem orqali to'liq o'qish (WebView ichki serveri ishlamasa — zaxira yo'l)
export async function nativeReadAll(path) {
  const r = await FS().readFile({ path, directory: 'DATA' });
  const b64 = typeof r.data === 'string' ? r.data : '';
  if (!b64) throw new Error('fayl o\'qilmadi');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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
  if (await nativeExists(path)) {
    const buffer = await nativeRead(path);
    if (isPdf(buffer)) return { buffer, downloaded: true };
    await nativeDelete(path); // buzilgan fayl — qayta yuklaymiz
  }
  if (!isRemote(book.file)) {
    const r = await fetch(book.file);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return { buffer: await r.arrayBuffer(), downloaded: false };
  }
  const urls = bookUrls(book);
  let lastErr = null;
  for (let i = 0; i < urls.length; i++) {
    try {
      await nativeDownload(urls[i], path, onProgress, i < urls.length - 1);
      const buffer = await nativeRead(path);
      if (!isPdf(buffer)) throw new Error('PDF emas');
      return { buffer, downloaded: true };
    } catch (e) {
      lastErr = e;
      await nativeDelete(path);
    }
  }
  throw lastErr || new Error('download failed');
}

// Kitobni ochish uchun (Android): faylni xotiraga to'liq o'qimaydi — PDF o'quvchiga telefondagi faylning
// manzilini beradi, u sahifalarni kerak bo'lganda o'qiydi. Shunda 100–300 MB lik kitoblar ham ochiladi.
export async function nativeBookUrl(book, onProgress, opts = {}) {
  const path = bookPath(book.id);
  const had = await nativeExists(path);
  const size = await nativeEnsure(book, onProgress, opts);
  const { uri } = await FS().getUri({ path, directory: 'DATA' });
  return { url: cap().convertFileSrc(uri), size, downloaded: !had, path };
}

// Butun sinfni yuklashda (Android): kitobni xotiraga o'qimasdan faqat telefonga yuklab qo'yadi.
// Qaytaradi: fayl hajmi (bayt).
export async function nativeEnsure(book, onProgress, opts = {}) {
  const path = bookPath(book.id);
  const size = async () => { try { return (await FS().stat({ path, directory: 'DATA' })).size || 0; } catch (e) { return 0; } };
  let n = await size();
  if (n > 20000) return n;
  if (n) await nativeDelete(path);
  let urls = bookUrls(book);
  // Qayta urinishda manzillar tartibi teskari: avvalgi server chala fayl bergan bo'lishi mumkin
  if (opts.reverse) urls = urls.slice().reverse();
  let lastErr = null;
  for (let i = 0; i < urls.length; i++) {
    try {
      await nativeDownload(urls[i], path, onProgress, i < urls.length - 1);
      n = await size();
      // Juda kichik fayl yoki PDF bo'lmagan javob (server xato sahifasi) — keyingi manzilga o'tamiz
      if (n > 20000 && await nativeLooksPdf(path)) {
        if (await nativeLooksComplete(path, n)) return n;
        throw new Error('chala yuklandi');
      }
      throw new Error('PDF emas');
    } catch (e) {
      lastErr = e;
      await nativeDelete(path);
    }
  }
  throw lastErr || new Error('download failed');
}

function isPdf(buf) {
  const b = new Uint8Array(buf, 0, Math.min(5, buf.byteLength));
  return b.length === 5 && String.fromCharCode(...b) === '%PDF-';
}

// Bir nechta manzildan navbat bilan urinib ko'rish (kompyuter va brauzer uchun)
export async function fetchBook(book, onProgress) {
  const urls = bookUrls(book);
  let lastErr = null;
  for (let i = 0; i < urls.length; i++) {
    try {
      const buf = await fetchBytes(urls[i], onProgress, i < urls.length - 1 ? 10000 : 0);
      if (!isPdf(buf)) throw new Error('PDF emas');
      return buf;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('download failed');
}

// Oddiy yuklash, foizni ko'rsatib. firstByteMs — server shuncha vaqtda javob bermasa, voz kechiladi.
export async function fetchBytes(url, onProgress, firstByteMs = 0) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = firstByteMs && ctl ? setTimeout(() => ctl.abort(), firstByteMs) : null;
  let res;
  try { res = await fetch(url, ctl ? { signal: ctl.signal } : undefined); } finally { if (timer) clearTimeout(timer); }
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
