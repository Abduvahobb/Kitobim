"""Har bir darslikning muqova rasmi, nashr yili, sahifalar soni va fayl izi (sha256) — GitHub Actions ichida.

  python tools/muqova.py  ->  public/covers/<id>.jpg  va  tools/muqova.json
"""
import concurrent.futures as cf
import hashlib
import json
import os
import re
import subprocess
import urllib.request

UA = {'User-Agent': 'Mozilla/5.0 (KitobimBot)'}
OUT = 'tools/muqova.json'
KEYS = re.compile(r'toshkent|тошкент|ташкент|nashr|нашр|издани|©|isbn|nashriyot|нашриёт|издательств|bosmaxona|босмахона|chop etil|чоп этил', re.I)
YEAR = re.compile(r'(?<!\d)(19[6-9]\d|20[0-2]\d)(?!\d)')


def year_of(text):
    best = {}
    for line in text.splitlines():
        ys = YEAR.findall(line)
        if not ys:
            continue
        w = 3 if KEYS.search(line) else 1
        for y in ys:
            best[y] = best.get(y, 0) + w
    strong = {y: s for y, s in best.items() if s >= 3}
    if not strong:
        return None
    return int(max(strong, key=lambda y: (strong[y], int(y))))


def one(item):
    grade, sid, b = item
    bid = b['id']
    pdf = f'tmp/{bid}.pdf'
    h = hashlib.sha256()
    try:
        with urllib.request.urlopen(urllib.request.Request(b['file'], headers=UA), timeout=600) as r, open(pdf, 'wb') as f:
            while True:
                c = r.read(1 << 20)
                if not c:
                    break
                h.update(c)
                f.write(c)
        info = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout
        pages = int((re.search(r'Pages:\s+(\d+)', info) or [0, 0])[1])
        subprocess.run(['pdftoppm', '-f', '1', '-l', '1', '-singlefile', '-scale-to-x', '220', '-scale-to-y', '-1',
                        '-jpeg', '-jpegopt', 'quality=72', pdf, f'public/covers/{bid}'], capture_output=True, timeout=120)
        text = subprocess.run(['pdftotext', '-f', '1', '-l', '6', '-layout', pdf, '-'], capture_output=True, text=True, timeout=120).stdout
        return bid, {'grade': grade, 'subject': sid, 'sha': h.hexdigest()[:16], 'pages': pages,
                     'year': year_of(text), 'cover': os.path.exists(f'public/covers/{bid}.jpg'),
                     'head': re.sub(r'\s+', ' ', text)[:400]}
    except Exception as e:  # noqa
        return bid, {'grade': grade, 'subject': sid, 'error': repr(e)[:200]}
    finally:
        if os.path.exists(pdf):
            os.remove(pdf)


def main():
    cat = json.load(open('public/catalog.json'))
    items = [(g['grade'], s['id'], b) for g in cat['grades'] for s in g['subjects'] for b in s['books'] if not b.get('sample')]
    os.makedirs('public/covers', exist_ok=True)
    os.makedirs('tmp', exist_ok=True)
    res = {}
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        for n, (bid, d) in enumerate(ex.map(one, items), 1):
            res[bid] = d
            print(n, bid, d.get('year'), d.get('pages'), d.get('error', ''), flush=True)
    json.dump(res, open(OUT, 'w'), ensure_ascii=False, indent=1)
    dup = {}
    for bid, d in res.items():
        if d.get('sha'):
            dup.setdefault(d['sha'], []).append(bid)
    print('Bir xil fayllar:', [v for v in dup.values() if len(v) > 1])
    print('Yili topildi:', sum(1 for d in res.values() if d.get('year')), '/', len(res))


if __name__ == '__main__':
    main()
