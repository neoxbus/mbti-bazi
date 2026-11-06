// คำนวณ "ธาตุของตัวเอง" จากวันเกิด แบบ bazi — เสาวันเกิด (日主 / Day Master)
// เสาวันเกิดคือเสาหยางหรือหยินของเสาที่อยู่ในตำแหน่ง "วัน" ของดวงจร 4 เสา

const STEM_KEYS = ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui'];
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ZODIAC = ['หนู', 'วัว', 'เสือ', 'กระต่าย', 'มังกร', 'งู', 'ม้า', 'แกะ', 'ลิง', 'ไก่', 'สุนัข', 'หมู'];
const STEM_ELEMENT = ['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water'];
const STEM_TH = ['แก้ไม้', 'อี้ไม้', 'ปิ่งไฟ', 'ติ่งไฟ', 'อู้ดิน', 'จี้ดิน', 'เกิงโลหะ', 'ซิ่งโลหะ', 'เหรินน้ำ', 'กุ้ยน้ำ'];

// Julian Day Number สำหรับวันที่ (Gregorian)
export function julianDay(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

// เสาวันเกิด: stem = (JDN + 9) % 10, branch = (JDN + 1) % 12
export function dayPillar(year, month, day) {
  const jdn = julianDay(year, month, day);
  const stemIndex = (jdn + 9) % 10;
  const branchIndex = (jdn + 1) % 12;
  return {
    jdn,
    stemIndex,
    branchIndex,
    stem: STEMS[stemIndex],
    branch: BRANCHES[branchIndex],
    element: STEM_ELEMENT[stemIndex],
    stemTh: STEM_TH[stemIndex],
    polarity: stemIndex % 2 === 0 ? 'yang' : 'yin',
  };
}

// เสาปี — เปลี่ยนที่ "ลิบชุน" (立春) ประมาณ 4 กุมภาพายน ไม่ใช่ 1 มกราคม
export function yearPillar(year, month, day) {
  const liChun = month > 2 || (month === 2 && day >= 4);
  const y = liChun ? year : year - 1;
  const stemIndex = ((y - 4) % 10 + 10) % 10;
  const branchIndex = ((y - 4) % 12 + 12) % 12;
  return {
    stem: STEMS[stemIndex],
    branch: BRANCHES[branchIndex],
    zodiac: ZODIAC[branchIndex],
    element: STEM_ELEMENT[stemIndex],
    stemTh: STEM_TH[stemIndex],
    liChun,
  };
}

// คำนวณครบจากวันเกิด
export function calculateFromBirth(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dp = dayPillar(year, month, day);
  const yp = yearPillar(year, month, day);
  return {
    dayPillar: dp,
    yearPillar: yp,
    stemKey: STEM_KEYS[dp.stemIndex],
    element: dp.element,
    polarity: dp.polarity,
  };
}

export { STEMS, BRANCHES, ZODIAC, STEM_ELEMENT, STEM_TH, STEM_KEYS };
