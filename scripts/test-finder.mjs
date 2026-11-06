// ทดสอบเครื่องมือ "หาธาตุของตัวเอง" และตัวกรองตาราง แบบอัตโนมัติ
// ใช้: node scripts/test-finder.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';

const CHROME = 'C:/Users/somsak/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe';
const BASE = 'http://127.0.0.1:4173';

const port = 9800 + Math.floor(Math.random() * 150);
const profile = mkdtempSync(join(tmpdir(), 'cany-finder-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--hide-scrollbars', '--disable-extensions', '--disable-dev-shm-usage',
], { stdio: ['ignore', 'ignore', 'ignore'] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const t = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const p = t.find((x) => x.type === 'page');
    if (p?.webSocketDebuggerUrl) { wsUrl = p.webSocketDebuggerUrl; break; }
  } catch {}
  await sleep(250);
}
if (!wsUrl) { console.error('chrome ไม่ตอบสนอง'); chrome.kill(); process.exit(1); }

const u = new URL(wsUrl);
const sock = createConnection({ host: u.hostname, port: Number(u.port) });
sock.on('error', () => {});
const key = Buffer.from(Math.random().toString(36)).toString('base64').slice(0, 22) + '==';
let buf = Buffer.alloc(0);
const waiters = new Map();
let id = 0;
let resolveOpen;
const opened = new Promise((r) => (resolveOpen = r));

sock.on('connect', () => {
  sock.write(
    `GET ${u.pathname} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\n` +
    `Connection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
  );
});

sock.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  // ตัดหัวข้อ HTTP ของ handshake ทิ้งก่อน ไม่งั้นเฟรมจะเริ่มผิดตำแหน่ง
  const hs = buf.indexOf('\r\n\r\n');
  if (hs >= 0 && !resolveOpen.done) {
    buf = buf.slice(hs + 4);
    resolveOpen.done = true;
    resolveOpen();
  }
  for (;;) {
    if (buf.length < 2) return;
    const b1 = buf[0], b2 = buf[1];
    const masked = (b2 & 0x80) !== 0;
    let len = b2 & 0x7f, off = 2;
    if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
    if (masked) off += 4;
    if (buf.length < off + len) return;
    const payload = buf.slice(off, off + len);
    buf = buf.slice(off + len);
    if ((b1 & 0x0f) === 1) {
      const msg = JSON.parse(payload.toString('utf8'));
      if (msg.id && waiters.has(msg.id)) { waiters.get(msg.id)(msg); waiters.delete(msg.id); }
    }
  }
});

await opened;

function send(method, params = {}) {
  const mid = ++id;
  const pl = Buffer.from(JSON.stringify({ id: mid, method, params }), 'utf8');
  const mask = Buffer.alloc(4);
  let header;
  if (pl.length < 126) header = Buffer.from([0x81, 0x80 | pl.length]);
  else if (pl.length < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(pl.length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(pl.length), 2); }
  sock.write(Buffer.concat([header, mask, pl]));
  return new Promise((resolve) => waiters.set(mid, resolve));
}

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  return r.result?.result?.value;
}

const problems = [];
const check = (name, cond, detail = '') => {
  console.log(`${cond ? '  OK  ' : '  FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!cond) problems.push(name);
};

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // ---------- เครื่องมือหาธาตุของตัวเอง ----------
  await send('Page.navigate', { url: BASE + '/' });
  await sleep(1800);

  const finder = JSON.parse(await evaluate(`(() => {
    const out = {};
    const d = document.getElementById('birthDate');
    d.value = '1990-05-15';
    d.dispatchEvent(new Event('change'));
    document.querySelector('[data-pick-type="INFP"]').click();
    const r = document.getElementById('finderResult');
    out.shown = r.classList.contains('show');
    out.note = document.getElementById('birthNote').textContent;
    out.stem = (document.querySelector('[data-pick-stem][aria-pressed="true"]')||{}).dataset
      ? document.querySelector('[data-pick-stem][aria-pressed="true"]').dataset.pickStem : null;
    out.god = (document.querySelector('#finderResult .god-name')||{}).textContent;
    out.score = (document.querySelector('#finderResult .pair-score .num')||{}).textContent;
    out.paras = document.querySelectorAll('#finderResult .result-body p').length;
    const a = document.querySelector('#finderResult a.btn');
    out.link = a ? a.getAttribute('href') : null;
    document.querySelector('[data-pick-stem="ren"]').click();
    out.afterManual = (document.querySelector('#finderResult .pair-score .num')||{}).textContent;
    out.afterManualGod = (document.querySelector('#finderResult .god-name')||{}).textContent;
    out.noteAfter = document.getElementById('birthNote').textContent;
    return JSON.stringify(out);
  })()`));

  console.log('เครื่องมือ "หาธาตุของตัวเอง":');
  check('แสดงผลลัพธ์', finder.shown);
  check('คำนวณเสาจากวันเกิดได้', /เสาวันเกิด/.test(finder.note || ''), finder.note);
  check('เลือกเสาให้อัตโนมัติ', !!finder.stem, finder.stem);
  check('แสดงบทบาทสิบเทพ', !!finder.god, finder.god);
  check('แสดงคะแนน', /\d+/.test(finder.score || ''), finder.score);
  check('มีคำอ่านครบ', finder.paras >= 4, `${finder.paras} ย่อหน้า`);
  check('ลิงก์ไปหน้าคู่', !!finder.link, finder.link);
  check('เลือกเสาเองได้', finder.afterManual !== finder.score, `${finder.score} -> ${finder.afterManual}`);
  check('เปลี่ยนเสาแล้วบทบาทเปลี่ยนตาม', finder.afterManualGod !== finder.god, `${finder.god} -> ${finder.afterManualGod}`);
  check('บอกผู้ใช้ว่าเลือกเอง', /เลือกเอง/.test(finder.noteAfter || ''), finder.noteAfter);

  // ---------- ตัวกรองตาราง ----------
  await send('Page.navigate', { url: BASE + '/matrix/' });
  await sleep(1500);

  const matrix = JSON.parse(await evaluate(`(() => {
    const out = {};
    const count = () => document.getElementById('matrixCount').textContent;
    out.total = count();
    document.querySelector('[data-filter-group="NF"]').click();
    out.nf = count();
    out.nfRows = Array.from(document.querySelectorAll('.matrix tbody tr')).filter(r => !r.hidden).map(r => r.dataset.group);
    document.querySelector('[data-filter-group="all"]').click();
    document.querySelector('[data-filter-element="water"]').click();
    out.water = count();
    out.waterCols = Array.from(document.querySelectorAll('.matrix thead th')).filter(t => !t.hidden).map(t => t.dataset.element || 'label');
    document.querySelector('[data-filter-element="all"]').click();
    out.reset = count();
    return JSON.stringify(out);
  })()`));

  console.log('\nตัวกรองตาราง:');
  check('แสดงครบ 160 คู่', matrix.total === '160', matrix.total);
  check('กรองกลุ่ม NF ได้ 40 คู่', matrix.nf === '40', matrix.nf);
  check('เหลือแต่แถวของกลุ่ม NF', matrix.nfRows.every((g) => g === 'NF'), matrix.nfRows.join(','));
  check('กรองธาตุน้ำได้ 32 คู่', matrix.water === '32', matrix.water);
  // หัวมุมซ้าย (ป้าย "MBTI \ เสา") ต้องอยู่เสมอ ไม่ใช่ถูกซ่อนไปพร้อมคอลัมน์ธาตุ
  check('หัวมุมซ้ายยังอยู่ + คอลัมน์น้ำ 2 เสา', matrix.waterCols.length === 3
    && matrix.waterCols[0] === 'label' && matrix.waterCols.slice(1).every((e) => e === 'water'),
    matrix.waterCols.join(','));
  check('รีเซ็ตกลับได้ 160', matrix.reset === '160', matrix.reset);

  // ---------- ลิงก์ของผล (แชร์ได้) ----------
  await send('Page.navigate', { url: BASE + '/?type=ENFJ&stem=jia' });
  await sleep(1800);

  const deep = JSON.parse(await evaluate(`(() => {
    const out = {};
    const r = document.getElementById('finderResult');
    out.shown = r.classList.contains('show');
    out.title = (document.querySelector('#finderResult .result-title')||{}).textContent;
    out.score = (document.querySelector('#finderResult .pair-score .num')||{}).textContent;
    out.typePressed = (document.querySelector('[data-pick-type="ENFJ"]')||{}).getAttribute
      ? document.querySelector('[data-pick-type="ENFJ"]').getAttribute('aria-pressed') : null;
    out.stemPressed = document.querySelector('[data-pick-stem="jia"]').getAttribute('aria-pressed');
    out.note = document.getElementById('birthNote').textContent;
    out.hasCopy = !!document.getElementById('copyResult');
    out.url = location.search;
    return JSON.stringify(out);
  })()`));

  console.log('\nลิงก์ของผล (แชร์ได้):');
  check('เปิดจากลิงก์แล้วแสดงผล', deep.shown === true);
  check('ขึ้นคู่ที่ถูกต้อง', /ENFJ/.test(deep.title || '') && /แก้ไม้/.test(deep.title || ''), deep.title);
  check('คะแนนตรงกับหน้าคู่', !!deep.score, deep.score);
  check('ปุ่ม MBTI ถูกเลือก', deep.typePressed === 'true');
  check('ปุ่มเสาถูกเลือก', deep.stemPressed === 'true');
  check('บอกผู้ใช้ว่าเปิดจากลิงก์', /ลิงก์/.test(deep.note || ''), deep.note);
  check('มีปุ่มคัดลอกลิงก์', deep.hasCopy === true);

  // เลือกเองแล้วลิงก์ต้องเปลี่ยนตาม
  const synced = JSON.parse(await evaluate(`(() => {
    document.querySelector('[data-pick-stem="ren"]').click();
    return JSON.stringify({ search: location.search });
  })()`));
  check('เลือกใหม่แล้วลิงก์อัปเดต', /stem=ren/.test(synced.search || ''), synced.search);
} catch (err) {
  console.error('ล้มเหลว:', err.message);
  problems.push('รันไม่สำเร็จ');
} finally {
  chrome.kill();
  await sleep(200);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

console.log(problems.length ? `\nพบปัญหา ${problems.length}: ${problems.join(', ')}` : '\nผ่านทั้งหมด');
process.exit(problems.length ? 1 : 0);
