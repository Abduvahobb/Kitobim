"""Katalogni tozalash: takroriy va eskirgan darsliklarni olib tashlash, noto'g'ri bo'limdagilarni ko'chirish,
har bir kitobga muqova, nashr yili va sahifalar sonini qo'shish.

Manba (oliygoh.uz) da ba'zi fayllar ikki xil nom bilan turadi (masalan, 11-sinf "Umumiy kimyo" = "Kimyo"),
ba'zilari esa 2020-yildan "Tarbiya" fani bilan almashtirilgan eski fanlar. Har bir qaror muqovalarni
ko'zdan kechirib (tools/muqova.json va public/covers) qilingan.

  python tools/tozalash.py   ->  public/catalog.json ni joyida tozalaydi
  (tools/kitoblar.py catalog ham oxirida shuni chaqiradi)
"""
import json
import os
import re

# Bir xil fayl yoki bir xil kitobning boshqa nomdagi nusxasi
DUPLICATE = {
    'botanika-5-sinf-uz',                                   # = biologiya-5-sinf-uz
    'odam-va-uning-salomatligi-8-sinf-ru', 'odam-va-uning-salomatligi-8-sinf-uz',   # = biologiya-8
    'ozbekistonning-iqtisodiy-va-ijtimoiy-geografiyasi-8-sinf-ru',
    'ozbekistonning-iqtisodiy-va-ijtimoiy-geografiyasi-8-sinf-uz',                  # = geografiya-8
    'iqtisodiyot-8-sinf-ru', 'iqtisodiyot-8-sinf-uz',                               # = iqtisodiy-bilim-asoslari-8
    'jahon-ijtimoiy-iqtisodiy-geografiyasi-9-sinf-ru',
    'jahon-ijtimoiy-iqtisodiy-geografiyasi-9-sinf-uz',                              # = geografiya-9
    'iqtisodiy-bilim-asoslari-9-sinf-ru', 'iqtisodiy-bilim-asoslari-9-sinf-uz',     # suv belgili nusxa; toza nusxasi qoladi
    'sitologiya-va-genetika-asoslari-9-sinf-ru', 'sitologiya-va-genetika-asoslari-9-sinf-uz',  # = biologiya-9
    'algebra-va-analiz-asoslari-10-sinf-ru',                # = ...-geometriya-10-sinf-ru-2-qism
    'algebra-11-sinf-ru', 'algebra-11-sinf-uz',             # = matematika-11 1-qism
    'umumiy-kimyo-11-sinf-ru', 'umumiy-kimyo-11-sinf-uz',   # = kimyo-11
    'ozbek-tili-11-sinf-uz',                                # = ozbek-tili-11-sinf-ru (rus maktablari uchun)
}

# Yangi nashri katalogda bor bo'lgan eski nashrlar
OUTDATED = {
    'atrofimizdagi-olam-1-sinf-ru', 'atrofimizdagi-olam-1-sinf-uz',
    'atrofimizdagi-olam-2-sinf-ru', 'atrofimizdagi-olam-2-sinf-uz',   # -> Tabiiy fanlar
    'oqish-1-sinf-ru', 'oqish-1-sinf-uz', 'oqish-4-sinf-ru', 'oqish-4-sinf-uz',
    'oqish-kitobi-2-sinf-ru', 'oqish-kitobi-2-sinf-uz', 'oqish-kitobi-3-sinf-ru', 'oqish-kitobi-3-sinf-uz',  # -> O'qish savodxonligi
    'tabiatshunoslik-3-sinf-ru', 'tabiatshunoslik-3-sinf-uz', 'tabiatshunoslik-4-sinf-uz',
    'ozbek-tili-3-sinf-uz', 'ozbek-tili-6-sinf-uz', 'ozbek-tili-10-sinf-uz',
    'qadimgi-dunyo-tarixi-6-sinf-ru', 'qadimgi-dunyo-tarixi-6-sinf-uz',             # -> Tarix 6 (2022)
    'konstitutsiyaviy-huquq-asoslari-9-sinf-ru', 'konstitutsiyaviy-huquq-asoslari-9-sinf-uz',  # -> Davlat va huquq asoslari
    'algebra-va-analiz-asoslari-geometriya-10-sinf-ru', 'algebra-va-analiz-asoslari-geometriya-10-sinf-ru-2-qism',
    'algebra-va-analiz-asoslari-geometriya-10-sinf-uz', 'algebra-va-analiz-asoslari-geometriya-10-sinf-uz-2-qism',  # -> Algebra, Geometriya 10 (2022)
    'organik-kimyo-10-sinf-ru', 'organik-kimyo-10-sinf-uz',                         # -> Kimyo 10 (2022)
    'davlat-va-huquq-asoslari-10-sinf-uz',                  # 2017; 2023 nashri "huquq-10-sinf-uz" da
}

# 2020-yildan "Tarbiya" fani o'rniga o'tilmaydigan fanlar (Tarbiya kitoblari katalogda bor)
REPLACED_BY_TARBIYA = {'odobnoma', 'vatan-tuygusi', 'milliy-istiqlol-goyasi-va-manaviyat-asoslari',
                       'manaviyat-asoslari', 'dunyo-dinlari-tarixi'}

# Boshqa nom ostida turgan kitobni to'g'ri fanga ko'chirish: kitob id -> fan
MOVE = {
    'tabiatshunoslik-1-sinf-ru-1-qism': 'tabiiy-fanlar',    # "Естествознание" = Tabiiy fanlar
    'tabiatshunoslik-2-sinf-ru': 'tabiiy-fanlar',
    'tabiatshunoslik-4-sinf-ru': 'tabiiy-fanlar',
    'tabiatshunoslik-5-sinf-ru': 'tabiiy-fanlar',
    'botanika-5-sinf-ru': 'biologiya',                      # muqovasida "Биология 5"
    'botanika-6-sinf-ru': 'biologiya', 'botanika-6-sinf-uz': 'biologiya',   # "Biologiya (Botanika) 6"
    'iqtisodiyot-9-sinf-ru': 'iqtisodiy-bilim-asoslari', 'iqtisodiyot-9-sinf-uz': 'iqtisodiy-bilim-asoslari',
    'huquq-10-sinf-uz': 'davlat-va-huquq-asoslari',         # muqovasida "Davlat va huquq asoslari 10"
}


def _title(names, g, part):
    uz, ru, en = names
    return {'uz': f'{uz} · {g}-sinf' + (f' · {part}-qism' if part else ''),
            'ru': f'{ru} · {g} класс' + (f' · {part} часть' if part else ''),
            'en': f'{en} · Grade {g}' + (f' · Part {part}' if part else '')}


def clean(cat, meta=None, covers_dir='public/covers'):
    from kitoblar import subject_names, ORDER, FIXED, COLORS  # noqa
    import hashlib
    if meta is None and os.path.exists('tools/muqova.json'):
        meta = json.load(open('tools/muqova.json'))
    meta = meta or {}
    dropped, moved = [], []
    for gr in cat['grades']:
        g = gr['grade']
        has_tarbiya = any(s['id'] == f'{g}-tarbiya' for s in gr['subjects'])
        bysub = {s['id'].split('-', 1)[1]: s for s in gr['subjects']}
        for slug, s in list(bysub.items()):
            keep = []
            for b in s['books']:
                if b['id'] in DUPLICATE or b['id'] in OUTDATED or (has_tarbiya and slug in REPLACED_BY_TARBIYA):
                    dropped.append(b['id'])
                    continue
                to = MOVE.get(b['id'])
                if to and to != slug:
                    if to not in bysub:
                        names = subject_names(to)
                        color = FIXED.get(to) or COLORS[int(hashlib.md5(to.encode()).hexdigest(), 16) % len(COLORS)]
                        bysub[to] = {'id': f'{g}-{to}', 'name': dict(zip(('uz', 'ru', 'en'), names)), 'color': color, 'books': []}
                    b['title'] = _title(subject_names(to), g, b.get('part'))
                    bysub[to]['books'].append(b)
                    moved.append(f"{b['id']} -> {to}")
                    continue
                keep.append(b)
            s['books'] = keep
        def key(slug):
            return (ORDER.index(slug) if slug in ORDER else len(ORDER), slug)
        subjects = []
        for slug in sorted(bysub, key=key):
            s = bysub[slug]
            if not s['books']:
                continue
            s['books'].sort(key=lambda x: (x['lang'], x.get('part') or 0, x['id']))
            subjects.append(s)
        gr['subjects'] = subjects
    # muqova, nashr yili, sahifalar
    for gr in cat['grades']:
        for s in gr['subjects']:
            for b in s['books']:
                m = meta.get(b['id'], {})
                y = m.get('year')
                b.pop('year', None)
                if y and 2000 <= y <= 2030:
                    b['year'] = y
                if m.get('pages'):
                    b['pages'] = m['pages']
                if os.path.exists(f"{covers_dir}/{b['id']}.jpg"):
                    b['cover'] = f"covers/{b['id']}.jpg"
    cat.pop('fiction', None)
    cat.pop('audio', None)
    return cat, dropped, moved


if __name__ == '__main__':
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    cat = json.load(open('public/catalog.json'))
    before = sum(len(s['books']) for g in cat['grades'] for s in g['subjects'])
    cat, dropped, moved = clean(cat)
    import time
    cat['updated'] = time.strftime('%Y-%m-%d %H:%M')
    after = sum(len(s['books']) for g in cat['grades'] for s in g['subjects'])
    json.dump(cat, open('public/catalog.json', 'w'), ensure_ascii=False, indent=1)
    print(f'{before} -> {after} kitob; olib tashlandi {len(dropped)}, ko\'chirildi {len(moved)}')
    for m in moved:
        print('  ', m)
    known = set(DUPLICATE) | set(OUTDATED) | set(MOVE)
    ids = {b['id'] for g in cat['grades'] for s in g['subjects'] for b in s['books']} | set(dropped)
    miss = sorted(i for i in known if i not in ids)
    if miss:
        print('Diqqat, katalogda topilmadi:', miss)
