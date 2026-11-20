// Muallif paneli: ilova nomi va rasmlari, kitoblar, matnlar va testlarni o'zgartirish.
// Saqlangan narsa Firestore'ga yoziladi va hamma telefonda keyingi ochilishda ko'rinadi.
import { saveDoc, uploadFile, imageToDataUrl, authorSignedIn, authorSignIn } from './cloud.js';

const clone = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));
const LANGS3 = [['uz', 'O‘zbekcha'], ['ru', 'Русский'], ['en', 'English']];

let tab = 'ilova';
let st = null; // ishchi nusxalar: { ilova, matnlar, kitoblar, testlar, grade, subject, lang, testId, q }

export function scrAuthor(ctx) {
  const { app, esc, I, store } = ctx;
  if (!store.user || !store.user.author) return ctx.go('#/profile');
  if (!st) {
    const c = ctx.cloud();
    st = {
      ilova: clone((c.ilova && c.ilova.json) || {}),
      matnlar: clone((c.matnlar && c.matnlar.json) || {}),
      kitoblar: Object.assign({ edits: {}, added: [], deleted: [], subjects: {} }, clone((c.kitoblar && c.kitoblar.json) || {})),
      testlar: clone(ctx.tests()),
      grade: (store.user && store.user.grade) || 5, subject: '', lang: 'uz', testId: '', q: ''
    };
  }
  const tabs = [['ilova', 'Ilova'], ['kitoblar', 'Kitoblar'], ['matnlar', 'Matnlar'], ['testlar', 'Testlar']];
  app.innerHTML = `<main class="screen no-nav">
    <div class="row" style="gap:10px"><button class="icon-btn boxed" data-close aria-label="Orqaga">${I.back(22)}</button>
      <div class="grow"><h1 style="font-size:22px">Muallif paneli</h1><p class="sub">O‘zgarishlar saqlangach, hamma telefonda ko‘rinadi</p></div></div>
    <div class="seg" role="tablist">${tabs.map(([k, n]) => `<button role="tab" data-tab="${k}" aria-selected="${k === tab}">${n}</button>`).join('')}</div>
    <div id="pane" class="col" style="gap:14px"></div></main>`;
  app.querySelector('[data-close]').onclick = () => { st = null; ctx.go('#/profile'); };
  app.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; scrAuthor(ctx); });
  const pane = app.querySelector('#pane');
  ({ ilova: paneApp, kitoblar: paneBooks, matnlar: paneTexts, testlar: paneTests })[tab](ctx, pane, esc, I);
}

// Saqlashdan oldin muallif hali tizimda ekanini tekshiradi (seans tugagan bo'lsa parol so'raladi)
async function save(ctx, name, json, btn) {
  const old = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Saqlanmoqda…';
  try {
    if (!(await authorSignedIn())) {
      const pw = window.prompt('Muallif paroli:');
      if (!pw) throw new Error('cancel');
      await authorSignIn(pw);
    }
    await saveDoc(name, json);
    ctx.reloadCloud();
    ctx.toast('Saqlandi ✓ Hamma telefonda yangilanadi');
  } catch (e) {
    const c = (e && (e.code || e.message)) || '';
    ctx.toast(c === 'too-big' ? 'Juda katta: rasmlarni kamaytiring' : /permission/i.test(c) ? 'Ruxsat yo‘q: Firestore qoidalarini tekshiring' : /cancel/.test(c) ? 'Bekor qilindi' : 'Saqlab bo‘lmadi: ' + c);
  } finally {
    btn.disabled = false; btn.innerHTML = old;
  }
}

function pickFile(accept) {
  return new Promise((res) => {
    const f = document.createElement('input');
    f.type = 'file'; f.accept = accept;
    f.onchange = () => res(f.files && f.files[0]);
    f.click();
  });
}

// ---------- Ilova: nomi, ichki logotip, telefon ikonkasi ----------
function paneApp(ctx, pane, esc) {
  const a = st.ilova;
  pane.innerHTML = `
    <div class="card col" style="gap:12px">
      <div class="field"><label for="an">Ilova nomi</label><input id="an" class="input" value="${esc(a.name || 'Kitobim')}"></div>
      <div class="field"><span class="lb">Ilova ichidagi logotip</span>
        <div class="row" style="gap:12px"><span id="lp">${a.logo ? `<img src="${a.logo}" width="64" height="64" style="border-radius:15px" alt="">` : ctx.logo(64)}</span>
        <button class="btn soft" data-logo style="width:auto">Rasm tanlash</button>
        ${a.logo ? '<button class="btn ghost" data-logo-rm style="width:auto">Asliga qaytarish</button>' : ''}</div></div>
      <div class="field"><span class="lb">Telefon ekranidagi ikonka</span>
        <div class="row" style="gap:12px">${a.icon ? `<img src="${a.icon}" width="64" height="64" style="border-radius:16px" alt="">` : '<span class="sub">Hozirgi ikonka</span>'}
        <button class="btn soft" data-icon style="width:auto">Rasm tanlash</button></div>
        <p class="sub" style="font-size:13px">Android telefon ekranidagi belgini faqat yangi APK orqali almashtirishga ruxsat beradi. Siz tanlagan ikonka keyingi APK’ga avtomatik qo‘shiladi (har 6 soatda tekshiriladi).</p></div>
      <button class="btn" data-save>Saqlash</button></div>`;
  pane.querySelector('#an').oninput = (e) => { a.name = e.target.value; };
  pane.querySelector('[data-logo]').onclick = async () => {
    const f = await pickFile('image/*'); if (!f) return;
    a.logo = await imageToDataUrl(f, 256, 'image/png'); paneApp(ctx, pane, esc);
  };
  const rm = pane.querySelector('[data-logo-rm]');
  if (rm) rm.onclick = () => { delete a.logo; paneApp(ctx, pane, esc); };
  pane.querySelector('[data-icon]').onclick = async () => {
    const f = await pickFile('image/*'); if (!f) return;
    a.icon = await imageToDataUrl(f, 512, 'image/png'); paneApp(ctx, pane, esc);
  };
  pane.querySelector('[data-save]').onclick = (e) => save(ctx, 'ilova', a, e.currentTarget);
}

// ---------- Kitoblar ----------
function paneBooks(ctx, pane, esc, I) {
  const k = st.kitoblar;
  const cat = ctx.applyBooks(ctx.baseCatalog(), k);
  const g = cat.grades.find((x) => x.grade === st.grade) || cat.grades[0];
  if (!g.subjects.some((s) => s.id === st.subject)) st.subject = g.subjects[0] ? g.subjects[0].id : '';
  const subj = g.subjects.find((s) => s.id === st.subject);
  const list = subj ? subj.books : [];
  const val = (b, f) => (k.edits[b.id] && k.edits[b.id][f] !== undefined ? k.edits[b.id][f] : b[f]);
  pane.innerHTML = `
    <div class="row" style="gap:10px;flex-wrap:wrap">
      <select id="gr" class="input" style="width:auto">${cat.grades.map((x) => `<option value="${x.grade}" ${x.grade === g.grade ? 'selected' : ''}>${x.grade}-sinf</option>`).join('')}</select>
      <select id="sb" class="input grow" style="width:auto">${g.subjects.map((s) => `<option value="${s.id}" ${s.id === st.subject ? 'selected' : ''}>${esc(s.name.uz)} (${s.books.length})</option>`).join('')}</select>
    </div>
    ${subj ? `<div class="field"><span class="lb">Fan nomi (o‘zbekcha)</span><input class="input" data-sname value="${esc(((k.subjects[subj.id] || {}).name || {}).uz || subj.name.uz)}"></div>` : ''}
    <div class="col" style="gap:12px">${list.map((b) => {
      const t = val(b, 'title') || {};
      const cov = val(b, 'cover');
      return `<div class="card col" style="gap:10px" data-b="${esc(b.id)}">
        <div class="row" style="gap:12px;align-items:flex-start">
          <span style="width:64px;height:88px;border-radius:8px;overflow:hidden;background:${b.color || '#0F7A64'};flex:none">${cov ? `<img src="${cov.startsWith('data:') ? cov : new URL(cov, location.href).href}" style="width:100%;height:100%;object-fit:cover" alt="">` : ''}</span>
          <div class="col grow" style="gap:6px;min-width:0">
            ${LANGS3.map(([l, n]) => `<input class="input" style="height:42px" data-title="${l}" placeholder="${n}" value="${esc(t[l] || '')}">`).join('')}
          </div></div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <button class="btn soft" style="width:auto;height:42px" data-cover>${I.plus(18)}Muqova</button>
          <button class="btn soft" style="width:auto;height:42px" data-pdf>${I.download(18)}PDF yuklash</button>
          <a class="btn ghost" style="width:auto;height:42px" href="${esc(val(b, 'src') || b.file)}" target="_blank" rel="noopener">Ochish</a>
          <button class="btn ghost" style="width:auto;height:42px;color:#B42318" data-del>O‘chirish</button></div>
        <input class="input" style="height:42px;font-size:13px" data-url placeholder="yoki PDF havolasi (https://…)" value="${esc(val(b, 'file') || '')}">
      </div>`;
    }).join('') || '<div class="card empty">Bu fanda kitob yo‘q</div>'}</div>
    <button class="btn ghost" data-add>${I.plus(20)}Kitob qo‘shish</button>
    <button class="btn" data-save>Kitoblarni saqlash</button>`;

  pane.querySelector('#gr').onchange = (e) => { st.grade = +e.target.value; st.subject = ''; paneBooks(ctx, pane, esc, I); };
  pane.querySelector('#sb').onchange = (e) => { st.subject = e.target.value; paneBooks(ctx, pane, esc, I); };
  const sn = pane.querySelector('[data-sname]');
  if (sn) sn.oninput = (e) => { k.subjects[subj.id] = { name: Object.assign({}, subj.name, { uz: e.target.value }) }; };
  const edit = (id, patch) => { k.edits[id] = Object.assign({}, k.edits[id], patch); };
  pane.querySelectorAll('[data-b]').forEach((card) => {
    const id = card.dataset.b;
    const b = list.find((x) => x.id === id);
    card.querySelectorAll('[data-title]').forEach((inp) => inp.oninput = () => {
      edit(id, { title: Object.assign({}, b.title, (k.edits[id] || {}).title, { [inp.dataset.title]: inp.value }) });
    });
    card.querySelector('[data-url]').onchange = (e) => { const u = e.target.value.trim(); if (/^https?:\/\//.test(u)) edit(id, { file: u, src: '' }); };
    card.querySelector('[data-cover]').onclick = async () => {
      const f = await pickFile('image/*'); if (!f) return;
      edit(id, { cover: await imageToDataUrl(f, 220) }); paneBooks(ctx, pane, esc, I);
    };
    card.querySelector('[data-pdf]').onclick = async (ev) => {
      const btn = ev.currentTarget;
      const f = await pickFile('application/pdf'); if (!f) return;
      btn.disabled = true;
      try {
        if (!(await authorSignedIn())) { const pw = window.prompt('Muallif paroli:'); if (!pw) throw new Error('cancel'); await authorSignIn(pw); }
        const url = await uploadFile(`kitoblar/${id}-${Date.now()}.pdf`, f, (p) => { btn.textContent = Math.round(p * 100) + '%'; });
        edit(id, { file: url, src: '', size: f.size });
        ctx.toast('PDF yuklandi. "Kitoblarni saqlash"ni bosing');
        paneBooks(ctx, pane, esc, I);
      } catch (e) {
        btn.disabled = false; btn.textContent = 'PDF yuklash';
        ctx.toast(/cancel/.test(e.message || '') ? 'Bekor qilindi' : 'Fayl yuklanmadi: Firebase Storage yoqilmagan bo‘lishi mumkin. PDF havolasini kiriting');
      }
    };
    card.querySelector('[data-del]').onclick = () => {
      if (!window.confirm('Bu kitob ilovadan olib tashlansinmi?')) return;
      k.deleted = Array.from(new Set((k.deleted || []).concat(id)));
      paneBooks(ctx, pane, esc, I);
    };
  });
  pane.querySelector('[data-add]').onclick = () => {
    if (!subj) return;
    const id = `${subj.id}-yangi-${Date.now().toString(36)}`;
    k.added.push({ subject: subj.id, book: { id, title: { uz: `${subj.name.uz} · ${g.grade}-sinf`, ru: '', en: '' }, lang: 'uz', part: null, file: '' } });
    paneBooks(ctx, pane, esc, I);
  };
  pane.querySelector('[data-save]').onclick = (e) => {
    const bad = list.find((b) => !val(b, 'file'));
    if (bad) { ctx.toast('Har bir kitobga PDF yuklang yoki havola kiriting'); return; }
    save(ctx, 'kitoblar', k, e.currentTarget);
  };
}

// ---------- Matnlar ----------
function paneTexts(ctx, pane, esc) {
  const base = ctx.baseStrings()[st.lang];
  const ov = st.matnlar[st.lang] = st.matnlar[st.lang] || {};
  const keys = Object.keys(base).filter((k) => typeof base[k] === 'string');
  const q = st.q.toLowerCase();
  const shown = keys.filter((k) => !q || base[k].toLowerCase().includes(q) || (ov[k] || '').toLowerCase().includes(q));
  pane.innerHTML = `
    <div class="seg">${LANGS3.map(([l, n]) => `<button data-l="${l}" aria-pressed="${l === st.lang}">${n}</button>`).join('')}</div>
    <input class="input" id="q" placeholder="Matnni qidirish" value="${esc(st.q)}">
    <div class="col" style="gap:10px">${shown.map((k) => `<div class="field"><span class="lb" style="font-weight:500">${esc(base[k])}</span>
      <input class="input" style="height:44px" data-k="${k}" value="${esc(ov[k] || '')}" placeholder="${esc(base[k])}"></div>`).join('')}</div>
    <button class="btn" data-save>Matnlarni saqlash</button>`;
  pane.querySelectorAll('[data-l]').forEach((b) => b.onclick = () => { st.lang = b.dataset.l; paneTexts(ctx, pane, esc); });
  const qi = pane.querySelector('#q');
  qi.oninput = () => { st.q = qi.value; const pos = qi.selectionStart; paneTexts(ctx, pane, esc); const n = pane.querySelector('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  pane.querySelectorAll('[data-k]').forEach((inp) => inp.oninput = () => {
    if (inp.value.trim()) ov[inp.dataset.k] = inp.value; else delete ov[inp.dataset.k];
  });
  pane.querySelector('[data-save]').onclick = (e) => save(ctx, 'matnlar', st.matnlar, e.currentTarget);
}

// ---------- Testlar ----------
function paneTests(ctx, pane, esc, I) {
  const T = st.testlar;
  T.tests = T.tests || [];
  if (!T.tests.some((x) => x.id === st.testId)) st.testId = T.tests[0] ? T.tests[0].id : '';
  const tt = T.tests.find((x) => x.id === st.testId);
  const cat = ctx.applyBooks(ctx.baseCatalog(), st.kitoblar);
  const subjOf = (g) => ((cat.grades.find((x) => x.grade === g) || {}).subjects || []);
  pane.innerHTML = `
    <div class="row" style="gap:10px">
      <select id="ts" class="input grow" style="width:auto">${T.tests.map((x) => `<option value="${esc(x.id)}" ${x.id === st.testId ? 'selected' : ''}>${x.grade}-sinf · ${esc((x.title && x.title.uz) || x.id)}</option>`).join('')}</select>
      <button class="btn soft" style="width:auto" data-new>${I.plus(18)}Yangi</button></div>
    <div class="field"><label for="pp">O‘tish bali (%) — sertifikat uchun</label><input id="pp" class="input" type="number" min="1" max="100" value="${T.passPercent || 70}"></div>
    ${tt ? `<div class="card col" style="gap:10px">
      <div class="field"><label>Test nomi</label><input class="input" data-tt value="${esc((tt.title && tt.title.uz) || '')}"></div>
      <div class="row" style="gap:10px">
        <select class="input" data-tg style="width:auto">${Array.from({ length: 11 }, (_, i) => i + 1).map((g) => `<option value="${g}" ${g === tt.grade ? 'selected' : ''}>${g}-sinf</option>`).join('')}</select>
        <select class="input grow" data-tsub style="width:auto">${subjOf(tt.grade).map((s) => `<option value="${s.id}" ${s.id === tt.subject ? 'selected' : ''}>${esc(s.name.uz)}</option>`).join('')}</select></div>
      </div>
      ${tt.questions.map((q, i) => `<div class="card col" style="gap:8px" data-q="${i}">
        <div class="row"><b class="grow">${i + 1}-savol</b><button class="icon-btn" data-qdel aria-label="O‘chirish">${I.close(18)}</button></div>
        <textarea class="input" style="height:auto;min-height:70px;padding:10px 14px;font:inherit;resize:vertical" data-qt>${esc(q.q)}</textarea>
        ${q.options.map((o, j) => `<label class="row" style="gap:8px"><input type="radio" name="a${i}" value="${j}" ${j === q.answer ? 'checked' : ''} data-ans>
          <input class="input grow" style="height:42px" data-opt="${j}" value="${esc(o)}"></label>`).join('')}
        <input class="input" style="height:42px" data-why placeholder="Izoh (nega to‘g‘ri)" value="${esc(q.why || '')}">
      </div>`).join('')}
      <button class="btn ghost" data-qadd>${I.plus(20)}Savol qo‘shish</button>
      <button class="btn ghost" style="color:#B42318" data-tdel>Testni o‘chirish</button>` : '<div class="card empty">Test yo‘q</div>'}
    <button class="btn" data-save>Testlarni saqlash</button>`;
  pane.querySelector('#ts') && (pane.querySelector('#ts').onchange = (e) => { st.testId = e.target.value; paneTests(ctx, pane, esc, I); });
  pane.querySelector('#pp').oninput = (e) => { T.passPercent = Math.max(1, Math.min(100, +e.target.value || 70)); };
  pane.querySelector('[data-new]').onclick = () => {
    const g = st.grade || 5;
    const s0 = subjOf(g)[0];
    const id = 'test-' + Date.now().toString(36);
    T.tests.push({ id, grade: g, subject: s0 ? s0.id : '', title: { uz: 'Yangi test', ru: 'Новый тест', en: 'New test' },
      questions: [{ q: 'Savol matni', options: ['A', 'B', 'C', 'D'], answer: 0, why: '' }] });
    st.testId = id; paneTests(ctx, pane, esc, I);
  };
  pane.querySelector('[data-save]').onclick = (e) => {
    const bad = T.tests.find((x) => !x.questions.length || x.questions.some((q) => !q.q.trim() || q.options.some((o) => !o.trim())));
    if (bad) { ctx.toast(`"${(bad.title && bad.title.uz) || bad.id}" testida bo‘sh savol yoki javob bor`); return; }
    save(ctx, 'testlar', T, e.currentTarget);
  };
  if (!tt) return;
  pane.querySelector('[data-tt]').oninput = (e) => { tt.title = Object.assign({}, tt.title, { uz: e.target.value }); };
  pane.querySelector('[data-tg]').onchange = (e) => { tt.grade = +e.target.value; const s0 = subjOf(tt.grade)[0]; tt.subject = s0 ? s0.id : ''; paneTests(ctx, pane, esc, I); };
  pane.querySelector('[data-tsub]').onchange = (e) => { tt.subject = e.target.value; };
  pane.querySelectorAll('[data-q]').forEach((card) => {
    const q = tt.questions[+card.dataset.q];
    card.querySelector('[data-qt]').oninput = (e) => { q.q = e.target.value; };
    card.querySelectorAll('[data-opt]').forEach((inp) => inp.oninput = () => { q.options[+inp.dataset.opt] = inp.value; });
    card.querySelectorAll('[data-ans]').forEach((r) => r.onchange = () => { q.answer = +r.value; });
    card.querySelector('[data-why]').oninput = (e) => { q.why = e.target.value; };
    card.querySelector('[data-qdel]').onclick = () => { tt.questions.splice(+card.dataset.q, 1); paneTests(ctx, pane, esc, I); };
  });
  pane.querySelector('[data-qadd]').onclick = () => { tt.questions.push({ q: '', options: ['', '', '', ''], answer: 0, why: '' }); paneTests(ctx, pane, esc, I); };
  pane.querySelector('[data-tdel]').onclick = () => {
    if (!window.confirm('Test o‘chirilsinmi?')) return;
    T.tests = T.tests.filter((x) => x.id !== tt.id); st.testId = ''; paneTests(ctx, pane, esc, I);
  };
}
