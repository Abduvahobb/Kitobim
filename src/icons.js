// Ilovadagi chiziqli ikonkalar (SVG). Rang atrofdagi matn rangidan olinadi.
const s = (d, size = 24, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const I = {
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
  trash: (z) => s('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', z),
  play: (z = 30) => `<svg width="${z}" height="${z}" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`,
  pause: (z = 30) => `<svg width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>`
};

// Ilova logotipi (tanlangan 5-ikonka: kitoblar ustidagi bitiruv qalpog'i)
export const LOGO = (size = 96) => `<svg width="${size}" height="${size}" viewBox="0 0 140 140" role="img" aria-label="Kitobim"><rect width="140" height="140" rx="32" fill="#16A085"/><rect x="38" y="70" width="64" height="16" rx="3" fill="#FFFFFF"/><rect x="42" y="88" width="58" height="16" rx="3" fill="#D4F1EA"/><polygon points="70,30 112,46 70,62 28,46" fill="#1B2A41"/><rect x="52" y="52" width="36" height="12" fill="#1B2A41"/><polyline points="70,46 104,50 104,68" fill="none" stroke="#F2C94C" stroke-width="3" stroke-linecap="round"/><circle cx="104" cy="70" r="4" fill="#F2C94C"/></svg>`;
