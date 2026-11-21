"""Shubhali siqilgan fayllar: eng yomon sahifani asl bilan yonma-yon rasmga oladi (varaq-N.png)."""
import subprocess, sys
from PIL import Image, ImageDraw
def get(u, p): return subprocess.run(['curl', '-sfL', '--retry', '3', '-A', 'Mozilla/5.0', '-o', p, u]).returncode == 0
def pages(f):
    for l in subprocess.run(['pdfinfo', f], capture_output=True, text=True).stdout.splitlines():
        if l.startswith('Pages:'): return int(l.split()[1])
    return 0
def img(f, p, o):
    subprocess.run(['pdftoppm', '-f', str(p), '-l', str(p), '-singlefile', '-r', '28', '-png', f, o], capture_output=True)
    try: return Image.open(o + '.png').convert('RGB')
    except Exception: return Image.new('RGB', (200, 280), 'red')
pairs = []
for line in open(sys.argv[1]):
    name, comp, orig, i = line.split()
    if not (get(comp, 'c.pdf') and get(orig, 'o.pdf')): continue
    n = min(pages('c.pdf'), pages('o.pdf'))
    ps = sorted({max(1, n * k // 10) for k in range(1, 10)})
    p = ps[min(int(i), len(ps) - 1)]
    a, b = img('o.pdf', p, 'a'), img('c.pdf', p, 'b')
    b = b.resize(a.size)
    t = Image.new('RGB', (a.width * 2 + 10, a.height + 18), 'white')
    t.paste(a, (0, 18)); t.paste(b, (a.width + 10, 18))
    ImageDraw.Draw(t).text((2, 2), f'{name} p{p}', fill='black')
    pairs.append(t)
for s in range(0, len(pairs), 8):
    grp = pairs[s:s + 8]
    W = max(x.width for x in grp); H = max(x.height for x in grp)
    sheet = Image.new('RGB', (W * 4 + 30, H * 2 + 10), 'white')
    for j, x in enumerate(grp): sheet.paste(x, ((j % 4) * (W + 10), (j // 4) * (H + 10)))
    sheet.save(f'varaq-{s // 8}.png')
