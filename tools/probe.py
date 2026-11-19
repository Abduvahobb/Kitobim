"""Badiiy kitob va audiokitob manbalarini tekshirish (GitHub Actions ichida ishlaydi).
Natija research/report.json fayliga yoziladi."""
import json
import os
import urllib.parse
import urllib.request

UA = {'User-Agent': 'KitobimBot/0.1 (maktab ilovasi; github.com/Abduvahobb/Kitobim)'}
out = {}


def get(url, n=None):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read(n) if n else r.read()
        return r.status, dict(r.headers), data


def api(host, **p):
    p.setdefault('format', 'json')
    url = f'https://{host}/w/api.php?' + urllib.parse.urlencode(p)
    return json.loads(get(url)[2])


def safe(name, fn):
    try:
        out[name] = fn()
    except Exception as e:  # noqa
        out[name] = {'error': repr(e)}


# 1) Ko'p tilli Wikisource'dagi o'zbekcha matnlar
def mul_search():
    res = {}
    for q in ['Qodiriy', 'Choʻlpon', "Cho'lpon", 'Fitrat', 'Avloniy', 'Hamza', 'Navoiy', 'Behbudiy',
              'Hamid Olimjon', 'Usmon Nosir', 'Muqimiy', 'Furqat', 'Bobur', 'oʻzbek']:
        r = api('wikisource.org', action='query', list='search', srsearch=q, srlimit=50)
        res[q] = [(x['title'], x.get('size')) for x in r['query']['search']]
    return res


def mul_cats():
    r = api('wikisource.org', action='query', list='allcategories', acprefix='O', aclimit=500)
    cats = [c['*'] for c in r['query']['allcategories'] if 'zbek' in c['*'].lower() or 'ʻzbek' in c['*']]
    r2 = api('wikisource.org', action='query', list='allcategories', acprefix='Uzbek', aclimit=100)
    cats += [c['*'] for c in r2['query']['allcategories']]
    members = {}
    for c in cats[:10]:
        m = api('wikisource.org', action='query', list='categorymembers', cmtitle='Category:' + c, cmlimit=500)
        members[c] = [x['title'] for x in m['query']['categorymembers']]
    return {'cats': cats, 'members': members}


# 2) ws-export orqali PDF yasab ko'rish
def wsexport(lang, page):
    url = 'https://ws-export.wmcloud.org/?' + urllib.parse.urlencode({'lang': lang, 'page': page, 'format': 'pdf-a5'})
    st, h, data = get(url)
    return {'status': st, 'type': h.get('Content-Type'), 'bytes': len(data), 'head': data[:8].decode('latin1')}


# 3) Rus tilidagi klassika (ru.wikisource)
def ru_check():
    res = {}
    for t in ['Капитанская дочка (Пушкин)', 'Кавказский пленник (Толстой)', 'Каштанка (Чехов)', 'Муму (Тургенев)',
              'Сказка о рыбаке и рыбке (Пушкин)', 'Белый пудель (Куприн)']:
        r = api('ru.wikisource.org', action='query', titles=t, prop='info')
        p = list(r['query']['pages'].values())[0]
        res[t] = {'exists': 'missing' not in p, 'length': p.get('length')}
    return res


# 4) Ziyouz audiokutubxonasi fayli
def ziyouz_audio():
    st, h, data = get('https://n.ziyouz.com/kutubxona/category/214-utkan-kunlar?download=10395:01-o-tkan-kunlar', 4096)
    return {'status': st, 'type': h.get('Content-Type'), 'length': h.get('Content-Length'),
            'disposition': h.get('Content-Disposition'), 'head': data[:16].hex()}


# 5) LibriVox (ochiq audiokitoblar) — rus va ingliz tilidagi bolalar klassikasi
def librivox():
    res = {}
    for q in ['Pushkin', 'Tolstoy', 'Chekhov', 'Andersen', 'Grimm', 'Aesop']:
        url = 'https://librivox.org/api/feed/audiobooks/?' + urllib.parse.urlencode({'author': q, 'format': 'json', 'limit': 10})
        try:
            d = json.loads(get(url)[2])
            res[q] = [(b['title'], b['language'], b.get('totaltime'), b.get('url_zip_file')) for b in d.get('books', [])]
        except Exception as e:  # noqa
            res[q] = repr(e)
    return res


safe('mul_search', mul_search)
safe('mul_cats', mul_cats)
safe('wsexport_mul', lambda: wsexport('mul', 'Oʻtkan kunlar'))
safe('wsexport_ru', lambda: wsexport('ru', 'Каштанка (Чехов)'))
safe('ru_check', ru_check)
safe('ziyouz_audio', ziyouz_audio)
safe('librivox', librivox)

os.makedirs('research', exist_ok=True)
json.dump(out, open('research/report.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False)[:3000])
