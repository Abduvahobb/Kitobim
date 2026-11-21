// PDF o'quvchi: kitob sahifalarini asl holida (rasm, jadval, bet raqamlari bilan) ko'rsatadi.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';
import { store } from './store.js';
import { I } from './icons.js';
import { isNative, nativeBook, nativeBookUrl, nativeDelete, nativeEnsure, nativeReadAll, bookPath, fetchBook as netFetchBook } from './net.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Kitob faylini olib kelish: avval qurilmadagi nusxadan, bo'lmasa internetdan.
export async function fetchBook(book, onProgress) {
  if (isNative()) {
    const r = await nativeBook(book, onProgress);
    if (r.downloaded && !store.isSaved(book.id)) {
      store.markSaved(book.id, { title: book.title, color: book.color, size: r.buffer.byteLength });
    }
    return r.buffer;
  }
  const local = await store.loadFile(book.id);
  if (local) return local;
  return netFetchBook(book, onProgress);
}

// Kitobni qurilmaga saqlab qo'yish (ochmasdan) — "butun sinfni yuklab olish" uchun
export async function ensureSaved(book, onProgress) {
  if (book.bundled) return; // ilova ichida bor
  if (isNative()) {
    const size = await nativeEnsure(book, onProgress);
    store.markSaved(book.id, { title: book.title, color: book.color, size });
    return;
  }
  if (store.isSaved(book.id)) return;
  const buf = await netFetchBook(book, onProgress);
  await store.saveFile(book.id, { title: book.title, color: book.color }, buf);
}

export function openReader(root, book, title, t, onClose, toast) {
  let pdf = null;
  let page = (store.progress(book.id) && store.progress(book.id).page) || 1;
  let zoom = 1;          // 1 = ekran kengligiga moslangan
  let buffer = null;
  let renderTask = null;
  let closed = false;

  root.innerHTML = `
  <div class="reader" role="dialog" aria-label="${esc(title)}">
    <div class="reader-top">
      <button class="icon-btn" data-r="close" aria-label="${t.back}">${I.back()}</button>
      <div class="ttl"><b>${esc(title)}</b><span data-r="count">${t.loading}</span></div>
      <button class="icon-btn" data-r="save" aria-label="${t.saveOffline}">${I.download()}</button>
    </div>
    <div class="pages" data-r="pages"><div class="reader-msg"><div class="spin"></div>${t.loading}</div></div>
    <div class="reader-bot">
      <button class="icon-btn" data-r="zout" aria-label="${t.zoomOut}">${I.minus()}</button>
      <button class="icon-btn" data-r="zin" aria-label="${t.zoomIn}">${I.plus()}</button>
      <div class="pg">
        <button class="icon-btn" data-r="prev" aria-label="${t.prev}">${I.left()}</button>
        <label class="sr" for="pgInput">${t.goToPage}</label>
        <input id="pgInput" data-r="pg" type="number" inputmode="numeric" min="1" value="${page}">
        <span data-r="total">/ …</span>
        <button class="icon-btn" data-r="next" aria-label="${t.next}">${I.right()}</button>
      </div>
      <button class="icon-btn" data-r="fit" aria-label="${t.fit}">${I.fit()}</button>
    </div>
  </div>`;

  const $ = (k) => root.querySelector(`[data-r="${k}"]`);
  const isSavedHere = () => store.isSaved(book.id) || !!book.bundled;
  const pagesEl = $('pages');

  function updateSaveBtn() {
    const b = $('save');
    if (!b) return;
    const saved = isSavedHere();
    b.style.color = saved ? '#0F7A64' : '';
    b.setAttribute('aria-label', saved ? t.savedOffline : t.saveOffline);
    b.title = saved ? t.savedOffline : t.saveOffline;
  }
  updateSaveBtn();

  let tries = 0;
  // Telefondagi faylni ochish: 1) bo'laklab o'qish, 2) butun faylni bir martada, 3) fayl tizimi orqali
  async function openLocal(r) {
    let last;
    try { return await pdfjsLib.getDocument({ url: r.url, rangeChunkSize: 1 << 20 }).promise; } catch (e) { last = e; console.warn('range', e); }
    if (closed) throw last;
    try { return await pdfjsLib.getDocument({ url: r.url, disableRange: true, disableStream: true }).promise; } catch (e) { last = e; console.warn('full', e); }
    if (closed) throw last;
    const data = await nativeReadAll(r.path);
    return await pdfjsLib.getDocument({ data }).promise;
  }

  async function load() {
    pagesEl.innerHTML = `<div class="reader-msg"><div class="spin"></div><span data-r="pct">${t.loading}</span></div>`;
    try {
      const prog = (f) => {
        const el = $('pct');
        if (el) el.textContent = `${t.loading} ${Math.round(f * 100)}%`;
      };
      if (book.bundled) {
        // Ilova ichidagi kitob: yuklab olish shart emas
        pdf = await pdfjsLib.getDocument({ url: book.bundled, rangeChunkSize: 1 << 20 }).promise;
      } else if (isNative()) {
        // Telefonda: fayl xotiraga to'liq yuklanmaydi (katta kitoblar ham ochiladi)
        const r = await nativeBookUrl(book, prog, { reverse: tries % 2 === 1 });
        if (!store.isSaved(book.id)) store.markSaved(book.id, { title: book.title, color: book.color, size: r.size });
        updateSaveBtn();
        try {
          pdf = await openLocal(r);
        } catch (err) {
          // Buzilgan yoki chala yuklangan fayl — o'chirib, bir marta boshqa serverdan qayta yuklaymiz
          await nativeDelete(r.path);
          store.removeFile && await store.removeFile(book.id);
          const r2 = await nativeBookUrl(book, prog, { reverse: true });
          store.markSaved(book.id, { title: book.title, color: book.color, size: r2.size });
          pdf = await openLocal(r2);
        }
      } else {
        buffer = await fetchBook(book, prog);
        updateSaveBtn();
        pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
      }
      if (closed) return;
      if (page > pdf.numPages) page = 1;
      $('total').textContent = '/ ' + pdf.numPages;
      $('pg').max = pdf.numPages;
      pagesEl.innerHTML = '<div class="stage"><canvas></canvas></div>';
      await render();
    } catch (e) {
      console.error(e);
      // Ochilmagan fayl telefonda qolib ketmasin: keyingi urinishda qaytadan yuklanadi
      if (isNative() && !book.bundled) { try { await nativeDelete(bookPath(book.id)); } catch (x) { /* */ } }
      const why = String((e && (e.message || e.name)) || e || '').slice(0, 120);
      pagesEl.innerHTML = `<div class="reader-msg"><p>${t.loadError}</p><button class="btn" style="max-width:220px" data-r="retry">${t.retry}</button><small style="opacity:.55;margin-top:10px;font-size:11px;word-break:break-all">${why.replace(/[<>&]/g, '')}</small></div>`;
      $('retry').onclick = () => { tries++; load(); };
    }
  }

  async function render() {
    if (!pdf || closed) return;
    const p = await pdf.getPage(page);
    const base = p.getViewport({ scale: 1 });
    // Telefonda bet ekran kengligiga, kompyuterda butun bet ekranga sig'adigan qilib ko'rsatiladi
    const availW = Math.max(200, pagesEl.clientWidth - 24);
    const availH = Math.max(200, pagesEl.clientHeight - 24);
    const fitW = availW / base.width;
    const fit = pagesEl.clientWidth > 700 ? Math.min(fitW, availH / base.height) : fitW;
    const cssScale = fit * zoom;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const vp = p.getViewport({ scale: cssScale * dpr });
    const canvas = pagesEl.querySelector('canvas');
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.style.width = Math.floor(vp.width / dpr) + 'px';
    canvas.style.height = Math.floor(vp.height / dpr) + 'px';
    if (renderTask) { try { renderTask.cancel(); } catch (e) { /* */ } }
    renderTask = p.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
    try { await renderTask.promise; } catch (e) { return; }
    $('pg').value = page;
    $('count').textContent = `${page} / ${pdf.numPages}`;
    store.setProgress(book.id, { page, pages: pdf.numPages, title: book.title, color: book.color });
  }

  function go(n) {
    if (!pdf) return;
    const np = Math.min(pdf.numPages, Math.max(1, n));
    if (np === page) return;
    page = np;
    pagesEl.scrollTop = 0;
    render();
  }
  function setZoom(z) { zoom = Math.min(4, Math.max(1, z)); render(); }

  $('close').onclick = () => { closed = true; onClose(); };
  $('prev').onclick = () => go(page - 1);
  $('next').onclick = () => go(page + 1);
  $('zin').onclick = () => setZoom(zoom + 0.5);
  $('zout').onclick = () => setZoom(zoom - 0.5);
  $('fit').onclick = () => setZoom(1);
  $('pg').onchange = (e) => go(parseInt(e.target.value, 10) || 1);
  $('save').onclick = async () => {
    if (isSavedHere()) { toast(t.savedOffline); return; }
    try {
      if (!buffer) buffer = await fetchBook(book);
      await store.saveFile(book.id, { title: book.title, color: book.color }, buffer.slice(0));
      updateSaveBtn();
      toast(t.savedOffline);
    } catch (e) { toast(t.loadError); }
  };

  // Barmoq bilan surish (sahifa almashtirish), ikki barmoq bilan kattalashtirish,
  // ikki marta bosish bilan tez kattalashtirish.
  let sx = 0, sy = 0, st = 0, pinch0 = 0, lastTap = 0;
  pagesEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinch0 = dist(e.touches);
    } else if (e.touches.length === 1) {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    }
  }, { passive: true });
  pagesEl.addEventListener('touchend', (e) => {
    if (pinch0 && e.touches.length < 2) { pinch0 = 0; return; }
    if (e.changedTouches.length !== 1 || e.touches.length) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    const dt = Date.now() - st;
    if (zoom === 1 && dt < 500 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(dx < 0 ? page + 1 : page - 1);
      return;
    }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 250) {
      const now = Date.now();
      if (now - lastTap < 300) { setZoom(zoom > 1 ? 1 : 2); lastTap = 0; } else lastTap = now;
    }
  }, { passive: true });
  pagesEl.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinch0) {
      const d = dist(e.touches);
      const ratio = d / pinch0;
      if (ratio > 1.25 || ratio < 0.8) { pinch0 = d; setZoom(zoom * (ratio > 1 ? 1.25 : 0.8)); }
    }
  }, { passive: true });

  // Kompyuterda klaviatura bilan boshqarish
  const onKey = (e) => {
    if (closed) { window.removeEventListener('keydown', onKey); return; }
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') go(page + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(page - 1);
    else if (e.key === '+' || e.key === '=') setZoom(zoom + 0.5);
    else if (e.key === '-') setZoom(zoom - 0.5);
  };
  window.addEventListener('keydown', onKey);
  const onResize = () => { if (!closed) render(); else window.removeEventListener('resize', onResize); };
  window.addEventListener('resize', onResize);

  load();
  return () => { closed = true; window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
}

function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
export function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
