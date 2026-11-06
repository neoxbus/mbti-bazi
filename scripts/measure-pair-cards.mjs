// วัดความสูงและความสมดุลของการ์ดสองใบในหน้าคู่ — ใช้ตรวจว่ามีพื้นที่ว่างท้ายการ์ดมากเกินไปไหม
// ใช้: node scripts/measure-pair-cards.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';

const CHROME = 'C:/Users/somsak/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe';
const BASE = 'http://127.0.0.1:4173';
const PAIRS = ['intj-gui', 'enfp-gui', 'estp-wu', 'isfj-xin', 'enfj-jia', 'intp-ren'];

const port = 9960 + Math.floor(Math.random() * 30);
const profile = mkdtempSync(join(tmpdir(), 'cany-pc-'));
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

const problems = [];
for (const w of [1440, 768, 390]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700 });
  for (const pair of PAIRS) {
    await send('Page.navigate', { url: `${BASE}/pair/${pair}/` });
    await sleep(1100);
    const raw = await ev(`(() => {
      const grid = document.querySelector('.pair-cards');
      const cards = Array.from(grid.querySelectorAll(':scope > .card'));
      const statWidths = Array.from(document.querySelectorAll('.stat-grid--three .stat'))
        .map(s => Math.round(s.getBoundingClientRect().width));
      const out = cards.map(c => {
        const cr = c.getBoundingClientRect();
        const cs = getComputedStyle(c);
        const pad = parseFloat(cs.paddingBottom);
        // หาพื้นที่ว่างท้ายการ์ด = ระยะจากขอบล่างของเนื้อหาสุดท้ายถึงขอบล่างของการ์ด
        const kids = Array.from(c.children).filter(k => k.getBoundingClientRect().height > 0);
        const last = kids[kids.length - 1];
        const gap = last ? cr.bottom - last.getBoundingClientRect().bottom : 0;
        return {
          h: Math.round(cr.height),
          bottomGap: Math.round(gap - pad),
          contentH: Math.round(kids.reduce((s, k) => s + k.getBoundingClientRect().height, 0)),
        };
      });
      return JSON.stringify({ cards: out, statWidths, docW: document.documentElement.scrollWidth, winW: window.innerWidth });
    })()`);
    const d = JSON.parse(raw);
    const [a, b] = d.cards;
    const gapDiff = Math.abs(a.bottomGap - b.bottomGap);
    const sw = d.statWidths || [];
    const statEven = sw.length !== 3 || (Math.max(...sw) - Math.min(...sw) <= 1);
    const ok = gapDiff <= 60 && statEven && d.docW <= d.winW + 2;
    console.log(`  ${ok ? 'OK  ' : 'WARN'} ${pair} @${w}: สูง ${a.h}/${b.h} · ช่องว่างท้าย ${a.bottomGap}/${b.bottomGap}px · ต่าง ${gapDiff}px · stat ${sw.join('/')}`);
    if (!ok) problems.push(`${pair}@${w}`);
  }
}

chrome.kill();
await sleep(200);
try { rmSync(profile, { recursive: true, force: true }); } catch {}

console.log(problems.length ? `\nควรปรับ: ${problems.length} รายการ` : '\nสมดุลดี — ช่องว่างท้ายการ์ดต่างกันไม่เกิน 60px');
process.exit(problems.length ? 1 : 0);
