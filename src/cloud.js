// Bulut (Firebase): muallif rejimi va muallif o'zgartirgan mazmun.
//
// O'quvchilar mazmunni Firestore REST orqali faqat o'qiydi (SDK yuklanmaydi, tez).
// Firebase SDK faqat muallif kirganda va saqlaganda kerak bo'ladi — u alohida bo'lak bo'lib yuklanadi.
//
// Firestore'dagi "kitobim" to'plami:
//   ilova    — { json: { name, logo, icon } }              ilova nomi, ichki logotip, telefon ikonkasi
//   matnlar  — { json: { uz: {kalit: matn}, ru: {...}, en: {...} } }
//   kitoblar — { json: { edits: {id: {...}}, added: [{subject, book}], deleted: [id] } }
//   testlar  — { json: { tests: [...], passPercent } }      (bo'lsa, ilova ichidagi testlar o'rniga)
// Har bir hujjatda "updated" (vaqt) bor.
import { FIREBASE, AUTHOR_EMAIL, AUTHOR_NAMES } from './config.js';

const REST = `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents/kitobim/`;
const CACHE = 'kitobim:cloud';
export const DOCS = ['ilova', 'matnlar', 'kitoblar', 'testlar'];

export const cloudReady = () => !!(FIREBASE && FIREBASE.apiKey);

// ---------- Mazmunni o'qish (hamma uchun) ----------
export function cachedCloud() {
  try { return JSON.parse(localStorage.getItem(CACHE)) || {}; } catch (e) { return {}; }
}
function setCachedCloud(c) {
  try { localStorage.setItem(CACHE, JSON.stringify(c)); } catch (e) { /* joy yetmasa ham ishlaydi */ }
}

async function readDoc(name) {
  const r = await fetch(`${REST}${name}?key=${FIREBASE.apiKey}`, { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('firestore ' + r.status);
  const d = await r.json();
  const f = d.fields || {};
  return { json: f.json ? JSON.parse(f.json.stringValue || 'null') : null, updated: f.updated ? f.updated.stringValue : '' };
}

// Internetdan yangi mazmunni oladi; bo'lmasa oxirgi saqlangani qaytadi
export async function fetchCloud() {
  if (!cloudReady()) return {};
  const out = {};
  const res = await Promise.allSettled(DOCS.map((n) => readDoc(n)));
  let anyOk = false;
  res.forEach((r, i) => { if (r.status === 'fulfilled') { anyOk = true; if (r.value) out[DOCS[i]] = r.value; } });
  if (!anyOk) throw new Error('offline');
  setCachedCloud(out);
  return out;
}

// ---------- Firebase SDK (kerak bo'lganda yuklanadi) ----------
let sdkP = null;
export function sdk() {
  if (!sdkP) {
    sdkP = Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]).then(([a, au, fs]) => {
      const app = a.getApps().length ? a.getApp() : a.initializeApp(FIREBASE);
      const auth = au.getAuth(app);
      try { auth.languageCode = 'uz'; } catch (e) { /* e'tiborsiz */ }
      return { app, auth, au, db: fs.getFirestore(app), fs };
    });
  }
  return sdkP;
}

// ---------- Muallif ----------
const norm = (s) => String(s || '').toLowerCase().replace(/[‘’ʻʼ'`´]/g, '').replace(/\s+/g, ' ').trim();
export const isAuthorName = (name) => AUTHOR_NAMES.map(norm).includes(norm(name));

// Parolni Firebase serveri tekshiradi; to'g'ri bo'lsa muallif sifatida kiradi
export async function authorSignIn(password) {
  const { auth, au } = await sdk();
  await au.signInWithEmailAndPassword(auth, AUTHOR_EMAIL, password);
  return true;
}

export async function authorSignedIn() {
  const { auth } = await sdk();
  await auth.authStateReady();
  return !!(auth.currentUser && auth.currentUser.email === AUTHOR_EMAIL);
}

export async function authorSignOut() {
  try { const { auth, au } = await sdk(); if (auth.currentUser) await au.signOut(auth); } catch (e) { /* e'tiborsiz */ }
}

// Muallif saqlagan narsa hammaga ko'rinadi (Firestore qoidasi faqat muallifga yozishga ruxsat beradi)
export async function saveDoc(name, json) {
  const { db, fs } = await sdk();
  const body = JSON.stringify(json);
  if (body.length > 950000) throw new Error('too-big');
  const updated = new Date().toISOString();
  await fs.setDoc(fs.doc(db, 'kitobim', name), { json: body, updated });
  const c = cachedCloud();
  c[name] = { json, updated };
  setCachedCloud(c);
  return updated;
}

// Kitob fayli (PDF) — Firebase Storage'ga; Storage yoqilmagan bo'lsa xato qaytadi
export async function uploadFile(path, file, onProgress) {
  const [{ app }, st] = await Promise.all([sdk(), import('firebase/storage')]);
  const storage = st.getStorage(app);
  const ref = st.ref(storage, path);
  const task = st.uploadBytesResumable(ref, file, { contentType: file.type || 'application/pdf' });
  await new Promise((res, rej) => task.on('state_changed',
    (s) => onProgress && onProgress(s.bytesTransferred / Math.max(1, s.totalBytes)), rej, res));
  return st.getDownloadURL(ref);
}

// Rasmni kichraytirib, ma'lumotlar bazasiga sig'adigan matn (data URL) qiladi
export function imageToDataUrl(file, maxW, type = 'image/jpeg', quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d');
      if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL(type, quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}

// ---------- Mazmunni ilovaga qo'llash ----------
// Kitoblar: asosiy ro'yxat (GitHub'dagi catalog.json) ustiga muallifning o'zgartirishlari qo'yiladi.
// Shunda keyin asosiy ro'yxat yangilansa ham, muallif qilgan o'zgarishlar yo'qolmaydi.
export function applyBooks(catalog, k) {
  if (!catalog || !k) return catalog;
  const c = JSON.parse(JSON.stringify(catalog));
  const edits = k.edits || {};
  const deleted = new Set(k.deleted || []);
  for (const g of c.grades) {
    for (const s of g.subjects) {
      const ed = (k.subjects || {})[s.id];
      if (ed && ed.name) s.name = Object.assign({}, s.name, ed.name);
      s.books = s.books.filter((b) => !deleted.has(b.id)).map((b) => (edits[b.id] ? Object.assign({}, b, edits[b.id]) : b));
    }
  }
  for (const a of k.added || []) {
    if (deleted.has(a.book.id)) continue;
    const g = c.grades.find((x) => x.subjects.some((s) => s.id === a.subject));
    const s = g && g.subjects.find((x) => x.id === a.subject);
    if (s && !s.books.some((b) => b.id === a.book.id)) s.books.push(Object.assign({}, a.book, edits[a.book.id] || {}));
  }
  return c;
}

export function applyTexts(STRINGS, m) {
  if (!m) return;
  for (const lang of Object.keys(m)) {
    if (!STRINGS[lang]) continue;
    for (const [k, v] of Object.entries(m[lang] || {})) {
      if (typeof STRINGS[lang][k] === 'string' && typeof v === 'string' && v.trim()) STRINGS[lang][k] = v;
    }
  }
}
