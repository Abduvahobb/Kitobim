// Kitoblar ro'yxati (katalog) qayerdan yangilanadi.
// Ilova ochilganda avval ichidagi (yoki oxirgi saqlangan) ro'yxat bilan darhol ishlaydi,
// so'ng shu manzildan yangi ro'yxatni oladi — yangi kitob qo'shilsa, ilovani qayta o'rnatish shart emas.
// Bo'sh qoldirilsa, faqat ilova ichidagi public/catalog.json ishlatiladi.
export const REMOTE_CATALOG = 'https://github.com/Abduvahobb/Kitobim/releases/download/kitoblar/catalog.json';
// GitHub ochilmaydigan tarmoqlar uchun zaxira nusxa (jsDelivr CDN, main shoxobchadagi fayl)
export const REMOTE_CATALOG_MIRROR = 'https://cdn.jsdelivr.net/gh/Abduvahobb/Kitobim@main/public/catalog.json';

export const APP_VERSION = '1.0.0';

// Ilova muallifi
export const AUTHOR = { name: 'Vahobjonov Abduvahob', full: 'Vahobjonov Abduvahob Rustamjon o‘g‘li', phone: '+998 98 007 69 56', telegram: 'Vakhobov47' };

// Firebase (SMS orqali kirish, muallif rejimi, ilova mazmunini bulutdan olish).
// Bu kalitlar maxfiy emas: kim nimani o'qishi/yozishi Firestore qoidalarida belgilanadi.
export const FIREBASE = {
  apiKey: 'AIzaSyA-b7I4Q-qUnDnr_iQk5hDNQsqpws3kM4o',
  authDomain: 'kitobim-56f45.firebaseapp.com',
  projectId: 'kitobim-56f45',
  storageBucket: 'kitobim-56f45.firebasestorage.app',
  messagingSenderId: '129414149746',
  appId: '1:129414149746:web:ddaef5f332953b221a74eb'
};

// Muallif hisobi (Firebase Authentication'dagi Email/Password foydalanuvchi).
// Parol ilovada saqlanmaydi — uni Firebase serveri tekshiradi.
export const AUTHOR_EMAIL = 'muallif@kitobim.uz';
// Shu ismlardan biri yozilsa, muallif paroli so'raladi
export const AUTHOR_NAMES = ['abduvahob vahobjonov', 'vahobjonov abduvahob', 'абдувахоб вахобжонов', 'вахобжонов абдувахоб'];

