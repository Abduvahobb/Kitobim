"""Katalogdagi eski darsliklarni 2025–2026 rasmiy nashrlari bilan almashtirish.

  python3 tools/almashtirish.py <pdf_papka>

<pdf_papka> ichida release'dagi tgNNN.pdf fayllar turadi (sahifalar soni va muqova shulardan olinadi).
Moslik: tools/yangi-nashrlar.json. Har bir almashtirilgan kitob:
  - yangi id oladi (<eski-id>-2025): telefonda saqlangan eski nashr yangisi bilan aralashmaydi;
  - src (oliygoh.uz dagi eski nashr) olib tashlanadi, fayl "kitoblar" release'idan olinadi;
  - size, pages, year, cover yangilanadi.
"""
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

CATALOG = 'public/catalog.json'
MAP = 'tools/yangi-nashrlar.json'
BASE = 'https://github.com/Abduvahobb/Kitobim/releases/download/kitoblar/'


def info(pdf):
    out = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout
    m = re.search(r'^Pages:\s+(\d+)', out, re.M)
    return int(m.group(1)) if m else None


def make_cover(pdf, bid):
    os.makedirs('public/covers', exist_ok=True)
    subprocess.run(['pdftoppm', '-f', '1', '-l', '1', '-singlefile', '-scale-to-x', '220', '-scale-to-y', '-1',
                    '-jpeg', '-jpegopt', 'quality=72', pdf, f'public/covers/{bid}'], capture_output=True, timeout=180)
    return f'covers/{bid}.jpg' if os.path.exists(f'public/covers/{bid}.jpg') else None


def main(folder):
    cat = json.load(open(CATALOG, encoding='utf-8'))
    mp = json.load(open(sys.argv[2] if len(sys.argv) > 2 else MAP, encoding='utf-8'))
    where = {}
    for g in cat['grades']:
        for s in g['subjects']:
            for b in s['books']:
                where[b['id']] = s
    done, missing, nofile = [], [], []

    def pdf_of(msg):
        # siqilgan nusxa (tgNNN-s.pdf) bo'lsa, o'shani ishlatamiz
        for n in (f'tg{msg}-s.pdf', f'tg{msg}.pdf'):
            if os.path.exists(os.path.join(folder, n)):
                return n
        return None

    def fresh(msg, base_book, new_id, title=None, part=None, year=None):
        name = pdf_of(msg)
        pdf = os.path.join(folder, name)
        b = dict(base_book)
        b.pop('src', None)
        b['id'] = new_id
        b['file'] = BASE + name
        b['size'] = os.path.getsize(pdf)
        b.pop('year', None)
        if year:
            b['year'] = year
        if title:
            b['title'] = title
        if part is not None:
            b['part'] = part
        p = info(pdf)
        if p:
            b['pages'] = p
        c = make_cover(pdf, new_id)
        if c:
            b['cover'] = c
        else:
            b.pop('cover', None)
        return b

    for msg, olds in mp['replace'].items():
        if not pdf_of(msg):
            nofile.append(msg)
            continue
        if isinstance(olds, dict):
            spec, olds = olds, olds['ids']
        else:
            spec = {}
        for old in olds:
            s = where.get(old)
            if not s:
                missing.append(old)
                continue
            i = next(k for k, b in enumerate(s['books']) if b['id'] == old)
            s['books'][i] = fresh(msg, s['books'][i], old + '-2025', spec.get('title'), spec.get('part'), spec.get('year'))
            done.append(f'{old} <- tg{msg}')
    for msg, a in mp.get('add', {}).items():
        if not pdf_of(msg):
            nofile.append(msg)
            continue
        anchor = a['after'] + '-2025'
        s = where.get(a['after'])
        if not s:
            missing.append(a['after'])
            continue
        if any(b['id'] == a['id'] for b in s['books']):
            continue
        ids = [b['id'] for b in s['books']]
        i = ids.index(anchor) if anchor in ids else ids.index(a['after'])
        s['books'].insert(i + 1, fresh(msg, s['books'][i], a['id'], a['title'], a.get('part'), a.get('year')))
        done.append(f'+ {a["id"]} <- tg{msg}')
    cat['updated'] = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')
    json.dump(cat, open(CATALOG, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n'.join(done))
    print(f'almashtirildi/qo\'shildi: {len(done)}')
    if missing:
        print('katalogda yo\'q:', missing)
    if nofile:
        print('fayl hali yo\'q:', nofile)


if __name__ == '__main__':
    main(sys.argv[1])
