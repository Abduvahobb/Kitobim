import './style.css';
import { STRINGS, LANGS, pick } from './i18n.js';
import { store } from './store.js';
import { I, LOGO } from './icons.js';
import { openReader, esc } from './reader.js';
import { drawCertificate, saveImage } from './cert.js';
import { REMOTE_CATALOG, APP_VERSION, AUTHOR } from './config.js';
import { getJson } from './net.js';

const app = document.getElementById('app');
const overlay = document.createElement('div');
document.body.appendChild(overlay);

let catalog = null;
let tests = { tests: [], passPercent: 70 };
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
  const useCached = cached && cached.grades && bookCount(cached) >= bookCount(local);
  indexCatalog(useCached ? cached : local, useCached ? REMOTE_CATALOG : new URL('catalog.json', location.href).href);
  try { tests = await loadJson(new URL('tests.json', location.href).href); } catch (e) { /* testlarsiz ham ishlaydi */ }
}

async function refreshCatalog() {
  if (!REMOTE_CATALOG) return;
  try {
    const fresh = await getJson(REMOTE_CATALOG);
    if (!fresh || !fresh.grades || !bookCount(fresh)) return;
    if (catalog && fresh.updated === catalog.updated && bookCount(fresh) === bookCount(catalog)) return;
    store.setCachedCatalog(fresh);
    indexCatalog(fresh, REMOTE_CATALOG);
    // O'qish yoki test paytida ekranni almashtirmaymiz
    if (!/^#\/(read|test|cert|audio|login)/.test(location.hash)) render();
  } catch (e) { /* internet yo'q — eski ro'yxat bilan davom etamiz */ }
}

function indexCatalog(c, base) {
  catalog = c;
  books.clear(); subjects.clear();
  catalog.fiction = catalog.fiction || [];
  catalog.audio = catalog.audio || [];
  for (const g of catalog.grades) {
    for (const s of g.subjects) {
      s.grade = g.grade;
      subjects.set(s.id, s);
      for (const b of s.books) {
        b.grade = g.grade; b.subject = s.id; b.color = b.color || s.color;
        b.file = new URL(b.file, base).href;
        books.set(b.id, b);
      }
    }
  }
  for (const b of catalog.fiction) { b.file = new URL(b.file, base).href; b.color = b.color || '#7A3E2E'; books.set(b.id, b); }
  for (const a of catalog.audio) { (a.chapters || []).forEach((c) => { c.file = new URL(c.file, base).href; }); }
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
    ['home', '#/home', I.home(), t().home],
    ['school', '#/school', I.school(), t().school],
    ['library', '#/library', I.library(), t().library],
    ['tests', '#/tests', I.test(), t().tests],
    ['profile', '#/profile', I.user(), t().profile]
  ];
  return `<nav class="tabs" aria-label="Menu"><div class="in">${items.map(([k, h, ic, lb]) =>
    `<button data-go="${h}" ${k === active ? 'aria-current="page"' : ''}>${ic}<span>${esc(lb)}</span></button>`).join('')}</div></nav>`;
}
function backBar(title, sub) {
  return `<div class="row"><button class="icon-btn" data-back aria-label="${t().back}">${I.back()}</button>
    <div class="grow"><h1 style="font-size:21px">${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}</div></div>`;
}
function bookItem(b, extra = '') {
  const p = store.progress(b.id);
  const pct = p && p.pages ? Math.round((p.page / p.pages) * 100) : 0;
  return `<button class="item" data-go="#/read/${encodeURIComponent(b.id)}">
    <span class="cover" style="background:${b.color || '#0F7A64'}"></span>
    <span class="grow col" style="gap:4px">
      <span class="t">${esc(bookTitle(b))}</span>
      ${b.sample ? `<span><span class="tag">${t().sample}</span></span>` : ''}
      ${b.author ? `<span class="s">${esc(pick(b.author, L()))}</span>` : ''}
      ${!p && b.size ? `<span class="s">${b.lang ? b.lang.toUpperCase() + ' · ' : ''}${(b.size / 1048576).toFixed(1)} MB${store.isSaved(b.id) ? ' · ' + t().savedOffline : ''}</span>` : ''}
      ${p ? `<span class="row" style="gap:8px"><span class="bar"><i style="width:${pct}%"></i></span><span class="s">${p.page}/${p.pages}</span></span>` : ''}
      ${extra}
    </span>${I.chevron(20)}</button>`;
}
function gradeGrid(selected, hrefFor) {
  let h = '<div class="grade-grid">';
  for (let g = 1; g <= 11; g++) {
    h += `<button class="grade" data-go="${hrefFor(g)}" aria-pressed="${g === selected}">${g}<small>${t().grade}</small></button>`;
  }
  return h + '</div>';
}

function authorCard() {
  const s = t();
  return `<section class="card row" style="gap:14px">
    <span class="badge" style="background:#1B2A41">${I.user(20)}</span>
    <span class="grow col" style="gap:2px"><span class="sub" style="font-size:12px">${s.author}</span>
      <b style="font-size:16px">${esc(AUTHOR.name)}</b>
      <a href="https://t.me/${AUTHOR.telegram}" class="row" style="gap:6px;font-size:14px;font-weight:600;text-decoration:none;min-height:32px">${I.telegram(18)}Telegram: @${AUTHOR.telegram}</a></span>
  </section>`;
}

// ---------- Ekranlar ----------
function scrLogin() {
  const s = t();
  const u = store.user || {};
  let grade = u.grade || null;
  app.className = '';
  app.innerHTML = `<main class="screen no-nav" style="gap:28px">
    <div class="pills" style="justify-content:center">${LANGS.map((l) =>
      `<button class="pill green" data-lang="${l}" aria-pressed="${l === L()}">${STRINGS[l].langName}</button>`).join('')}</div>
    <div class="col" style="align-items:center;text-align:center;gap:12px">${LOGO(96)}
      <h1 style="font-size:36px">Kitobim</h1><p class="sub" style="font-size:16px;max-width:300px">${s.tagline}</p></div>
    <form class="card col" style="gap:14px" novalidate>
      <div class="field"><label for="nm">${s.yourName}</label>
        <input id="nm" class="input" autocomplete="name" placeholder="${s.namePh}" value="${esc(u.name || '')}"><div class="err" id="eNm"></div></div>
      <div class="field"><label for="ph">${s.yourPhone}</label>
        <div class="row" style="gap:8px"><span class="prefix">+998</span>
        <input id="ph" class="input" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="90 123 45 67" value="${esc(u.phone || '')}"></div><div class="err" id="ePh"></div></div>
      <div class="field"><span style="font-size:14px;font-weight:600">${s.yourGrade}</span>
        <div class="grade-grid" id="gr">${Array.from({ length: 11 }, (_, i) => i + 1).map((g) =>
          `<button type="button" class="grade" data-g="${g}" aria-pressed="${g === grade}">${g}</button>`).join('')}</div></div>
      <button class="btn" type="submit">${s.start}</button>
    </form>
    <p class="sub" style="font-size:12px;text-align:center">${s.terms}</p>
    <p class="sub" style="font-size:12px;text-align:center">${s.author}: ${esc(AUTHOR.name)} · <a href="https://t.me/${AUTHOR.telegram}">@${AUTHOR.telegram}</a></p></main>`;

  app.querySelectorAll('[data-lang]').forEach((b) => b.onclick = () => { store.setLang(b.dataset.lang); scrLogin(); });
  app.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => {
    grade = +b.dataset.g;
    app.querySelectorAll('[data-g]').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.g === grade)));
  });
  const ph = app.querySelector('#ph');
  ph.oninput = () => {
    const d = ph.value.replace(/\D/g, '').slice(0, 9);
    ph.value = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
    app.querySelector('#ePh').textContent = '';
  };
  app.querySelector('#nm').oninput = () => { app.querySelector('#eNm').textContent = ''; };
  app.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const name = app.querySelector('#nm').value.trim().replace(/\s+/g, ' ');
    const digits = ph.value.replace(/\D/g, '');
    let ok = true;
    if (name.length < 3) { app.querySelector('#eNm').textContent = s.errName; ok = false; }
    if (digits.length !== 9) { app.querySelector('#ePh').textContent = s.errPhone; ok = false; }
    if (!ok) return;
    store.setUser({ name, phone: ph.value, grade: grade || 5 });
    go('#/home');
  };
}

function scrHome() {
  const s = t();
  const recent = store.recent().filter((r) => books.has(r.id));
  const last = recent[0] && books.get(recent[0].id);
  const lp = recent[0];
  app.innerHTML = `<main class="screen">
    <div class="row between">
      <div class="col" style="gap:2px"><h1>${s.hello}!</h1><p class="sub">${esc(store.user.name || '')} · ${s.whatToday}</p></div>
      <button class="pill" data-cyclelang aria-label="${s.language}" style="display:flex;align-items:center;gap:6px;height:44px">${I.globe(18)}${L().toUpperCase()}</button>
    </div>
    <label class="card row" style="padding:0 14px;height:50px;gap:10px">${I.search(20)}<span class="sr">${s.search}</span>
      <input id="q" type="search" placeholder="${s.search}" style="border:0;outline:none;background:transparent;flex:1;min-width:0;font-size:15px"></label>
    <div id="results" class="list"></div>
    <div id="main" style="display:flex;flex-direction:column;gap:20px">
      ${last ? `<button class="hero" data-go="#/read/${encodeURIComponent(last.id)}">
        <span class="small">${s.continueReading}</span><span class="title">${esc(bookTitle(last))}</span>
        <span class="meta">${lp.page}-${s.page}</span>
        <span class="row" style="gap:10px"><span class="bar"><i style="width:${Math.round(lp.page / lp.pages * 100)}%"></i></span><span style="font-size:13px;font-weight:600">${Math.round(lp.page / lp.pages * 100)}%</span></span></button>` : ''}
      <section class="col" style="gap:10px"><div class="row between"><h2>${s.schoolBooks}</h2>
        <button class="pill" data-go="#/school" style="height:36px">${s.all}</button></div>
        ${gradeGrid(store.user.grade, (g) => '#/school/' + g)}</section>
      <section class="col" style="gap:10px"><h2>${s.fiction}</h2>
        ${catalog.fiction.length ? `<div class="list">${catalog.fiction.map((b) => bookItem(b)).join('')}</div>` : `<div class="card empty">${s.soon}</div>`}</section>
      <section class="col" style="gap:10px"><h2>${s.audiobooks}</h2>
        ${catalog.audio.length ? `<div class="list">${catalog.audio.map((a) => `<button class="item" data-go="#/audio/${encodeURIComponent(a.id)}">
          <span class="badge" style="background:${a.color || '#7A3E2E'}">${I.headphones(20)}</span>
          <span class="grow col" style="gap:2px"><span class="t">${esc(pick(a.title, L()))}</span><span class="s">${esc(pick(a.author, L()))}</span></span>${I.chevron(20)}</button>`).join('')}</div>`
          : `<div class="card empty">${s.soon}</div>`}</section>
    </div></main>${nav('home')}`;

  const q = app.querySelector('#q');
  q.oninput = () => {
    const v = q.value.trim().toLowerCase();
    const res = app.querySelector('#results');
    app.querySelector('#main').style.display = v ? 'none' : 'flex';
    if (!v) { res.innerHTML = ''; return; }
    const found = [];
    for (const sb of subjects.values()) {
      if (pick(sb.name, L()).toLowerCase().includes(v)) found.push(`<button class="item" data-go="#/subject/${sb.id}">
        <span class="badge" style="background:${sb.color}">${esc(pick(sb.name, L())[0])}</span>
        <span class="grow col" style="gap:2px"><span class="t">${esc(pick(sb.name, L()))}</span><span class="s">${sb.grade}-${s.grade}</span></span>${I.chevron(20)}</button>`);
    }
    for (const b of books.values()) if (bookTitle(b).toLowerCase().includes(v)) found.push(bookItem(b));
    res.innerHTML = found.slice(0, 40).join('') || `<div class="empty">—</div>`;
  };
}

// O'quvchining maktab tili: o'zbek yoki rus maktabi darsliklari
function schoolLang() { return (store.user && store.user.school) || (L() === 'ru' ? 'ru' : 'uz'); }
function setSchoolLang(v) { store.setUser(Object.assign({}, store.user, { school: v })); }
function schoolPills() {
  const s = t(), cur = schoolLang();
  return `<div class="pills" role="group" aria-label="${s.schoolLang}">${[['uz', s.schoolUz], ['ru', s.schoolRu]].map(([k, lb]) =>
    `<button class="pill green" data-school="${k}" aria-pressed="${k === cur}">${lb}</button>`).join('')}</div>`;
}
function booksFor(sb) {
  const mine = sb.books.filter((b) => !b.lang || b.lang === schoolLang());
  return mine.length ? mine : sb.books;
}
function bindSchoolPills() {
  app.querySelectorAll('[data-school]').forEach((b) => b.onclick = () => { setSchoolLang(b.dataset.school); render(); });
}

function scrSchool(g) {
  const s = t();
  g = g || store.user.grade || 5;
  const gr = catalog.grades.find((x) => x.grade === g);
  const list = (gr ? gr.subjects : []).filter((sb) => !sb.books.length || sb.books.some((b) => !b.lang || b.lang === schoolLang()));
  app.innerHTML = `<main class="screen">
    <div class="col" style="gap:4px"><h1>${s.schoolBooks}</h1><p class="sub">${s.chooseGrade}</p></div>
    ${gradeGrid(g, (n) => '#/school/' + n)}
    ${schoolPills()}
    <h2>${g}-${s.subjectsOf}</h2>
    ${list.length ? `<div class="subj-grid">${list.map((sb) => {
      const n = sb.books.filter((b) => !b.lang || b.lang === schoolLang()).length;
      return `<button class="subj" data-go="#/subject/${sb.id}">
      <span class="badge" style="background:${sb.color}">${esc(pick(sb.name, L())[0])}</span>
      <span class="col" style="gap:2px;min-width:0"><span class="name">${esc(pick(sb.name, L()))}</span>
      <span class="cnt">${n ? n + ' ' + s.books : s.soon}</span></span></button>`;
    }).join('')}</div>` : `<div class="card empty">${s.soon}</div>`}
  </main>${nav('school')}`;
  bindSchoolPills();
}

function scrSubject(id) {
  const s = t();
  const sb = subjects.get(id);
  if (!sb) return go('#/school');
  const hasBoth = new Set(sb.books.map((b) => b.lang).filter(Boolean)).size > 1;
  const list = booksFor(sb);
  app.innerHTML = `<main class="screen">
    ${backBar(pick(sb.name, L()), sb.grade + '-' + s.grade)}
    ${hasBoth ? schoolPills() : ''}
    ${list.length ? `<div class="list">${list.map((b) => bookItem(b)).join('')}</div>` : `<div class="card empty">${s.noBooks}</div>`}
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
      <span class="badge" style="background:#0F7A64">${I.check(20)}</span>
      <span class="grow col" style="gap:2px"><span class="t">${esc(c.title)}</span><span class="s">${c.pct}% · ${c.date}</span></span>${I.chevron(20)}</button>`).join('') : `<div class="card empty">${s.emptyCerts}</div>`;
  app.innerHTML = `<main class="screen">
    <h1>${s.library}</h1>
    <div class="stats"><div class="card stat"><b>${recent.length}</b><span>${s.booksOpened}</span></div>
      <div class="card stat"><b>${certs.length}</b><span>${s.certsCount}</span></div></div>
    <div class="pills" role="tablist">${[['reading', s.reading], ['saved', s.saved], ['certs', s.certificates]].map(([k, lb]) =>
      `<button class="pill" role="tab" data-tab="${k}" aria-selected="${k === libTab}">${lb}</button>`).join('')}</div>
    <div class="list">${body}</div></main>${nav('library')}`;
  app.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { libTab = b.dataset.tab; scrLibrary(); });
  app.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { await store.removeFile(b.dataset.del); scrLibrary(); });
}

function scrTests() {
  const s = t();
  const list = tests.tests.slice().sort((a, b) => (a.grade === store.user.grade ? -1 : 0) - (b.grade === store.user.grade ? -1 : 0));
  app.innerHTML = `<main class="screen">
    <div class="col" style="gap:4px"><h1>${s.tests}</h1><p class="sub">${s.testsIntro}</p></div>
    <div class="list">${list.map((x) => `<button class="item" data-go="#/test/${x.id}">
      <span class="badge" style="background:${(subjects.get(x.subject) || {}).color || '#0F7A64'}">${I.test(20)}</span>
      <span class="grow col" style="gap:2px"><span class="t">${esc(pick(x.title, L()))}</span><span class="s">${x.questions.length} ${s.questions}</span></span>${I.chevron(20)}</button>`).join('') || `<div class="card empty">${s.soon}</div>`}</div>
  </main>${nav('tests')}`;
}

let run = null; // joriy test holati
function scrTest(id) {
  const s = t();
  const tt = tests.tests.find((x) => x.id === id);
  if (!tt) return go('#/tests');
  if (!run || run.id !== id) run = { id, i: 0, picked: null, right: 0, done: false, certId: null };
  const title = pick(tt.title, L());

  if (run.done) {
    const pct = Math.round((run.right / tt.questions.length) * 100);
    const pass = pct >= (tests.passPercent || 70);
    app.innerHTML = `<main class="screen no-nav" style="text-align:center">
      <div class="row"><button class="icon-btn" data-go="#/tests" aria-label="${s.back}">${I.close()}</button></div>
      <div class="score ${pass ? '' : 'low'}">${run.right}/${tt.questions.length}</div>
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
    <div class="card col" style="gap:6px;padding:20px"><span style="font-size:12px;font-weight:600;color:#0F7A64">${s.question}</span>
      <h2 style="font-size:21px;line-height:1.35">${esc(q.q)}</h2></div>
    <div class="list">${q.options.map((o, k) => {
      let cls = '', note = '', mark = 'ABCD'[k];
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
  app.querySelector('[data-dl]').onclick = () => saveImage(url, `Kitobim-sertifikat-${c.id}.png`).catch(() => toast(s.loadError));
}

function scrProfile() {
  const s = t();
  const u = store.user;
  app.innerHTML = `<main class="screen">
    <h1>${s.profile}</h1>
    <div class="card row" style="gap:14px"><span class="badge" style="width:56px;height:56px;border-radius:28px;background:#0F7A64;font-size:22px">${esc((u.name || '?')[0].toUpperCase())}</span>
      <div class="col" style="gap:2px"><b style="font-size:17px">${esc(u.name)}</b><span class="sub">${u.grade}-${s.grade} · +998 ${esc(u.phone)}</span></div></div>
    <section class="col" style="gap:10px"><h2>${s.language}</h2>
      <div class="pills">${LANGS.map((l) => `<button class="pill green" data-lang="${l}" aria-pressed="${l === L()}">${STRINGS[l].langName}</button>`).join('')}</div></section>
    <section class="col" style="gap:10px"><h2>${s.schoolLang}</h2>${schoolPills()}</section>
    <section class="col" style="gap:10px"><h2>${s.yourGrade}</h2>
      <div class="grade-grid">${Array.from({ length: 11 }, (_, i) => i + 1).map((g) => `<button class="grade" data-g="${g}" aria-pressed="${g === u.grade}">${g}</button>`).join('')}</div></section>
    ${authorCard()}
    <button class="btn ghost" data-logout>${I.logout(20)}${s.logout}</button>
    <p class="sub" style="text-align:center;font-size:12px">${s.about} · v${APP_VERSION}</p></main>${nav('profile')}`;
  app.querySelectorAll('[data-lang]').forEach((b) => b.onclick = () => { store.setLang(b.dataset.lang); render(); });
  app.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => { store.setUser(Object.assign({}, u, { grade: +b.dataset.g })); render(); });
  app.querySelector('[data-logout]').onclick = () => { store.logout(); go('#/login'); };
  bindSchoolPills();
}

let audioEl = null;
function scrAudio(id) {
  const s = t();
  const a = catalog.audio.find((x) => x.id === id);
  if (!a || !(a.chapters || []).length) {
    app.innerHTML = `<main class="screen no-nav">${backBar(s.audiobooks)}<div class="card empty">${s.noAudio}</div></main>`;
    return;
  }
  const st = { ch: 0, speeds: [1, 1.25, 1.5, 2, 0.75], si: 0 };
  if (audioEl) { audioEl.pause(); }
  audioEl = new Audio();
  const fmt = (x) => { x = Math.floor(x || 0); return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); };
  function draw() {
    const ch = a.chapters[st.ch];
    app.innerHTML = `<main class="screen no-nav">
      <div class="row between"><button class="icon-btn" data-back aria-label="${s.back}">${I.back()}</button><span class="sub" style="font-weight:600">${s.nowPlaying}</span><span style="width:44px"></span></div>
      <div class="au-cover" style="background:${a.color || '#7A3E2E'}"><b>${esc(pick(a.title, L()))}</b><span>${esc(pick(a.author, L()))}</span></div>
      <div class="col" style="align-items:center;text-align:center;gap:4px"><h1 style="font-size:22px">${esc(pick(a.title, L()))}</h1><p class="sub">${esc(pick(ch.title, L()))}</p></div>
      <div class="col"><label class="sr" for="pos">${s.page}</label><input id="pos" type="range" min="0" max="1000" value="0">
        <div class="row between sub" style="font-size:12px"><span id="cur">0:00</span><span id="dur">0:00</span></div></div>
      <div class="au-ctrl"><button class="s" data-a="b15" aria-label="${s.back15}">${I.rewind(20)}15</button>
        <button class="m" data-a="pp" aria-label="${s.play}">${I.play()}</button>
        <button class="s" data-a="f15" aria-label="${s.fwd15}">${I.forward(20)}15</button></div>
      <button class="btn ghost" data-a="sp">${s.speed}: ${st.speeds[st.si]}x</button>
      <div class="list">${a.chapters.map((c, k) => `<button class="item" data-ch="${k}" style="${k === st.ch ? 'border-color:#0F7A64' : ''}"><span class="grow t">${esc(pick(c.title, L()))}</span></button>`).join('')}</div></main>`;
    const pos = app.querySelector('#pos'), pp = app.querySelector('[data-a="pp"]');
    const key = a.id + ':' + st.ch;
    if (!audioEl.src || audioEl.dataset.key !== key) {
      audioEl.src = ch.file; audioEl.dataset.key = key;
      audioEl.currentTime = store.audioPos(key);
    }
    audioEl.playbackRate = st.speeds[st.si];
    const upd = () => {
      if (!document.body.contains(pos)) return;
      pos.value = audioEl.duration ? (audioEl.currentTime / audioEl.duration) * 1000 : 0;
      app.querySelector('#cur').textContent = fmt(audioEl.currentTime);
      app.querySelector('#dur').textContent = fmt(audioEl.duration);
      pp.innerHTML = audioEl.paused ? I.play() : I.pause();
      pp.setAttribute('aria-label', audioEl.paused ? s.play : s.pause);
      store.setAudioPos(key, audioEl.currentTime);
    };
    audioEl.ontimeupdate = upd; audioEl.onplay = upd; audioEl.onpause = upd; audioEl.onloadedmetadata = upd;
    pos.oninput = () => { if (audioEl.duration) audioEl.currentTime = (pos.value / 1000) * audioEl.duration; };
    pp.onclick = () => (audioEl.paused ? audioEl.play().catch(() => toast(s.loadError)) : audioEl.pause());
    app.querySelector('[data-a="b15"]').onclick = () => { audioEl.currentTime = Math.max(0, audioEl.currentTime - 15); };
    app.querySelector('[data-a="f15"]').onclick = () => { audioEl.currentTime = audioEl.currentTime + 15; };
    app.querySelector('[data-a="sp"]').onclick = () => { st.si = (st.si + 1) % st.speeds.length; draw(); };
    app.querySelectorAll('[data-ch]').forEach((b) => b.onclick = () => { st.ch = +b.dataset.ch; audioEl.pause(); draw(); audioEl.play().catch(() => {}); });
  }
  draw();
}

// ---------- Marshrutlash ----------
function render() {
  if (!/^#\/read\//.test(location.hash)) overlay.innerHTML = '';
  if (audioEl && !/^#\/audio\//.test(location.hash)) { audioEl.pause(); }
  const [, route, arg] = (location.hash.match(/^#\/([^/]*)\/?(.*)$/) || []);
  const a = arg ? decodeURIComponent(arg) : '';
  if (!store.user && route !== 'login') return go('#/login');
  document.documentElement.lang = L();
  app.className = '';
  window.scrollTo(0, 0);
  switch (route) {
    case 'login': return store.user ? go('#/home') : scrLogin();
    case 'school': return scrSchool(a ? +a : 0);
    case 'subject': return scrSubject(a);
    case 'read': return scrRead(a);
    case 'library': return scrLibrary();
    case 'tests': return scrTests();
    case 'test': return scrTest(a);
    case 'cert': return scrCert(a);
    case 'profile': return scrProfile();
    case 'audio': return scrAudio(a);
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

loadData()
  .then(() => { render(); refreshCatalog(); })
  .catch((e) => { console.error(e); app.innerHTML = `<main class="screen no-nav"><div class="card empty">${t().loadError}</div></main>`; });
