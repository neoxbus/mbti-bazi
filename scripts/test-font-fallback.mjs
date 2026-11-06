// ทดสอบว่าเว็บยังอ่านออกและไม่ล้นถ้าไม่มีฟอนต์ที่ฝังไว้
// (เช่น เครื่องที่บล็อก woff2 หรือผู้ใช้ที่ปิดการโหลดฟอนต์)
// ใช้: node scripts/test-font-fallback.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';

const CHROME = 'C:/Users/somsak/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe';
const BASE = 'http://127.0.0.1:4173';
const PAGES = ['/', '/matrix/', '/pair/enfj-gui/', '/mbti/intj/', '/stems/gui/', '/about/'];
const WIDTHS = [1440, 768, 390];

const port = 9900 + Math.floor(Math.random() * 60);
const profile = mkdtempSync(join(tmpdir(), 'cany-font-'));
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

// บังคับให้ใช้ฟอนต์สำรองของระบบทั้งหมด แทนฟอนต์ที่ฝังไว้
const FORCE_FALLBACK = `(() => {
  const s = document.createElement('style');
  s.textContent = '*, *::before, *::after { font-family: sans-serif !important; }';
  document.head.appendChild(s);
  return true;
})()`;

const AUDIT = `(() => {
  const out = { overflow: [], hOverflow: false, fonts: {} };
  out.hOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  document.querySelectorAll('body *').forEach((el) => {
    if (el.closest('.matrix-scroll')) return;
    const r = el.getBoundingClientRect();
    if (r.width > innerWidth + 2 || r.right > innerWidth + 2) out.overflow.push(el.tagName + '.' + String(el.className).slice(0, 22));
  });
  out.fonts = {
    body: getComputedStyle(document.body).fontFamily.split(',')[0],
    thai: (document.querySelector('h1') ? getComputedStyle(document.querySelector('h1')).fontFamily.split(',')[0] : null),
    cellFS: document.querySelector('.cell') ? getComputedStyle(document.querySelector('.cell')).fontSize : null,
  };
  out.text = (document.body.innerText || '').length;
  return JSON.stringify(out);
})()`;

let problems = 0;
try {
  await send('Page.enable');
  await send('Runtime.enable');

  for (const w of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700 });
    for (const pg of PAGES) {
      await send('Page.navigate', { url: BASE + pg });
      await sleep(1200);
      await ev(FORCE_FALLBACK);
      await sleep(300);
      const raw = await ev(AUDIT);
      const d = JSON.parse(raw);
      const bad = [];
      if (d.hOverflow) bad.push('ล้นแนวนอน');
      if (d.overflow.length) bad.push('ล้น: ' + [...new Set(d.overflow)].slice(0, 3).join(', '));
      if (d.text < 100) bad.push('ข้อความหายไป');
      if (bad.length) {
        problems++;
        console.log(`  ISSUE ${pg} @${w}: ${bad.join(' | ')}`);
      }
    }
    console.log(`  ตรวจ ${PAGES.length} หน้า @${w}px (ฟอนต์สำรอง) เสร็จ`);
  }

  // เทียบความสูงหน้าเมื่อใช้ฟอนต์จริง กับฟอนต์สำรอง
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const heights = {};
  for (const pg of PAGES) {
    await send('Page.navigate', { url: BASE + pg });
    await sleep(1200);
    const real = JSON.parse(await ev(`JSON.stringify({ h: document.documentElement.scrollHeight })`));
    await ev(FORCE_FALLBACK);
    await sleep(300);
    const fb = JSON.parse(await ev(`JSON.stringify({ h: document.documentElement.scrollHeight })`));
    const diff = Math.round(((fb.h - real.h) / real.h) * 100);
    heights[pg] = diff;
    const mark = Math.abs(diff) > 15 ? '  (ต่างมาก)' : '';
    console.log(`  ${pg}: สูงจริง ${real.h}px · สูงฟอนต์สำรอง ${fb.h}px · ต่าง ${diff}%${mark}`);
    if (Math.abs(diff) > 25) problems++;
  }
} catch (err) {
  console.error('ล้มเหลว:', err.message);
  problems++;
} finally {
  chrome.kill();
  await sleep(200);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

console.log(problems ? `\nพบปัญหา ${problems}` : '\nผ่านทั้งหมด — เว็บอ่านออกและไม่ล้นแม้ไม่มีฟอนต์ที่ฝังไว้');
process.exit(problems ? 1 : 0);
