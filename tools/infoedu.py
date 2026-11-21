"""infoedu.uz dagi darsliklarni ilovadagi kitoblar bilan solishtirish (GitHub Actions ichida).

Har bir PDF uchun: bet soni, nashr yili (birinchi va oxirgi betlardagi eng katta yil), ISBN.
Ilovada mos kitob bo'lsa, o'shaning ham ko'rsatkichlari va 3 ta sahifaning rasm farqi yoziladi.
Natija: infoedu-natija.json (release'ga joylanadi).
"""
import json, os, re, subprocess, sys, urllib.request
sys.path.insert(0, 'tools')
from solishtir import get, pages, img, BOOKS
from PIL import ImageChops, ImageStat

API = 'https://api.infoedu.uz/wp-json/wp/v2/'
TMP = 'tmp-ie'
os.makedirs(TMP, exist_ok=True)


def j(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return json.load(urllib.request.urlopen(req, timeout=120))


def meta(f, n):
    t = subprocess.run(['pdftotext', '-l', '5', f, '-'], capture_output=True, text=True).stdout
    t += subprocess.run(['pdftotext', '-f', str(max(1, n - 2)), f, '-'], capture_output=True, text=True).stdout
    ys = [int(y) for y in re.findall(r'\b(19[89]\d|20[0-3]\d)\b', t)]
    isbn = re.findall(r'ISBN[:\s]*([\d\-–XХ ]{10,22})', t)
    return (max(ys) if ys else None), sorted({re.sub(r'[\s–]', '-', i).strip('-') for i in isbn})[:3]


def diff(a, b, n):
    res = []
    for p in (max(1, n // 4), n // 2, max(1, 3 * n // 4)):
        x, y = img(a, p), img(b, p)
        res.append(99 if x is None or y is None else round(ImageStat.Stat(ImageChops.difference(x, y)).mean[0], 1))
    return res


def match(slug):
    m = re.match(r'(\d+)-sinf-(.+?)(?:-(\d)-qism)?$', slug)
    if not m:
        return None
    g, subj, q = m.groups()
    lang = 'uz'
    if subj.endswith('-rus') or subj.endswith('-ru'):
        lang, subj = 'ru', re.sub(r'-(rus|ru)$', '', subj)
    base = f'{subj}-{g}-sinf-{lang}'
    cands = [base + (f'-{q}-qism' if q else ''), base + '-1-qism' if not q else None]
    for c in cands:
        if not c:
            continue
        for x in (c + '-2025', c):
            if x in BOOKS:
                return x
    return None


def main():
    media, p = [], 1
    while True:
        try:
            a = j(API + f'media?mime_type=application/pdf&per_page=100&page={p}')
        except Exception:
            break
        if not a:
            break
        media += a
        p += 1
    print('pdf:', len(media), flush=True)
    out = 'infoedu-natija.json'
    res = json.load(open(out)) if os.path.exists(out) else {}
    for m in media:
        url = m['source_url']
        slug = re.sub(r'\.pdf$', '', url.rsplit('/', 1)[-1])
        if slug in res:
            continue
        r = {'url': url, 'title': m.get('title', {}).get('rendered'), 'date': m.get('date')}
        new = f'{TMP}/n.pdf'
        if not get(url, new):
            r['error'] = 'yuklanmadi'
        else:
            r['size'] = os.path.getsize(new)
            r['pages'] = pages(new)
            r['year'], r['isbn'] = meta(new, r['pages'])
            bid = match(slug)
            r['app'] = bid
            if bid:
                b = BOOKS[bid]
                old = f'{TMP}/o.pdf'
                if get(b['file'], old):
                    po = pages(old)
                    yo, io = meta(old, po)
                    r.update(app_pages=po, app_year=yo, app_isbn=io, app_cat_year=b.get('year'))
                    if po and r['pages'] and abs(po - r['pages']) <= 2:
                        r['diff'] = diff(old, new, min(po, r['pages']))
                    os.remove(old)
            os.remove(new)
        res[slug] = r
        print(slug, r, flush=True)
        json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1)
        if len(res) % 15 == 0:
            subprocess.run(['gh', 'release', 'upload', 'kitoblar', out, '--clobber', '--repo', os.environ.get('GITHUB_REPOSITORY', '')])


if __name__ == '__main__':
    main()
