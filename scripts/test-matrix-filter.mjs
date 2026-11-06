// ทดสอบตัวกรองตาราง 16 × 10 — ตรวจว่าหัวคอลัมน์มุมซ้ายไม่หายไปเมื่อกรองตามธาตุ
// ใช้: node scripts/test-matrix-filter.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';

const CHROME = 'C:/Users/somsak/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe';
const BASE = 'http://127.0.0.1:4173';

const port = 9700 + Math.floor(Math.random() * 90);
const profile = mkdtempSync(join(tmpdir(), 'cany-mf-'));
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
const key = Buffer.from(Math.random().toString(36)).slice(0, 22) + '==';
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
  const hs = buf.indexOf('\r\n\r\n');
  if (hs >= 0 && !resolveOpen.done) { buf = buf.slice(hs + 4); resolveOpen.done = true; resolveOpen(); }
  for (;;) {
    if (buf.length < 2) return;
    const b1 = buf[0], b2 = buf[1];
    let len = b2 & 0x7f, off = 2;
    if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
    if ((b2 & 0x80) !== 0) off += 4;
    if (buf.length < off + len) return;
    const pl = buf.slice(off, off + len);
    buf = buf.slice(off + len);
    if ((b1 & 0x0f) === 1) {
      const m = JSON.parse(pl.toString('utf8'));
      if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); }
    }
  }
});

await opened;

function send(method, params = {}) {
  const mid = ++id;
  const pl = Buffer.from(JSON.stringify({ id: mid, method, params }), 'utf8');
  const mask = Buffer.alloc(4);
  let h;
  if (pl.length < 126) h = Buffer.from([0x81, 0x80 | pl.length]);
  else if (pl.length < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 0x80 | 126; h.writeUInt16BE(pl.length, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 0x80 | 127; h.writeBigUInt64BE(BigInt(pl.length), 2); }
  sock.write(Buffer.concat([h, mask, pl]));
  return new Promise((r) => waiters.set(mid, r));
}
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: BASE + '/matrix/' });
await sleep(1500);

const problems = [];
const ok = (label, cond, detail = '') => {
  console.log(`  ${cond ? 'OK  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!cond) problems.push(label + (detail ? ' — ' + detail : ''));
};

// สถานะเริ่มต้น
const before = await ev(`(() => {
  const ths = [...document.querySelectorAll('#matrix thead th')];
  const corner = ths[0];
  return JSON.stringify({
    totalTh: ths.length,
    cornerHidden: corner.hidden,
    cornerText: corner.textContent.trim(),
    visibleCols: ths.filter(t => !t.hidden).length,
    count: document.getElementById('matrixCount').textContent,
  });
})()`);
console.log('ก่อนกรอง:', before);
const b = JSON.parse(before);
ok('หัวตารางมี 11 คอลัมน์', b.totalTh === 11, `ได้ ${b.totalTh}`);
ok('หัวมุมซ้าย (MBTI \\ เสา) มองเห็นอยู่', b.cornerHidden === false);
ok('นับได้ 160 คู่ตอนเริ่ม', b.count === '160', `ได้ ${b.count}`);

// กรองตามธาตุน้ำ (มี 2 เสาน้ำ = เกิงน้ำ, กุ้ยน้ำ)
await ev(`document.querySelector('[data-filter-element="water"]').click()`);
await sleep(400);
const after = await ev(`(() => {
  const ths = [...document.querySelectorAll('#matrix thead th')];
  const corner = ths[0];
  const visCells = [...document.querySelectorAll('#matrix tbody td')].filter(td => !td.hidden);
  return JSON.stringify({
    cornerHidden: corner.hidden,
    visibleCols: ths.filter(t => !t.hidden).length,
    visibleCells: visCells.length,
    count: document.getElementById('matrixCount').textContent,
    cornerVisibleWidth: Math.round(corner.getBoundingClientRect().width),
  });
})()`);
console.log('หลังกรองธาตุน้ำ:', after);
const a = JSON.parse(after);
ok('หัวมุมซ้ายยังอยู่หลังกรองธาตุ', a.cornerHidden === false);
ok('เหลือ 3 คอลัมน์ที่มองเห็น (มุมซ้าย + น้ำ 2 เสา)', a.visibleCols === 3, `ได้ ${a.visibleCols}`);
ok('หัวมุมซ้ายยังมีความกว้าง', a.cornerVisibleWidth > 0, `กว้าง ${a.cornerVisibleWidth}`);
ok('เหลือ 32 ช่อง (16 แบบ x 2 เสาน้ำ)', a.visibleCells === 32, `ได้ ${a.visibleCells}`);
ok('ตัวนับแสดง 32', a.count === '32', `ได้ ${a.count}`);

// กรองกลุ่ม NF ด้วย — นับเฉพาะช่องที่อยู่ในแถวที่ยังมองเห็น
await ev(`document.querySelector('[data-filter-group="NF"]').click()`);
await sleep(400);
const nf = JSON.parse(await ev(`(() => {
  const rows = [...document.querySelectorAll('#matrix tbody tr')].filter(tr => !tr.hidden);
  const visCells = rows.flatMap(tr => [...tr.querySelectorAll('td')].filter(td => !td.hidden));
  const corner = document.querySelector('#matrix thead th');
  return JSON.stringify({
    visibleCells: visCells.length,
    count: document.getElementById('matrixCount').textContent,
    cornerHidden: corner.hidden,
    visibleRows: rows.length,
  });
})()`));
console.log('หลังกรอง NF + น้ำ:', JSON.stringify(nf));
ok('NF + น้ำ = 8 คู่', nf.visibleCells === 8, `ได้ ${nf.visibleCells}`);
ok('เหลือ 4 แถว', nf.visibleRows === 4, `ได้ ${nf.visibleRows}`);
ok('หัวมุมซ้ายยังอยู่', nf.cornerHidden === false);

// รีเซ็ต
await ev(`document.querySelector('[data-filter-group="all"]').click()`);
await ev(`document.querySelector('[data-filter-element="all"]').click()`);
await sleep(400);
const reset = JSON.parse(await ev(`JSON.stringify({
  count: document.getElementById('matrixCount').textContent,
  visibleRows: [...document.querySelectorAll('#matrix tbody tr')].filter(tr => !tr.hidden).length,
  visibleCols: [...document.querySelectorAll('#matrix thead th')].filter(t => !t.hidden).length,
})`));
console.log('หลังรีเซ็ต:', JSON.stringify(reset));
ok('รีเซ็ตกลับได้ 160 คู่ / 16 แถว / 11 คอลัมน์',
  reset.count === '160' && reset.visibleRows === 16 && reset.visibleCols === 11,
  JSON.stringify(reset));

// สลับลำดับตัวกรอง: กรองธาตุก่อน แล้วค่อยกรองกลุ่ม — ต้องได้ผลเหมือนกัน
await ev(`document.querySelector('[data-filter-element="earth"]').click()`);
await sleep(200);
await ev(`document.querySelector('[data-filter-group="SJ"]').click()`);
await sleep(400);
const order = JSON.parse(await ev(`(() => {
  const rows = [...document.querySelectorAll('#matrix tbody tr')].filter(tr => !tr.hidden);
  const visCells = rows.flatMap(tr => [...tr.querySelectorAll('td')].filter(td => !td.hidden));
  return JSON.stringify({
    visibleCells: visCells.length,
    count: document.getElementById('matrixCount').textContent,
    visibleRows: rows.length,
  });
})()`));
console.log('กรองดินก่อนแล้วค่อยกรอง SJ:', JSON.stringify(order));
ok('SJ + ดิน = 8 คู่ ไม่ว่าจะกดตัวกรองมาก่อนหรือหลัง', order.visibleCells === 8 && order.count === '8',
  JSON.stringify(order));

chrome.kill();
await sleep(200);
try { rmSync(profile, { recursive: true, force: true }); } catch {}

console.log(problems.length ? `\nพบปัญหา ${problems.length}` : '\nผ่านทั้งหมด');
process.exit(problems.length ? 1 : 0);
