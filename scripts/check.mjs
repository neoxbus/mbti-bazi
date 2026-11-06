// ตรวจไฟล์ที่สร้าง: ลิงก์ภายในต้องชี้ไปยังหน้าที่มีจริง, ไม่มี HTML เสีย, ไม่มีข้อความว่าง
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, '..', 'dist');

const problems = [];
const htmlFiles = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full);
    else if (entry.endsWith('.html')) htmlFiles.push(full);
  }
}
walk(dist);

const toUrl = (file) => '/' + relative(dist, file).replace(/\\/g, '/').replace(/index\.html$/, '');

let linkCount = 0;
const seenTargets = new Set();

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const page = toUrl(file);

  // 1) โครงสร้างพื้นฐาน
  if (!html.includes('<!DOCTYPE html>')) problems.push(`${page}: ไม่มี DOCTYPE`);
  if (!/<html lang="th">/.test(html)) problems.push(`${page}: ไม่ได้ตั้ง lang="th"`);
  if (!/<meta name="viewport"/.test(html)) problems.push(`${page}: ไม่มี viewport meta`);
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${page}: ไม่มี title`);
  if (!/<meta name="description" content="[^"]+"/.test(html)) problems.push(`${page}: ไม่มี description`);
  if (!html.includes('</html>')) problems.push(`${page}: ไม่ปิด html`);

  // 1b) ต้องมี h1 พอดีหนึ่ง
  const h1Count = (html.match(/<h1\b/g) || []).length;
  if (h1Count !== 1) problems.push(`${page}: มี h1 ${h1Count} ตัว (ควรมี 1)`);

  // 2) ลิงก์ภายในทั้งหมดต้องมีไฟล์จริง
  const links = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const link of links) {
    if (/^(https?:|mailto:|tel:|data:|#)/.test(link)) continue;
    linkCount++;
    const clean = link.split('#')[0].split('?')[0];
    if (!clean) continue;
    let target = clean.startsWith('/')
      ? join(dist, clean)
      : resolve(dirname(file), clean);
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
    if (!existsSync(target)) {
      problems.push(`${page}: ลิงก์เสีย -> ${link}`);
    } else {
      seenTargets.add(toUrl(target).replace(/\/$/, '') || '/');
    }
  }

  // 3) ไม่มีอักขระที่หลุดจากการ escape (ข้ามส่วน script/style ซึ่งเป็นโค้ด ไม่ใช่ข้อความ)
  const textOnly = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const rawUnescaped = textOnly.match(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/);
  if (rawUnescaped) problems.push(`${page}: มี & ที่ไม่ได้ escape`);

  // 4) ไม่มีข้อความว่างหรือ placeholder ค้าง
  for (const bad of ['undefined', 'NaN', '[object Object]', 'TODO', 'Lorem ipsum']) {
    if (html.includes(bad)) problems.push(`${page}: พบข้อความ "${bad}"`);
  }

  // 5) แท็กที่ไม่ได้ปิด
  const openTags = (html.match(/<(div|section|article|ul|ol|li|p|nav|header|footer|main|table|tbody|thead|tr|td|th)\b/g) || []).length;
  const closeTags = (html.match(/<\/(div|section|article|ul|ol|li|p|nav|header|footer|main|table|tbody|thead|tr|td|th)>/g) || []).length;
  if (openTags !== closeTags) {
    problems.push(`${page}: แท็กเปิด ${openTags} แต่ปิด ${closeTags}`);
  }

  // 6) id ต้องไม่ซ้ำในหน้าเดียวกัน (จอแตะงานผิดปกติเมื่อมี id ซ้ำ)
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupIds.length) {
    problems.push(`${page}: id ซ้ำ ${[...new Set(dupIds)].join(', ')}`);
  }

  // 7) แถบคะแนนต้องตรงกับตัวเลขคะแนนเสมอ
  const bars = [...html.matchAll(/class="bar"[^>]*aria-label="คะแนน (\d+) จาก 100"[^>]*>\s*<span class="bar-fill[^"]*" style="width:([\d.]+)%"/g)];
  for (const [, score, width] of bars) {
    if (Math.abs(Number(width) - Number(score)) > 0.51) {
      problems.push(`${page}: ความยาวแถบคะแนนไม่ตรงกับตัวเลข (${score} vs ${width}%)`);
    }
  }

  // 8) ทุกหน้าต้องมีช่องค้นหาและลิงก์ไปยังหน้าอื่น
  if (!html.includes('id="searchBtn"')) problems.push(`${page}: ไม่มีปุ่มค้นหา`);
  if (!html.includes('/assets/search-index.js')) problems.push(`${page}: ไม่ได้โหลดดัชนีค้นหา`);
}

// 9) ทุกหน้าต้องเข้าถึงได้จากหน้าอื่นด้วยลิงก์
const reachable = new Set([...seenTargets].map((u) => u.replace(/\/$/, '') || '/'));
for (const file of htmlFiles) {
  const page = toUrl(file).replace(/\/$/, '') || '/';
  if (page === '/404.html') continue;
  if (!reachable.has(page)) problems.push(`${page}: ไม่มีใครลิงก์มาหา — เข้าไม่ถึง`);
}

// 10) sitemap ต้องครบทุกหน้า
const sitemapPath = join(dist, 'sitemap.xml');
if (!existsSync(sitemapPath)) {
  problems.push('ไม่มีไฟล์ sitemap.xml');
} else {
  const xml = readFileSync(sitemapPath, 'utf8');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const paths = new Set(urls.map((u) => u.replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '') || '/'));
  for (const file of htmlFiles) {
    const page = toUrl(file).replace(/\/$/, '') || '/';
    if (page === '/404.html') continue;
    if (!paths.has(page)) problems.push(`${page}: ไม่อยู่ใน sitemap.xml`);
  }
}

// 11) ไฟล์ฟอนต์ที่ประกาศไว้ต้องมีจริง
const fontsCss = join(dist, 'assets/fonts.css');
if (!existsSync(fontsCss)) {
  problems.push('ไม่มีไฟล์ assets/fonts.css');
} else {
  const css = readFileSync(fontsCss, 'utf8');
  for (const m of css.matchAll(/url\('\/assets\/fonts\/([^']+)'\)/g)) {
    if (!existsSync(join(dist, 'assets/fonts', m[1]))) {
      problems.push(`ไฟล์ฟอนต์ไม่มีจริง: ${m[1]}`);
    }
  }
}

// 6) ทุกหน้าต้องเข้าถึงได้จากหน้าแรกผ่านลิงก์
const indexHtml = readFileSync(join(dist, 'index.html'), 'utf8');
const linkedFromIndex = [...indexHtml.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);

console.log(`ไฟล์ HTML: ${htmlFiles.length}`);
console.log(`ลิงก์ภายในที่ตรวจ: ${linkCount}`);
console.log(`หน้าที่มีลิงก์เข้าถึง: ${seenTargets.size}`);
console.log('');

if (problems.length === 0) {
  console.log('ไม่พบปัญหา');
} else {
  console.log(`พบปัญหา ${problems.length} รายการ:`);
  for (const p of problems.slice(0, 60)) console.log('  - ' + p);
  if (problems.length > 60) console.log(`  ... และอีก ${problems.length - 60} รายการ`);
  process.exitCode = 1;
}
