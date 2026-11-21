"""Siqilgan PDF bilan aslini solishtirish: matn yo'qolmaganmi (sahifa rasmlari farqi)."""
import subprocess, sys, os, json
from PIL import Image, ImageChops, ImageStat

def get(url, path):
    return subprocess.run(['curl', '-sfL', '--retry', '3', '-A', 'Mozilla/5.0', '-o', path, url]).returncode == 0

def pages(f):
    out = subprocess.run(['pdfinfo', f], capture_output=True, text=True).stdout
    for l in out.splitlines():
        if l.startswith('Pages:'): return int(l.split()[1])
    return 0

def img(f, p, o):
    subprocess.run(['pdftoppm', '-f', str(p), '-l', str(p), '-singlefile', '-gray', '-r', '40', '-png', f, o], capture_output=True, timeout=300)
    try: return Image.open(o + '.png').convert('L')
    except Exception: return None

res = []
for line in open(sys.argv[1]):
    if not line.strip(): continue
    name, comp, orig = line.split()
    r = {'file': name}
    if not (get(comp, 'c.pdf') and get(orig, 'o.pdf')):
        r['error'] = 'yuklanmadi'; res.append(r); print(r, flush=True); continue
    n = min(pages('c.pdf'), pages('o.pdf'))
    diffs = []; dark = []
    for p in sorted({max(1, n * k // 10) for k in range(1, 10)}):
        a, b = img('o.pdf', p, 'a'), img('c.pdf', p, 'b')
        if a is None or b is None: diffs.append(99); continue
        if a.size != b.size: b = b.resize(a.size)
        diffs.append(round(ImageStat.Stat(ImageChops.difference(a, b)).mean[0], 2))
        # Qora (matn) piksellar ulushi: matn yo'qolsa siqilganda keskin kamayadi
        da = sum(a.point(lambda v: 1 if v < 110 else 0).getdata()) / (a.width * a.height)
        db = sum(b.point(lambda v: 1 if v < 110 else 0).getdata()) / (b.width * b.height)
        if da > 0.01: dark.append(round(db / da, 2))
    r['diffs'] = diffs; r['max'] = max(diffs); r['dark'] = dark; r['dark_min'] = min(dark) if dark else None
    res.append(r); print(r, flush=True)
    os.remove('c.pdf'); os.remove('o.pdf')
json.dump(res, open('siq-tekshir.json', 'w'), indent=1)
