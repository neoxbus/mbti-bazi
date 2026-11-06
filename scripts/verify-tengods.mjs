// ตรวจว่าตารางสิบเทพตรงกับกติกามาตรฐานของระบบ bazi
// กติกา: ธาตุเดียวกัน = เพื่อนคู่เสีย | ตัวเองหล่อเลี้ยง = สิ่งที่หล่อเลี้ยงออกมา
//        ตัวเองควบคุม = ทรัพย์ | ถูกควบคุม = อำนาจ | ถูกหล่อเลี้ยง = ปัญญา
// หยาง–หยิน: หยางตรงกับหยาง = ตรง, คนละ = กลับ
import { tenGod } from '../src/data/tengods.js';
import { STEMS } from '../src/data/stems.js';

const GEN = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
const OVR = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };

// กติกาควบคุมของแต่ละกลุ่ม: same = หยางตรงกับหยาง, opposite = คนละขั้ว
const RULE = {
  peer: { same: '比肩', opposite: '劫财' },
  output: { same: '食神', opposite: '伤官' },
  wealth: { same: '偏财', opposite: '正财' },
  authority: { same: '七杀', opposite: '正官' },
  resource: { same: '偏印', opposite: '正印' },
};

let ok = 0;
let total = 0;
let failed = [];

// ทดสอบกับทุกเสาที่เป็น Day Master
for (const dm of STEMS) {
  for (const other of STEMS) {
    const g = tenGod(dm, other, GEN, OVR);
    const expect = RULE[g.family][g.samePolarity ? 'same' : 'opposite'];
    total++;
    if (g.hanzi === expect) ok++;
    else failed.push(`${dm.hanzi} x ${other.hanzi} -> ${g.hanzi} (expect ${expect})`);
  }
}

console.log(`ตรวจ ${total} คู่ (10 Day Master x 10 เสา)`);
console.log(`ตรงตามกติกา: ${ok}/${total}`);
if (failed.length) {
  console.log('ไม่ตรง:');
  failed.slice(0, 10).forEach((f) => console.log('  ' + f));
}

// ตรวจว่าแต่ละเสาวันได้สิบเทพครบชุด (9 เสาที่เหลือ + ตัวเอง)
const jia = STEMS.find((s) => s.key === 'jia');
const gods = STEMS.map((s) => tenGod(jia, s, GEN, OVR).hanzi);
console.log('\nJia เป็น Day Master:');
console.log(' ', gods.join(' '));
console.log(' ครบ 10 ชนิดไม่ซ้ำ:', new Set(gods).size === 10);

// ตรวจว่าหยาง/หยิน ของเสาเดียวกันให้สิบเทพต่างกัน
const yang = tenGod(jia, STEMS.find((s) => s.key === 'jia'), GEN, OVR);
const yin = tenGod(jia, STEMS.find((s) => s.key === 'yi'), GEN, OVR);
console.log('\nแก้ไม้ (หยาง) =', yang.hanzi, '| อี้ไม้ (หยิน) =', yin.hanzi, '-> ต่างกัน:', yang.hanzi !== yin.hanzi);
