import { esc, scoreRing, scoreBar } from '../lib/html.js';
import { TYPES, GROUPS } from '../data/mbti.js';
import { STEMS } from '../data/stems.js';
import { ELEMENTS, ELEMENT_ORDER } from '../data/elements.js';
import { ALL_PAIRS, GENERATES, OVERCOMES, SCORE_BANDS } from '../data/pairs.js';
import { tenGod } from '../data/tengods.js';

const groupAccent = (g) => GROUPS[g].color;

// คำอธิบายย่อของระดับคะแนน ใช้ในการ์ดหน้าคู่ — เดิมมีแต่ในตารางท้ายหน้า
const BAND_NOTE = {
  peak: 'พลังงานของเสานี้เติมเต็มธาตุของคุณพอดี ใช้ได้เต็มที่ในงานที่คุณถนัด',
  high: 'เข้ากันดีและมีแรงหนุนให้ทำงานได้เต็มที่ เหมาะกับงานที่ต้องใช้ทั้งความคิดและความลงมือ',
  good: 'ใช้ร่วมกันได้ดี แต่ต้องปรับจังหวะกันบ้างในบางเรื่อง',
  mixed: 'ต่างกันพอสมควร คุยกันตรง ๆ ได้ผลกว่าฝืนให้เข้ากัน',
  hard: 'พลังงานคนละทาง ต้องแยกบทบาทให้ชัดและระวังจังหวะของกัน',
};

export function typeCard(t) {
  return `<a class="card type-card" href="/mbti/${t.code.toLowerCase()}/" style="--accent:${groupAccent(t.group)}">
    <span class="group-tag group-${t.group}">${t.group}</span>
    <div class="code">${t.code}</div>
    <div class="name">${esc(t.nameTh)}</div>
    <p class="tagline">${esc(t.tagline)}</p>
  </a>`;
}

export function stemCard(s) {
  const el = ELEMENTS[s.element];
  return `<a class="card stem-card" href="/stems/${s.key}/" style="--accent:${el.color}">
    <span class="hanzi">${s.hanzi}</span>
    <div class="stem-name">${esc(s.thai)}</div>
    <div class="stem-meta">${s.pin} · ธาตุ${el.thai} · ${s.polarity === 'yang' ? 'หยาง 阳' : 'หยิน 阴'}</div>
    <div class="stem-symbol">${esc(s.symbol)}</div>
  </a>`;
}

export function elementCard(k) {
  const el = ELEMENTS[k];
  return `<div class="card el-card" style="--accent:${el.color}">
    <span class="el-hanzi">${el.hanzi}</span>
    <div class="el-name">${el.thai}</div>
    <p>${esc(el.core)}</p>
    <div class="cycle">${esc(el.seasons)}</div>
  </div>`;
}

// ---------------- อธิบายคะแนน ----------------
// อธิบายสั้น ๆ ใต้วงคะแนน และตารางระดับคะแนนที่ใช้ทั้งเว็บ
export function scoreNote() {
  return `<p class="score-note">คะแนนความเข้ากันของบุคลิกภาพนี้กับเสานี้ — ไม่ใช่คะแนนดี–แย่ของคุณ</p>`;
}

export function scoreLegend({ compact = false } = {}) {
  return `<div class="score-legend">
    <div class="legend-head">คะแนนนี้วัดอะไร</div>
    <p class="legend-lead">
      คะแนนความเข้ากันคำนวณจากสองส่วน — ความสัมพันธ์ระหว่างธาตุของบุคลิกภาพกับธาตุของเสา (ส่วนใหญ่)
      และบทบาทสิบเทพที่เสานี้ทำหน้าที่ต่อเสาวันของบุคลิกภาพนั้น แล้วปรับด้วยหยาง–หยินและอคติของกลุ่มบุคลิกภาพอีกที
      ยิ่งเลขสูงยิ่งสองอย่างนี้เดินไปทางเดียวกัน
    </p>
    <ul class="legend-list">
      ${SCORE_BANDS.map(
        (b) => `<li><span class="legend-dot tone-${b.tone}"></span>
          <span class="legend-range">${b.min}–${b.max}</span>
          <span class="legend-label">${b.label}</span>
          <span class="legend-note">${b.note}</span></li>`
      ).join('')}
    </ul>
    ${compact ? '' : '<p class="legend-foot">คำอ่านทั้งหมดเป็นการตีความของผู้ทำเว็บ โดยใช้กติกาสิบเทพของระบบ bazi จริงเป็นกติกาหลัก — ดูรายละเอียดที่หน้า "ที่มา"</p>'}
  </div>`;
}
export function homePage() {
  const pairData = ALL_PAIRS.map((p) => ({
    t: p.type,
    s: p.stem,
    typeName: `${p.type} (${TYPES.find((x) => x.code === p.type).nameTh})`,
    stemName: STEMS.find((x) => x.key === p.stem).thai,
    stemSymbol: STEMS.find((x) => x.key === p.stem).symbol,
    elementTh: ELEMENTS[p.element].thai,
    polarityTh: p.polarity === 'yang' ? 'หยาง' : 'หยิน',
    score: p.score,
    band: p.band.key,
    bandLabel: p.band.label,
    relationLabel: p.relation.label,
    godName: `${p.god.hanzi} ${p.god.thai}`,
    godRole: p.god.role,
    sharedText: p.sharedText,
    sharedDetail: p.sharedDetail,
    sharedKind: p.shared.kind,
    reading: p.reading,
    advice: p.advice,
    url: `/pair/${p.type.toLowerCase()}-${p.stem}/`,
  }));

  const body = `<section class="hero wrap">
  <span class="eyebrow">◈ 16 × 10 = 160 คู่</span>
  <h1>MBTI 16 ชนิด คู่กับ<br><span class="accent">10 เสา</span> แบบ bazi <span class="accent-hanzi">(天干)</span></h1>
  <p class="lede">
    บุคลิกภาพ MBTI บอกว่าเราคิดและตัดสินใจอย่างไร ส่วน 10 เสาแบบ bazi บอกว่าพลังงานภายในเราไหลไปทางไหน
    เว็บนี้อ่านทั้งสองอย่างเข้าหากันด้วยกติกาสิบเทพ (十神) ของระบบ bazi ครบทุกคู่ และคำนวณ "ธาตุของตัวเอง" ให้จากวันเกิดได้เลย
  </p>
  <div class="hero-actions">
    <a class="btn btn-primary btn-lg" href="/#finder">หา "ธาตุของตัวเอง" →</a>
    <a class="btn btn-lg" href="/matrix/">ดูตารางทั้ง 160 คู่</a>
  </div>
  <div class="hanzi-row" aria-hidden="true">
    ${STEMS.map((s) => `<span>${s.hanzi}</span>`).join('')}
  </div>
</section>

<section class="section wrap" id="finder">
  <div class="section-head">
    <div class="kicker">เครื่องมือ</div>
    <h2>หา "ธาตุของตัวเอง" แล้วอ่านคู่ของคุณ</h2>
    <p>เลือก MBTI ของคุณ กับเสาธาตุ — ไม่ว่าจะคำนวณจากวันเกิดหรือเลือกเอง ผลจะอัปเดตทันที</p>
  </div>

  <div class="finder" id="finderRoot">
    <div class="finder-step">
      <div class="finder-label"><span class="step-num">1</span> คำนวณเสาวันเกิดจากวันเกิด</div>
      <p class="finder-hint">ใน bazi เสาวันเกิด (日主) คือเสาที่บอกธาตุของตัวคุณ — กรอกวันเกิดแล้วระบบจะเลือกเสาให้</p>
      <div class="birthday-row">
        <input type="date" id="birthDate" min="1900-01-01" max="2100-12-31" aria-label="วันเดือนปีเกิด">
        <span id="birthNote" class="finder-hint" style="margin:0"></span>
      </div>
    </div>

    <div class="finder-step">
      <div class="finder-label"><span class="step-num">2</span> เลือก MBTI ของคุณ</div>
      <p class="finder-hint">ถ้ายังไม่รู้ว่าตัวเองเป็นแบบไหน เลือกตามที่รู้สึกว่าใกล้เคียงที่สุดก็ได้</p>
      <div class="pick-grid">
        ${TYPES.map((t) => `<button class="pick" type="button" data-pick-type="${t.code}" aria-pressed="false" title="${esc(t.tagline)}">
          <span>${t.code}</span><span style="font-weight:500;font-size:0.85rem;opacity:0.8">${esc(t.nameTh)}</span></button>`).join('')}
      </div>
    </div>

    <div class="finder-step">
      <div class="finder-label"><span class="step-num">3</span> เลือกเสาธาตุ</div>
      <p class="finder-hint">เลือกเองได้ ถ้าอยากดูเสาอื่นที่ไม่ใช่ของตัวเองด้วย</p>
      <div class="pick-grid">
        ${STEMS.map((s) => `<button class="pick" type="button" data-pick-stem="${s.key}" aria-pressed="false">
          <span class="hanzi">${s.hanzi}</span><span>${esc(s.thai)}</span></button>`).join('')}
      </div>
    </div>

    <div class="finder-result" id="finderResult" aria-live="polite"></div>
  </div>
</section>

<section class="section wrap">
  <div class="section-head">
    <div class="kicker">16 ชนิด</div>
    <h2>MBTI ทั้ง 16 แบบ</h2>
    <p>แต่ละแบบมีธาตุที่ "ใช้ได้ง่าย" ต่างกัน คลิกเพื่อดูว่าเสาไหนเข้ากับแบบของคุณ</p>
  </div>
  <div class="grid grid-4">${TYPES.map(typeCard).join('')}</div>
</section>

<section class="section wrap">
  <div class="section-head">
    <div class="kicker">10 เสา</div>
    <h2>10 เสาแบบ bazi (天干)</h2>
    <p>ธาตุ 5 ธาตุ แต่ละธาตุแยกเป็นหยาง (阳) กับหยิน (阴) จึงได้ 10 เสา ความต่างอยู่ที่ "ทำงาน" ไม่ใช่แค่ชนิด</p>
  </div>
  <div class="grid grid-4">${STEMS.map(stemCard).join('')}</div>
</section>

<section class="section wrap">
  <div class="section-head">
    <div class="kicker">5 ธาตุ</div>
    <h2>ธาตุทั้งห้า</h2>
    <p>ฐานของทั้งหมด — ไม้หล่อเลี้ยงไฟ ไฟหล่อเลี้ยงดิน ดินหล่อเลี้ยงโลหะ โลหะหล่อเลี้ยงน้ำ และน้ำหล่อเลี้ยงไม้</p>
  </div>
  <div class="element-wheel">${ELEMENT_ORDER.map(elementCard).join('')}</div>
</section>`;

  const scripts = `<script>window.__PAIRS__ = ${JSON.stringify(pairData)};
window.__BAZI__ = ${baziClient()};</script>`;

  return { body, scripts };
}

// ฟังก์ชันคำนวณเสาวันเกิดสำหรับฝั่งผู้ใช้ (สร้างเป็นโค้ดแบบข้อความ)
function baziClient() {
  return String.raw`function (dateStr) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
    if (!m) return null;
    var year = +m[1], month = +m[2], day = +m[3];
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    var a = Math.floor((14 - month) / 12);
    var y = year + 4800 - a;
    var mm = month + 12 * a - 3;
    var jdn = day + Math.floor((153 * mm + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    var stems = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
    var keys = ['jia','yi','bing','ding','wu','ji','geng','xin','ren','gui'];
    var branches = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    var zodiac = ['หนู','วัว','เสือ','กระต่าย','มังกร','งู','ม้า','แกะ','ลิง','ไก่','สุนัข','หมู'];
    var elems = ['ไม้','ไม้','ไฟ','ไฟ','ดิน','ดิน','โลหะ','โลหะ','น้ำ','น้ำ'];
    var s = (jdn + 9) % 10, b = (jdn + 1) % 12;
    var y2 = (month > 2 || (month === 2 && day >= 4)) ? year : year - 1;
    var ys = ((y2 - 4) % 10 + 10) % 10, yb = ((y2 - 4) % 12 + 12) % 12;
    return {
      stem: stems[s], branch: branches[b], stemKey: keys[s],
      elementTh: elems[s], polarityTh: s % 2 === 0 ? 'หยาง' : 'หยิน',
      zodiac: zodiac[yb]
    };
  }`;
}

// ---------------- หน้าตาราง ----------------
export function matrixPage() {
  const byType = (code) => ALL_PAIRS.filter((p) => p.type === code);
  const head = STEMS.map((s) => {
    const el = ELEMENTS[s.element];
    return `<th data-element="${s.element}" scope="col">
      <span class="stem-head"><b>${s.hanzi}</b><i>${esc(s.thai)}</i>
      <i style="color:${el.color}">${el.thai}</i></span></th>`;
  }).join('');

  const rows = TYPES.map((t) => {
    const cells = byType(t.code).map((p) => {
      const s = STEMS.find((x) => x.key === p.stem);
      const el = ELEMENTS[p.element];
      return `<td data-element="${p.element}"><a class="cell tone-${p.band.key}" href="/pair/${p.type.toLowerCase()}-${p.stem}/"
        title="${t.code} × ${esc(s.thai)} — ${p.score}/100 (${p.band.label})">${p.score}</a></td>`;
    }).join('');
    return `<tr data-group="${t.group}">
      <th scope="row"><a href="/mbti/${t.code.toLowerCase()}/" style="color:${groupAccent(t.group)}">${t.code}</a>
        <span class="tname">${esc(t.nameTh)}</span></th>
      ${cells}</tr>`;
  }).join('');

  const body = `
<section class="section wrap">
  <div class="section-head">
    <div class="kicker">160 คู่</div>
    <h1>ตารางความสัมพันธ์ทั้งหมด</h1>
    <p>แถวคือ MBTI 16 ชนิด คอลัมน์คือ 10 เสา ตัวเลขคือคะแนนความสัมพันธ์ คลิกช่องเพื่ออ่านรายละเอียด</p>
  </div>

  <div class="filters">
    <span class="label">กลุ่ม MBTI</span>
    <button class="fbtn" type="button" data-filter-group="all" aria-pressed="true">ทั้งหมด</button>
    ${Object.values(GROUPS).map((g) => `<button class="fbtn" type="button" data-filter-group="${g.key}" aria-pressed="false" style="color:${g.color}">${g.key} · ${esc(g.thai)}</button>`).join('')}
  </div>
  <div class="filters">
    <span class="label">ธาตุ</span>
    <button class="fbtn" type="button" data-filter-element="all" aria-pressed="true">ทั้งหมด</button>
    ${ELEMENT_ORDER.map((k) => `<button class="fbtn" type="button" data-filter-element="${k}" aria-pressed="false" style="color:${ELEMENTS[k].color}">${ELEMENTS[k].thai} ${ELEMENTS[k].hanzi}</button>`).join('')}
    <span class="label" style="margin-left:auto">แสดง <b id="matrixCount">160</b> คู่</span>
  </div>

  <div class="matrix-scroll">
    <table class="matrix" id="matrix">
      <thead><tr><th scope="col" style="text-align:left">MBTI \\ เสา</th>${head}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="legend">
    ${SCORE_BANDS.map(
      (b) => `<span><i class="swatch tone-${b.tone}"></i> ${b.label} (${b.min}–${b.max})</span>`
    ).join('')}
  </div>

  ${scoreLegend({ compact: true })}
</section>`;

  return { body };
}

// ---------------- หน้า MBTI ----------------
export function mbtiIndexPage() {
  const body = `
<section class="section wrap">
  <div class="section-head">
    <div class="kicker">16 ชนิด</div>
    <h1>MBTI ทั้ง 16 แบบ</h1>
    <p>แต่ละแบบมีเสาที่เข้ากันดีที่สุดและเสาที่ต้องระวัง คลิกเพื่อดูครบทั้ง 10 เสา</p>
  </div>
  <div class="grid grid-4">${TYPES.map(typeCard).join('')}</div>
</section>`;
  return { body };
}

export function mbtiPage(t) {
  const pairs = ALL_PAIRS.filter((p) => p.type === t.code).sort((a, b) => b.score - a.score);
  const g = GROUPS[t.group];

  const rows = pairs.map((p) => {
    const s = STEMS.find((x) => x.key === p.stem);
    const el = ELEMENTS[p.element];
    return `<a class="rank-item" href="/pair/${p.type.toLowerCase()}-${p.stem}/">
      <span class="rk" style="color:${el.color}">${s.hanzi}</span>
      <span class="nm">${esc(s.thai)}<small>${p.god.hanzi} ${esc(p.god.thai)}</small></span>
      ${scoreBar(p.score)}
      <span class="sc">${p.score}</span>
    </a>`;
  }).join('');

  const body = `
<div class="wrap" style="padding-top:8px">
  <nav class="breadcrumb"><a href="/">หน้าแรก</a><span class="sep">/</span><a href="/mbti/">16 MBTI</a><span class="sep">/</span><span>${t.code}</span></nav>
</div>

<section class="section wrap">
  <div class="pair-hero">
    <div class="pair-vs">
      <div class="code" style="color:${groupAccent(t.group)}">${t.code}</div>
      <div class="x">${esc(t.nameTh)}</div>
    </div>
    <div>
      <h1 style="margin-bottom:6px">${t.code} — ${esc(t.nameTh)}</h1>
      <p style="color:var(--ink-2);margin-bottom:10px">${esc(t.tagline)}</p>
      <div class="tag-list">
        <span class="chip" style="color:${groupAccent(t.group)}">กลุ่ม ${t.group} · ${esc(g.thai)}</span>
        <span class="chip" style="color:var(--gold)">เสาวัน ${t.dayMasterStem.hanzi} ${esc(t.dayMasterStem.thai)}</span>
        ${t.stack.map((f) => `<span class="chip">${f}</span>`).join('')}
      </div>
    </div>
  </div>

  <div class="grid grid-2" style="margin-bottom:34px">
    <div class="card">
      <h3>ตัวตนของ ${t.code}</h3>
      <p style="color:var(--ink-2)">${esc(t.desc)}</p>
      <h4 style="margin-top:18px">จุดแข็ง</h4>
      <ul style="color:var(--ink-2);padding-left:20px;margin:0">
        ${t.strengths.map((s) => `<li>${esc(s)}</li>`).join('')}
      </ul>
      <h4 style="margin-top:18px">ต้องระวัง</h4>
      <ul style="color:var(--ink-2);padding-left:20px;margin:0">
        ${t.watch.map((s) => `<li>${esc(s)}</li>`).join('')}
      </ul>
    </div>
    <div class="card">
      <h3>ธาตุที่ ${t.code} รับได้ดีที่สุด</h3>
      <p style="color:var(--ink-2)">${esc(t.life)}</p>
      <div class="stat-grid" style="margin-top:16px">
        ${ELEMENT_ORDER.map((k) => `<div class="stat">
          <div class="k" style="color:${ELEMENTS[k].color}">${ELEMENTS[k].thai} ${ELEMENTS[k].hanzi}</div>
          <div class="v">${t.affinity[k]}/100</div>
          ${scoreBar(t.affinity[k])}
        </div>`).join('')}
      </div>
    </div>
  </div>

  <div class="section-head">
    <div class="kicker">10 เสา</div>
    <h2>${t.code} คู่กับเสาไหนได้บ้าง</h2>
    <p>เรียงจากคะแนนสูงไปต่ำ คลิกเพื่ออ่านรายละเอียด</p>
  </div>
  <div class="rank-list">${rows}</div>
</section>`;

  return { body };
}

// ---------------- หน้าเสา ----------------
export function stemsIndexPage() {
  const body = `
<section class="section wrap">
  <div class="section-head">
    <div class="kicker">10 เสา</div>
    <h1>10 เสาแบบ bazi (天干)</h1>
    <p>ธาตุ 5 ธาตุ แบ่งหยาง–หยิน จึงได้ 10 เสา ความต่างอยู่ที่วิธีทำงาน ไม่ใช่แค่ธาตุเดียวกัน</p>
  </div>
  <div class="grid grid-4">${STEMS.map(stemCard).join('')}</div>
</section>`;
  return { body };
}

export function stemPage(s) {
  const el = ELEMENTS[s.element];
  const pairs = ALL_PAIRS.filter((p) => p.stem === s.key).sort((a, b) => b.score - a.score);

  const rows = pairs.map((p) => {
    const t = TYPES.find((x) => x.code === p.type);
    return `<a class="rank-item" href="/pair/${p.type.toLowerCase()}-${p.stem}/">
      <span class="rk" style="color:${groupAccent(t.group)}">${p.type}</span>
      <span class="nm">${esc(t.nameTh)}<small>${esc(t.tagline.slice(0, 42))}…</small></span>
      ${scoreBar(p.score)}
      <span class="sc">${p.score}</span>
    </a>`;
  }).join('');

  const body = `
<div class="wrap" style="padding-top:8px">
  <nav class="breadcrumb"><a href="/">หน้าแรก</a><span class="sep">/</span><a href="/stems/">10 เสา</a><span class="sep">/</span><span>${esc(s.thai)}</span></nav>
</div>

<section class="section wrap">
  <div class="pair-hero" style="border-color:${el.color}44">
    <div class="pair-vs">
      <div class="hanzi" style="color:${el.color}">${s.hanzi}</div>
      <div class="x">${esc(s.pin)}</div>
    </div>
    <div>
      <h1 style="margin-bottom:6px">${esc(s.thai)} <span style="color:${el.color}">${s.hanzi}</span></h1>
      <p style="color:var(--ink-2);margin-bottom:10px">${esc(s.symbol)}</p>
      <div class="tag-list">
        <span class="chip" style="color:${el.color}">ธาตุ${el.thai} ${el.hanzi}</span>
        <span class="chip">${s.polarity === 'yang' ? 'หยาง 阳' : 'หยิน 阴'}</span>
        ${s.keywords.map((k) => `<span class="chip">${esc(k)}</span>`).join('')}
      </div>
    </div>
  </div>

  <div class="grid grid-2" style="margin-bottom:34px">
    <div class="card">
      <h3>เสานี้คืออะไร</h3>
      <p style="color:var(--ink-2)">${esc(s.nature)}</p>
      <h4 style="margin-top:18px">สิ่งที่ได้</h4>
      <p style="color:var(--ink-2);margin:0">${esc(s.gives)}</p>
      <h4 style="margin-top:18px">เงาของมัน</h4>
      <p style="color:var(--ink-2);margin:0">${esc(s.shadow)}</p>
    </div>
    <div class="card">
      <h3>บทบาทของเสา</h3>
      <p style="color:var(--ink-2)">${esc(s.life)}</p>
      <div class="stat-grid" style="margin-top:16px">
        <div class="stat">
          <div class="k">ธาตุ</div>
          <div class="v" style="color:${el.color}">${el.thai} ${el.hanzi}</div>
        </div>
        <div class="stat">
          <div class="k">หยาง / หยิน</div>
          <div class="v">${s.polarity === 'yang' ? 'หยาง (阳)' : 'หยิน (阴)'}</div>
        </div>
        <div class="stat">
          <div class="k">หล่อเลี้ยง</div>
          <div class="v">${ELEMENTS[GENERATES[s.element]].thai}</div>
        </div>
        <div class="stat">
          <div class="k">ควบคุม</div>
          <div class="v">${ELEMENTS[OVERCOMES[s.element]].thai}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="section-head">
    <div class="kicker">16 MBTI</div>
    <h2>${esc(s.thai)} เข้ากับ MBTI แบบไหน</h2>
    <p>เรียงจากคะแนนสูงไปต่ำ</p>
  </div>
  <div class="rank-list">${rows}</div>
</section>`;

  return { body };
}

// ---------------- หน้าคู่ ----------------
export function pairPage(p) {
  const t = TYPES.find((x) => x.code === p.type);
  const s = STEMS.find((x) => x.key === p.stem);
  const el = ELEMENTS[p.element];
  const others = ALL_PAIRS.filter((x) => x.type === p.type && x.stem !== p.stem)
    .sort((a, b) => b.score - a.score).slice(0, 5);

  const body = `
<div class="wrap" style="padding-top:8px">
  <nav class="breadcrumb">
    <a href="/">หน้าแรก</a><span class="sep">/</span>
    <a href="/mbti/${t.code.toLowerCase()}/">${t.code}</a><span class="sep">/</span>
    <a href="/stems/${s.key}/">${esc(s.thai)}</a><span class="sep">/</span>
    <span>คู่นี้</span>
  </nav>
</div>

<section class="section wrap">
  <div class="pair-hero pair-hero--duel" style="border-color:${el.color}33">
    <div class="duel">
      <div class="pair-vs">
        <div class="code" style="color:${groupAccent(t.group)}">${t.code}</div>
        <div class="x">${esc(t.nameTh)}</div>
      </div>
      <div class="duel-op" aria-hidden="true">×</div>
      <div class="pair-vs">
        <div class="hanzi" style="color:${el.color}">${s.hanzi}</div>
        <div class="x">${esc(s.thai)}</div>
      </div>
      <div class="pair-score">
        ${scoreRing(p.score, 96, '/100')}
        <div class="band" style="color:${el.color};font-weight:600">${esc(p.band.label)}</div>
        ${scoreNote()}
      </div>
    </div>
    <div class="duel-title">
      <h1>${t.code} × ${esc(s.thai)} <span class="duel-hanzi" style="color:${el.color}">${s.hanzi}</span></h1>
      <p>${esc(s.symbol)} — ธาตุ${el.thai} · ${s.polarity === 'yang' ? 'หยาง 阳' : 'หยิน 阴'}</p>
      <div class="tag-list">
        <span class="chip">${esc(p.relation.label)}</span>
        ${p.keywords.slice(0, 3).map((k) => `<span class="chip">${esc(k)}</span>`).join('')}
      </div>
    </div>
  </div>

  <div class="grid grid-2 pair-cards" style="margin-bottom:30px">
    <div class="card pair-card">
      <h3>คำอ่าน</h3>
      <div class="shared-note shared-note--${p.shared.kind}">
        <div class="shared-note-head">${esc(p.sharedText)}</div>
        <p>${esc(p.sharedDetail)}</p>
      </div>
      <ul class="reading-list">
        ${p.reading.map((r) => `<li>${esc(r)}</li>`).join('')}
      </ul>
      <div class="band-note band-note--${p.band.key}">
        <div class="band-note-head">
          <span class="band-note-score">${p.score}</span>
          <span class="band-note-label">${esc(p.band.label)}</span>
        </div>
        <p>${esc(BAND_NOTE[p.band.key])}</p>
      </div>
    </div>
    <div class="card pair-card">
      <div class="god-card">
        <div class="god-label">บทบาทสิบเทพ (十神) ต่อเสาวันของ ${t.code}</div>
        <div class="god-name">${p.god.hanzi} <span>${esc(p.god.thai)}</span></div>
        <div class="god-role">${esc(p.god.role)}</div>
        <div class="god-rel">${esc(p.god.relation)} · ${p.god.samePolarity ? 'หยาง–หยินตรงกัน' : 'หยาง–หยินคนละขั้ว'}</div>
      </div>
      <h3 style="margin-top:20px">เสา${esc(s.thai)} <span style="color:${el.color}">${s.hanzi}</span> คืออะไร</h3>
      <p style="color:var(--ink-2)">${esc(s.gives)}</p>
      <div class="stat-grid stat-grid--three" style="margin-top:14px">
        <div class="stat">
          <div class="k">ธาตุที่เสาหล่อเลี้ยง</div>
          <div class="v" style="color:${ELEMENTS[GENERATES[el.key]].color}">${ELEMENTS[GENERATES[el.key]].thai} ${ELEMENTS[GENERATES[el.key]].hanzi}</div>
        </div>
        <div class="stat">
          <div class="k">ธาตุที่เสาควบคุม</div>
          <div class="v" style="color:${ELEMENTS[OVERCOMES[el.key]].color}">${ELEMENTS[OVERCOMES[el.key]].thai} ${ELEMENTS[OVERCOMES[el.key]].hanzi}</div>
        </div>
        <div class="stat">
          <div class="k">หยาง / หยิน</div>
          <div class="v">${s.polarity === 'yang' ? 'หยาง 阳' : 'หยิน 阴'}</div>
        </div>
      </div>
      <h4 style="margin-top:16px">สิ่งที่ต้องระวัง</h4>
      <p style="color:var(--ink-2)">${esc(s.shadow)}</p>
      <div class="advice-box"><b>คำแนะนำ:</b> ${esc(p.advice)}</div>
    </div>
  </div>

  <div class="section-head">
    <div class="kicker">เปรียบเทียบ</div>
    <h2>${t.code} คู่กับเสาอื่น</h2>
  </div>
  <div class="rank-list">
    ${others.map((o) => {
      const os = STEMS.find((x) => x.key === o.stem);
      const oe = ELEMENTS[o.element];
      return `<a class="rank-item" href="/pair/${o.type.toLowerCase()}-${o.stem}/">
        <span class="rk" style="color:${oe.color}">${os.hanzi}</span>
        <span class="nm">${esc(os.thai)}<small>${os.symbol}</small></span>
        ${scoreBar(o.score)}
        <span class="sc">${o.score}</span>
      </a>`;
    }).join('')}
  </div>

  ${scoreLegend()}

  <div style="margin-top:34px;display:flex;gap:12px;flex-wrap:wrap">
    <a class="btn" href="/mbti/${t.code.toLowerCase()}/">← ดู ${t.code} ทั้งหมด</a>
    <a class="btn" href="/stems/${s.key}/">ดูเสา${esc(s.thai)} กับทั้ง 16 MBTI →</a>
    <a class="btn btn-primary" href="/#finder">หา "ธาตุของตัวเอง" →</a>
  </div>
</section>`;

  return { body };
}

// ---------------- หน้าธาตุ ----------------
export function elementsPage() {
  const body = `
<section class="section wrap">
  <div class="section-head">
    <div class="kicker">5 ธาตุ</div>
    <h1>ธาตุทั้งห้า และวงจรของมัน</h1>
    <p>ใน bazi ธาตุไม่ได้อยู่โดด ๆ แต่ไหลเวียนกัน — หนึ่งหล่อเลี้ยงอีกหนึ่ง และหนึ่งควบคุมอีกหนึ่ง</p>
  </div>
  <div class="element-wheel">${ELEMENT_ORDER.map(elementCard).join('')}</div>

  <div class="grid grid-2" style="margin-top:34px">
    <div class="card">
      <h3>วงจรหล่อเลี้ยง (相生)</h3>
      <p style="color:var(--ink-2)">ไม้ให้ไฟ ไฟให้ดิน ดินให้โลหะ โลหะให้น้ำ น้ำให้ไม้ — ไหลไปตามลำดับนี้เสมอ</p>
      <div class="tag-list" style="margin-top:12px">
        ${ELEMENT_ORDER.map((k) => `<span class="chip"><span class="dot" style="background:${ELEMENTS[k].color}"></span>${ELEMENTS[k].thai} → ${ELEMENTS[GENERATES[k]].thai}</span>`).join('')}
      </div>
    </div>
    <div class="card">
      <h3>วงจรควบคุม (相克)</h3>
      <p style="color:var(--ink-2)">ไม้ควบคุมดิน ดินควบคุมน้ำ น้ำควบคุมไฟ ไฟควบคุมโลหะ โลหะควบคุมไม้ — เรียกว่า "การหักล้าง" ซึ่งอาจเป็นได้ทั้งล้างออกและทำร้าย</p>
      <div class="tag-list" style="margin-top:12px">
        ${ELEMENT_ORDER.map((k) => `<span class="chip"><span class="dot" style="background:${ELEMENTS[k].color}"></span>${ELEMENTS[k].thai} → ${ELEMENTS[OVERCOMES[k]].thai}</span>`).join('')}
      </div>
    </div>
  </div>

  <div class="note" style="margin-top:26px">
    คำว่า "ควบคุม" ไม่ได้แปลว่าลบทิ้ง โลหะควบคุมไม้คือการตัดสิ่งที่ไม่จำเป็นออกเพื่อให้ไม้โตได้ดี คะแนนในเว็บนี้จึงให้คะแนนบวกกับเสาที่ควบคุมธาตุที่คุณต้องการ และลบกับเสาที่ควบคุมธาตุที่คุณขาด
  </div>
</section>`;
  return { body };
}

// ---------------- หน้าสิบเทพ ----------------
export function tengodsPage() {
  const dm = STEMS.find((s) => s.key === 'jia');
  const rows = STEMS.map((s) => {
    const g = tenGod(dm, s, GENERATES, OVERCOMES);
    const el = ELEMENTS[s.element];
    return `<div class="rank-item" style="grid-template-columns: 58px 1fr 150px">
      <span class="rk" style="color:${el.color};font-size:1.4rem">${s.hanzi}</span>
      <span class="nm">${esc(s.thai)}<small>${esc(g.role)}</small></span>
      <span style="text-align:right">
        <b style="color:var(--gold)">${g.hanzi}</b>
        <small style="display:block;color:var(--ink-3);font-size:0.78rem">${esc(g.thai)}</small>
      </span>
    </div>`;
  }).join('');

  const body = `
<div class="wrap" style="padding-top:8px">
  <nav class="breadcrumb"><a href="/">หน้าแรก</a><span class="sep">/</span><span>สิบเทพ</span></nav>
</div>

<section class="section wrap">
  <div class="section-head">
    <div class="kicker">十神</div>
    <h1>สิบเทพ — บทบาทของเสาทั้งสิบ</h1>
    <p>ในระบบ bazi ทุกเสาไม่ได้มีความหมายเท่ากัน แต่มี "บทบาท" ที่กำหนดจากความสัมพันธ์กับเสาวัน (ธาตุประจำตัว) ของแต่ละคน บทบาทเหล่านี้เรียกว่าสิบเทพ</p>
  </div>

  <div class="card" style="margin-bottom:26px">
    <h3>กติกาที่ใช้</h3>
    <p style="color:var(--ink-2);margin-bottom:16px">
      ดูสองอย่าง — ความสัมพันธ์ธาตุ 5 ธาตุ และหยาง–หยินของเสา จะได้ชื่อบทบาทที่แน่นอน
    </p>
    <div class="stat-grid">
      <div class="stat"><div class="k">ธาตุเดียวกัน</div><div class="v">เพื่อนคู่เสีย (比肩 / 劫财)</div></div>
      <div class="stat"><div class="k">ตัวคุณหล่อเลี้ยง</div><div class="v">สิ่งที่หล่อเลี้ยงออกมา (食神 / 伤官)</div></div>
      <div class="stat"><div class="k">ตัวคุณควบคุม</div><div class="v">ทรัพย์ (偏财 / 正财)</div></div>
      <div class="stat"><div class="k">ควบคุมคุณ</div><div class="v">อำนาจ (七杀 / 正官)</div></div>
      <div class="stat"><div class="k">หล่อเลี้ยงคุณ</div><div class="v">ปัญญา (偏印 / 正印)</div></div>
    </div>

    <div class="rule-table" role="table" aria-label="ตารางกติกาสิบเทพ">
      <div class="rule-row rule-head" role="row">
        <span role="columnheader">ความสัมพันธ์ธาตุ</span>
        <span role="columnheader">หยาง–หยินตรงกัน</span>
        <span role="columnheader">หยาง–หยินคนละขั้ว</span>
      </div>
      <div class="rule-row" role="row">
        <span role="cell">ธาตุเดียวกัน</span>
        <span role="cell"><b>比肩</b><i>พี่คู่เสีย</i></span>
        <span role="cell"><b>劫财</b><i>ผู้แย่งทรัพย์</i></span>
      </div>
      <div class="rule-row" role="row">
        <span role="cell">ตัวคุณหล่อเลี้ยง</span>
        <span role="cell"><b>食神</b><i>เทพแห่งการสร้างสรรค์</i></span>
        <span role="cell"><b>伤官</b><i>เทพแห่งการท้วง</i></span>
      </div>
      <div class="rule-row" role="row">
        <span role="cell">ตัวคุณควบคุม</span>
        <span role="cell"><b>偏财</b><i>ทรัพย์อ้อน</i></span>
        <span role="cell"><b>正财</b><i>ทรัพย์จริง</i></span>
      </div>
      <div class="rule-row" role="row">
        <span role="cell">ควบคุมคุณ</span>
        <span role="cell"><b>七杀</b><i>ผู้พิชิต</i></span>
        <span role="cell"><b>正官</b><i>อำมาตร์</i></span>
      </div>
      <div class="rule-row" role="row">
        <span role="cell">หล่อเลี้ยงคุณ</span>
        <span role="cell"><b>偏印</b><i>ปัญญาเกราะ</i></span>
        <span role="cell"><b>正印</b><i>ปัญญาประกาศ</i></span>
      </div>
    </div>

    <p style="color:var(--ink-3);font-size:0.88rem;margin:16px 0 0">
      จำง่าย ๆ: ดูธาตุก่อนให้ได้ "กลุ่ม" ของบทบาท แล้วค่อยดูหยาง–หยินว่าตรงกันหรือคนละขั้วเพื่อเลือกชื่อในกลุ่มนั้น
      เสาหยางคือ แก้ไม้ ปิ่งไฟ อู้ดิน เกิงโลหะ เหรินน้ำ · เสาหยินคือ อี้ไม้ ติ่งไฟ จี้ดิน ซิ่งโลหะ กุ้ยน้ำ
    </p>
  </div>

  <div class="section-head">
    <div class="kicker">ตัวอย่าง</div>
    <h2>เมื่อเสาวันคือ แก้ไม้ (甲)</h2>
    <p>เสาทั้งสิบจะได้บทบาทตามนี้ — ของจริงแต่ละคนจะอิงเสาวันของตัวเอง</p>
  </div>
  <div class="rank-list">${rows}</div>

  <div class="note" style="margin-top:26px">
    เว็บนี้ใช้กติกาสิบเทพนี้เป็นฐานคำนวณคะแนนของทุกคู่ — คะแนนสูงเมื่อเสานั้นทำหน้าที่ที่เสริมกับบุคลิกภาพของคุณ ไม่ว่าจะเป็นปัญญาที่คอยสนับสนุน หรืออำนาจที่คุมให้อยู่ในร่าง
  </div>
</section>`;

  return { body };
}

// ---------------- หน้าเกี่ยวกับ ----------------
export function aboutPage() {
  const body = `
<section class="section wrap wrap-narrow">
  <div class="section-head">
    <div class="kicker">ที่มา</div>
    <h1>ข้อมูลนี้มาจากไหน</h1>
    <p>เว็บนี้ไม่ได้เป็นการทำนาย แต่เป็นการอ่าน "ภาษา" สองภาษาควบคู่กัน</p>
  </div>

  <div class="card" style="margin-bottom:18px">
    <h3>MBTI 16 ชนิด</h3>
    <p style="color:var(--ink-2)">
      มาจากทฤษฎีบุคลิกภาพที่ใช้แบ่งคนออกเป็นสี่กลุ่ม (NT, NF, SJ, SP) ตามการรับรู้ข้อมูล และวิธีตัดสินใจ
      เว็บนี้ใช้กลุ่มเหล่านี้เป็นฐานว่า "พลังงานของแบบนี้หน้าไปทางไหน" แล้วเทียบกับธาตุที่ตรงกัน
    </p>
  </div>

  <div class="card" style="margin-bottom:18px">
    <h3>10 เสาแบบ bazi (天干)</h3>
    <p style="color:var(--ink-2)">
      ในระบบดวงจรสี่เสา (ดวงปี ดวงเดือน ดวงวัน ดวงชั่วโมง) เสาวันเกิดหรือ "日主" เป็นตัวแทนพลังงานหลักของบุคลิกภาพ
      มีทั้งหมด 10 เสา เพราะธาตุทั้งห้าแยกเป็นหยาง (阳) กับหยิน (阴) เว็บนี้ใช้เสานี้เป็น "ธาตุของตัวเอง"
      และคำนวณจากวันเกิดด้วยวิธีมาตรฐาน (เสาวันจาก Julian Day) พร้อมให้เลือกเองแทนได้
    </p>
  </div>

  <div class="card" style="margin-bottom:18px">
    <h3>กติกาสิบเทพที่ใช้ตรวจสอบ</h3>
    <p style="color:var(--ink-2)">
      กติกา "ดูธาตุก่อน แล้วดูหยาง–หยิน" ที่ใช้ในเว็บนี้ ไม่ได้แต่งขึ้นเอง แต่ตรงกับตารางมาตรฐานที่ปรากฏในแหล่งอ้างอิงหลายแห่ง
      เราเทียบทั้ง 100 คู่ (เสาวัน 10 x เสา 10) กับตารางของแหล่งอ้างอิงเหล่านี้ และตรงกันครบทั้ง 100 คู่
    </p>
    <ul class="source-list">
      <li><a href="https://www.daokeyi.com/ming/bazi/shishen/" target="_blank" rel="noopener">道可易 — ตารางสิบเทพ (十神对照表)</a> — ตารางห้าแถว × สองคอลัมน์ ตรงกันทุกช่อง</li>
      <li><a href="https://guanyitang.com/wiki/shishen" target="_blank" rel="noopener">观易堂百科 — 十神详解</a> — ตารางสิบเสาวันครบ พร้อมอธิบายกติกาทีละขั้ว</li>
      <li><a href="https://minglimr.com/learn/bazi/shi-shen" target="_blank" rel="noopener">命理先生 — 十神對照表</a> — ระบุกติกา "เหมือนขั้วเป็น偏 ต่างขั้วเป็น正" ชัดเจน</li>
      <li><a href="https://bazipilot.com/wiki/ten-gods" target="_blank" rel="noopener">BaziPilot — Ten Gods</a> — อธิบายการหาโดยดูธาตุแล้วดูหยาง–หยินสองขั้น</li>
      <li><a href="https://www.baziinsight.com/learn/ten-gods-in-bazi" target="_blank" rel="noopener">BaziInsight — Ten Gods in BaZi</a> — ยืนยันว่าชื่อสิบเทพขึ้นกับเสาวันของแต่ละคน</li>
    </ul>
    <p style="color:var(--ink-3);font-size:0.88rem;margin-bottom:0">
      หมายเหตุจากแหล่งอ้างอิงเอง: ชื่อสิบเทพไม่ได้แปลว่าดีหรือแย่โดยตรง ต้องดูความแข็ง–อ่อนของเสาวันร่วมด้วย
      เว็บนี้จึงใช้ชื่อบทบาทเป็น "มุมที่มอง" ไม่ใช่คำทำนายว่าอะไรดีหรือไม่ดี
    </p>
  </div>

  <div class="card" style="margin-bottom:18px">
    <h3>คะแนน 160 คู่มาจากอะไร</h3>
    <p style="color:var(--ink-2)">
      เว็บนี้ไม่ได้ตั้งคะแนนขึ้นเอง แต่ใช้กติกา <a href="/tengods/" style="color:var(--gold)">สิบเทพ (十神)</a> ของระบบ bazi จริง
      คือดูความสัมพันธ์ธาตุ 5 ธาตุ และหยาง–หยินของเสา แล้วจะรู้ว่าเสานั้นทำหน้าที่อะไรต่อเสาวันของคุณ
      จากนั้นจึงเทียบบทบาทนั้นกับสิ่งที่บุคลิกภาพ MBTI ของคุณต้องการ
    </p>
    <p style="color:var(--ink-2);margin-bottom:0">
      ส่วนที่เป็นการตีความของผู้ทำเว็บคือการเลือกว่า MBTI แบบไหนเข้ากับธาตุไหน และน้ำหนักของแต่ละบทบาท
      เพราะยังไม่มีตารางมาตรฐานที่เชื่อม MBTI กับสิบเทพโดยตรง
    </p>
  </div>

  <div class="note">
    เว็บนี้จัดทำเพื่อการสำรวจบุคลิกภาพในมุมของศาสตร์การนับชะตา ไม่ใช่คำทำนาย และไม่ควรใช้ตัดสินใจเรื่องสำคัญ
    หากต้องการคำอ่านดวงจรโดยละเอียด แนะนำให้ปรึกษาผู้เชี่ยวชาญที่ใช้ระบบเต็มรูปแบบ
  </div>
</section>`;
  return { body };
}

