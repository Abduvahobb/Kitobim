"""infoedu.uz dan olingan nashrlarni katalogga qo'yish.

  python3 tools/ie-qoy.py <pdf_papka> tools/ie-qoy.json

Papkada release'dagi ie-<slug>.pdf fayllar turadi. Spec ro'yxati:
  {"slug", "replace": [ids], "year"}                      — almashtirish (yangi id: <eski-asos>-<yil|yangi>)
  {"slug", "after"|"before": id, "id", "part", "year", "note"} — yangi kitob qo'shish
"""
import json, os, re, subprocess, sys
from datetime import datetime, timezone
sys.path.insert(0, 'tools')
from almashtirish import info, make_cover

CATALOG = 'public/catalog.json'
BASE = 'https://github.com/Abduvahobb/Kitobim/releases/download/kitoblar/'


def title(subj, grade, part=None, note=None):
    n = subj['name']
    t = {'uz': f"{n['uz']} · {grade}-sinf", 'ru': f"{n['ru']} · {grade} класс", 'en': f"{n['en']} · Grade {grade}"}
    if part:
        t['uz'] += f' · {part}-qism'; t['ru'] += f' · {part} часть'; t['en'] += f' · Part {part}'
    if note:
        for k in t:
            t[k] += f' ({note[k]})'
    return t


def main(folder, spec_file):
    cat = json.load(open(CATALOG, encoding='utf-8'))
    spec = json.load(open(spec_file, encoding='utf-8'))
    where = {}
    for g in cat['grades']:
        for s in g['subjects']:
            for b in s['books']:
                where[b['id']] = (g, s)
    log = []

    def fill(b, slug, new_id, year):
        pdf = os.path.join(folder, f'ie-{slug}.pdf')
        b.pop('src', None)
        b['id'] = new_id
        b['file'] = BASE + f'ie-{slug}.pdf'
        b['size'] = os.path.getsize(pdf)
        b.pop('year', None)
        if year:
            b['year'] = year
        p = info(pdf)
        if p:
            b['pages'] = p
        c = make_cover(pdf, new_id)
        if c:
            b['cover'] = c
        else:
            b.pop('cover', None)
        return b

    for e in spec:
        slug = e['slug']
        if not os.path.exists(os.path.join(folder, f'ie-{slug}.pdf')):
            log.append(f'FAYL YO\'Q: {slug}'); continue
        if 'replace' in e:
            for old in e['replace']:
                if old not in where:
                    log.append(f'katalogda yo\'q: {old}'); continue
                g, s = where[old]
                i = next(k for k, b in enumerate(s['books']) if b['id'] == old)
                base = re.sub(r'-(2025|2024|2023|2022|yangi)$', '', old)
                nid = f"{base}-{e.get('year') or 'yangi'}"
                if nid == old:
                    nid = base + '-ie'
                b = fill(dict(s['books'][i]), slug, nid, e.get('year'))
                if 'part' in e:
                    b['part'] = e['part']
                    b['title'] = title(s, g['grade'], e['part'])
                s['books'][i] = b
                where[nid] = (g, s)
                log.append(f'{old} -> {nid}  ({b["pages"]} bet)')
        else:
            anchor = e.get('after') or e.get('before')
            if anchor not in where:
                log.append(f'langar yo\'q: {anchor}'); continue
            g, s = where[anchor]
            if any(b['id'] == e['id'] for b in s['books']):
                continue
            ids = [b['id'] for b in s['books']]
            i = ids.index(anchor)
            b = fill(dict(s['books'][i]), slug, e['id'], e.get('year'))
            b['lang'] = e.get('lang', b['lang'])
            b['part'] = e.get('part')
            b['title'] = title(s, g['grade'], e.get('part'), e.get('note'))
            s['books'].insert(i + 1 if e.get('after') else i, b)
            where[e['id']] = (g, s)
            log.append(f'+ {e["id"]}  ({b["pages"]} bet)')
    cat['updated'] = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')
    json.dump(cat, open(CATALOG, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n'.join(log))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
