"""Darsliklarni Kitobim'ga joylash vositasi (GitHub Actions ichida ishlaydi).

  python tools/kitoblar.py collect  -> kitoblar.json (barcha darsliklar ro'yxati)
  python tools/kitoblar.py mirror   -> har bir PDF'ni yuklab, "kitoblar" release'iga joylaydi
  python tools/kitoblar.py catalog  -> public/catalog.json (ilova uchun kitoblar ro'yxati)

Manba: oliygoh.uz (1–11-sinf, o'zbek va rus maktablari uchun darsliklar).
"""
import concurrent.futures as cf
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

SOURCE = 'https://oliygoh.uz/darsliklar'
RELEASE = 'kitoblar'
REPO = os.environ.get('GITHUB_REPOSITORY', 'Abduvahobb/Kitobim')
ASSET_BASE = f'https://github.com/{REPO}/releases/download/{RELEASE}/'
LIST = 'kitoblar.json'
UA = {'User-Agent': 'Mozilla/5.0 (Kitobim maktab ilovasi)'}

PDF_RE = re.compile(r'https://static\.oliygoh\.uz/uploads/darsliklar/(\d{1,2})/([a-z0-9-]+)\.pdf')
SLUG_RE = re.compile(r'^(?P<subj>[a-z0-9-]+?)-(?P<g>\d{1,2})-sinf-(?P<lang>[a-z]{2})(?:-(?P<part>\d{1,2})-qism)?$')

# Fan nomlari: slug -> (o'zbekcha, ruscha, inglizcha)
NAMES = {
    'alifbe': ('Alifbe', 'Букварь', 'Alphabet book'),
    'atrofimizdagi-olam': ('Atrofimizdagi olam', 'Окружающий мир', 'The world around us'),
    'fransuz-tili': ('Fransuz tili', 'Французский язык', 'French'),
    'nemis-tili': ('Nemis tili', 'Немецкий язык', 'German'),
    'ingliz-tili': ('Ingliz tili', 'Английский язык', 'English'),
    'rus-tili': ('Rus tili', 'Русский язык', 'Russian'),
    'ozbek-tili': ('O‘zbek tili', 'Узбекский язык', 'Uzbek'),
    'ona-tili': ('Ona tili', 'Родной язык', 'Native language'),
    'ona-tili-va-oqish-savodxonligi': ('Ona tili va o‘qish savodxonligi', 'Родной язык и чтение', 'Native language & reading'),
    'oqish': ('O‘qish', 'Чтение', 'Reading'),
    'oqish-savodxonligi': ('O‘qish savodxonligi', 'Грамотность чтения', 'Reading literacy'),
    'nutq-ostirish': ('Nutq o‘stirish', 'Развитие речи', 'Speech development'),
    'odobnoma': ('Odobnoma', 'Этика', 'Etiquette'),
    'adabiyot': ('Adabiyot', 'Литература', 'Literature'),
    'matematika': ('Matematika', 'Математика', 'Mathematics'),
    'algebra': ('Algebra', 'Алгебра', 'Algebra'),
    'geometriya': ('Geometriya', 'Геометрия', 'Geometry'),
    'informatika': ('Informatika', 'Информатика', 'Computer science'),
    'fizika': ('Fizika', 'Физика', 'Physics'),
    'kimyo': ('Kimyo', 'Химия', 'Chemistry'),
    'biologiya': ('Biologiya', 'Биология', 'Biology'),
    'geografiya': ('Geografiya', 'География', 'Geography'),
    'tabiiy-fanlar': ('Tabiiy fanlar', 'Естественные науки', 'Natural science'),
    'tabiatshunoslik': ('Tabiatshunoslik', 'Естествознание', 'Nature study'),
    'tarix': ('Tarix', 'История', 'History'),
    'jahon-tarixi': ('Jahon tarixi', 'Всемирная история', 'World history'),
    'ozbekiston-tarixi': ('O‘zbekiston tarixi', 'История Узбекистана', 'History of Uzbekistan'),
    'tarbiya': ('Tarbiya', 'Воспитание', 'Upbringing'),
    'jismoniy-tarbiya': ('Jismoniy tarbiya', 'Физическая культура', 'Physical education'),
    'musiqa': ('Musiqa', 'Музыка', 'Music'),
    'tasviriy-sanat': ('Tasviriy san’at', 'Изобразительное искусство', 'Fine arts'),
    'texnologiya': ('Texnologiya', 'Технология', 'Technology'),
    'chizmachilik': ('Chizmachilik', 'Черчение', 'Technical drawing'),
    'astronomiya': ('Astronomiya', 'Астрономия', 'Astronomy'),
    'davlat-va-huquq-asoslari': ('Davlat va huquq asoslari', 'Основы государства и права', 'Basics of state and law'),
    'huquq': ('Huquq', 'Право', 'Law'),
    'iqtisodiy-bilim-asoslari': ('Iqtisodiy bilim asoslari', 'Основы экономических знаний', 'Basics of economics'),
    'chaqiruvgacha-boshlangich-tayyorgarlik': ('Chaqiruvgacha boshlang‘ich tayyorgarlik', 'Начальная допризывная подготовка', 'Pre-conscription training'),
    'mashq-daftari': ('Mashq daftari', 'Рабочая тетрадь', 'Workbook'),
    'algebra-va-analiz-asoslari': ('Algebra va analiz asoslari', 'Алгебра и начала анализа', 'Algebra and calculus basics'),
    'algebra-va-analiz-asoslari-geometriya': ('Algebra va analiz asoslari, geometriya', 'Алгебра и начала анализа, геометрия', 'Algebra, calculus and geometry'),
    'botanika': ('Botanika', 'Ботаника', 'Botany'),
    'zoologiya': ('Zoologiya', 'Зоология', 'Zoology'),
    'chaqiruvga-qadar-boshlangich-tayyorgarlik': ('Chaqiruvga qadar boshlang‘ich tayyorgarlik', 'Начальная допризывная подготовка', 'Pre-conscription training'),
    'dunyo-dinlari-tarixi': ('Dunyo dinlari tarixi', 'История мировых религий', 'History of world religions'),
    'iqtisodiyot': ('Iqtisodiyot', 'Экономика', 'Economics'),
    'jahon-ijtimoiy-iqtisodiy-geografiyasi': ('Jahon ijtimoiy-iqtisodiy geografiyasi', 'Социально-экономическая география мира', 'World socio-economic geography'),
    'konstitutsiyaviy-huquq-asoslari': ('Konstitutsiyaviy huquq asoslari', 'Основы конституционного права', 'Basics of constitutional law'),
    'manaviyat-asoslari': ('Ma’naviyat asoslari', 'Основы духовности', 'Basics of spirituality'),
    'milliy-istiqlol-goyasi-va-manaviyat-asoslari': ('Milliy istiqlol g‘oyasi va ma’naviyat asoslari', 'Идея национальной независимости и основы духовности', 'National idea and spirituality'),
    'odam-va-uning-salomatligi': ('Odam va uning salomatligi', 'Человек и его здоровье', 'Human body and health'),
    'oqish-kitobi': ('O‘qish kitobi', 'Книга для чтения', 'Reading book'),
    'organik-kimyo': ('Organik kimyo', 'Органическая химия', 'Organic chemistry'),
    'umumiy-kimyo': ('Umumiy kimyo', 'Общая химия', 'General chemistry'),
    'ozbekistonning-iqtisodiy-va-ijtimoiy-geografiyasi': ('O‘zbekistonning iqtisodiy va ijtimoiy geografiyasi', 'Экономическая и социальная география Узбекистана', 'Economic and social geography of Uzbekistan'),
    'qadimgi-dunyo-tarixi': ('Qadimgi dunyo tarixi', 'История Древнего мира', 'Ancient history'),
    'sitologiya-va-genetika-asoslari': ('Sitologiya va genetika asoslari', 'Основы цитологии и генетики', 'Cytology and genetics'),
    'tadbirkorlik-asoslari': ('Tadbirkorlik asoslari', 'Основы предпринимательства', 'Basics of entrepreneurship'),
    'tarixdan-hikoyalar': ('Tarixdan hikoyalar', 'Рассказы из истории', 'Stories from history'),
    'vatan-tuygusi': ('Vatan tuyg‘usi', 'Чувство Родины', 'Love for the homeland'),
    'yozuv-daftari-propis': ('Yozuv daftari (propis)', 'Пропись', 'Handwriting workbook'),
}
ORDER = ['alifbe', 'ona-tili', 'oqish-savodxonligi', 'oqish', 'ozbek-tili', 'rus-tili', 'adabiyot', 'matematika',
         'algebra', 'geometriya', 'tabiiy-fanlar', 'atrofimizdagi-olam', 'tabiatshunoslik', 'fizika', 'kimyo',
         'biologiya', 'geografiya', 'tarix', 'ozbekiston-tarixi', 'jahon-tarixi', 'ingliz-tili', 'nemis-tili',
         'fransuz-tili', 'informatika', 'tarbiya']
COLORS = ['#0F7A64', '#2563C9', '#7B3FB0', '#B42318', '#9A4A00', '#6D4C2F', '#1E7B4F', '#1F6F8B',
          '#AD1457', '#3949AB', '#8A5410', '#00796B']
FIXED = {'ona-tili': '#0F7A64', 'matematika': '#2563C9', 'adabiyot': '#7B3FB0', 'ingliz-tili': '#B42318',
         'rus-tili': '#9A4A00', 'tarix': '#6D4C2F', 'biologiya': '#1E7B4F', 'geografiya': '#1F6F8B'}


def fetch(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa
            print(f'  qayta urinish {i + 1}: {url} ({e})', flush=True)
            time.sleep(3 * (i + 1))
    raise RuntimeError('yuklab bo‘lmadi: ' + url)


def subject_names(subj):
    if subj in NAMES:
        return NAMES[subj]
    for k in sorted(NAMES, key=len, reverse=True):  # "matematika-mashq-daftari" kabi
        if subj.startswith(k + '-') and subj[len(k) + 1:] in NAMES:
            a, b = NAMES[k], NAMES[subj[len(k) + 1:]]
            return (f'{a[0]} · {b[0].lower()}', f'{a[1]} · {b[1].lower()}', f'{a[2]} · {b[2].lower()}')
    t = subj.replace('-', ' ').capitalize()
    return (t, t, t)


def collect():
    found = {}
    for g in range(1, 12):
        for til in ('', 'uz', 'ru'):
            q = f'?sinf={g}' + (f'&til={til}' if til else '')
            try:
                html = fetch(SOURCE + q).decode('utf-8', 'replace')
            except Exception as e:  # noqa
                print('XATO', q, e)
                continue
            n = 0
            for m in PDF_RE.finditer(html):
                grade, slug = int(m.group(1)), m.group(2)
                s = SLUG_RE.match(slug)
                if not s or s.group('lang') not in ('uz', 'ru'):
                    continue
                if slug not in found:
                    found[slug] = {
                        'slug': slug, 'grade': grade, 'lang': s.group('lang'), 'subj': s.group('subj'),
                        'part': int(s.group('part')) if s.group('part') else None,
                        'url': f'https://static.oliygoh.uz/uploads/darsliklar/{grade}/{slug}.pdf',
                        'asset': f'{slug}.pdf'
                    }
                    n += 1
            print(f'{g}-sinf {til or "-"}: +{n} (jami {len(found)})', flush=True)
            time.sleep(1)
    books = sorted(found.values(), key=lambda b: (b['grade'], b['lang'], b['subj'], b['part'] or 0))
    json.dump(books, open(LIST, 'w'), ensure_ascii=False, indent=1)
    print('Jami darsliklar:', len(books))
    unknown = sorted({b['subj'] for b in books if subject_names(b['subj'])[0] == b['subj'].replace('-', ' ').capitalize()})
    if unknown:
        print('Nomi lug‘atda yo‘q fanlar:', ', '.join(unknown))


def existing_assets():
    out = subprocess.run(['gh', 'release', 'view', RELEASE, '--repo', REPO, '--json', 'assets'],
                         capture_output=True, text=True)
    if out.returncode != 0:
        return {}
    return {a['name']: a['size'] for a in json.loads(out.stdout)['assets']}


def mirror():
    books = json.load(open(LIST))
    have = existing_assets()
    todo = [b for b in books if b['asset'] not in have]
    print(f'Joylangan: {len(books) - len(todo)}, qolgan: {len(todo)}', flush=True)
    os.makedirs('tmp', exist_ok=True)

    def one(b):
        path = os.path.join('tmp', b['asset'])
        for i in range(4):
            try:
                req = urllib.request.Request(b['url'], headers=UA)
                with urllib.request.urlopen(req, timeout=300) as r, open(path, 'wb') as f:
                    while True:
                        chunk = r.read(1 << 20)
                        if not chunk:
                            break
                        f.write(chunk)
                with open(path, 'rb') as f:
                    if f.read(5) != b'%PDF-':
                        raise RuntimeError('PDF emas')
                up = subprocess.run(['gh', 'release', 'upload', RELEASE, path, '--repo', REPO, '--clobber'],
                                    capture_output=True, text=True)
                if up.returncode != 0:
                    raise RuntimeError(up.stderr.strip()[:300])
                size = os.path.getsize(path)
                os.remove(path)
                return b['asset'], size, None
            except Exception as e:  # noqa
                time.sleep(5 * (i + 1))
                err = str(e)
        if os.path.exists(path):
            os.remove(path)
        return b['asset'], 0, err

    done = fail = 0
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        for asset, size, err in ex.map(one, todo):
            if err:
                fail += 1
                print(f'XATO {asset}: {err}', flush=True)
            else:
                done += 1
                print(f'[{done}/{len(todo)}] {asset} {size / 1048576:.1f} MB', flush=True)
    print(f'Tayyor: {done}, xato: {fail}')


def catalog():
    books = json.load(open(LIST))
    have = existing_assets()
    grades = []
    for g in range(1, 12):
        subs = {}
        for b in books:
            if b['grade'] != g or b['asset'] not in have:
                continue
            subs.setdefault(b['subj'], []).append(b)
        def key(s):
            return (ORDER.index(s) if s in ORDER else len(ORDER), s)
        subjects = []
        for s in sorted(subs, key=key):
            uz, ru, en = subject_names(s)
            color = FIXED.get(s) or COLORS[int(hashlib.md5(s.encode()).hexdigest(), 16) % len(COLORS)]
            items = []
            for b in sorted(subs[s], key=lambda x: (x['lang'], x['part'] or 0)):
                p = b['part']
                items.append({
                    'id': b['slug'],
                    'title': {
                        'uz': f'{uz} · {g}-sinf' + (f' · {p}-qism' if p else ''),
                        'ru': f'{ru} · {g} класс' + (f' · {p} часть' if p else ''),
                        'en': f'{en} · Grade {g}' + (f' · Part {p}' if p else '')
                    },
                    'lang': b['lang'],
                    'part': p,
                    'size': have[b['asset']],
                    # src — O'zbekistondagi asl server (tezroq), file — GitHub'dagi zaxira nusxa
                    'src': b['url'],
                    'file': ASSET_BASE + b['asset']
                })
            subjects.append({'id': f'{g}-{s}', 'name': {'uz': uz, 'ru': ru, 'en': en}, 'color': color, 'books': items})
        grades.append({'grade': g, 'subjects': subjects})
    old = {}
    if os.path.exists('public/catalog.json'):
        old = json.load(open('public/catalog.json'))
    cat = {
        'version': 2,
        'note': 'Avtomatik yasalgan (tools/kitoblar.py). Manba: oliygoh.uz',
        'updated': time.strftime('%Y-%m-%d %H:%M'),
        'grades': grades,
        'fiction': old.get('fiction', []),
        'audio': old.get('audio', [])
    }
    json.dump(cat, open('public/catalog.json', 'w'), ensure_ascii=False, indent=1)
    total = sum(len(s['books']) for gr in grades for s in gr['subjects'])
    print('Katalogdagi kitoblar:', total)


if __name__ == '__main__':
    {'collect': collect, 'mirror': mirror, 'catalog': catalog}[sys.argv[1]]()
