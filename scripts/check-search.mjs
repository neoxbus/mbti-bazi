// ตรวจว่าฟอนต์ที่ฝังไว้โหลดจริง และช่องค้นหาหาเจอครบ
// ใช้: node scripts/check-search.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';

const CHROME = 'C:/Users/somsak/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe';
const BASE = 'http://127.0.0.1:4173';

const port = 9900 + Math.floor(Math.random() * 90);
const profile = mkdtempSync(join(tmpdir(), 'cany-search-'));
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
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) {
    throw new Error('JS error: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  }
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

  // ---------- ฟอนต์ที่ฝังไว้ ----------
  await send('Page.navigate', { url: BASE + '/' });
  await sleep(2200);

  const fonts = JSON.parse(await evaluate(`(() => {
    const out = {};
    out.loaded = Array.from(document.fonts).map(f => f.family + '/' + f.weight + '/' + f.status);
    out.hasThai = document.fonts.check('16px "IBM Plex Sans Thai"', 'ทดสอบ');
    out.hasHanzi = document.fonts.check('16px "Noto Sans SC"', '甲');
    out.res = performance.getEntriesByType('resource')
      .map(r => r.name).filter(n => n.includes('/assets/fonts/'));
    out.external = performance.getEntriesByType('resource')
      .map(r => r.name).filter(n => /fonts\\.(googleapis|gstatic)\\.com/.test(n));
    // เทียบภาพที่เรนเดอร์ด้วยฟอนต์ที่ฝังไว้ กับภาพที่บังคับให้ใช้ฟอนต์อื่น
    // ถ้าต่างกัน แปลว่าฟอนต์ที่ฝังไว้ถูกใช้จริง (ถ้าเหมือนกันแปลว่ายังใช้ฟอนต์ของระบบ)
    function draw(text, font) {
      const cv = document.createElement('canvas');
      cv.width = 80; cv.height = 80;
      const cx = cv.getContext('2d');
      cx.clearRect(0, 0, 80, 80);
      cx.fillStyle = '#fff';
      cx.font = font;
      cx.textBaseline = 'top';
      cx.fillText(text, 4, 4);
      return cx.getImageData(0, 0, 80, 80).data.join(',');
    }
    out.glyphA = draw('甲', '48px "Noto Sans SC"');
    out.glyphB = draw('甲', '48px "__no_such_font__"');
    out.thaiA = draw('ก', '48px "IBM Plex Sans Thai"');
    out.thaiB = draw('ก', '48px "__no_such_font__"');
    return JSON.stringify(out);
  })()`));

  console.log('ฟอนต์ที่ฝังไว้ในเว็บ:');
  check('โหลดฟอนต์ไทย IBM Plex Sans Thai', fonts.hasThai === true);
  check('โหลดฟอนต์จีน Noto Sans SC', fonts.hasHanzi === true);
  check('ดึงไฟล์ฟอนต์จากเว็บเอง', fonts.res.length >= 2, `${fonts.res.length} ไฟล์`);
  check('ไม่มีการดึงฟอนต์จากข้างนอก', fonts.external.length === 0, fonts.external.join(','));
  check('ตัวอักษรจีนใช้ฟอนต์ที่ฝังไว้จริง', fonts.glyphA !== fonts.glyphB);
  check('ตัวอักษรไทยใช้ฟอนต์ที่ฝังไว้จริง', fonts.thaiA !== fonts.thaiB);
  check('ไม่มีคำขอภายนอกเลย', fonts.res.every((n) => n.includes('127.0.0.1')), fonts.res.length + ' ไฟล์');

  // ---------- ช่องค้นหา ----------
  const search = JSON.parse(await evaluate(`(() => {
    const out = {};
    const btn = document.getElementById('searchBtn');
    const modal = document.getElementById('searchModal');
    const input = document.getElementById('searchInput');
    out.hasBtn = !!btn;
    out.hasModal = !!modal;
    out.hiddenAtStart = modal.hidden;

    function type(v) {
      input.value = v;
      input.dispatchEvent(new Event('input'));
      const hits = Array.from(document.querySelectorAll('.search-hit')).map(a => ({
        label: a.querySelector('.hit-label').textContent,
        href: a.getAttribute('href'),
      }));
      return hits;
    }

    btn.click();
    out.opened = !modal.hidden;
    out.focused = document.activeElement === input;

    out.enfj = type('enfj').slice(0, 3);
    out.enfjCount = type('enfj').length;
    out.jia = type('แก้ไม้').slice(0, 3);
    out.hanzi = type('甲').slice(0, 3);
    out.element = type('ไม้').length;
    out.nonsense = type('zzzzz').length;
    out.emptyMsg = (document.querySelector('.search-empty')||{}).textContent || '';

    // คีย์ลูกศร + Enter
    input.value = 'enfj';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    out.selected = document.querySelectorAll('.search-hit.sel').length;

    document.getElementById('searchClose').click();
    out.closed = modal.hidden;
    return JSON.stringify(out);
  })()`));

  console.log('\nช่องค้นหา:');
  check('มีปุ่มค้นหาในหัวเว็บ', search.hasBtn);
  check('มีกล่องค้นหา', search.hasModal);
  check('เริ่มต้นปิดอยู่', search.hiddenAtStart === true);
  check('กดแล้วเปิดได้', search.opened === true);
  check('โฟกัสไปที่ช่องพิมพ์', search.focused === true);
  check('ค้น "enfj" เจอ', search.enfjCount >= 1, `${search.enfjCount} รายการ`);
  check('ค้น "enfj" ลิงก์ไปหน้าที่ถูกต้อง', (search.enfj[0]?.href || '').startsWith('/mbti/enfj/') || (search.enfj[0]?.href || '').startsWith('/pair/enfj-'), search.enfj[0]?.href);
  check('ค้น "แก้ไม้" เจอ', (search.jia || []).length >= 1, (search.jia || []).map((x) => x.label).join(' / '));
  check('ค้น "甲" เจอ', (search.hanzi || []).length >= 1, (search.hanzi || []).map((x) => x.label).join(' / '));
  check('ค้นชื่อธาตุ "ไม้" เจอหลายรายการ', search.element >= 10, `${search.element} รายการ`);
  check('ค้นคำที่ไม่มี ไม่ต้องเจออะไร', search.nonsense === 0);
  check('บอกผู้ใช้เมื่อไม่พบ', /ไม่พบ/.test(search.emptyMsg), search.emptyMsg.slice(0, 40));
  check('เลือกด้วยปุ่มลูกศร', search.selected === 1);
  check('กดปิดแล้วกล่องหาย', search.closed === true);

  // ---------- ช่องค้นหาต้องมีทุกหน้า ----------
  await send('Page.navigate', { url: BASE + '/pair/enfj-jia/' });
  await sleep(1400);
  const onPair = await evaluate(`!!document.getElementById('searchBtn')`);
  check('มีช่องค้นหาบนหน้าคู่ด้วย', onPair === true);
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
