// สร้างเว็บไซต์แบบไฟล์คงที่ (static site) — ออกไฟล์ไว้ที่ app/dist
import { mkdirSync, writeFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TYPES } from '../src/data/mbti.js';
import { STEMS } from '../src/data/stems.js';
import { ALL_PAIRS } from '../src/data/pairs.js';
import { layout } from '../src/lib/layout.js';
import { searchIndexJs } from '../src/lib/search-index.js';
import {
  homePage,
  matrixPage,
  mbtiIndexPage,
  mbtiPage,
  stemsIndexPage,
  stemPage,
  pairPage,
  elementsPage,
  tengodsPage,
  aboutPage,
} from '../src/lib/pages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');

// โดเมนไซต์ — ตั้งค่าผ่าน env SITE_URL ตอน build (บน Vercel ให้ใส่ใน Project Settings > Environment Variables)
// ถ้าไม่ได้ตั้งจะเดาโดเมนจากตัวแปรที่ Vercel ส่งมาให้ แล้วค่อย fallback เป็น example.com
const vercelHost =
  process.env.VERCEL_ENV === 'production'
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : process.env.VERCEL_URL;
const siteUrl = (
  process.env.SITE_URL ||
  (vercelHost ? `https://${vercelHost}` : '') ||
  'https://example.com'
).replace(/\/$/, '');

let pages = 0;
const sitemap = [];

function write(relPath, html) {
  const file = join(dist, relPath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html, 'utf8');
  pages++;
}

// กำหนดความสำคัญ/ความถี่ในการอัปเดตของแต่ละหน้า สำหรับ sitemap
function seo(relPath) {
  const url = '/' + relPath.replace(/index\.html$/, '');
  if (url === '/') return { url, priority: '1.0', freq: 'weekly' };
  if (url.startsWith('/pair/')) return { url, priority: '0.6', freq: 'monthly' };
  if (url.startsWith('/mbti/')) return { url, priority: '0.8', freq: 'monthly' };
  if (url.startsWith('/stems/')) return { url, priority: '0.8', freq: 'monthly' };
  if (url.startsWith('/matrix')) return { url, priority: '0.9', freq: 'weekly' };
  return { url, priority: '0.7', freq: 'monthly' };
}

function page(relPath, opts) {
  write(relPath, layout(opts));
  sitemap.push(seo(relPath));
}

// ---------- ล้างโฟลเดอร์ผลลัพธ์ ----------
if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// ---------- หน้าแรก ----------
{
  const { body, scripts } = homePage();
  page('index.html', {
    title: null,
    description:
      'อ่านความสัมพันธ์ระหว่างบุคลิกภาพ MBTI 16 ชนิด กับ 10 เสาแบบ bazi (天干) ครบ 160 คู่ พร้อมคำนวณธาตุของตัวเองจากวันเกิด',
    active: 'home',
    body,
    scripts,
  });
}

// ---------- ตาราง ----------
{
  const { body } = matrixPage();
  page('matrix/index.html', {
    title: 'ตาราง 160 คู่ MBTI × 10 เสา',
    description: 'ตารางคะแนนความสัมพันธ์ของ MBTI 16 ชนิด กับ 10 เสาแบบ bazi ครบทุกคู่',
    active: 'matrix',
    body,
  });
}

// ---------- ดัชนี MBTI ----------
{
  const { body } = mbtiIndexPage();
  page('mbti/index.html', {
    title: 'MBTI 16 ชนิด',
    description: 'บุคลิกภาพ MBTI ทั้ง 16 แบบ พร้อมเสาธาตุแบบ bazi ที่เข้ากันในแต่ละแบบ',
    active: 'mbti',
    body,
  });
}

// ---------- หน้า MBTI แต่ละชนิด ----------
for (const t of TYPES) {
  const { body } = mbtiPage(t);
  page(`mbti/${t.code.toLowerCase()}/index.html`, {
    title: `${t.code} ${t.nameTh} — คู่กับ 10 เสา bazi`,
    description: `${t.code} (${t.nameTh}) ${t.tagline} — ดูความสัมพันธ์กับ 10 เสาแบบ bazi พร้อมคะแนนและคำอ่าน`,
    active: 'mbti',
    body,
  });
}

// ---------- ดัชนีเสา ----------
{
  const { body } = stemsIndexPage();
  page('stems/index.html', {
    title: '10 เสาแบบ bazi (天干)',
    description: '10 เสาแบบ bazi — ไม้ ไฟ ดิน โลหะ น้ำ แบ่งหยางและหยิน',
    active: 'stems',
    body,
  });
}

// ---------- หน้าเสาแต่ละเสา ----------
for (const s of STEMS) {
  const { body } = stemPage(s);
  page(`stems/${s.key}/index.html`, {
    title: `${s.thai} ${s.hanzi} — กับ MBTI 16 ชนิด`,
    description: `เสา${s.thai} (${s.hanzi}) ธาตุ${
      { wood: 'ไม้', fire: 'ไฟ', earth: 'ดิน', metal: 'โลหะ', water: 'น้ำ' }[s.element]
    } ${s.polarity === 'yang' ? 'หยาง' : 'หยิน'} — ดูความสัมพันธ์กับ MBTI ทั้ง 16 ชนิด`,
    active: 'stems',
    body,
  });
}

// ---------- หน้าคู่ทั้งหมด 160 คู่ ----------
for (const p of ALL_PAIRS) {
  const { body } = pairPage(p);
  page(`pair/${p.type.toLowerCase()}-${p.stem}/index.html`, {
    title: `${p.type} × ${STEMS.find((s) => s.key === p.stem).thai}`,
    description: p.summary,
    active: 'matrix',
    body,
  });
}

// ---------- หน้าธาตุ ----------
{
  const { body } = elementsPage();
  page('elements/index.html', {
    title: 'ธาตุทั้งห้า และวงจรของมัน',
    description: 'ไม้ ไฟ ดิน โลหะ น้ำ — วงจรหล่อเลี้ยงและวงจรควบคุมในระบบ bazi',
    active: 'elements',
    body,
  });
}

// ---------- หน้าสิบเทพ ----------
{
  const { body } = tengodsPage();
  page('tengods/index.html', {
    title: 'สิบเทพ (十神) — บทบาทของเสาทั้งสิบ',
    description: 'กติกาสิบเทพของระบบ bazi — ทุกเสามีบทบาทต่อเสาวันของแต่ละคนอย่างไร',
    active: 'tengods',
    body,
  });
}

// ---------- หน้าเกี่ยวกับ ----------
{
  const { body } = aboutPage();
  page('about/index.html', {
    title: 'ที่มาของข้อมูล',
    description: 'ที่มาของข้อมูล MBTI 16 ชนิด กับ 10 เสาแบบ bazi และวิธีคำนวณคะแนน 160 คู่',
    active: 'about',
    body,
  });
}

// ---------- 404 ----------
write(
  '404.html',
  layout({
    title: 'ไม่พบหน้านี้',
    description: 'ไม่พบหน้าที่คุณต้องการ',
    body: `<section class="section wrap wrap-narrow" style="text-align:center">
      <div class="kicker" style="color:var(--gold);letter-spacing:0.14em;font-size:0.82rem">404</div>
      <h1 style="margin-top:10px">ไม่พบหน้านี้</h1>
      <p style="color:var(--ink-2)">ลิงก์อาจไม่ถูกต้อง หรือหน้าถูกย้าย</p>
      <a class="btn btn-primary" href="/">กลับหน้าแรก</a>
    </section>`,
  })
);

// ---------- ไฟล์ประกอบ ----------
mkdirSync(join(dist, 'assets'), { recursive: true });
cpSync(join(root, 'src/styles/site.css'), join(dist, 'assets/site.css'));
cpSync(join(root, 'src/styles/fonts.css'), join(dist, 'assets/fonts.css'));
cpSync(join(root, 'src/client/app.js'), join(dist, 'assets/app.js'));
cpSync(join(root, 'src/client/search.js'), join(dist, 'assets/search.js'));

// ดัชนีสำหรับช่องค้นหา — สร้างจากข้อมูลจริงทุกครั้งที่ build
writeFileSync(join(dist, 'assets/search-index.js'), searchIndexJs(), 'utf8');

// ฟอนต์ที่ฝังไว้ในเว็บเอง — ให้หน้าตาเหมือนกันทุกเครื่องและใช้งานแบบออฟไลน์ได้
cpSync(join(root, 'src/assets/fonts'), join(dist, 'assets/fonts'), { recursive: true });

// favicon เป็นกราฟิก/สัญลักษณ์ เรียงสีห้าธาตุ
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#121022"/>
  <circle cx="32" cy="32" r="19" fill="none" stroke="#e6c07a" stroke-width="3"/>
  <circle cx="32" cy="15" r="5" fill="#4fb783"/>
  <circle cx="47" cy="40" r="5" fill="#ff6f59"/>
  <circle cx="32" cy="50" r="5" fill="#d8a33c"/>
  <circle cx="17" cy="40" r="5" fill="#5b93f5"/>
</svg>`;
writeFileSync(join(dist, 'assets/favicon.svg'), favicon, 'utf8');

// robots — ชี้ sitemap ด้วย URL แบบเต็มตามมาตรฐาน (ต้องเป็น absolute URL)
writeFileSync(
  join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`,
  'utf8'
);

// sitemap — ให้ผู้ค้นหาเก็บทุกหน้าได้ครบ
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap
  .map(
    (s) => `  <url>
    <loc>${siteUrl}${s.url}</loc>
    <changefreq>${s.freq}</changefreq>
    <priority>${s.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
writeFileSync(join(dist, 'sitemap.xml'), sitemapXml, 'utf8');

console.log(`สร้างเสร็จ ${pages} หน้า -> ${dist}`);
console.log(`  MBTI ${TYPES.length} · เสา ${STEMS.length} · คู่ ${ALL_PAIRS.length}`);
console.log(`  sitemap ${sitemap.length} รายการ`);
