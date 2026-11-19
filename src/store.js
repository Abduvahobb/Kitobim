// Foydalanuvchi ma'lumotlari va o'qish holati telefonning o'zida saqlanadi.
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { isNative, nativeDelete, bookPath } from './net.js';

const KEY = 'kitobim:v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* xotira yopiq bo'lsa ham ilova ishlayveradi */ }
  return {};
}

const data = Object.assign(
  { lang: 'uz', user: null, progress: {}, certs: [], saved: {}, audio: {} },
  load()
);

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* e'tiborsiz */ }
}

export const store = {
  get lang() { return data.lang; },
  setLang(l) { data.lang = l; persist(); },

  get user() { return data.user; },
  setUser(u) { data.user = u; persist(); },
  logout() { data.user = null; persist(); },

  // O'qish joyi: har bir kitob uchun oxirgi ochilgan bet
  progress(id) { return data.progress[id]; },
  setProgress(id, info) {
    data.progress[id] = Object.assign({}, data.progress[id], info, { at: Date.now() });
    persist();
  },
  recent() {
    return Object.entries(data.progress)
      .map(([id, p]) => Object.assign({ id }, p))
      .sort((a, b) => b.at - a.at);
  },

  get certs() { return data.certs; },
  addCert(c) { data.certs.unshift(c); persist(); },
  cert(id) { return data.certs.find((c) => c.id === id); },

  audioPos(id) { return data.audio[id] || 0; },
  setAudioPos(id, t) { data.audio[id] = t; persist(); },

  // Oflayn saqlangan kitoblar: faylning o'zi IndexedDB'da, ro'yxat esa shu yerda
  isSaved(id) { return !!data.saved[id]; },
  savedList() { return Object.entries(data.saved).map(([id, s]) => Object.assign({ id }, s)); },
  async saveFile(id, meta, buffer) {
    await idbSet('file:' + id, buffer);
    data.saved[id] = Object.assign({}, meta, { size: buffer.byteLength, at: Date.now() });
    persist();
  },
  async loadFile(id) {
    if (!data.saved[id]) return null;
    try { return (await idbGet('file:' + id)) || null; } catch (e) { return null; }
  },
  // Android: fayl telefon xotirasiga yozilgan, bu yerda faqat belgilanadi
  markSaved(id, meta) {
    data.saved[id] = Object.assign({}, data.saved[id], meta, { at: Date.now() });
    persist();
  },
  async removeFile(id) {
    if (isNative()) await nativeDelete(bookPath(id));
    try { await idbDel('file:' + id); } catch (e) { /* e'tiborsiz */ }
    delete data.saved[id];
    persist();
  },

  // Oxirgi olingan katalog (internet bo'lmaganda ishlatiladi)
  cachedCatalog() {
    try { const c = localStorage.getItem(KEY + ':catalog'); return c ? JSON.parse(c) : null; } catch (e) { return null; }
  },
  setCachedCatalog(c) {
    try { localStorage.setItem(KEY + ':catalog', JSON.stringify(c)); } catch (e) { /* joy yetmasa ham ishlayveradi */ }
  }
};
