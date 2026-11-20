"""Kitobim "Kitoblar" bo'limi: o'zbek va ingliz tilidagi kitoblar.

  python tools/kutubxona.py uz       -> public/library.json ga o'zbekcha javonlar (research/badiiy-scan.json dan)
  python tools/kutubxona.py en       -> ingliz kitoblarini telefonbop PDF qilib "kitoblar" release'iga joylaydi
                                         va public/library.json ga qo'shadi (GitHub Actions ichida)
  python tools/kutubxona.py publish  -> public/library.json ni release'ga joylaydi

Faqat mualliflik huquqi muddati o'tgan asarlar va xalq og'zaki ijodi olinadi.
O'zbekcha kitoblar ziyouz.com kutubxonasidan to'g'ridan-to'g'ri ochiladi (manba ko'rsatiladi).
Ingliz kitoblari — jamoat mulki (public domain) matnlari.
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

LIB = 'public/library.json'
SCAN = 'research/badiiy-scan.json'
RELEASE = 'kitoblar'
REPO = os.environ.get('GITHUB_REPOSITORY', 'Abduvahobb/Kitobim')
ASSET_BASE = f'https://github.com/{REPO}/releases/download/{RELEASE}/'
UA = {'User-Agent': 'Mozilla/5.0 (KitobimBot; maktab ilovasi; github.com/Abduvahobb/Kitobim)'}

# Vafotiga ko'p yil o'tgan nosir mualliflar (asarlari erkin)
PD_PROSE = ['Abdulla Qodiriy', "Abdulhamid Cho'lpon", "Cho'lpon", 'Abdurauf Fitrat', 'Hamza Hakimzoda Niyoziy',
            "Mahmudxo'ja Behbudiy", 'Sadriddin Ayniy', 'Hamid Olimjon', 'Abdulla Avloniy']
# Xalq og'zaki ijodi bo'limidan chiqarib tashlanadiganlar (zamonaviy mualliflarning o'z asarlari)
FOLK_EXCLUDE = ['Malik Murodov', 'Muzaffar Naimov']
CHILD_WORDS = ['ertak', 'afandi', 'topishmoq', 'maqol', 'chittigul', 'boychechak', 'ilon pari', 'suv qizi',
               'oltin beshik', 'yonar daryo', 'luqmoni hakim', 'kulsa - gul', 'askiya']

SHELVES = [
    ('uz-nasr', 'uz', {'uz': 'O‘zbek nasri: klassika', 'ru': 'Узбекская проза: классика', 'en': 'Uzbek prose: classics'}, '#7A3E2E'),
    ('uz-ertak', 'uz', {'uz': 'Ertaklar va bolalar uchun', 'ru': 'Сказки и детям', 'en': 'Folk tales & children'}, '#B45309'),
    ('uz-mumtoz', 'uz', {'uz': 'Mumtoz adabiyot', 'ru': 'Классическая поэзия', 'en': 'Classical poetry'}, '#7B3FB0'),
    ('uz-navoiy', 'uz', {'uz': 'Alisher Navoiy asarlari', 'ru': 'Произведения Алишера Навои', 'en': 'Works of Alisher Navoi'}, '#1F4FA8'),
    ('uz-doston', 'uz', {'uz': 'Xalq dostonlari', 'ru': 'Народные дастаны', 'en': 'Folk epics (dostons)'}, '#0F7A64'),
    ('en-classic', 'en', {'uz': 'Ingliz klassikasi', 'ru': 'Английская классика', 'en': 'Classics'}, '#2E4A7A'),
    ('en-kids', 'en', {'uz': 'Bolalar kitoblari (ingliz tilida)', 'ru': 'Детские книги (на английском)', 'en': 'Children’s books'}, '#B42318'),
    ('en-easy', 'en', {'uz': 'Ingliz tilini o‘rganish uchun', 'ru': 'Для изучения английского', 'en': 'Easy English'}, '#1E7B4F'),
]

# Ingliz kitoblari: (id, javon, nomida bo'lishi shart bo'lgan so'z)
EN_BOOKS = [
    (120, 'en-classic', 'treasure island'), (74, 'en-classic', 'tom sawyer'), (76, 'en-classic', 'huckleberry'),
    (1661, 'en-classic', 'sherlock holmes'), (46, 'en-classic', 'christmas carol'), (521, 'en-classic', 'robinson crusoe'),
    (829, 'en-classic', 'gulliver'), (730, 'en-classic', 'oliver twist'), (103, 'en-classic', 'eighty days'),
    (271, 'en-classic', 'black beauty'), (514, 'en-classic', 'little women'), (215, 'en-classic', 'call of the wild'),
    (910, 'en-classic', 'white fang'), (1400, 'en-classic', 'great expectations'), (1342, 'en-classic', 'pride and prejudice'),
    (35, 'en-classic', 'time machine'),
    (11, 'en-kids', 'alice'), (12, 'en-kids', 'looking-glass'), (16, 'en-kids', 'peter pan'), (55, 'en-kids', 'oz'),
    (113, 'en-kids', 'secret garden'), (500, 'en-kids', 'pinocchio'), (1448, 'en-kids', 'heidi'),
    (2591, 'en-kids', 'grimm'), (1597, 'en-kids', 'andersen'), (236, 'en-kids', 'jungle book'),
    (289, 'en-kids', 'wind in the willows'), (2781, 'en-kids', 'just so'), (902, 'en-kids', 'happy prince'),
    (21, 'en-easy', 'aesop'), (11757, 'en-easy', 'velveteen'), (14838, 'en-easy', 'peter rabbit'),
    (14640, 'en-easy', 'mcguffey'), (14668, 'en-easy', 'mcguffey'), (18442, 'en-easy', 'fifty famous stories'),
]


def uz_quotes(s):
    s = s.replace("o'", 'o‘').replace("g'", 'g‘').replace("O'", 'O‘').replace("G'", 'G‘')
    return s.replace("'", '’')


def split_author(title):
    m = re.match(r'^([^.]{3,90}?)\.\s+(.+)$', title)
    if m and not re.search(r'\d', m.group(1)):
        return m.group(1).strip(), m.group(2).strip()
    return '', title.strip()


def load_lib():
    if os.path.exists(LIB):
        return json.load(open(LIB))
    return {'version': 1, 'shelves': []}


def save_lib(lib):
    order = {s[0]: i for i, s in enumerate(SHELVES)}
    lib['shelves'].sort(key=lambda s: order.get(s['id'], 99))
    lib['updated'] = time.strftime('%Y-%m-%d %H:%M')
    json.dump(lib, open(LIB, 'w'), ensure_ascii=False, indent=1)
    print('Javonlar:', [(s['id'], len(s['books'])) for s in lib['shelves']])


def shelf(lib, sid):
    for s in lib['shelves']:
        if s['id'] == sid:
            return s
    meta = next(x for x in SHELVES if x[0] == sid)
    s = {'id': sid, 'lang': meta[1], 'name': meta[2], 'color': meta[3], 'books': []}
    lib['shelves'].append(s)
    return s


def uz():
    scan = json.load(open(SCAN))['ziyouz']
    lib = load_lib()
    lib['shelves'] = [s for s in lib['shelves'] if s['lang'] != 'uz']
    seen = set()

    def add(sid, it, author, title):
        if it.get('kind') != 'pdf' or it['id'] in seen:
            return
        seen.add(it['id'])
        shelf(lib, sid)['books'].append({
            'id': 'z' + it['id'],
            'title': uz_quotes(title),
            'author': uz_quotes(author) if author else 'Xalq og‘zaki ijodi',
            'lang': 'uz',
            'size': it.get('size') or 0,
            'file': it['url'],
            'source': 'ziyouz.com'
        })

    for it in scan['41-o-zbek-nasri']['picked']:
        a, t = split_author(it['title'])
        if any(a == p or a.startswith(p) for p in PD_PROSE):
            add('uz-nasr', it, a, t)
    for it in scan['39-o-zbek-mumtoz-adabiyoti']['picked']:
        if 'sharh' in it['title'].lower():
            continue
        a, t = split_author(it['title'])
        add('uz-navoiy' if 'Navoiy' in a else 'uz-mumtoz', it, a, t)
    for it in scan['40-alisher-navoiy-asarlari']['picked']:
        if 'sharh' in it['title'].lower():
            continue
        a, t = split_author(it['title'])
        add('uz-navoiy', it, a or 'Alisher Navoiy', t)
    for it in scan['38-o-zbek-xalq-og-zaki-ijodi']['picked']:
        if any(x in it['title'] for x in FOLK_EXCLUDE):
            continue
        a, t = split_author(it['title'])
        child = any(w in it['title'].lower() for w in CHILD_WORDS)
        add('uz-ertak' if child else 'uz-doston', it, a, t)
    for s in lib['shelves']:
        if s['lang'] == 'uz':
            s['books'].sort(key=lambda b: (b['author'], b['title']))
    save_lib(lib)


# ---------------- Ingliz kitoblari: matndan telefonbop PDF ----------------

MIRRORS = ['https://aleph.gutenberg.org', 'https://gutenberg.pglaf.org', 'https://mirrors.xmission.com/gutenberg',
           'https://mirror.csclub.uwaterloo.ca/gutenberg', 'https://gutenberg.readingroo.ms', 'https://www.gutenberg.org']


def pg_dir(n):
    s = str(n)
    return ('/'.join(s[:-1]) if len(s) > 1 else '0') + '/' + s


def fetch_text(n):
    # gutenberg.org GitHub serverlarini cheklaydi — rasmiy oyna (mirror) serverlardan navbat bilan urinamiz
    cands = []
    for m in MIRRORS:
        cands += [(f'{m}/cache/epub/{n}/pg{n}.txt', 'utf-8'), (f'{m}/{pg_dir(n)}/{n}-0.txt', 'utf-8'),
                  (f'{m}/{pg_dir(n)}/{n}.txt', 'utf-8'), (f'{m}/{pg_dir(n)}/{n}-8.txt', 'latin-1')]
    for url, enc in cands:
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                data = r.read()
            text = data.decode(enc, 'replace')
            if 'Title:' in text[:5000] and len(text) > 5000:
                print('  manba:', url, flush=True)
                return text
        except Exception:  # noqa
            continue
    return None


def parse_text(raw):
    title = (re.search(r'^Title:\s*(.+)$', raw, re.M) or [None, ''])[1].strip()
    author = (re.search(r'^Author:\s*(.+)$', raw, re.M) or [None, ''])[1].strip()
    s = re.search(r'^\*\*\*\s*START OF.*$', raw, re.M)
    e = re.search(r'^\*\*\*\s*END OF.*$', raw, re.M)
    body = raw[s.end() if s else 0: e.start() if e else len(raw)]
    body = body.replace('\r\n', '\n')
    paras = [p.strip('\n') for p in re.split(r'\n\s*\n', body)]
    return title, author, [p for p in paras if p.strip()]


HEAD_RE = re.compile(r'^(CHAPTER|Chapter|BOOK|Book|PART|Part|STAVE|Stave|ADVENTURE|LESSON|Lesson|FABLE)\b[\s\S]{0,70}$')


def make_pdf(path, title, author, paras):
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from xml.sax.saxutils import escape
    F = '/usr/share/fonts/truetype/dejavu/'
    pdfmetrics.registerFont(TTFont('Serif', F + 'DejaVuSerif.ttf'))
    pdfmetrics.registerFont(TTFont('SerifI', F + 'DejaVuSerif-Italic.ttf'))
    pdfmetrics.registerFont(TTFont('SerifB', F + 'DejaVuSerif-Bold.ttf'))
    pdfmetrics.registerFont(TTFont('Sans', F + 'DejaVuSans.ttf'))
    pdfmetrics.registerFont(TTFont('SansB', F + 'DejaVuSans-Bold.ttf'))
    from reportlab.pdfbase.pdfmetrics import registerFontFamily
    registerFontFamily('Serif', normal='Serif', bold='SerifB', italic='SerifI', boldItalic='SerifB')

    W, H = 306, 486  # telefon ekraniga mos sahifa
    body = ParagraphStyle('b', fontName='Serif', fontSize=11, leading=15.5, alignment=0, firstLineIndent=12, spaceAfter=4)
    verse = ParagraphStyle('v', parent=body, alignment=0, firstLineIndent=0, leftIndent=8)
    head = ParagraphStyle('h', fontName='SansB', fontSize=15, leading=19, spaceBefore=6, spaceAfter=12, textColor='#0F7A64')
    big = ParagraphStyle('t', fontName='SansB', fontSize=24, leading=29, alignment=TA_CENTER, textColor='#1B2A41')
    sub = ParagraphStyle('s', fontName='Sans', fontSize=13, leading=17, alignment=TA_CENTER, textColor='#5B6B79')
    small = ParagraphStyle('m', fontName='Sans', fontSize=8.5, leading=11, alignment=TA_CENTER, textColor='#5B6B79')

    def fmt(t):
        t = escape(t)
        return re.sub(r'_([^_\n]{1,200})_', r'<i>\1</i>', t)

    story = [Spacer(1, 120), Paragraph(fmt(title), big), Spacer(1, 14), Paragraph(fmt(author), sub),
             Spacer(1, 150), Paragraph('Kitobim · Public domain text', small), PageBreak()]
    since_break = 0  # oxirgi yangi sahifadan beri nechta paragraf
    for p in paras:
        lines = [l.strip() for l in p.split('\n') if not re.fullmatch(r'\[Illustration[^\]]*\]', l.strip())]
        one = ' '.join(l for l in lines if l)
        if not one:
            continue
        chapter = len(one) <= 80 and len(lines) <= 3 and HEAD_RE.match(one)
        caps = len(one) <= 60 and len(lines) <= 2 and one.isupper() and re.search('[A-Z]', one)
        if chapter or caps:
            # Faqat haqiqiy bob sarlavhasi yangi sahifadan boshlanadi (bo'sh sahifalar chiqmasligi uchun)
            if chapter and since_break >= 3:
                story.append(PageBreak())
                since_break = 0
            story.append(Paragraph(fmt(one), head))
            continue
        since_break += 1
        short = sum(1 for l in lines if l) >= 2 and max(len(l) for l in lines) < 55
        if short:  # she'r yoki ro'yxat — qatorlarni saqlaymiz
            story.append(Paragraph('<br/>'.join(fmt(l) for l in lines if l), verse))
        else:
            story.append(Paragraph(fmt(one), body))

    def page_no(c, d):
        if d.page > 1:
            c.setFont('Sans', 8)
            c.setFillColor('#5B6B79')
            c.drawCentredString(W / 2, 14, str(d.page - 1))

    doc = SimpleDocTemplate(path, pagesize=(W, H), leftMargin=22, rightMargin=22, topMargin=24, bottomMargin=28,
                            title=title, author=author)
    doc.build(story, onLaterPages=page_no)


def en():
    lib = load_lib()
    lib['shelves'] = [s for s in lib['shelves'] if s['lang'] != 'en']
    os.makedirs('tmp', exist_ok=True)
    for n, sid, key in EN_BOOKS:
        raw = fetch_text(n)
        if not raw:
            print('YUKLANMADI', n)
            continue
        title, author, paras = parse_text(raw)
        if key not in title.lower():
            print(f'O‘TKAZIB YUBORILDI {n}: nomi mos emas: {title!r}')
            continue
        name = f'en-{n}.pdf'
        path = os.path.join('tmp', name)
        try:
            make_pdf(path, title, author, paras)
        except Exception as e:  # noqa
            print('PDF XATO', n, e)
            continue
        up = subprocess.run(['gh', 'release', 'upload', RELEASE, path, '--repo', REPO, '--clobber'], capture_output=True, text=True)
        if up.returncode != 0:
            print('JOYLASH XATO', n, up.stderr[:300])
            continue
        shelf(lib, sid)['books'].append({
            'id': f'en{n}', 'title': title, 'author': author or 'Anonymous', 'lang': 'en',
            'size': os.path.getsize(path), 'file': ASSET_BASE + name, 'source': 'gutenberg.org'
        })
        print(f'OK {n} {title} — {author} ({os.path.getsize(path) / 1048576:.1f} MB)', flush=True)
        time.sleep(2)
    save_lib(lib)


def publish():
    subprocess.run(['gh', 'release', 'upload', RELEASE, LIB, '--repo', REPO, '--clobber'], check=True)


if __name__ == '__main__':
    {'uz': uz, 'en': en, 'publish': publish}[sys.argv[1]]()
