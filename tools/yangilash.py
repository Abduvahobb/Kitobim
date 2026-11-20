"""Eski darsliklarni 2025–2026 rasmiy nashrlari bilan almashtirish (katalogda).

  python tools/yangilash.py yangi/

yangi/ papkasidagi har bir PDF nomi: <eski-id>-2025.pdf  (masalan ona-tili-5-sinf-uz-1-qism-2025.pdf).
Katalogdagi eski kitob o'rniga yangisi yoziladi:
  - id yangi bo'ladi (telefonda saqlangan eski nashr yangisi bilan aralashib ketmasligi uchun);
  - src (oliygoh.uz dagi eski nashr) olib tashlanadi, ilova kitobni "kitoblar" release'idan oladi;
  - size, pages, year yangilanadi.
Katalogda hali yo'q kitob uchun: <fan>-<sinf>-sinf-<til>[-<n>-qism]-2025.pdf — fanning ichiga qo'shiladi.
"""
import json
import os
import re
import subprocess
import sys

CATALOG = 'public/catalog.json'
REPO = os.environ.get('GITHUB_REPOSITORY', 'Abduvahobb/Kitobim')
ASSET_BASE = f'https://github.com/{REPO}/releases/download/kitoblar/'
NEW = re.compile(r'^(?P<old>.+)-(?P<year>20\d\d)\.pdf$')


def pages_of(path):
    try:
        out = subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout
        m = re.search(r'^Pages:\s+(\d+)', out, re.M)
        return int(m.group(1)) if m else None
    except FileNotFoundError:
        return None


def main(folder):
    cat = json.load(open(CATALOG, encoding='utf-8'))
    index = {}
    for g in cat['grades']:
        for s in g['subjects']:
            for i, b in enumerate(s['books']):
                index[b['id']] = (s, i)
    done, missing = [], []
    for name in sorted(os.listdir(folder)):
        m = NEW.match(name)
        if not m:
            continue
        old, year = m.group('old'), int(m.group('year'))
        path = os.path.join(folder, name)
        if old not in index:
            missing.append(name)
            continue
        s, i = index[old]
        b = dict(s['books'][i])
        b.pop('src', None)
        b.pop('cover', None)  # muqova yangi nashrdan qayta olinadi
        b['id'] = name[:-4]
        b['file'] = ASSET_BASE + name
        b['size'] = os.path.getsize(path)
        b['year'] = year
        p = pages_of(path)
        if p:
            b['pages'] = p
        s['books'][i] = b
        done.append(name)
    from datetime import datetime, timezone
    cat['updated'] = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')
    json.dump(cat, open(CATALOG, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'almashtirildi: {len(done)}')
    for n in missing:
        print('katalogda topilmadi:', n)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'yangi')
