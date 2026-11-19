// Papkadagi PDF darsliklardan public/catalog.json yasaydi.
//
// Ishlatish:
//   node tools/katalog.mjs <kitoblar-papkasi> <serverdagi-manzil>
//   node tools/katalog.mjs ./kitoblar https://SERVER/kitoblar
//
// Papka tuzilishi:  kitoblar/5-sinf/Ona tili 1-qism.pdf
//                   kitoblar/5-sinf/Matematika.pdf
// Fan nomi fayl nomidan aniqlanadi. Rus tilidagi darslik fayl nomida
// "rus" bo'lsa yoki papka nomi "5-sinf-ru" bo'lsa, "ru" deb belgilanadi.
import fs from 'node:fs';
import path from 'node:path';

const [, , dir, baseUrl = ''] = process.argv;
if (!dir) { console.error('Papka ko‘rsatilmadi: node tools/katalog.mjs <papka> [server-manzil]'); process.exit(1); }

const catPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public', 'catalog.json');
const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));

// Fayl nomidagi kalit so'z -> fan qisqa nomi (catalog.json dagi "<sinf>-<qisqa>" id)
const KEYS = [
  [/savod|o.?qish/i, 'savod'], [/ona.?tili|родн/i, 'ona'], [/adabiyot|литер/i, 'adab'],
  [/algebra|алгеб/i, 'alg'], [/geometr|геомет/i, 'geom'], [/matem|матем/i, 'mat'],
  [/tabiiy|естеств|tabiat/i, 'tab'], [/ingliz|english|англ/i, 'ingl'], [/rus.?tili|русск/i, 'rus'],
  [/tarix|истор/i, 'tarix'], [/tarbiya|воспит/i, 'tarb'], [/informat|информ/i, 'inf'],
  [/fizika|физик/i, 'fiz'], [/kimyo|хими/i, 'kim'], [/biolog|биолог/i, 'bio'], [/geograf|геогр/i, 'geo']
];

let added = 0; const unknown = [];
for (const g of cat.grades) g.subjects.forEach((s) => { s.books = s.books.filter((b) => b.sample); });

for (const folder of fs.readdirSync(dir)) {
  const m = folder.match(/^(\d{1,2})/);
  if (!m) continue;
  const grade = +m[1];
  const gr = cat.grades.find((x) => x.grade === grade);
  if (!gr) continue;
  const ruFolder = /ru/i.test(folder.replace(/^\d+/, ''));
  for (const f of fs.readdirSync(path.join(dir, folder)).filter((x) => /\.pdf$/i.test(x)).sort()) {
    const name = f.replace(/\.pdf$/i, '');
    const key = (KEYS.find(([re]) => re.test(name)) || [])[1];
    let subj = key && gr.subjects.find((s) => s.id === `${grade}-${key}`);
    if (!subj && key === 'mat') subj = gr.subjects.find((s) => s.id === `${grade}-alg`);
    if (!subj) { unknown.push(`${folder}/${f}`); continue; }
    const part = (name.match(/(\d)\s*-?\s*(qism|часть|part)/i) || [])[1];
    const lang = ruFolder || /рус|_ru\b|\(ru\)/i.test(name) ? 'ru' : 'uz';
    const rel = `${encodeURIComponent(folder)}/${encodeURIComponent(f)}`;
    const sn = subj.name;
    const p = part ? { uz: ` · ${part}-qism`, ru: ` · ${part} часть`, en: ` · Part ${part}` } : { uz: '', ru: '', en: '' };
    subj.books.push({
      id: `${grade}-${lang}-${name}`.toLowerCase().replace(/[^a-z0-9а-яё‘'-]+/gi, '-'),
      title: { uz: `${sn.uz} · ${grade}-sinf${p.uz}`, ru: `${sn.ru} · ${grade} класс${p.ru}`, en: `${sn.en} · Grade ${grade}${p.en}` },
      lang,
      file: baseUrl ? `${baseUrl.replace(/\/$/, '')}/${rel}` : `kitoblar/${rel}`
    });
    added++;
  }
}

fs.writeFileSync(catPath, JSON.stringify(cat, null, 1));
console.log(`Qo‘shildi: ${added} ta kitob.`);
if (unknown.length) console.log(`Fani aniqlanmadi (${unknown.length}):\n  ` + unknown.join('\n  '));
