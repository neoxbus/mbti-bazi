import { esc } from './html.js';

export const SITE = {
  name: 'ธาตุกับ MBTI',
  tagline: '16 MBTI × 10 เสาแบบ bazi',
  description:
    'เว็บไซต์อ่านความสัมพันธ์ระหว่างบุคลิกภาพ MBTI 16 ชนิด กับ 10 เสาแบบ bazi (天干) ครบทั้ง 160 คู่ พร้อมคำนวณธาตุของตัวเองจากวันเกิด',
};

const NAV = [
  { href: '/', label: 'หน้าแรก', key: 'home' },
  { href: '/matrix/', label: 'ตาราง 160 คู่', key: 'matrix' },
  { href: '/mbti/', label: '16 MBTI', key: 'mbti' },
  { href: '/stems/', label: '10 เสา', key: 'stems' },
  { href: '/elements/', label: '5 ธาตุ', key: 'elements' },
  { href: '/tengods/', label: 'สิบเทพ', key: 'tengods' },
  { href: '/about/', label: 'ที่มา', key: 'about' },
];

export function layout({ title, description, active, body, scripts = '', bodyClass = '' }) {
  const pageTitle = title ? `${title} — ${SITE.name}` : `${SITE.name} — ${SITE.tagline}`;
  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description || SITE.description)}">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(description || SITE.description)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="th_TH">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/ibm-plex-sans-thai-400-thai.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/ibm-plex-sans-thai-400-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="/">
      <span class="brand-mark">命</span>
      <span class="brand-text">${esc(SITE.name)}<br><span>${esc(SITE.tagline)}</span></span>
    </a>
    <button class="search-btn" id="searchBtn" type="button" aria-label="ค้นหาในเว็บนี้" aria-haspopup="dialog" title="ค้นหา — กด /">
      <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>
      <span class="search-btn-text">ค้นหา</span>
    </button>
    <button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="siteNav" aria-label="เปิดเมนู">☰</button>
    <nav class="nav" id="siteNav">
      ${NAV.map((n) => `<a href="${n.href}"${active === n.key ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`).join('\n      ')}
    </nav>
  </div>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <strong>${esc(SITE.name)}</strong><br>
      ${esc(SITE.tagline)} — อ่านบุคลิกภาพ 16 แบบ คู่กับ 10 เสาธาตุของศาสตร์การนับชะตา
    </div>
    <div class="footer-links">
      ${NAV.map((n) => `<a href="${n.href}">${esc(n.label)}</a>`).join('\n      ')}
    </div>
  </div>
</footer>
<div class="search-modal" id="searchModal" role="dialog" aria-modal="true" aria-labelledby="searchTitle" hidden>
  <div class="search-panel">
    <h2 class="visually-hidden" id="searchTitle">ค้นหาในเว็บนี้</h2>
    <div class="search-field">
      <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>
      <input id="searchInput" type="search" placeholder="ค้นหา MBTI, เสา หรือคู่ — เช่น ENFJ, แก้ไม้, 甲" autocomplete="off" spellcheck="false" aria-label="พิมพ์คำค้นหา">
      <button type="button" class="search-close" id="searchClose" aria-label="ปิดการค้นหา">✕</button>
    </div>
    <div class="search-results" id="searchResults" aria-label="ผลการค้นหา"></div>
    <p class="search-foot"><kbd>Esc</kbd> ปิด · <kbd>↑</kbd><kbd>↓</kbd> เลือก · <kbd>Enter</kbd> เปิด</p>
  </div>
</div>
<script src="/assets/app.js" defer></script>
<script src="/assets/search-index.js" defer></script>
<script src="/assets/search.js" defer></script>
${scripts}
</body>
</html>`;
}

export function breadcrumb(items) {
  const parts = [`<a href="/">หน้าแรก</a>`];
  items.forEach((it, i) => {
    parts.push('<span class="sep">/</span>');
    parts.push(it.href ? `<a href="${it.href}">${esc(it.label)}</a>` : `<span>${esc(it.label)}</span>`);
  });
  return `<nav class="wrap breadcrumb" aria-label="เส้นทาง">${parts.join('')}</nav>`;
}
