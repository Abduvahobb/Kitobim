"""Telegram kanalidan rasmiy darsliklarni olib, "kitoblar" release'iga joylash (GitHub Actions ichida).

Kirish QR kod orqali: dastur repoda issue ochadi, unda QR rasm turadi. Telefondagi Telegram'da
Sozlamalar -> Qurilmalar -> "Kompyuterni ulash" orqali skanerlanadi. Seans faqat shu ish davomida
xotirada turadi, oxirida dastur o'zi chiqib ketadi (log_out).

Muhit o'zgaruvchilari: TG_API_ID, TG_API_HASH, TG_PASSWORD (2FA bo'lsa), GH_TOKEN, GITHUB_REPOSITORY,
KANAL, IDLAR ("540-780"), FILTR ("uzb" — fayl nomida bo'lishi kerak bo'lgan so'z, bo'sh = hammasi).
"""
import asyncio
import json
import os
import re
import subprocess
import time
import urllib.parse

from telethon import TelegramClient, errors
from telethon.sessions import StringSession

REPO = os.environ['GITHUB_REPOSITORY']
KANAL = os.environ.get('KANAL', 'talimxabarlari_fayllar')
IDLAR = os.environ.get('IDLAR', '540-780')
FILTR = os.environ.get('FILTR', 'uzb').lower().split(',')
REGEX = os.environ.get('REGEX', '')
MIN_DATE = os.environ.get('MIN_DATE', '')
MANIFEST = os.environ.get('MANIFEST', 'tg-manifest.json')
RELEASE = 'kitoblar'
OUT = 'tg'


def gh(*args, inp=None):
    return subprocess.run(['gh', *args], input=inp, capture_output=True, text=True, check=True).stdout


def issue_body(url, n):
    img = 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=' + urllib.parse.quote(url, safe='')
    return (
        "## Kitobim: Telegram'ga kirish\n\n"
        "1. Telefoningizda **Telegram** → **Sozlamalar** → **Qurilmalar** → **Kompyuterni ulash** "
        "(Settings → Devices → Link Desktop Device).\n"
        "2. Pastdagi QR kodni skanerlang.\n\n"
        f"![QR]({img})\n\n"
        f"QR har 25 soniyada yangilanadi (#{n}). Skanerlash ishlamasa, sahifani yangilang (F5) va yangisini skanerlang.\n"
    )


async def login(client):
    num = gh('issue', 'create', '--repo', REPO, '--title', "Telegram'ga kirish (QR)", '--body', 'Tayyorlanmoqda…').strip().rsplit('/', 1)[-1]
    print('issue:', num, flush=True)
    qr = await client.qr_login()
    deadline = time.time() + 15 * 60
    n = 1
    try:
        while time.time() < deadline:
            gh('issue', 'edit', num, '--repo', REPO, '--body', issue_body(qr.url, n))
            try:
                await qr.wait(25)
                break
            except asyncio.TimeoutError:
                await qr.recreate()
                n += 1
            except errors.SessionPasswordNeededError:
                pw = (os.environ.get('TG_PASSWORD') or '').strip('\r\n')
                if not pw:
                    raise SystemExit("2FA parol kerak: TG_PASSWORD secret qo'shilmagan")
                await client.sign_in(password=pw)
                break
        else:
            raise SystemExit("15 daqiqada QR skanerlanmadi")
    finally:
        ok = await client.is_user_authorized()
        gh('issue', 'edit', num, '--repo', REPO, '--body',
           "Kirildi ✅ Darsliklar yuklanmoqda." if ok else "Kirish bo'lmadi.")
        gh('issue', 'close', num, '--repo', REPO)


async def main():
    client = TelegramClient(StringSession(), int(os.environ['TG_API_ID']), os.environ['TG_API_HASH'],
                            device_model='Kitobim darslik yuklovchi', app_version='1.0')
    await client.connect()
    try:
        if not await client.is_user_authorized():
            await login(client)
        ids = []
        for part in IDLAR.split(','):
            if '-' in part:
                a, b = map(int, part.split('-'))
                ids += list(range(a, b + 1))
            elif part.strip():
                ids.append(int(part))
        msgs = await client.get_messages(KANAL, ids=ids)
        os.makedirs(OUT, exist_ok=True)
        manifest, todo = [], []
        for m in msgs:
            if not m or not m.document:
                continue
            name = m.file.name or ''
            item = {'id': m.id, 'name': name, 'size': m.file.size, 'date': m.date.isoformat(),
                    'text': (m.message or '')[:200]}
            manifest.append(item)
            low = name.lower()
            ok = FILTR == [''] or any(f in low for f in FILTR)
            if REGEX:
                ok = bool(re.search(REGEX, name + ' ' + (m.message or ''), re.I))
            if MIN_DATE and m.date.date().isoformat() < MIN_DATE:
                ok = False
            if m.file.size > 1_000_000 and ok:
                todo.append(m)
        json.dump(manifest, open(f'{OUT}/{MANIFEST}', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'jami fayl: {len(manifest)}, yuklanadi: {len(todo)}', flush=True)

        sem = asyncio.Semaphore(4)

        async def one(m):
            async with sem:
                path = f'{OUT}/tg{m.id}.pdf'
                t = time.time()
                await client.download_media(m, path)
                mb = os.path.getsize(path) / 1048576
                print(f'{m.id} {m.file.name} {mb:.1f} MB {mb / max(time.time() - t, 0.1):.1f} MB/s', flush=True)
                await asyncio.to_thread(gh, 'release', 'upload', RELEASE, path, '--clobber', '--repo', REPO)

        await asyncio.gather(*(one(m) for m in todo))
        gh('release', 'upload', RELEASE, f'{OUT}/{MANIFEST}', '--clobber', '--repo', REPO)
    finally:
        if await client.is_user_authorized():
            await client.log_out()  # seans o'chiriladi, akkauntda qolmaydi
        await client.disconnect()


asyncio.run(main())
