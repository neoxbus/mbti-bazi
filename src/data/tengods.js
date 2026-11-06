// สิบเทพ (十神) — ชื่อบทบาทของเสาแต่ละเสาเมื่อเทียบกับ "ธาตุประจำตัว" (เสาวัน / Day Master)
// กติกามาตรฐาน: ดูความสัมพันธ์ธาตุ 5 ธาตุ แล้วดูว่าหยาง–หยิน ตรงกันหรือกลับกัน
export const TEN_GODS = {
  peer: {
    same: { hanzi: '比肩', pinyin: 'bǐ jiān', thai: 'พี่คู่เสีย', role: 'ตัวเต็มที่เหมือนกัน — คิดเหมือน ทำเหมือน แต่แย่งของกันได้' },
    opposite: { hanzi: '劫财', pinyin: 'jié cái', thai: 'ผู้แย่งทรัพย์', role: 'ตัวเต็มที่หักล้าง — แข็งแกร่งและท้าทาย แต่มักแย่งทรัพย์กัน' },
  },
  output: {
    same: { hanzi: '食神', pinyin: 'shí shén', thai: 'เทพแห่งการสร้างสรรค์', role: 'สิ่งที่ตัวคุณหล่อเลี้ยงออกมา — ผ่อนคลาย เป็นธรรมชาติ และกินได้' },
    opposite: { hanzi: '伤官', pinyin: 'shāng guān', thai: 'เทพแห่งการท้วง', role: 'สิ่งที่ตัวคุณหล่อเลี้ยงออกมาแต่ดูถูกกฎ — สร้างสรรค์เก่ง แต่ไม่เกรงใจอำนาจ' },
  },
  wealth: {
    same: { hanzi: '偏财', pinyin: 'piān cái', thai: 'ทรัพย์อ้อน', role: 'สิ่งที่ตัวคุณควบคุม — โอกาสที่มาแบบไม่คาดคิด ลุกโลกได้' },
    opposite: { hanzi: '正财', pinyin: 'zhèng cái', thai: 'ทรัพย์จริง', role: 'สิ่งที่ตัวคุณควบคุม — ทรัพย์ที่มาด้วยความขยันและความมั่นคง' },
  },
  authority: {
    same: { hanzi: '七杀', pinyin: 'qī shā', thai: 'ผู้พิชิต', role: 'สิ่งที่ควบคุมคุณ — แรงกดดันที่ทำให้คุณโต แต่ต้องระวังเผลอพลัง' },
    opposite: { hanzi: '正官', pinyin: 'zhèng guān', thai: 'อำมาตร์', role: 'สิ่งที่ควบคุมคุณ — กฎเกณฑ์ที่ทำให้คุณอยู่ในร่าง สงบและน่าเชื่อถือ' },
  },
  resource: {
    same: { hanzi: '偏印', pinyin: 'piān yìn', thai: 'ปัญญาเกราะ', role: 'สิ่งที่หล่อเลี้ยงคุณ — เจ็ดลึกแต่ไม่ตรงไปตรงมา ใช้ประโยชน์ได้ทางลับ' },
    opposite: { hanzi: '正印', pinyin: 'zhèng yìn', thai: 'ปัญญาประกาศ', role: 'สิ่งที่หล่อเลี้ยงคุณ — ความรู้ที่ได้มาตรง ๆ พิสูจน์ได้ และส่งต่อได้ดี' },
  },
};

export const TEN_GOD_FAMILY = {
  peer: 'เพื่อนคู่เสีย (比肩/劫财)',
  output: 'สิ่งที่หล่อเลี้ยงออกมา (食神/伤官)',
  wealth: 'สิ่งที่คุณควบคุม (正财/偏财)',
  authority: 'สิ่งที่ควบคุมคุณ (正官/七杀)',
  resource: 'สิ่งที่หล่อเลี้ยงคุณ (正印/偏印)',
};

// ความสัมพันธ์ธาตุระหว่างธาตุประจำตัว (dm) กับเสาอีกเสา (other)
export function godFamily(dmElement, otherElement, GENERATES, OVERCOMES) {
  if (dmElement === otherElement) return 'peer';
  if (GENERATES[dmElement] === otherElement) return 'output';   // ตัวเองหล่อเลี้ยง
  if (OVERCOMES[dmElement] === otherElement) return 'wealth';   // ตัวเองควบคุม
  if (OVERCOMES[otherElement] === dmElement) return 'authority'; // ถูกควบคุม
  return 'resource';                                            // ถูกหล่อเลี้ยง
}

// ชื่อสิบเทพที่เสานั้นมีเมื่อเทียบกับธาตุประจำตัว
export function tenGod(dmStem, otherStem, GENERATES, OVERCOMES) {
  const family = godFamily(dmStem.element, otherStem.element, GENERATES, OVERCOMES);
  const samePolarity = dmStem.polarity === otherStem.polarity;
  const god = TEN_GODS[family][samePolarity ? 'same' : 'opposite'];
  return {
    family,
    familyLabel: TEN_GOD_FAMILY[family],
    samePolarity,
    ...god,
    relation: {
      peer: 'ธาตุเดียวกัน',
      output: 'ตัวคุณหล่อเลี้ยงเสานี้',
      wealth: 'ตัวคุณควบคุมเสานี้',
      authority: 'เสานี้ควบคุมตัวคุณ',
      resource: 'เสานี้หล่อเลี้ยงตัวคุณ',
    }[family],
  };
}
