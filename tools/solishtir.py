"""Ilovadagi kitob bilan kanaldagi rasmiy faylni solishtirish (GitHub Actions ichida).

  python3 tools/solishtir.py tools/moslik.json natija.json

moslik.json: {"tg123": ["katalog-id", ...], ...}
Har bir juftlik uchun: bet soni, 3 ta sahifaning rasm farqi (0 = bir xil) va birinchi betlardagi nashr yili.
Fayllar navbatma-navbat yuklanadi va o'chiriladi (disk to'lmasin).
"""
import json, os, re, subprocess, sys
from PIL import Image, ImageChops, ImageStat

CAT = json.load(open('public/catalog.json'))
BOOKS = {b['id']: b for g in CAT['grades'] for s in g['subjects'] for b in s['books']}
BASE = 'https://github.com/Abduvahobb/Kitobim/releases/download/kitoblar/'
TMP = 'tmp-cmp'
os.makedirs(TMP, exist_ok=True)


def get(url, path):
    r = subprocess.run(['curl', '-sfL', '--retry', '3', '--max-time', '900', '-o', path, url])
    return r.returncode == 0 and os.path.exists(path) and open(path, 'rb').read(5) == b'%PDF-'


def pages(f):
    out = subprocess.run(['pdfinfo', f], capture_output=True, text=True).stdout
    m = re.search(r'^Pages:\s+(\d+)', out, re.M)
    return int(m.group(1)) if m else 0


def year(f):
    t = subprocess.run(['pdftotext', '-l', '4', f, '-'], capture_output=True, text=True).stdout
    ys = [int(y) for y in re.findall(r'\b(19[89]\d|20[0-3]\d)\b', t)]
    return max(ys) if ys else None


def img(f, p):
    o = f'{TMP}/x'
    subprocess.run(['pdftoppm', '-f', str(p), '-l', str(p), '-singlefile', '-gray', '-scale-to-x', '160',
                    '-scale-to-y', '-1', '-png', f, o], capture_output=True, timeout=120)
    try:
        return Image.open(o + '.png').convert('L').resize((160, 226))
    except Exception:
        return None


def diff(a, b, n):
    res = []
    for p in (max(1, n // 4), n // 2, max(1, 3 * n // 4)):
        x, y = img(a, p), img(b, p)
        res.append(99 if x is None or y is None else round(ImageStat.Stat(ImageChops.difference(x, y)).mean[0], 1))
    return res


def main(mfile, out):
    mp = json.load(open(mfile))
    res = json.load(open(out)) if os.path.exists(out) else {}
    for tg, olds in mp.items():
        new = f'{TMP}/{tg}.pdf'
        if not get(BASE + f'{tg}.pdf', new):
            for o in olds:
                res[o] = {'tg': tg, 'error': 'yangi fayl yuklanmadi'}
            continue
        pn, yn = pages(new), year(new)
        for o in olds:
            b = BOOKS.get(o)
            if not b:
                res[o] = {'tg': tg, 'error': 'katalogda yo\'q'}; continue
            old = f'{TMP}/old.pdf'
            src = b.get('src') or b['file']
            ok = get(src, old) or get(b['file'], old)
            if not ok:
                res[o] = {'tg': tg, 'new_pages': pn, 'new_year': yn, 'error': 'eski fayl yuklanmadi'}; continue
            po, yo = pages(old), year(old)
            d = diff(old, new, min(po, pn)) if po and pn and abs(po - pn) <= 2 else None
            res[o] = {'tg': tg, 'old_pages': po, 'new_pages': pn, 'old_year': yo, 'new_year': yn,
                      'cat_year': b.get('year'), 'diff': d, 'new_size': os.path.getsize(new)}
            os.remove(old)
            print(o, res[o], flush=True)
        os.remove(new)
        json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1)
    json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
