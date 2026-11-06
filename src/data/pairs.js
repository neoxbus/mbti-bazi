// คำนวณคู่ MBTI × เสา bazi (16 × 10 = 160 คู่)
// หลักการ: ใช้ "สิบเทพ" (十神) ของระบบ bazi จริง — ทุกเสามีบทบาทต่อเสาวัน (Day Master)
// แล้วเทียบบทบาทนั้นกับสิ่งที่ MBTI ต้องการ เพื่อให้คะแนนและคำอ่านมีที่มา
import { TYPES } from './mbti.js';
import { STEMS } from './stems.js';
import { ELEMENTS } from './elements.js';
import { tenGod } from './tengods.js';
import { conceptOf, CONCEPT_NOTE } from './concepts.js';

// วงจรหล่อเลี้ยง (相生) — key หล่อเลี้ยง value
const GENERATES = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
// วงจรควบคุม (相克) — key ควบคุม value
const OVERCOMES = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };
// ธาตุที่กินธาตุนี้
const OVERCOME_BY = Object.fromEntries(Object.entries(OVERCOMES).map(([k, v]) => [v, k]));

// อคติของกลุ่มบุคลิกภาพต่อธาตุ — ปรับเล็กน้อยเพื่อให้คะแนนกระจาย ไม่ให้ติดเพดาน
const GROUP_ELEMENT_BIAS = {
  NT: { wood: 3, fire: -3, earth: -2, metal: 4, water: 4 },
  NF: { wood: 4, fire: 2, earth: 1, metal: -4, water: 2 },
  SJ: { wood: -3, fire: -1, earth: 4, metal: 2, water: -4 },
  SP: { wood: 1, fire: 4, earth: -1, metal: 1, water: -1 },
};

// น้ำหนักของแต่ละบทบาทสิบเทพต่อความสัมพันธ์
// 正 = แบบตรงไปตรงมา ดูแลและพิสูจน์ได้ / 偏 = แบบอ้อน เปลี่ยนแปลงได้
// 七杀 กับ 伤官 = แรงมาก แต่ขัดกัน
const GOD_WEIGHT = {
  '正印': 10, '偏印': 4,
  '食神': 8, '伤官': -3,
  '正财': 8, '偏财': 3,
  '正官': 7, '七杀': -4,
  '比肩': 5, '劫财': -2,
};

// ช่วงของน้ำหนักบทบาทสิบเทพ ใช้ทำสเกลให้เทียบกับช่วงของค่าความสัมพันธ์ธาตุ
const GOD_MIN = -4;
const GOD_MAX = 10;
// ช่วงของค่าความสัมพันธ์ธาตุในตาราง MBTI
const AFF_MIN = 44;
const AFF_MAX = 95;

// น้ำหนักขององค์ประกอบทั้งสองในการผสมคะแนน
// ความสัมพันธ์ธาตุเป็นพื้นฐาน ส่วนบทบาทสิบเทพคือสิ่งที่ทำให้เสาแต่ละเสาต่างกัน
const AFF_WEIGHT = 0.6;
const GOD_WEIGHT_RATIO = 0.35;
// ช่วงคะแนนสุดท้าย
const SCORE_BASE = 39;
const SCORE_SPAN = 56;

const clamp = (n) => Math.max(38, Math.min(97, Math.round(n)));

// เสาวันของแต่ละ MBTI (ธาตุประจำตัวของบุคลิกภาพนั้น)
for (const t of TYPES) {
  t.affinityOrderBest = Object.entries(t.affinity).sort((a, b) => b[1] - a[1])[0][0];
  t.dayMasterStem = STEMS.find((s) => s.key === t.dayMaster);
}

export function scorePair(type, stem) {
  const base = type.affinity[stem.element];
  const bias = GROUP_ELEMENT_BIAS[type.group][stem.element];

  // น้ำหนักจากบทบาทสิบเทพ — นี่คือหัวใจของระบบ bazi
  const god = tenGod(type.dayMasterStem, stem, GENERATES, OVERCOMES);
  const godWeight = GOD_WEIGHT[god.hanzi] ?? 0;

  // ทั้งสององค์ประกอบถูกทำให้เป็นสัดส่วน 0..1 ก่อนผสมกัน
  // เพื่อให้คะแนนกระจายเต็มช่วง ไม่ไปติดเพดานบนหรือล่างจนแยกกันไม่ออก
  const affFit = (base - AFF_MIN) / (AFF_MAX - AFF_MIN);
  const godFit = (godWeight - GOD_MIN) / (GOD_MAX - GOD_MIN);
  let score = SCORE_BASE + SCORE_SPAN * (AFF_WEIGHT * affFit + GOD_WEIGHT_RATIO * godFit);

  // เสาหยาง (阳) เพิ่มพลัง/ความเด็ดขาด เสาหยิน (阴) เพิ่มความละเอียด/ความนุ่ม
  if (stem.polarity === 'yang') score += type.group === 'SP' ? 2 : type.group === 'SJ' ? 1 : 0;
  else score += type.group === 'NF' ? 2 : type.group === 'NT' ? 1 : 0;

  // อคติของกลุ่มบุคลิกภาพต่อธาตุ
  score += bias * 1.4;

  // เสาไม้ (การเติบโต) ให้กับคนที่ต้องการพัฒนา
  if (stem.element === 'wood' && ['NF', 'NT'].includes(type.group)) score += 1;
  // เสาน้ำ (ความยืดหยุ่น) ให้กับคนที่ตรึงแน่น
  if (stem.element === 'water' && type.group === 'SJ') score -= 2;
  // เสาโลหะ (ความชัดเจน) ให้กับคนที่ใจไม่นิ่ง
  if (stem.element === 'metal' && ['SP', 'NF'].includes(type.group)) score -= 2;

  return clamp(score);
}

// ระดับคะแนน — ใช้ทั้งในการคำนวณและในการอธิบายให้ผู้ใช้ จึงต้องตรงกันเสมอ
export const SCORE_BANDS = [
  { min: 88, max: 97, key: 'peak', label: 'เหมาะกันมาก', tone: 'peak', note: 'พลังงานของเสานี้เติมเต็มธาตุของคุณ' },
  { min: 78, max: 87, key: 'high', label: 'ไหลลื่น', tone: 'high', note: 'เข้ากันดี มีแรงหนุนให้ทำงานได้เต็มที่' },
  { min: 66, max: 77, key: 'good', label: 'เข้ากันได้', tone: 'good', note: 'ใช้ร่วมกันได้ แต่ต้องปรับจังหวะกันบ้าง' },
  { min: 54, max: 65, key: 'mixed', label: 'ต้องปรับตัว', tone: 'mixed', note: 'ต่างกันพอสมควร คุยกันตรง ๆ ได้ผลกว่า' },
  { min: 38, max: 53, key: 'hard', label: 'ขัดแย้ง', tone: 'hard', note: 'พลังงานคนละทาง ต้องระวังจังหวะของกัน' },
];

export function bandOf(score) {
  const b = SCORE_BANDS.find((x) => score >= x.min) || SCORE_BANDS[SCORE_BANDS.length - 1];
  return { key: b.key, label: b.label, tone: b.tone };
}

export function buildPairs() {
  const pairs = [];
  for (const type of TYPES) {
    for (const stem of STEMS) {
      const score = scorePair(type, stem);
      const band = bandOf(score);
      const el = ELEMENTS[stem.element];
      const god = tenGod(type.dayMasterStem, stem, GENERATES, OVERCOMES);
      const relation = relationBetween(stem.element, type.affinityOrderBest);
      const shared = sharedGround(type, stem);
      pairs.push({
        type: type.code,
        stem: stem.key,
        score,
        band,
        relation,
        god,
        element: stem.element,
        polarity: stem.polarity,
        title: `${type.code} × ${stem.thai}`,
        summary: `${type.code} (${type.nameTh}) กับเสา${stem.thai} ${stem.hanzi} ธาตุ${el.thai} — ความสัมพันธ์ ${score} จาก 100`,
        reading: reading(type, stem, score, band, relation, god),
        advice: advice(type, stem, band),
        shared,
        sharedText: shared.text,
        sharedDetail: shared.detail,
        keywords: [god.thai, ...stem.keywords.slice(0, 2)],
      });
    }
  }
  return pairs;
}

// ความสัมพันธ์ระหว่างธาตุของเสา กับธาตุที่ MBTI นั้นต้องการมากที่สุด
function relationBetween(stemEl, bestEl) {
  if (stemEl === bestEl) {
    return { key: 'same', label: 'ธาตุตรงกัน', note: 'เสากับตัวคุณเป็นธาตุเดียวกัน จึงเข้าใจกันโดยไม่ต้องอธิบาย' };
  }
  if (GENERATES[stemEl] === bestEl) {
    return { key: 'nourish', label: 'เสาหล่อเลี้ยงธาตุที่คุณต้องการ', note: 'ธาตุของเสาหล่อเลี้ยงธาตุที่คุณต้องการ พลังงานจึงไหลเข้าหาคุณ' };
  }
  if (GENERATES[bestEl] === stemEl) {
    return { key: 'feed', label: 'คุณเป็นคนหล่อเลี้ยงธาตุของเสา', note: 'ธาตุของคุณหล่อเลี้ยงเสานี้ คุณจึงเป็นฝ่ายที่ให้พลังงาน' };
  }
  if (OVERCOMES[stemEl] === bestEl) {
    return { key: 'drain', label: 'เสาควบคุมธาตุที่คุณต้องการ', note: 'ธาตุของเสาควบคุมธาตุที่คุณต้องการ พลังงานจะไหลออกจากคุณมากกว่าเข้า' };
  }
  return { key: 'control', label: 'ธาตุที่คุณต้องการควบคุมธาตุของเสา', note: 'ธาตุของคุณคุมเสานี้ไว้ คุณจึงนำทางได้' };
}

// "จุดร่วม" — จุดที่บุคลิกภาพกับเสานี้พูดตรงกันจริง ๆ
// เดิมเดาจากข้อความ ทำให้ 114 จาก 160 คู่ตกไปใช้คำของธาตุทั่วไปที่ไม่ผูกกับบุคลิกภาพเลย
// ตอนนี้จับคู่ด้วย "แนวคิด" (concept) แทน — จุดแข็งของแบบหนึ่งกับคุณสมบัติของธาตุที่แทนแนวคิดเดียวกัน
function sharedGround(type, stem) {
  const el = ELEMENTS[stem.element];

  // หาจุดแข็งของบุคลิกภาพที่มีแนวคิดตรงกับธาตุนี้
  const typeConcepts = type.strengths.map(conceptOf).filter(Boolean);
  const match = el.strengths.find((s) => typeConcepts.includes(conceptOf(s)));

  if (match) {
    const concept = conceptOf(match);
    return {
      kind: 'match',
      text: `จุดร่วม: ${CONCEPT_NOTE[concept]}`,
      detail: `${type.nameTh} กับเสา${stem.thai} ต่างก็เรื่อง${match} — ตรงกับคุณสมบัติของธาตุ${el.thai}พอดี`,
    };
  }

  // ไม่ตรงแนวคิด — บอกตรง ๆ ว่าต่างกันตรงไหน แทนการอ้างคำของธาตุทั่วไปว่าเป็นจุดร่วม
  return {
    kind: 'different',
    text: 'จุดที่ต่างกัน',
    detail: `${type.nameTh} เน้น${type.strengths[0]} ส่วนเสา${stem.thai} เน้น${el.strengths[0]} — คนละแนว ต้องปรับจังหวะกัน`,
  };
}

function reading(type, stem, score, band, relation, god) {
  const el = ELEMENTS[stem.element];
  const lead = {
    peak: 'กลมกลืนกันมาก',
    high: 'ไหลลื่นกันดี',
    good: 'เข้ากันได้ดี',
    mixed: 'เข้ากันได้ แต่ต้องปรับตัว',
    hard: 'ความต่างตรงกันค่อนข้างชัด ต้องระวัง',
  }[band.key];

  // บทบาทสิบเทพของเสานี้ต่อเสาวันของ MBTI — หัวใจของระบบ bazi
  const godLine = `ในระบบสิบเทพ เสา${stem.thai} ${stem.hanzi} ทำหน้าที่ "${god.thai}" (${god.hanzi}) ต่อเสาวันของ ${type.code} — ${god.role}`;

  // คะแนนสูง — เล่าในแง่ที่ช่วยเสริมกัน
  if (band.key === 'peak' || band.key === 'high' || band.key === 'good') {
    return [
      `${type.code} กับเสา${stem.thai} ${stem.hanzi} ${lead} (${score}/100) ${relation.note}`,
      `เสา${stem.thai} คือ${el.core} — ${type.theme[stem.element]}`,
      godLine,
      `สำหรับ ${type.nameTh} จุดที่เสานี้ช่วยได้มากที่สุดคือ ${type.strengths[0]} — ${stem.mbtiNote[type.group]}`,
      `เสานี้ให้คุณ ${stem.gives} แต่ต้องระวังเรื่อง ${stem.shadow} โดยเฉพาะกับ ${type.code} ที่ ${type.watch[0]}`,
    ];
  }

  // คะแนนต่ำ — เล่าในแง่ที่ต้องระวัง ไม่ใช่สมบูรณ์แบบ
  const tension = {
    mixed: `ธาตุ${el.thai}เป็นธาตุที่ ${type.code} ไม่ค่อยถนัด จึงต้องอาศัยการปรับตัวมากกว่าปกติ`,
    hard: `ธาตุ${el.thai}ขัดกับจังหวะของ ${type.code} ค่อนข้างชัด พลังงานจะไหลผ่านกันไปมากกว่ากัน`,
  }[band.key];

  return [
    `${type.code} กับเสา${stem.thai} ${stem.hanzi} ${lead} (${score}/100) ${relation.note}`,
    `${tension} — ${el.core} ของเสานี้จึงกลายเป็นเรื่องที่ต้องจัดการ ไม่ใช่พลังงานที่ไหลมาให้`,
    godLine,
    `จุดที่ชนกันคือ ${type.watch[0]} ของ ${type.code} กับ${stem.shadow} — จุดแข็งที่ต้องพึ่งคือ ${type.strengths[1]}`,
    `ถ้ายังไม่พร้อมปรับ เสานี้ยังมีประโยชน์ในแง่ ${stem.gives} โดยเฉพาะกับด้านที่คุณยังไม่แน่น`,
  ];
}

// คำแนะนำ — ผูกกับบุคลิกภาพของคู่นั้น ไม่ใช่คำแนะนำกลาง ๆ อย่างเดียว
function advice(type, stem, band) {
  const map = {
    peak: `ใช้พลังของเสา${stem.thai}ได้เต็มที่ โดยเฉพาะในเรื่องที่คุณถนัด`,
    high: `ลองมอบหมู่ที่ต้องใช้ทั้งความคิดและความลงมือให้เสา${stem.thai}ช่วยถ่วงน้ำหนัก`,
    good: `เสา${stem.thai}ช่วยเก็บรายละเอียดที่คุณมองข้าม ลองใช้ในงานที่ต้องส่งต่อคนอื่น`,
    mixed: `ระวับ${type.watch[0]} คุยกับเสา${stem.thai}ตรง ๆ ตั้งแต่แรก`,
    hard: `ลองแยกบทบาทให้ชัด ให้เสา${stem.thai}ทำในส่วนที่ตัวเองไม่ถนัด และอย่าฝืนกัน`,
  };
  // ผูกคำแนะนำกับจุดแข็งของบุคลิกภาพ เพื่อให้เห็นว่าควรใช้เสานี้กับด้านไหนของตัวเอง
  const use = {
    peak: `ใช้ด้านที่คุณแข็งที่สุด — ${type.strengths[0]}`,
    high: `ใช้คู่กับ${type.strengths[0]}`,
    good: `เหมาะกับงานที่ต้องใช้ทั้ง${type.strengths[0]}และ${type.strengths[1]}`,
    mixed: `ระวับ${type.watch[0]}ของ${type.code}`,
    hard: `อย่าฝืนใช้เสานี้กับงานที่ต้องใช้${type.strengths[0]}โดยเฉพาะ`,
  };
  return `${map[band.key]} (${use[band.key]})`;
}

export const ALL_PAIRS = buildPairs();
export const PAIR_INDEX = Object.fromEntries(ALL_PAIRS.map((p) => [`${p.type}-${p.stem}`, p]));

export { GENERATES, OVERCOMES, OVERCOME_BY, GOD_WEIGHT };
