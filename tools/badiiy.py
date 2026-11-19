"""Badiiy kitoblar va audiokitoblar (GitHub Actions ichida ishlaydi).

  python tools/badiiy.py scan  -> research/badiiy-scan.json (manbalardagi mos kitoblar ro'yxati)

Manbalar:
  - ziyouz.com kutubxonasi: o'zbek mumtoz adabiyoti (faqat mualliflik huquqi muddati o'tgan mualliflar)
  - Project Gutenberg (gutendex.com orqali): ingliz va rus tilidagi klassika
  - LibriVox: mualliflik huquqidan ozod audiokitoblar
"""
import json
import os
import re
import sys
import time
import html as H
import urllib.parse
import urllib.request

UA = {'User-Agent': 'Mozilla/5.0 (KitobimBot; maktab ilovasi; github.com/Abduvahobb/Kitobim)'}
ZBASE = 'https://n.ziyouz.com/kutubxona/category/'
ZCATS = ['41-o-zbek-nasri', '39-o-zbek-mumtoz-adabiyoti', '40-alisher-navoiy-asarlari',
         '38-o-zbek-xalq-og-zaki-ijodi', '6-biblioteka-ziyouz-com']

# Vafotiga 70 yildan ko'p o'tgan (yoki xalq ijodi) — erkin foydalanish mumkin
PD_UZ = ['Abdulla Qodiriy', "Cho'lpon", 'Chulpon', 'Fitrat', 'Avloniy', 'Hamza', 'Behbudiy', 'Ayniy',
         'Hamid Olimjon', 'Usmon Nosir', 'Navoiy', 'Bobur', 'Muqimiy', 'Furqat', 'Ogahiy', 'Nodira',
         'Uvaysiy', 'Mashrab', 'Lutfiy', 'Atoiy', 'Gulxaniy', 'Munis', 'Huvaydo', 'Amiriy', 'Zavqiy',
         'Sakkokiy', "Yusuf Xos Hojib", "Mahmud Qoshg'ariy", 'Rabg\'uziy', 'Xorazmiy', 'Nishotiy', 'Haziniy',
         'Dilshodi Barno', 'Anbar Otin', 'Majlisiy', 'Turdi', 'Boborahim', "So'fi Olloyor", 'Sufi Olloyor',
         'xalq', 'Xalq', 'ertak', 'doston', 'Alpomish', "Go'ro'g'li", 'maqol', 'topishmoq']
PD_RU = ['Пушкин', 'Лермонтов', 'Толстой Л', 'Лев Толстой', 'Чехов', 'Тургенев', 'Гоголь', 'Достоевский',
         'Крылов', 'Куприн', 'Горький', 'Андерсен', 'Гримм', 'Перро', 'Бажов', 'Короленко', 'Гаршин',
         'Мамин-Сибиряк', 'Ушинский', 'Жуковский', 'Некрасов', 'Тютчев', 'Фет', 'Есенин', 'Блок', 'Грин']

GUT_EN = [11, 16, 55, 120, 521, 2591, 1597, 21, 236, 74, 113, 271, 1448, 500, 829, 76, 514, 45, 35, 46,
          1661, 158, 1342, 84, 345, 2701, 98, 1400, 730, 19033, 17396, 2781, 236]
GUT_RU_SEARCH = ['Пушкин', 'Толстой', 'Чехов', 'Тургенев', 'Лермонтов', 'Гоголь', 'Крылов']

LV_EN = ["Aesop's Fables", 'Grimms', 'Andersen', "Alice's Adventures in Wonderland", 'Peter Pan',
         'Wonderful Wizard of Oz', 'Jungle Book', 'Treasure Island', 'Black Beauty', 'Secret Garden',
         'Just So Stories', 'Velveteen Rabbit', 'Tom Sawyer', 'Heidi', 'Pinocchio']
LV_RU_AUTH = ['Pushkin', 'Tolstoy', 'Chekhov', 'Turgenev', 'Lermontov', 'Gogol', 'Krylov', 'Kuprin']


def get(url, n=None, headers=None, tries=3):
    h = dict(UA, **(headers or {}))
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=h)
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read(n) if n else r.read()
                return r.status, dict(r.headers), data
        except Exception as e:  # noqa
            last = e
            time.sleep(3 * (i + 1))
    raise last


LINK_RE = re.compile(r'href="([^"]*\?download=(\d+):[^"]+)"[^>]*>([^<]{3,300})</a>')


def ziyouz_list(cat):
    items, seen = [], set()
    for start in range(0, 2000, 100):
        url = ZBASE + cat + (f'?start={start}' if start else '')
        try:
            page = get(url)[2].decode('utf-8', 'replace')
        except Exception as e:  # noqa
            print('XATO', url, e)
            break
        n = 0
        for m in LINK_RE.finditer(page):
            href, fid, title = m.group(1), m.group(2), H.unescape(m.group(3)).strip()
            if fid in seen or title.lower() in ('saqlash', 'yuklab olish', 'скачать'):
                continue
            seen.add(fid)
            if href.startswith('/'):
                href = 'https://n.ziyouz.com' + href
            items.append({'cat': cat, 'id': fid, 'title': title, 'url': H.unescape(href)})
            n += 1
        if n == 0:
            break
        time.sleep(1)
    return items


def sniff(url):
    try:
        st, h, data = get(url, 16)
        kind = ('pdf' if data.startswith(b'%PDF') else 'zip' if data.startswith(b'PK') else
                'doc' if data.startswith(b'\xd0\xcf\x11\xe0') else 'djvu' if data.startswith(b'AT&T') else
                'rtf' if data.startswith(b'{\\rtf') else 'html' if b'<' in data[:4] else data[:8].hex())
        return {'kind': kind, 'size': int(h.get('Content-Length') or 0), 'ctype': h.get('Content-Type'),
                'disp': h.get('Content-Disposition')}
    except Exception as e:  # noqa
        return {'kind': 'error', 'err': repr(e)}


def scan():
    out = {'ziyouz': {}, 'gut_en': [], 'gut_ru': [], 'lv_en': [], 'lv_ru': []}
    for cat in ZCATS:
        items = ziyouz_list(cat)
        keys = PD_RU if cat.startswith('6-') else PD_UZ
        pick = [it for it in items if any(k in it['title'] for k in keys)] if not cat.startswith('38-') else items
        for it in pick:
            it.update(sniff(it['url']))
            time.sleep(0.5)
        out['ziyouz'][cat] = {'total': len(items), 'picked': pick,
                              'sample_titles': [i['title'] for i in items[:40]]}
        print(cat, len(items), 'ta, tanlandi', len(pick), flush=True)

    try:
        ids = ','.join(str(i) for i in sorted(set(GUT_EN)))
        d = json.loads(get(f'https://gutendex.com/books/?ids={ids}')[2])
        for b in d.get('results', []):
            out['gut_en'].append({'id': b['id'], 'title': b['title'], 'authors': [a['name'] for a in b['authors']],
                                  'langs': b['languages'], 'formats': [k for k in b['formats']]})
    except Exception as e:  # noqa
        out['gut_en'] = repr(e)
    for q in GUT_RU_SEARCH:
        try:
            d = json.loads(get('https://gutendex.com/books/?' + urllib.parse.urlencode({'languages': 'ru', 'search': q}))[2])
            for b in d.get('results', [])[:15]:
                out['gut_ru'].append({'id': b['id'], 'title': b['title'], 'authors': [a['name'] for a in b['authors']],
                                      'formats': [k for k in b['formats']]})
        except Exception as e:  # noqa
            out['gut_ru'].append({'q': q, 'error': repr(e)})
        time.sleep(1)

    def lv(params):
        url = 'https://librivox.org/api/feed/audiobooks/?' + urllib.parse.urlencode(dict(params, format='json', extended=1, limit=20))
        d = json.loads(get(url)[2])
        res = []
        for b in d.get('books', []):
            res.append({'id': b['id'], 'title': b['title'], 'lang': b['language'], 'time': b.get('totaltime'),
                        'authors': [a['first_name'] + ' ' + a['last_name'] for a in b.get('authors', [])],
                        'sections': len(b.get('sections') or []),
                        'first': (b.get('sections') or [{}])[0].get('listen_url'),
                        'archive': b.get('url_iarchive')})
        return res
    for q in LV_EN:
        try:
            out['lv_en'] += [x for x in lv({'title': '^' + q}) if x['lang'] == 'English'][:3]
        except Exception as e:  # noqa
            out['lv_en'].append({'q': q, 'error': repr(e)})
        time.sleep(1)
    for q in LV_RU_AUTH:
        try:
            out['lv_ru'] += [x for x in lv({'author': q}) if x['lang'] == 'Russian']
        except Exception as e:  # noqa
            out['lv_ru'].append({'q': q, 'error': repr(e)})
        time.sleep(1)

    os.makedirs('research', exist_ok=True)
    json.dump(out, open('research/badiiy-scan.json', 'w'), ensure_ascii=False, indent=1)
    print('tayyor')


if __name__ == '__main__':
    {'scan': scan}[sys.argv[1]]()
