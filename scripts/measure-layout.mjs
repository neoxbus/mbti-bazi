// วัดความกว้างจริงขององค์ประกอบหลักที่หลายขนาดจอ — ใช้ตรวจว่าตารางกว้างเต็มพื้นที่จริงไหม
// ใช้: node scripts/measure-layout.mjs [path] [width...]
// หมายเหตุ: ใน bash ของ Git ให้เขียนพาธเว็บเป็น "path=/matrix/" เพื่อไม่ให้ MSYS แปลงพาธให้
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';

const CHROME = 'C:/Users/somsak/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe';
const BASE = 'http://127.0.0.1:4173';

function argPath(v) {
  let s = String(v ?? '');
  if (s.startsWith('path=')) s = s.slice(5);
  const m = s.match(/git-[^\\/]+[\\/](.*)$/i);
  if (m) s = '/' + m[1].replace(/\\/g, '/');
  return s;
}

const args = process.argv.slice(2);
const urlPath = argPath(args[0] ?? '/');
const widths = args.slice(1).map(Number).filter((n) => n > 0);
const WIDTHS = widths.length ? widths : [1440, 1280, 1024, 768, 390];

const port = 9800 + Math.floor(Math.random() * 90);
const profile = mkdtempSync(join(tmpdir(), 'cany-measure-'));
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

console.log(`หน้า ${urlPath}`);
for (const w of WIDTHS) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700 });
  await send('Page.navigate', { url: BASE + urlPath });
  await sleep(1400);
  const raw = await ev(`(() => {
    const pick = (sel) => document.querySelector(sel);
    const rect = (sel) => { const e = pick(sel); return e ? Math.round(e.getBoundingClientRect().width) : null; };
    const out = {
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
      wrapW: rect('.section.wrap'),
      scrollW: rect('.matrix-scroll'),
      tableW: rect('#matrix'),
      cellW: rect('.cell'),
      cellH: rect('.cell') ? Math.round(pick('.cell').getBoundingClientRect().height) : null,
      cellFS: pick('.cell') ? getComputedStyle(pick('.cell')).fontSize : null,
      headFS: pick('.matrix thead th .stem-head i') ? getComputedStyle(pick('.matrix thead th .stem-head i')).fontSize : null,
      legendFS: pick('.legend') ? getComputedStyle(pick('.legend')).fontSize : null,
      heroH1: pick('h1') ? Math.round(pick('h1').getBoundingClientRect().width) : null,
      maxTextW: 0,
      overflowEls: 0,
    };
    document.querySelectorAll('main *').forEach((e) => {
      if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'visible') out.overflowEls++;
    });
    return JSON.stringify(out);
  })()`);
  console.log(`  ${w}px → ${raw}`);
}

chrome.kill();
await sleep(200);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
