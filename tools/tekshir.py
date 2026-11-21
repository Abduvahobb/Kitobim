"""Katalogdagi har bir kitobning manzillarini tekshirish: src va file — javob, vaqt, PDF ekanligi."""
import json, subprocess, time, concurrent.futures as cf
c = json.load(open('public/catalog.json'))
books = [b for g in c['grades'] for s in g['subjects'] for b in s['books']]


def probe(url):
    t = time.time()
    r = subprocess.run(['curl', '-sL', '-r', '0-1023', '--max-time', '25', '-o', '-', '-w', '\n%{http_code} %{url_effective}', url],
                       capture_output=True)
    out = r.stdout
    body, _, tail = out.rpartition(b'\n')
    code = tail.decode(errors='replace').split(' ')[0]
    return {'code': code, 'pdf': body[:5] == b'%PDF-', 'sec': round(time.time() - t, 1)}


def one(b):
    r = {'id': b['id']}
    if b.get('src'):
        r['src'] = probe(b['src'])
    r['file'] = probe(b['file'])
    return r


with cf.ThreadPoolExecutor(16) as ex:
    res = list(ex.map(one, books))
json.dump(res, open('tekshir.json', 'w'), indent=1)
bad_src = [r for r in res if 'src' in r and not r['src']['pdf']]
bad_file = [r for r in res if not r['file']['pdf']]
print('jami', len(res), "src ishlamaydi:", len(bad_src), "file ishlamaydi:", len(bad_file))
for r in bad_src[:30]:
    print('SRC', r['id'], r['src'])
for r in bad_file[:30]:
    print('FILE', r['id'], r['file'])
