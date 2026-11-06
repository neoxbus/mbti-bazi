// ดาวน์โหลดฟอนต์มาเก็บไว้ในเว็บเอง เพื่อให้หน้าตาเหมือนกันทุกเครื่อง
// ใช้: node scripts/fetch-fonts.mjs
// ผลลัพธ์: src/assets/fonts/*.woff2 และ src/styles/fonts.css (ไฟล์ @font-face ที่สร้างอัตโนมัติ)
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const fontDir = join(root, 'src/assets/fonts');
const cssOut = join(root, 'src/styles/fonts.css');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ตัวอักษรจีนที่เว็บใช้จริงทั้งหมด — ดึงจากไฟล์ที่สร้างไว้ หรือกำหนดเองได้
const CJK_TEXT = process.env.CJK_TEXT || [
  '丁七丑丙主乙亥伤偏克劫十午卯印命土壬天子官寅己巳干庚戊戌日木未杀正比水火生甲申癸相神肩财辛辰酉金阳阴食',
].join('');

mkdirSync(fontDir, { recursive: true });

/** ดึง CSS จาก Google Fonts พร้อม user-agent ที่ทำให้ได้ woff2 */
async function googleCss(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`ดึง CSS ไม่สำเร็จ ${res.status} ${url}`);
  return res.text();
}

/** แยกบล็อก @font-face ออกมาทีละอัน */
function parseFaces(css) {
  const faces = [];
  const re = /@font-face\s*\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const block = m[1];
    const pick = (p) => (block.match(p) || [])[1] || '';
    const url = pick(/src:\s*url\(([^)]+)\)/);
    if (!url) continue;
    faces.push({
      family: pick(/font-family:\s*'([^']+)'/) || pick(/font-family:\s*([^;]+);/),
      weight: pick(/font-weight:\s*([^;]+);/),
      style: pick(/font-style:\s*([^;]+);/),
      unicodeRange: pick(/unicode-range:\s*([^;]+);/),
      url,
    });
  }
  return faces;
}

/** กด unicode-range ให้สั้นลง โดยเก็บเฉพาะช่วงที่มีจริง */
function compactRange(range) {
  const nums = (range.match(/U\+[0-9a-fA-F]+/g) || []).map((u) => parseInt(u.slice(2), 16));
  if (!nums.length) return 'U+0-10FFFF';
  nums.sort((a, b) => a - b);
  const out = [];
  let start = nums[0];
  let prev = nums[0];
  for (let i = 1; i < nums.length; i++) {
    const n = nums[i];
    if (n === prev + 1) { prev = n; continue; }
    out.push(start === prev ? `U+${start.toString(16).toUpperCase()}` : `U+${start.toString(16).toUpperCase()}-${prev.toString(16).toUpperCase()}`);
    start = n; prev = n;
  }
  out.push(start === prev ? `U+${start.toString(16).toUpperCase()}` : `U+${start.toString(16).toUpperCase()}-${prev.toString(16).toUpperCase()}`);
  return out.join(',');
}

/** ชื่อไฟล์ที่อ่านง่าย */
function fileName(family, weight, tag) {
  const fam = family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const w = String(weight).replace(/[^0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${fam}-${w}-${tag}.woff2`;
}

const jobs = [];

// ---------- IBM Plex Sans Thai (ตัวไทย + ตัวละติน) ----------
{
  const css = await googleCss(
    'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap'
  );
  for (const f of parseFaces(css)) {
    const tag = /U\+0E01-0E5B/.test(f.unicodeRange) ? 'thai' : 'latin';
    if (tag === 'latin' && !/U\+0000-00FF/.test(f.unicodeRange)) continue; // เก็บแค่ latin กับ thai
    jobs.push({ ...f, tag });
  }
}

// ---------- Noto Sans SC (ตัดเหลือเฉพาะตัวอักษรจีนที่เว็บใช้) ----------
// ขอเป็นฟอนต์ตัวแปร (wght@400..700) ไฟล์เดียวจบ ครอบคลุมทุกน้ำหนัก
{
  const css = await googleCss(
    `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400..700&text=${encodeURIComponent(CJK_TEXT)}`
  );
  for (const f of parseFaces(css)) jobs.push({ ...f, tag: 'subset', variable: true });
}

// ---------- ดาวน์โหลด ----------
const byHash = new Map();
let bytes = 0;
for (const f of jobs) {
  const name = fileName(f.family, f.weight, f.tag);
  const dest = join(fontDir, name);
  if (!existsSync(dest)) {
    const res = await fetch(f.url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`ดาวน์โหลดฟอนต์ไม่สำเร็จ ${res.status} ${f.url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
    bytes += buf.length;
  }
  // ฟอนต์ตัวแปร: Google ส่งไฟล์เดียวกันมาทุกน้ำหนัก ให้ใช้ไฟล์เดียวแล้วประกาศช่วงน้ำหนักแทน
  const hash = createHash('sha256').update(readFileSync(dest)).digest('hex');
  if (byHash.has(hash)) {
    const prev = byHash.get(hash);
    prev.weights.add(f.weight);
    prev.variable = prev.variable && f.variable;
    continue;
  }
  byHash.set(hash, { ...f, file: name, weights: new Set([f.weight]), variable: !!f.variable });
}

// ---------- เขียนไฟล์ @font-face ----------
const faces = [...byHash.values()].map((f) => {
  // ฟอนต์ตัวแปร: Google ระบุน้ำหนักเป็นช่วงอยู่แล้ว (เช่น "400 700") ให้ใช้ค่านั้นตรง ๆ
  const isRange = /\s/.test(String(f.weight));
  const weights = [...f.weights].sort();
  const weight = isRange
    ? String(f.weight)
    : f.variable
      ? `${weights[0]} ${weights[weights.length - 1]}`
      : weights[0];
  return { ...f, weight, range: f.tag === 'subset' ? compactRange(f.unicodeRange) : f.unicodeRange };
});

const css = [
  '/* สร้างโดย scripts/fetch-fonts.mjs — อย่าแก้ด้วยมือ ให้รันสคริปต์ซ้ำแทน */',
  '/* ฟอนต์ถูกฝังไว้ในเว็บเอง เพื่อให้หน้าตาเหมือนกันทุกเครื่องและใช้งานแบบออฟไลน์ได้ */',
  '',
  ...faces.map(
    (f) => `@font-face {
  font-family: '${f.family}';
  font-style: ${f.style || 'normal'};
  font-weight: ${f.weight};
  font-display: swap;
  src: url('/assets/fonts/${f.file}') format('woff2');
  unicode-range: ${f.range};
}`
  ),
  '',
].join('\n');

writeFileSync(cssOut, css, 'utf8');

console.log(`ดาวน์โหลดฟอนต์ ${faces.length} ไฟล์ (${(bytes / 1024).toFixed(0)} KB ใหม่)`);
console.log(`  -> ${fontDir}`);
console.log(`  -> ${cssOut}`);
