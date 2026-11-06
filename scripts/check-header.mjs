// วัดความกว้างหัวเว็บที่หลายขนาดจอ เพื่อกันไม่ให้เมนูล้นหรือซ้อนกัน
// ใช้: node scripts/check-header.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';

const CHROME = 'C:/Users/somsak/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe';
const BASE = 'http://127.0.0.1:4173';
const WIDTHS = [1440, 1280, 1100, 1024, 960, 900, 860, 820, 768, 640, 480, 390];

const port = 9600 + Math.floor(Math.random() * 90);
const profile = mkdtempSync(join(tmpdir(), 'cany-header-'));
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
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  return r.result?.result?.value;
}

const problems = [];

try {
  await send('Page.enable');
  await send('Runtime.enable');

  for (const w of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700,
    });
    await send('Page.navigate', { url: BASE + '/pair/enfj-jia/' });
    await sleep(1500);

    const m = JSON.parse(await evaluate(`(() => {
      const out = {};
      const bar = document.querySelector('.site-header .bar');
      const brand = document.querySelector('.brand');
      const search = document.getElementById('searchBtn');
      const nav = document.getElementById('siteNav');
      const toggle = document.getElementById('navToggle');
      const cs = getComputedStyle(nav);
      out.barW = bar.getBoundingClientRect().width;
      out.barRight = bar.getBoundingClientRect().right;
      out.brandRight = brand.getBoundingClientRect().right;
      out.searchLeft = search.getBoundingClientRect().left;
      out.searchRight = search.getBoundingClientRect().right;
      out.navDisplay = cs.display;
      out.navLeft = nav.getBoundingClientRect().left;
      out.navRight = nav.getBoundingClientRect().right;
      out.toggleDisplay = getComputedStyle(toggle).display;
      out.toggleLeft = toggle.getBoundingClientRect().left;
      out.docOverflow = document.documentElement.scrollWidth > window.innerWidth + 1;
      out.headerH = document.querySelector('.site-header').getBoundingClientRect().height;
      return JSON.stringify(out);
    })()`));

    const inlineNav = m.navDisplay !== 'none';
    const navFits = !inlineNav || m.navRight <= m.barRight + 1;
    const noOverlap = !inlineNav || m.navLeft >= m.searchRight - 1;
    const ok = navFits && noOverlap && !m.docOverflow && m.headerH <= 70;
    const note = `bar=${Math.round(m.barW)}(right ${Math.round(m.barRight)}) ` +
      `nav=${Math.round(m.navLeft)}-${Math.round(m.navRight)} ` +
      `search=${Math.round(m.searchLeft)}-${Math.round(m.searchRight)} ` +
      `headerH=${Math.round(m.headerH)} overflow=${m.docOverflow}`;
    console.log(`${ok ? '  OK  ' : '  FAIL'} ${w}px — ${note}`);
    if (!ok) problems.push(`${w}px: ${note}`);
  }
} catch (err) {
  console.error('ล้มเหลว:', err.message);
  problems.push('รันไม่สำเร็จ');
} finally {
  chrome.kill();
  await sleep(200);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

console.log(problems.length ? `\nพบปัญหา ${problems.length}` : '\nผ่านทั้งหมด');
process.exit(problems.length ? 1 : 0);
