"""tools/testlar/*.txt fayllaridan public/tests.json yasaydi.

Format:
  @ id | sinf | fan | mavzu
  ? savol
  + to'g'ri javob
  - noto'g'ri javob
  = izoh
"""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from kitoblar import subject_names  # noqa: E402

OUT = 'public/tests.json'
KEEP = ['ona-tili-5-ot', 'matematika-5-kasr']  # oldingi qo'lda yozilgan testlar


def uzq(s):
    s = s.replace("o'", 'o‘').replace("g'", 'g‘').replace("O'", 'O‘').replace("G'", 'G‘')
    return s.replace("'", '’')


def parse(path):
    tests, cur, q = [], None, None
    for n, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.rstrip('\n')
        if not line.strip() or line.startswith('#'):
            continue
        tag, body = line[0], line[2:].strip()
        if tag == '@':
            tid, grade, subj, topic = [x.strip() for x in body.split('|')]
            cur = {'id': tid, 'grade': int(grade), 'subj': subj, 'topic': topic, 'questions': []}
            tests.append(cur)
        elif tag == '?':
            q = {'q': body, 'options': [], 'answer': None, 'why': ''}
            cur['questions'].append(q)
        elif tag in '+-':
            if tag == '+':
                if q['answer'] is not None:
                    raise SystemExit(f'{path}:{n}: ikkinchi to‘g‘ri javob')
                q['answer'] = len(q['options'])
            q['options'].append(body)
        elif tag == '=':
            q['why'] = body
        else:
            raise SystemExit(f'{path}:{n}: noma’lum qator: {line!r}')
    return tests


def main():
    old = json.load(open(OUT)) if os.path.exists(OUT) else {'tests': []}
    out = [t for t in old['tests'] if t['id'] in KEEP]
    seen = {t['id'] for t in out}
    for path in sorted(glob.glob(os.path.join(os.path.dirname(__file__), 'testlar', '*.txt'))):
        for t in parse(path):
            if t['id'] in seen:
                raise SystemExit('takroriy id: ' + t['id'])
            seen.add(t['id'])
            en = t['subj'] == 'ingliz-tili'
            fix = (lambda s: s) if en else uzq
            for q in t['questions']:
                if q['answer'] is None or len(q['options']) != 4 or not q['why']:
                    raise SystemExit(f"{t['id']}: savol to‘liq emas: {q['q']}")
                q['q'] = fix(q['q'])
                q['options'] = [fix(o) for o in q['options']]
                q['why'] = fix(q['why'])
            uz, ru, enn = subject_names(t['subj'])
            out.append({
                'id': t['id'], 'grade': t['grade'], 'subject': f"{t['grade']}-{t['subj']}",
                'title': {'uz': f"{uz}, {t['grade']}-sinf: {uzq(t['topic'])}",
                          'ru': f"{ru}, {t['grade']} класс", 'en': f"{enn}, Grade {t['grade']}"},
                'questions': [{k: q[k] for k in ('q', 'options', 'answer', 'why')} for q in t['questions']]
            })
    out.sort(key=lambda t: t['grade'])
    json.dump({'version': 2, 'passPercent': old.get('passPercent', 70), 'tests': out}, open(OUT, 'w'), ensure_ascii=False, indent=1)
    nq = sum(len(t['questions']) for t in out)
    print(f'{len(out)} ta test, {nq} ta savol')
    from collections import Counter
    print('sinflar:', dict(sorted(Counter(t['grade'] for t in out).items())))
    print('to‘g‘ri javob o‘rni:', dict(Counter(q['answer'] for t in out for q in t['questions'])))


if __name__ == '__main__':
    main()
