import './style.css';
import { STRINGS, LANGS, pick } from './i18n.js';
import { store } from './store.js';
import { I, LOGO, subjIcon } from './icons.js';
import { openReader, esc, ensureSaved } from './reader.js';
import { drawCertificate, saveImage } from './cert.js';
import { REMOTE_CATALOG, APP_VERSION, AUTHOR } from './config.js';
import { getJson } from './net.js';
import { cachedCloud, fetchCloud, applyBooks, applyTexts, isAuthorName, authorSignIn, authorSignOut } from './cloud.js';
import { scrAuthor } from './panel.js';

const app = document.getElementById('app');
const overlay = document.createElement('div');
document.body.appendChild(overlay);

let catalog = null;
let catalogBase = '';
let baseCatalog = null;        // asosiy ro'yxat (muallif o'zgartirishlarisiz)
let tests = { tests: [], passPercent: 70 };
let baseTests = null;          // ilova ichidagi testlar
let cloud = {};                // muallif bulutga saqlagan mazmun
let bundled = {};              // ilovaning ichiga joylangan kitoblar: id -> fayl
// Matnlarning asl holati (muallif paneli "asl matn"ni ko'rsatishi uchun)
const BASE_STRINGS = JSON.parse(JSON.stringify(STRINGS));
const books = new Map();      // id -> kitob (fan va sinf ma'lumoti bilan)
const subjects = new Map();   // id -> fan

const t = () => STRINGS[store.lang] || STRINGS.uz;
const L = () => store.lang;

// ---------- Ma'lumotlarni yuklash ----------
async function loadJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}

function bookCount(c) {
  let n = 0;
  for (const g of (c && c.grades) || []) for (const s of g.subjects) n += s.books.length;
  return n;
}

// Ilova darhol ichidagi yoki oxirgi saqlangan ro'yxat bilan ochiladi,
// keyin internetdan yangi ro'yxatni oladi (refreshCatalog).
async function loadData() {
  const local = await loadJson(new URL('catalog.json', location.href).href);
  const cached = store.cachedCatalog();
  // Eng yangi ro'yxat ishlatiladi ("updated" sanasi bo'yicha), kitoblar soni bo'yicha emas:
  // takroriy kitoblar olib tashlanganda ro'yxat qisqaradi.
  const useCached = cached && cached.grades && bookCount(cached) && (cached.updated || '') > (local.updated || '');
  setCatalog(useCached ? cached : local, useCached ? REMOTE_CATALOG : new URL('catalog.json', location.href).href);
  try { baseTests = await loadJson(new URL('tests.json', location.href).href); } catch (e) { /* testlarsiz ham ishlaydi */ }
  try { bundled = (await loadJson(new URL('bundled.json', location.href).href)).books || {}; } catch (e) { bundled = {}; }
  applyCloud(cachedCloud());
}

// Asosiy ro'yxat ustiga muallifning o'zgartirishlari qo'yiladi
function setCatalog(base, baseUrl) {
  baseCatalog = base;
  if (baseUrl) catalogBase = baseUrl;
  catalog = applyBooks(base, cloud.kitoblar && cloud.kitoblar.json);
  reindex();
}

// Muallif bulutga saqlagan mazmunni qo'llash: kitoblar, testlar, matnlar, ilova nomi va logotipi
function applyCloud(c) {
  cloud = c || {};
  // Matnlar: avval asl holatga qaytarib, keyin muallif o'zgartirganlarini qo'yamiz
  for (const l of Object.keys(BASE_STRINGS)) for (const [k, v] of Object.entries(BASE_STRINGS[l])) if (typeof v === 'string') STRINGS[l][k] = v;
  applyTexts(STRINGS, cloud.matnlar && cloud.matnlar.json);
  tests = (cloud.testlar && cloud.testlar.json && cloud.testlar.json.tests) ? cloud.testlar.json : (baseTests || { tests: [], passPercent: 70 });
  if (baseCatalog) setCatalog(baseCatalog);
  const a = (cloud.ilova && cloud.ilova.json) || {};
  document.title = a.name || 'Darsligim';
}
async function refreshCloud() {
  try {
    const before = JSON.stringify(cloud);
    const fresh = await fetchCloud();
    if (JSON.stringify(fresh) === before) return;
    applyCloud(fresh);
    if (!/^#\/(read|test|cert|login|muallif)/.test(location.hash)) render();
  } catch (e) { /* internet yo'q — oxirgi saqlangan mazmun bilan ishlaymiz */ }
}
function appName() { return (cloud.ilova && cloud.ilova.json && cloud.ilova.json.name) || 'Darsligim'; }
function appLogo(size) {
  const l = cloud.ilova && cloud.ilova.json && cloud.ilova.json.logo;
  return l ? `<img src="${l}" width="${size}" height="${size}" alt="${esc(appName())}" style="border-radius:${Math.round(size * 0.23)}px;object-fit:cover">` : LOGO(size);
}

async function refreshCatalog() {
  if (!REMOTE_CATALOG) return;
  try {
    const fresh = await getJson(REMOTE_CATALOG);
    if (!fresh || !fresh.grades || !bookCount(fresh)) return;
    if (catalog && (fresh.updated || '') <= (catalog.updated || '')) return;
    store.setCachedCatalog(fresh);
    setCatalog(fresh, REMOTE_CATALOG);
    // O'qish yoki test paytida ekranni almashtirmaymiz
    if (!/^#\/(read|test|cert|login)/.test(location.hash)) render();
  } catch (e) { /* internet yo'q — eski ro'yxat bilan davom etamiz */ }
}

function reindex() {
  books.clear(); subjects.clear();
  for (const g of catalog.grades) {
    for (const s of g.subjects) {
      s.grade = g.grade;
      subjects.set(s.id, s);
      for (const b of s.books) {
        b.grade = g.grade; b.subject = s.id; b.color = b.color || s.color;
        b.file = new URL(b.file, catalogBase).href;
        // Ilova ichida bor kitob: internetsiz, darhol ochiladi
        if (bundled[b.id]) b.bundled = new URL(bundled[b.id], location.href).href;
        // Muqovalar ilova ichida turadi
        if (b.cover) b.coverUrl = new URL(b.cover, location.href).href;
        books.set(b.id, b);
      }
    }
  }
}

// ---------- Yordamchilar ----------
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function toast(msg) {
  const d = document.createElement('div');
  d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2200);
}
function bookTitle(b) { return pick(b.title, L()); }
function nav(active) {
  const items = [
    ['home', '#/home', I.home(22), t().home],
    ['school', '#/school', I.school(22), t().school],
    ['library', '#/library', I.library(22), t().library],
    ['tests', '#/tests', I.test(22), t().tests],
    ['profile', '#/profile', I.user(22), t().profile],
    ['info', '#/malumot', I.info(22), t().info]
  ];
  return `<nav class="tabs" aria-label="Menu"><div class="in">
    <div class="brand">${appLogo(38)}<span>${esc(appName())}</span></div>
    ${items.map(([k, h, ic, lb]) =>
    `<button data-go="${h}" ${k === active ? 'aria-current="page"' : ''}><span class="ic">${ic}</span><span>${esc(lb)}</span></button>`).join('')}
    <p class="side-foot sub" style="font-size:12px;padding:0 12px">${t().appAuthor}:<br><a href="https://t.me/${AUTHOR.telegram}" target="_blank" rel="noopener" style="font-weight:600;text-decoration:none">${esc(AUTHOR.name)}</a></p>
    </div></nav>`;
}
function backBar(title, sub, icon) {
  return `<div class="row" style="gap:10px"><button class="icon-btn boxed" data-back aria-label="${t().back}">${I.back(22)}</button>
    ${icon || ''}<div class="grow"><h1 style="font-size:22px">${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}</div></div>`;
}
function tint(color, a = '1F') { return /^#[0-9a-f]{6}$/i.test(color || '') ? color + a : '#0F7A641F'; }
function subjBadge(sb, size = 44) {
  const c = (sb && sb.color) || '#0F7A64';
  return `<span class="ico" style="width:${size}px;height:${size}px;background:${tint(c)};color:${c}">${subjIcon(sb ? sb.id : '', Math.round(size * 0.5))}</span>`;
}
// Kitob muqovasi: haqiqiy muqova rasmi, bo'lmasa fan rangidagi belgi
function cover(b, extra = '') {
  return `<span class="cv" style="background:${b.color || '#0F7A64'}"><span class="ph">${subjIcon(b.subject, 20)}</span>${b.coverUrl
    ? `<img src="${b.coverUrl}" alt="" loading="lazy" decoding="async" onerror="this.remove()" style="position:relative">` : ''}${extra}</span>`;
}
function bookMeta(b) {
  const s = t();
  const bits = [];
  if (b.year) bits.push(`<span>${s.edition(b.year)}</span>`);
  if (b.pages) bits.push(`<span>${s.pagesN(b.pages)}</span>`);
  if (b.size) bits.push(`<span>${(b.size / 1048576).toFixed(1)} MB</span>`);
  if (store.isSaved(b.id) || b.bundled) bits.push(`<span class="ok">${I.check(14)}${s.savedOffline}</span>`);
  return `<span class="meta">${bits.join('')}</span>`;
}
function bookItem(b, extra = '') {
  const p = store.progress(b.id);
  const pct = p && p.pages ? Math.round((p.page / p.pages) * 100) : 0;
  return `<button class="item" data-go="#/read/${encodeURIComponent(b.id)}">
    ${cover(b)}
    <span class="grow col" style="gap:5px">
      <span class="t">${esc(bookTitle(b))}</span>
      ${p ? `<span class="row" style="gap:8px"><span class="bar"><i style="width:${pct}%"></i></span><span class="s">${p.page}/${p.pages}</span></span>` : bookMeta(b)}
      ${extra}
    </span>${I.chevron(20)}</button>`;
}
function bookCard(b) {
  const p = store.progress(b.id);
  const pct = p && p.pages ? Math.round((p.page / p.pages) * 100) : 0;
  return `<button class="bk" data-go="#/read/${encodeURIComponent(b.id)}">
    ${cover(b, (store.isSaved(b.id) || b.bundled) ? `<span class="saved" title="${esc(t().savedOffline)}">${I.check(16)}</span>` : '')}
    <span class="col" style="gap:6px"><span class="t">${esc(bookTitle(b))}</span>
    ${p ? `<span class="row" style="gap:8px"><span class="bar"><i style="width:${pct}%"></i></span><span class="sub" style="font-size:12px">${pct}%</span></span>` : ''}
    ${bookMeta(b)}</span></button>`;
}
function gradeGrid(selected, hrefFor) {
  let h = '<div class="grade-grid">';
  for (let g = 1; g <= 11; g++) {
    h += `<button class="grade" data-go="${hrefFor(g)}" aria-pressed="${g === selected}">${g}<small>${t().grade}</small></button>`;
  }
  return h + '</div>';
}

// "Ilova muallifi" bo'limi
function authorSection() {
  const s = t();
  const initials = AUTHOR.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  return `<section class="sec" aria-labelledby="authorH"><h2 id="authorH">${s.appAuthor}</h2>
    <div class="card author"><span class="av">${esc(initials)}</span>
    <span class="grow col" style="gap:0">
      <b style="font-size:17px">${esc(AUTHOR.name)}</b>
      <a class="tg" href="https://t.me/${AUTHOR.telegram}" target="_blank" rel="noopener">${I.telegram(17)}Telegram: @${AUTHOR.telegram}</a></span>
  </div></section>`;
}

// ---------- Ekranlar ----------
function scrLogin() {
  const s = t();
  const u = store.user || {};
  let grade = u.grade || null;
  const featIcons = [I.book(18), I.download(18), I.test(18), I.globe(18)];
  app.className = 'bare';
  app.innerHTML = `<main class="login">
    <div class="brand">
      <div class="langs" role="group" aria-label="${s.language}">${LANGS.map((l) =>
        `<button data-lang="${l}" aria-pressed="${l === L()}">${STRINGS[l].langName}</button>`).join('')}</div>
      <div class="logo-row">${appLogo(72)}<span class="name">${esc(appName())}</span></div>
      <p class="tag">${s.tagline}</p>
      <div class="feats">${s.feats.map((f, i) => `<div><i>${featIcons[i]}</i>${esc(f)}</div>`).join('')}</div>
    </div>
    <div class="form-wrap">
    <form class="card col" style="gap:14px" novalidate>
      <div class="field"><label for="nm">${s.yourName}</label>
        <input id="nm" class="input" autocomplete="username" placeholder="${s.namePh}" value="${esc(u.name || '')}"><div class="err" id="eNm"></div></div>
      <div class="field"><label for="pw">${s.yourPass}</label>
        <input id="pw" class="input" type="password" autocomplete="current-password" placeholder="${s.passPh}"><div class="err" id="ePw"></div></div>
      <div class="field"><span class="lb">${s.yourGrade}</span>
        <div class="grade-grid" id="gr" style="grid-template-columns:repeat(6,minmax(0,1fr))">${Array.from({ length: 11 }, (_, i) => i + 1).map((g) =>
          `<button type="button" class="grade" data-g="${g}" aria-pressed="${g === grade}" style="height:48px;font-size:18px">${g}</button>`).join('')}</div></div>
      <button class="btn" type="submit" style="margin-top:6px">${s.start}</button>
    </form>
    <p class="foot">${s.terms}</p>
    <p class="foot">${s.appAuthor}: <b style="color:var(--ink-2)">${esc(AUTHOR.name)}</b> · Telegram: <a href="https://t.me/${AUTHOR.telegram}" target="_blank" rel="noopener">@${AUTHOR.telegram}</a></p>
    </div></main>`;

  app.querySelectorAll('[data-lang]').forEach((b) => b.onclick = () => { store.setLang(b.dataset.lang); scrLogin(); });
  app.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => {
    grade = +b.dataset.g;
    app.querySelectorAll('[data-g]').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.g === grade)));
  });
  const pw = app.querySelector('#pw');
  pw.oninput = () => { app.querySelector('#ePw').textContent = ''; };
  app.querySelector('#nm').oninput = () => { app.querySelector('#eNm').textContent = ''; };
  app.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = app.querySelector('form [type=submit]');
    const name = app.querySelector('#nm').value.trim().replace(/\s+/g, ' ');
    let ok = true;
    if (name.length < 3) { app.querySelector('#eNm').textContent = s.errName; ok = false; }
    if (pw.value.length < 4) { app.querySelector('#ePw').textContent = s.errPass; ok = false; }
    if (!ok) return;
    const user = { name, grade: grade || 5 };
    btn.disabled = true;
    try {
      if (isAuthorName(name)) {
        // Muallif: parolni Firebase serveri tekshiradi
        await authorSignIn(pw.value);
        store.setUser(Object.assign(user, { author: true }));
        toast(s.authorWelcome);
      } else {
        // O'quvchi: parol shu qurilmadagi profilni himoya qiladi
        if (!(await store.checkPassword(name, pw.value))) { btn.disabled = false; app.querySelector('#ePw').textContent = s.passWrong; return; }
        store.setUser(user);
      }
      go('#/home');
    } catch (err) {
      btn.disabled = false;
      const c = (err && (err.code || err.message)) || '';
      app.querySelector('#ePw').textContent = /wrong-password|invalid-credential|invalid-login|user-not-found/i.test(c) ? s.authorWrong
        : /network|offline|unavailable/i.test(c) ? s.netNeeded : s.loginFail + (c ? ` (${c})` : '');
    }
  };
}

function scrHome() {
  const s = t();
  const recent = store.recent().filter((r) => books.has(r.id));
  const last = recent[0] && books.get(recent[0].id);
  const lp = recent[0];
  const g = store.user.grade || 5;
  const lpct = lp && lp.pages ? Math.round(lp.page / lp.pages * 100) : 0;
  app.innerHTML = `<main class="screen">
    <header class="band">
      <div class="row between" style="align-items:flex-start">
        <div class="col" style="gap:4px"><span class="hi">${s.hello}!</span><h1>${esc(store.user.name || '')}</h1>
          <span class="hi">${g}-${s.grade} · ${s.whatToday}</span></div>
        <button class="lang" data-cyclelang aria-label="${s.language}">${I.globe(16)}${L().toUpperCase()}</button>
      </div>
      <label class="search">${I.search(20)}<span class="sr">${s.search}</span>
        <input id="q" type="search" placeholder="${s.search}" autocomplete="off"></label>
    </header>
    <div id="results" class="list"></div>
    <div id="main" style="display:flex;flex-direction:column;gap:26px">
      ${last ? `<button class="resume" data-go="#/read/${encodeURIComponent(last.id)}">
        ${cover(last)}
        <span class="grow col" style="gap:6px"><span class="k">${s.continueReading}</span><span class="t">${esc(bookTitle(last))}</span>
        <span class="row" style="gap:10px"><span class="bar"><i style="width:${lpct}%"></i></span><span class="sub" style="font-size:12.5px;white-space:nowrap">${lp.page}-${s.page} · ${lpct}%</span></span></span>
        <span class="go">${I.right(22)}</span></button>` : ''}
      <section class="sec"><div class="sec-head"><h2>${s.schoolBooks}</h2>
        <button class="link" data-go="#/school">${s.all}${I.chevron(16)}</button></div>
        ${gradeGrid(g, (n) => '#/school/' + n)}</section>
      <section class="sec"><div class="sec-head"><h2>${g}-${s.subjectsOf}</h2></div>
        ${subjectGrid(gradeSubjects(g))}</section>
      ${authorSection()}
    </div></main>${nav('home')}`;

  const q = app.querySelector('#q');
  q.oninput = () => {
    const v = q.value.trim().toLowerCase();
    const res = app.querySelector('#results');
    app.querySelector('#main').style.display = v ? 'none' : 'flex';
    if (!v) { res.innerHTML = ''; return; }
    const found = [];
    for (const sb of subjects.values()) {
      if (!sb.books.some((b) => !b.lang || b.lang === schoolLang())) continue;
      if (pick(sb.name, L()).toLowerCase().includes(v)) found.push(`<button class="item" data-go="#/subject/${sb.id}">
        ${subjBadge(sb)}
        <span class="grow col" style="gap:2px"><span class="t">${esc(pick(sb.name, L()))}</span><span class="s">${sb.grade}-${s.grade}</span></span>${I.chevron(20)}</button>`);
    }
    for (const b of books.values()) {
      if (b.lang && b.lang !== schoolLang()) continue;
      if (bookTitle(b).toLowerCase().includes(v)) found.push(bookItem(b));
    }
    res.innerHTML = found.slice(0, 40).join('') || `<div class="card empty">${s.nothingFound}</div>`;
  };
}

// O'quvchining maktab tili: o'zbek yoki rus maktabi darsliklari
function schoolLang() { return (store.user && store.user.school) || (L() === 'ru' ? 'ru' : 'uz'); }
function setSchoolLang(v) { store.setUser(Object.assign({}, store.user, { school: v })); }
function schoolPills() {
  const s = t(), cur = schoolLang();
  return `<div class="seg" role="group" aria-label="${s.schoolLang}">${[['uz', s.schoolUz], ['ru', s.schoolRu]].map(([k, lb]) =>
    `<button data-school="${k}" aria-pressed="${k === cur}">${lb}</button>`).join('')}</div>`;
}
function booksFor(sb) {
  const mine = sb.books.filter((b) => !b.lang || b.lang === schoolLang());
  return mine.length ? mine : sb.books;
}
function bindSchoolPills() {
  app.querySelectorAll('[data-school]').forEach((b) => b.onclick = () => { setSchoolLang(b.dataset.school); render(); });
}

function gradeSubjects(g) {
  const gr = catalog.grades.find((x) => x.grade === g);
  return (gr ? gr.subjects : []).filter((sb) => !sb.books.length || sb.books.some((b) => !b.lang || b.lang === schoolLang()));
}
function subjectGrid(list) {
  const s = t();
  return list.length ? `<div class="subj-grid">${list.map((sb) => {
      const n = sb.books.filter((b) => !b.lang || b.lang === schoolLang()).length;
      return `<button class="subj" data-go="#/subject/${sb.id}">
      ${subjBadge(sb)}
      <span class="col" style="gap:2px;min-width:0"><span class="name">${esc(pick(sb.name, L()))}</span>
      <span class="cnt">${n ? s.booksCount(n) : s.soon}</span></span></button>`;
    }).join('')}</div>` : `<div class="card empty">${s.soon}</div>`;
}

// ---------- Butun sinfni yuklab olish ----------
let bulk = null; // { key, list, i, frac, ok, fail, running, stop }
function gradeBooks(g) {
  const out = [];
  for (const sb of gradeSubjects(g)) for (const b of sb.books) if (!b.lang || b.lang === schoolLang()) out.push(b);
  return out;
}
function bulkKey(g) { return g + ':' + schoolLang(); }
function bulkCard(g) {
  const s = t();
  const list = gradeBooks(g);
  if (!list.length) return '';
  const left = list.filter((b) => !store.isSaved(b.id) && !b.bundled);
  const mb = (left.reduce((a, b) => a + (b.size || 0), 0) / 1048576).toFixed(0);
  const on = bulk && bulk.running && bulk.key === bulkKey(g);
  if (on) {
    const pct = Math.round(((bulk.i + bulk.frac) / bulk.list.length) * 100);
    return `<div class="card col" id="bulk" style="gap:10px">
      <div class="row between"><b>${s.downloading}: <span id="bulkN">${bulk.i + 1}/${bulk.list.length}</span></b><span class="sub" id="bulkP">${pct}%</span></div>
      <span class="bar" style="flex:none;height:8px;display:block"><i id="bulkBar" style="width:${pct}%"></i></span>
      <button class="btn ghost" data-bulkstop style="height:44px">${s.cancel}</button></div>`;
  }
  if (!left.length) return `<div class="card row" style="gap:10px;color:#145A39;background:#E6F4EC;border-color:#BFE3CC">${I.check(20)}<span style="font-size:14px">${s.allSaved}</span></div>`;
  const last = bulk && !bulk.running && bulk.key === bulkKey(g) && bulk.fail ? `<span class="sub" style="font-size:13px">${bulk.ok} ${s.savedCount} · ${bulk.fail} ${s.failedCount}</span>` : '';
  return `<div class="card col" id="bulk" style="gap:10px">
    <button class="btn soft" data-bulk="${g}">${I.download(20)}${s.downloadGrade}</button>
    <span class="sub" style="font-size:13px;text-align:center">${left.length} ${s.books} · ${mb} MB · ${s.downloadGradeHint}</span>${last}</div>`;
}
async function startBulk(g) {
  const list = gradeBooks(g).filter((b) => !store.isSaved(b.id) && !b.bundled);
  if (!list.length) return;
  bulk = { key: bulkKey(g), list, i: 0, frac: 0, ok: 0, fail: 0, running: true, stop: false };
  render();
  for (bulk.i = 0; bulk.i < list.length && !bulk.stop; bulk.i++) {
    bulk.frac = 0; updateBulk();
    try {
      await ensureSaved(list[bulk.i], (f) => { bulk.frac = f; updateBulk(); });
      bulk.ok++;
    } catch (e) { bulk.fail++; }
  }
  bulk.i = Math.min(bulk.i, list.length - 1);
  bulk.running = false;
  if (/^#\/school/.test(location.hash) || /^#\/home/.test(location.hash)) render();
}
function updateBulk() {
  const n = document.getElementById('bulkN'), p = document.getElementById('bulkP'), bar = document.getElementById('bulkBar');
  if (!n || !bulk) return;
  const pct = Math.round(((bulk.i + bulk.frac) / bulk.list.length) * 100);
  n.textContent = `${bulk.i + 1}/${bulk.list.length}`; p.textContent = pct + '%'; bar.style.width = pct + '%';
}

function scrSchool(g) {
  const s = t();
  g = g || store.user.grade || 5;
  const list = gradeSubjects(g);
  app.innerHTML = `<main class="screen">
    <div class="page-head"><h1>${s.schoolBooks}</h1><p class="sub">${s.chooseGrade}</p></div>
    ${gradeGrid(g, (n) => '#/school/' + n)}
    ${schoolPills()}
    ${bulkCard(g)}
    <section class="sec"><h2>${g}-${s.subjectsOf}</h2>
    ${subjectGrid(list)}</section>
  </main>${nav('school')}`;
  bindSchoolPills();
  const b = app.querySelector('[data-bulk]');
  if (b) b.onclick = () => startBulk(+b.dataset.bulk);
  const st = app.querySelector('[data-bulkstop]');
  if (st) st.onclick = () => { if (bulk) bulk.stop = true; st.disabled = true; };
}

function scrSubject(id) {
  const s = t();
  const sb = subjects.get(id);
  if (!sb) return go('#/school');
  const hasBoth = new Set(sb.books.map((b) => b.lang).filter(Boolean)).size > 1;
  const list = booksFor(sb);
  app.innerHTML = `<main class="screen">
    ${backBar(pick(sb.name, L()), sb.grade + '-' + s.grade + ' · ' + s.booksCount(list.length), subjBadge(sb, 48))}
    ${hasBoth ? schoolPills() : ''}
    ${list.length ? `<div class="shelf">${list.map((b) => bookCard(b)).join('')}</div>` : `<div class="card empty">${s.noBooks}</div>`}
  </main>${nav('school')}`;
  bindSchoolPills();
}

function scrRead(id) {
  const b = books.get(id);
  if (!b) return go('#/home');
  app.innerHTML = '';
  openReader(overlay, b, bookTitle(b), t(), () => { overlay.innerHTML = ''; history.length > 1 ? history.back() : go('#/home'); }, toast);
}

let libTab = 'reading';
function scrLibrary() {
  const s = t();
  const recent = store.recent().filter((r) => books.has(r.id));
  const saved = store.savedList().filter((r) => books.has(r.id));
  const certs = store.certs;
  let body = '';
  if (libTab === 'reading') body = recent.length ? recent.map((r) => bookItem(books.get(r.id))).join('') : `<div class="card empty">${s.emptyReading}</div>`;
  if (libTab === 'saved') body = saved.length ? saved.map((r) => `<div class="row" style="gap:8px"><div class="grow">${bookItem(books.get(r.id), `<span class="s">${(r.size / 1048576).toFixed(1)} MB</span>`)}</div>
      <button class="icon-btn" data-del="${esc(r.id)}" aria-label="${s.removeOffline}">${I.trash(20)}</button></div>`).join('') : `<div class="card empty">${s.emptySaved}</div>`;
  if (libTab === 'certs') body = certs.length ? certs.map((c) => `<button class="item" data-go="#/cert/${c.id}">
      <span class="ico" style="background:#FFF3CF;color:#9A6B00">${I.star(22)}</span>
      <span class="grow col" style="gap:2px"><span class="t">${esc(c.title)}</span><span class="s">${c.pct}% · ${c.date}</span></span>${I.chevron(20)}</button>`).join('') : `<div class="card empty">${s.emptyCerts}</div>`;
  app.innerHTML = `<main class="screen">
    <div class="page-head"><h1>${s.library}</h1></div>
    <div class="stats"><div class="card stat"><span class="ico" style="background:var(--p-tint);color:var(--p)">${I.book(22)}</span><span class="col" style="gap:0"><b>${recent.length}</b><span>${s.booksOpened}</span></span></div>
      <div class="card stat"><span class="ico" style="background:#FFF3CF;color:#9A6B00">${I.star(22)}</span><span class="col" style="gap:0"><b>${certs.length}</b><span>${s.certsCount}</span></span></div></div>
    <div class="seg" role="tablist">${[['reading', s.reading], ['saved', s.saved], ['certs', s.certificates]].map(([k, lb]) =>
      `<button role="tab" data-tab="${k}" aria-selected="${k === libTab}">${lb}</button>`).join('')}</div>
    <div class="list">${body}</div></main>${nav('library')}`;
  app.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { libTab = b.dataset.tab; scrLibrary(); });
  app.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { await store.removeFile(b.dataset.del); scrLibrary(); });
}

function scrTests(g) {
  const s = t();
  g = g || store.user.grade || 5;
  const list = tests.tests.filter((x) => x.grade === g);
  const done = new Set(store.certs.map((c) => c.test));
  app.innerHTML = `<main class="screen">
    <div class="page-head"><h1>${s.tests}</h1><p class="sub">${s.testsIntro}</p></div>
    ${gradeGrid(g, (n) => '#/tests/' + n)}
    ${L() !== 'uz' ? `<p class="sub" style="font-size:13px">${s.testsLangNote}</p>` : ''}
    <div class="list cols">${list.map((x) => `<button class="item" data-go="#/test/${x.id}">
      ${subjBadge(subjects.get(x.subject) || { id: x.subject, color: '#0F7A64' })}
      <span class="grow col" style="gap:3px"><span class="t">${esc(pick(x.title, L()))}</span><span class="meta"><span>${x.questions.length} ${s.questions}</span>${done.has(x.id) ? `<span class="ok">${I.check(14)}${s.certificate.charAt(0) + s.certificate.slice(1).toLowerCase()}</span>` : ''}</span></span>${I.chevron(20)}</button>`).join('') || `<div class="card empty">${s.soon}</div>`}</div>
  </main>${nav('tests')}`;
}

let run = null; // joriy test holati
function scrTest(id) {
  const s = t();
  const tt = tests.tests.find((x) => x.id === id);
  if (!tt) return go('#/tests');
  if (!run || run.id !== id) {
    // Javob variantlari har safar aralashtiriladi
    const order = tt.questions.map((q) => {
      const a = q.options.map((_, k) => k);
      for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; }
      return a;
    });
    run = { id, i: 0, picked: null, right: 0, done: false, certId: null, order };
  }
  const title = pick(tt.title, L());

  if (run.done) {
    const pct = Math.round((run.right / tt.questions.length) * 100);
    const pass = pct >= (tests.passPercent || 70);
    app.innerHTML = `<main class="screen no-nav" style="text-align:center">
      <div class="row"><button class="icon-btn" data-go="#/tests/${tt.grade}" aria-label="${s.back}">${I.close()}</button></div>
      <div class="score ${pass ? '' : 'low'}" style="--pct:${pct}%">${run.right}/${tt.questions.length}</div>
      <h1>${pass ? s.congrats : s.result + ': ' + pct + '%'}</h1>
      <p class="sub" style="font-size:15px">${pass ? s.passed : s.failed}</p>
      <div class="col" style="gap:10px;margin-top:12px">
        ${pass ? `<button class="btn" data-go="#/cert/${run.certId}">${s.getCert}</button>` : ''}
        <button class="btn ${pass ? 'ghost' : ''}" data-retry>${s.tryAgain}</button></div></main>`;
    app.querySelector('[data-retry]').onclick = () => { run = null; scrTest(id); };
    return;
  }

  const q = tt.questions[run.i];
  const last = run.i === tt.questions.length - 1;
  const answered = run.picked !== null;
  app.innerHTML = `<main class="screen no-nav">
    ${backBar(title)}
    <div class="col" style="gap:8px"><div class="row between" style="font-size:13px"><b>${s.question} ${run.i + 1} ${s.of} ${tt.questions.length}</b>
      <span class="sub" style="font-size:13px">${s.correct}: ${run.right}</span></div>
      <span class="bar"><i style="width:${(run.i / tt.questions.length) * 100}%"></i></span></div>
    <div class="card col q-card" style="gap:8px;padding:20px"><span class="lb">${s.question} ${run.i + 1}</span>
      <h2 style="font-size:21px;line-height:1.35">${esc(q.q)}</h2></div>
    <div class="list">${run.order[run.i].map((k, pos) => {
      const o = q.options[k];
      let cls = '', note = '', mark = 'ABCD'[pos];
      if (answered && k === q.answer) { cls = 'right'; note = s.correct; mark = I.check(18); }
      else if (answered && k === run.picked) { cls = 'wrong'; note = s.yourAnswer; mark = I.x(18); }
      return `<button class="opt ${cls}" data-opt="${k}" ${answered ? 'aria-disabled="true"' : ''}><span class="k">${mark}</span>${esc(o)}${note ? `<span class="note">${note}</span>` : ''}</button>`;
    }).join('')}</div>
    ${answered && q.why ? `<div class="explain"><b>${s.correct}:</b> ${esc(q.why)}</div>` : ''}
    <div style="flex:1"></div>
    <button class="btn" data-next ${answered ? '' : 'disabled'}>${last ? s.finish : s.nextQ}</button></main>`;

  app.querySelectorAll('[data-opt]').forEach((b) => b.onclick = () => {
    if (run.picked !== null) return;
    run.picked = +b.dataset.opt;
    if (run.picked === q.answer) run.right++;
    scrTest(id);
  });
  app.querySelector('[data-next]').onclick = () => {
    if (run.picked === null) return;
    if (last) {
      run.done = true;
      const pct = Math.round((run.right / tt.questions.length) * 100);
      if (pct >= (tests.passPercent || 70)) {
        const d = new Date();
        const c = {
          id: 'KTB-' + d.getFullYear() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
          name: store.user.name, title, score: run.right, total: tt.questions.length, pct,
          date: [d.getDate(), d.getMonth() + 1, d.getFullYear()].map((n) => String(n).padStart(2, '0')).join('.'),
          test: tt.id
        };
        store.addCert(c);
        run.certId = c.id;
      }
    } else { run.i++; run.picked = null; }
    scrTest(id);
  };
}

async function scrCert(id) {
  const s = t();
  const c = store.cert(id);
  if (!c) return go('#/library');
  app.innerHTML = `<main class="screen no-nav">
    ${backBar(s.certificates)}
    <div class="card" style="padding:8px" id="cimg"><div class="reader-msg"><div class="spin"></div></div></div>
    <button class="btn" data-dl>${I.download(20)}${s.download}</button>
    <button class="btn ghost" data-go="#/library">${s.toLibrary}</button></main>`;
  const url = await drawCertificate(c, s);
  const box = app.querySelector('#cimg');
  if (!box) return;
  box.innerHTML = `<img class="cert-img" src="${url}" alt="${esc(s.certificate + ': ' + c.name + ', ' + c.title)}">`;
  app.querySelector('[data-dl]').onclick = () => saveImage(url, `Darsligim-sertifikat-${c.id}.png`).catch(() => toast(s.loadError));
}

function scrProfile() {
  const s = t();
  const u = store.user;
  app.innerHTML = `<main class="screen">
    <header class="band" style="padding-bottom:24px">
      <div class="row" style="gap:16px"><span class="badge" style="width:64px;height:64px;border-radius:32px;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.5);font-size:26px">${esc((u.name || '?')[0].toUpperCase())}</span>
      <div class="col" style="gap:2px;min-width:0"><h1 style="font-size:22px">${esc(u.name)}</h1><span class="hi">${u.grade}-${s.grade}${u.author ? ' · ' + esc(s.authorPanel) : ''}</span></div></div></header>
    <section class="sec"><h2>${s.language}</h2>
      <div class="seg">${LANGS.map((l) => `<button data-lang="${l}" aria-pressed="${l === L()}">${STRINGS[l].langName}</button>`).join('')}</div></section>
    <section class="sec"><h2>${s.schoolLang}</h2>${schoolPills()}</section>
    <section class="sec"><h2>${s.yourGrade}</h2>
      <div class="grade-grid">${Array.from({ length: 11 }, (_, i) => i + 1).map((g) => `<button class="grade" data-g="${g}" aria-pressed="${g === u.grade}">${g}</button>`).join('')}</div></section>
    ${u.author ? `<section class="sec"><button class="btn" data-go="#/muallif">${I.test(20)}${s.authorPanel}</button>
      <p class="sub" style="font-size:13px;text-align:center">${s.authorPanelHint}</p></section>` : ''}
    ${authorSection()}
    <button class="btn ghost" data-logout>${I.logout(20)}${s.logout}</button>
    <p class="sub" style="text-align:center;font-size:12px">${s.about} · v${APP_VERSION}</p></main>${nav('profile')}`;
  app.querySelectorAll('[data-lang]').forEach((b) => b.onclick = () => { store.setLang(b.dataset.lang); render(); });
  app.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => { store.setUser(Object.assign({}, u, { grade: +b.dataset.g })); render(); });
  app.querySelector('[data-logout]').onclick = () => { if (u.author) authorSignOut(); store.logout(); go('#/login'); };
  bindSchoolPills();
}

// "Ma'lumot": ilova muallifi va bog'lanish
function scrInfo() {
  const s = t();
  const initials = AUTHOR.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  const tel = AUTHOR.phone.replace(/[^+\d]/g, '');
  app.innerHTML = `<main class="screen">
    <h1 style="font-size:24px">${esc(s.infoTitle)}</h1>
    <section class="about-hero">
      <div class="av">${esc(initials)}</div>
      <h1>${esc(AUTHOR.full)}</h1>
      <span class="role">${esc(s.appAuthor)}</span>
    </section>
    <section class="sec col" style="gap:10px"><h2>${esc(s.writeUs)}</h2>
      <a class="contact" href="tel:${tel}"><span class="ic" style="background:#E7F6F1;color:#0F7A64">${I.phone(22)}</span>
        <span class="grow"><small>${esc(s.phoneL)}</small><b>${esc(AUTHOR.phone)}</b></span>${I.chevron(20)}</a>
      <a class="contact" href="https://t.me/${AUTHOR.telegram}" target="_blank" rel="noopener"><span class="ic" style="background:#E8F3FB;color:#1E6FA8">${I.telegram(22)}</span>
        <span class="grow"><small>Telegram</small><b>@${esc(AUTHOR.telegram)}</b></span>${I.chevron(20)}</a>
    </section>
    <div class="card row" style="gap:14px;align-items:center">${appLogo(52)}
      <span class="grow col" style="gap:2px"><b style="font-size:17px">${esc(appName())}</b><span class="sub">${esc(s.about)} · v${APP_VERSION}</span></span></div>
  </main>${nav('info')}`;
}

// ---------- Marshrutlash ----------
function render() {
  if (!/^#\/read\//.test(location.hash)) overlay.innerHTML = '';
  const [, route, arg] = (location.hash.match(/^#\/([^/]*)\/?(.*)$/) || []);
  const a = arg ? decodeURIComponent(arg) : '';
  if (!store.user && route !== 'login') return go('#/login');
  document.documentElement.lang = L();
  app.className = /^(login|test|cert)$/.test(route || '') ? 'bare' : '';
  window.scrollTo(0, 0);
  switch (route) {
    case 'login': return store.user ? go('#/home') : scrLogin();
    case 'school': return scrSchool(a ? +a : 0);
    case 'subject': return scrSubject(a);
    case 'read': return scrRead(a);
    case 'library': return scrLibrary();
    case 'tests': return scrTests(a ? +a : 0);
    case 'test': return scrTest(a);
    case 'cert': return scrCert(a);
    case 'profile': return scrProfile();
    case 'muallif': return scrAuthor(panelCtx);
    case 'muallif-info': case 'malumot': return scrInfo();
    default: return scrHome();
  }
}

document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); if (g.getAttribute('data-go').startsWith('#/test/')) run = null; go(g.getAttribute('data-go')); return; }
  if (e.target.closest('[data-back]')) { history.length > 1 ? history.back() : go('#/home'); return; }
  if (e.target.closest('[data-cyclelang]')) { const i = LANGS.indexOf(L()); store.setLang(LANGS[(i + 1) % LANGS.length]); render(); }
});
window.addEventListener('hashchange', render);

const panelCtx = {
  app, store, esc, I, toast, go,
  cloud: () => cloud, tests: () => tests, baseCatalog: () => baseCatalog,
  baseStrings: () => BASE_STRINGS, applyBooks, logo: (z) => appLogo(z),
  reloadCloud: () => applyCloud(cachedCloud())
};

loadData()
  .then(() => { render(); refreshCatalog(); refreshCloud(); })
  .catch((e) => { console.error(e); app.innerHTML = `<main class="screen no-nav"><div class="card empty">${t().loadError}</div></main>`; });
