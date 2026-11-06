// วัดขนาดตัวอักษรจริงของหน้า "ที่มา" — ใช้ยืนยันว่าแหล่งอ้างอิงอ่านออกจริง (ไม่ใช่ตัวเลขจากภาพที่ถูกย่อ)
// ใช้: node scripts/measure-sources.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';

const CHROME = 'C:/Users/somsak/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe';
const BASE = 'http://127.0.0.1:4173';

const port = 9950 + Math.floor(Math.random() * 40);
const profile = mkdtempSync(join(tmpdir(), 'cany-ms-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
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
await send('Page.navigate', { url: BASE + '/about/' });
await sleep(1400);

const raw = await ev(`(() => {
  const cs = (e) => {
    if (!e) return null;
    const s = getComputedStyle(e);
    return { fs: s.fontSize, color: s.color, dec: s.textDecorationLine, bw: s.borderBottomWidth, lh: s.lineHeight };
  };
  const li = document.querySelector('.source-list li');
  const a = li && li.querySelector('a');
  const card = li && li.closest('.card');
  const note = card && Array.from(card.querySelectorAll('p')).find(p => p.textContent.includes('หมายเหตุจากแหล่งอ้างอิง'));
  const footer = document.querySelector('.site-footer');
  return JSON.stringify({
    li: cs(li), a: cs(a), note: cs(note),
    footer: cs(footer),
    listCount: document.querySelectorAll('.source-list li').length,
    linkTargets: [...document.querySelectorAll('.source-list a')].map(x => x.getAttribute('href')),
    rels: [...document.querySelectorAll('.source-list a')].map(x => x.getAttribute('rel')),
  }, null, 1);
})()`);

console.log(raw);
chrome.kill();
await sleep(200);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
