// Ilovadagi chiziqli ikonkalar (SVG). Rang atrofdagi matn rangidan olinadi.
const s = (d, size = 24, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const I = {
  info: (z) => s('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', z),
  phone: (z) => s('<path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5L16 14l4 1.5V19a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4z"/>', z),
  home: (z) => s('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>', z),
  school: (z) => s('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>', z),
  book: (z) => s('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>', z),
  library: (z) => s('<path d="M4 4h4v16H4zM10 4h4v16h-4z"/><path d="M16 5l3.5-1 2.5 15.5-3.5 1z"/>', z),
  test: (z) => s('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>', z),
  user: (z) => s('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', z),
  back: (z) => s('<path d="M15 5l-7 7 7 7"/>', z),
  close: (z) => s('<path d="M6 6l12 12M18 6L6 18"/>', z),
  chevron: (z) => s('<path d="M9 5l7 7-7 7"/>', z),
  left: (z) => s('<path d="M15 6l-6 6 6 6"/>', z),
  right: (z) => s('<path d="M9 6l6 6-6 6"/>', z),
  search: (z) => s('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', z),
  globe: (z) => s('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>', z),
  plus: (z) => s('<path d="M12 5v14M5 12h14"/>', z),
  minus: (z) => s('<path d="M5 12h14"/>', z),
  fit: (z) => s('<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>', z),
  download: (z) => s('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', z),
  check: (z) => s('<path d="M5 12l5 5 9-10"/>', z),
  x: (z) => s('<path d="M6 6l12 12M18 6L6 18"/>', z),
  headphones: (z) => s('<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="7" rx="1.5"/><rect x="17" y="14" width="4" height="7" rx="1.5"/>', z),
  rewind: (z) => s('<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/>', z),
  forward: (z) => s('<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v4h-4"/>', z),
  logout: (z) => s('<path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>', z),
  telegram: (z) => s('<path d="M21 4 3 11l6 2.5L19 7l-7.5 8L18 20z"/><path d="M9 13.5V19l3-3"/>', z),
  star: (z) => s('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>', z),
  trash: (z) => s('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', z),
  play: (z = 30) => `<svg width="${z}" height="${z}" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`,
  pause: (z = 30) => `<svg width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>`
};

// Fan ikonkalari (fan nomidagi slug bo'yicha)
const P = {
  letters: '<path d="M3.5 19 8.5 5l5 14M5.3 14h6.4"/><circle cx="17.6" cy="15.6" r="2.9"/><path d="M20.5 12.6V19"/>',
  read: '<path d="M3 5.5c2.7-1 5.7-.8 9 1.2 3.3-2 6.3-2.2 9-1.2V19c-2.7-1-5.7-.8-9 1.2-3.3-2-6.3-2.2-9-1.2z"/><path d="M12 6.7v13.5"/>',
  math: '<path d="M7 3.5v6M4 6.5h6M14 6.5h6M4.8 14.8l4.4 4.4M9.2 14.8l-4.4 4.4M14 15h6M14 18.6h6"/>',
  geom: '<path d="M12 3.5 21 20H3z"/><circle cx="12" cy="14.3" r="2.7"/>',
  atom: '<circle cx="12" cy="12" r="1.6"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)"/>',
  flask: '<path d="M9 3h6M10 3v6.2L4.6 18.4A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.4-2.6L14 9.2V3"/><path d="M7.2 15h9.6"/>',
  leaf: '<path d="M5 19.5C5 10.5 10.5 5 20 4.5 19.5 14 14 19.5 5 19.5z"/><path d="M5 19.5 14 10.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  hist: '<path d="M3 9 12 4l9 5z"/><path d="M5.5 9.5v8M10 9.5v8M14 9.5v8M18.5 9.5v8M3 20.5h18"/>',
  talk: '<path d="M4 5h16v11H9.5L5 19.5V16H4z"/><path d="M8 9h8M8 12.3h5"/>',
  pc: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8.5 20.5h7M12 16v4.5"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M3.6 9.2c5.4 1.6 11.4 1.6 16.8 0M12 3c-2.4 5.2-2.4 12.8 0 18"/>',
  music: '<path d="M9 18V5.5l11-2.2v12.4"/><circle cx="6.3" cy="18" r="2.7"/><circle cx="17.3" cy="15.7" r="2.7"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.9 0-1.2-1-1.6-1-2.6 0-1 .8-1.6 1.9-1.6H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.6" cy="11.4" r="1.1"/><circle cx="10.4" cy="7.4" r="1.1"/><circle cx="15.2" cy="7.6" r="1.1"/>',
  tool: '<path d="M14.6 5.4a4.2 4.2 0 0 0-5.3 5.3L3.8 16.2v4h4l5.5-5.5a4.2 4.2 0 0 0 5.3-5.3L16 12l-3-1-1-3z"/>',
  law: '<path d="M12 4v16M7.5 20.5h9M4.5 7.5h15M7 4.8l5-.8 5 .8"/><path d="M4.5 7.5 2 13.2a2.6 2.6 0 0 0 5 0zM19.5 7.5 17 13.2a2.6 2.6 0 0 0 5 0z"/>',
  chart: '<path d="M4 20V11M10 20V5M16 20v-6.5M2.5 20.5h19"/><path d="m16 7 4-3.5"/>',
  shield: '<path d="M12 3.2 19.5 6v6c0 4.8-3.2 7.9-7.5 9-4.3-1.1-7.5-4.2-7.5-9V6z"/><path d="m8.8 12 2.3 2.3 4.2-4.6"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  pen: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>'
};
const SUBJ = {
  'alifbe': 'letters', 'ona-tili': 'letters', 'ozbek-tili': 'letters', 'rus-tili': 'letters', 'nutq-ostirish': 'talk',
  'yozuv-daftari-propis': 'pen', 'oqish-savodxonligi': 'read', 'adabiyot': 'read', 'tarixdan-hikoyalar': 'read',
  'matematika': 'math', 'algebra': 'math', 'geometriya': 'geom', 'chizmachilik': 'geom', 'fizika': 'atom', 'astronomiya': 'star',
  'kimyo': 'flask', 'biologiya': 'leaf', 'zoologiya': 'leaf', 'tabiiy-fanlar': 'leaf', 'geografiya': 'globe',
  'tarix': 'hist', 'ozbekiston-tarixi': 'hist', 'jahon-tarixi': 'hist', 'ingliz-tili': 'talk', 'nemis-tili': 'talk',
  'fransuz-tili': 'talk', 'informatika': 'pc', 'tarbiya': 'heart', 'jismoniy-tarbiya': 'ball', 'musiqa': 'music',
  'tasviriy-sanat': 'palette', 'texnologiya': 'tool', 'davlat-va-huquq-asoslari': 'law', 'iqtisodiy-bilim-asoslari': 'chart',
  'tadbirkorlik-asoslari': 'chart', 'chaqiruvga-qadar-boshlangich-tayyorgarlik': 'shield'
};
// "5-matematika" -> matematika ikonkasi
export const subjIcon = (subjectId, size = 22) => s(P[SUBJ[String(subjectId).replace(/^\d+-/, '')]] || P.book, size, 'stroke-width="1.9"');

// Ilova logotipi (tanlangan 5-ikonka: kitoblar ustidagi bitiruv qalpog'i)
export const LOGO = (size = 96) => `<svg width="${size}" height="${size}" viewBox="0 0 140 140" role="img" aria-label="Darsligim"><rect width="140" height="140" rx="32" fill="#16A085"/><rect x="38" y="70" width="64" height="16" rx="3" fill="#FFFFFF"/><rect x="42" y="88" width="58" height="16" rx="3" fill="#D4F1EA"/><polygon points="70,30 112,46 70,62 28,46" fill="#1B2A41"/><rect x="52" y="52" width="36" height="12" fill="#1B2A41"/><polyline points="70,46 104,50 104,68" fill="none" stroke="#F2C94C" stroke-width="3" stroke-linecap="round"/><circle cx="104" cy="70" r="4" fill="#F2C94C"/></svg>`;
