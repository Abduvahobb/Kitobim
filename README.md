# Darsligim

Maktab o‘quvchilari uchun bepul ilova: 1–11-sinf maktab darsliklari (o‘zbek va rus maktablari uchun), testlar va sertifikatlar. Uch tilda: o‘zbek, rus, ingliz.

**Ilova muallifi:** Vahobjonov Abduvahob — Telegram: [@Vakhobov47](https://t.me/Vakhobov47)

## Yuklab olish

Eng so‘nggi versiya **Releases** bo‘limida:

- **Android:** `Darsligim.apk`
- **Kompyuter (Windows):** `Darsligim-Setup.exe` (o‘rnatiladigan) yoki `Darsligim-portable.exe` (o‘rnatmasdan ishlaydi)

`main` tarmog‘iga har bir o‘zgarish yuklanganda, ikkala versiya avtomatik qayta yig‘iladi va yangi release chiqadi.

## Kitob qo‘shish

Barcha kitoblar ro‘yxati `public/catalog.json` faylida. Har bir fan ichidagi `books` ro‘yxatiga kitob shunday qo‘shiladi:

```json
{ "id": "5-ona-tili-1", "title": { "uz": "Ona tili · 5-sinf · 1-qism", "ru": "Родной язык · 5 класс · 1 часть", "en": "Native language · Grade 5 · Part 1" }, "lang": "uz", "file": "https://SERVER/kitoblar/5-ona-tili-1.pdf" }
```

- `file` — kitobning PDF fayli. Ilova uni o‘zgartirmasdan ochadi, shuning uchun rasmlar, jadvallar va bet raqamlari bosma kitobdagidek ko‘rinadi.
- Kitoblar serverda tursa, server boshqa saytlardan so‘rovga ruxsat berishi kerak (CORS: `Access-Control-Allow-Origin: *`).
- `src/config.js` dagi `REMOTE_CATALOG` ga serverdagi `catalog.json` manzili yozilsa, yangi kitob qo‘shish uchun ilovani qayta o‘rnatish shart bo‘lmaydi.

## Test qo‘shish

Testlar `tools/testlar/*.txt` fayllarida yoziladi, so‘ng `python3 tools/testlar.py` buyrug‘i ularni `public/tests.json` ga aylantiradi. `answer` — to‘g‘ri javobning tartib raqami (0 dan boshlanadi), `why` — izoh. 70% va undan yuqori natija uchun sertifikat beriladi.

## Dasturchilar uchun

```bash
npm install
npm run dev      # brauzerda sinash
npm run build    # dist/ papkasiga yig‘ish
```

- Veb-ilova: Vite + oddiy JavaScript, PDF o‘quvchi — pdf.js
- Android: Capacitor (`capacitor.config.json`)
- Windows: Electron (`desktop/`)

