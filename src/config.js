// Kitoblar ro'yxati (katalog) qayerdan yangilanadi.
// Ilova ochilganda avval ichidagi (yoki oxirgi saqlangan) ro'yxat bilan darhol ishlaydi,
// so'ng shu manzildan yangi ro'yxatni oladi — yangi kitob qo'shilsa, ilovani qayta o'rnatish shart emas.
// Bo'sh qoldirilsa, faqat ilova ichidagi public/catalog.json ishlatiladi.
export const REMOTE_CATALOG = 'https://github.com/Abduvahobb/Kitobim/releases/download/kitoblar/catalog.json';

export const APP_VERSION = '0.3.0';

// Ilova muallifi
export const AUTHOR = { name: 'Vahobjonov Abduvahob', telegram: 'Vakhobov47' };

// "Kitoblar" bo'limi (o'zbek va ingliz tilidagi kitoblar) ro'yxati
export const REMOTE_LIBRARY = 'https://github.com/Abduvahobb/Kitobim/releases/download/kitoblar/library.json';
