// สร้างดัชนีสำหรับช่องค้นหาของทั้งเว็บ — เขียนเป็นไฟล์ JS แยก เพื่อให้เบราว์เซอร์แคชได้
// และไม่ต้องโหลดซ้ำทุกหน้า
import { TYPES, GROUPS } from '../data/mbti.js';
import { STEMS } from '../data/stems.js';
import { ELEMENTS } from '../data/elements.js';
import { ALL_PAIRS } from '../data/pairs.js';

const POLARITY_TH = { yang: 'หยาง', yin: 'หยิน' };

export function buildSearchIndex() {
  // t = [รหัส, ชื่อไทย, กลุ่ม, ชื่อกลุ่ม, url]
  const types = TYPES.map((t) => [
    t.code,
    t.nameTh,
    t.group,
    GROUPS[t.group].thai,
    `/mbti/${t.code.toLowerCase()}/`,
  ]);

  // s = [คีย์, อักษรจีน, ชื่อไทย, คีย์ธาตุ, ชื่อธาตุ, หยาง/หยิน, url]
  const stems = STEMS.map((s) => [
    s.key,
    s.hanzi,
    s.thai,
    s.element,
    ELEMENTS[s.element].thai,
    POLARITY_TH[s.polarity],
    `/stems/${s.key}/`,
  ]);

  // p = [รหัส MBTI, คีย์เสา, คะแนน, url]
  const pairs = ALL_PAIRS.map((p) => [
    p.type,
    p.stem,
    p.score,
    `/pair/${p.type.toLowerCase()}-${p.stem}/`,
  ]);

  // สีประจำธาตุ ใช้ในผลค้นหา
  const colors = Object.fromEntries(
    Object.entries(ELEMENTS).map(([k, v]) => [k, v.color])
  );

  // สีประจำกลุ่ม MBTI
  const groupColors = Object.fromEntries(
    Object.entries(GROUPS).map(([k, v]) => [k, v.color])
  );

  return { types, stems, pairs, colors, groupColors };
}

export function searchIndexJs() {
  const index = buildSearchIndex();
  return `// สร้างโดย src/lib/search-index.js — ดัชนีสำหรับช่องค้นหาของทั้งเว็บ\nwindow.__SEARCH__ = ${JSON.stringify(index)};\n`;
}
