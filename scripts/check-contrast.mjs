// ตรวจคอนทราสต์และการล้นขอบจอ ของทุกหน้าหลัก ที่ทุกความกว้าง
// ใช้: node scripts/check-contrast.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';

const CHROME = 'C:/Users/somsak/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe';
const BASE = 'http://127.0.0.1:4173';
const PAGES = [
  '/', '/matrix/', '/pair/intj-xin/', '/pair/esfp-gui/', '/mbti/intj/', '/mbti/isfp/',
  '/stems/jia/', '/stems/gui/', '/elements/', '/tengods/', '/about/', '/404.html',
];
const WIDTHS = [1440, 768, 390];

const port = 9800 + Math.floor(Math.random() * 150);
const profile = mkdtempSync(join(tmpdir(), 'cany-contrast-'));
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

// ฟังก์ชันวัดที่รันในหน้าเว็บ
const AUDIT = `(() => {
  const alphaOf = (c) => { const m = String(c).match(/[0-9.]+/g); return m && m.length > 3 ? Number(m[3]) : 1; };
  const lum = (rgb) => {
    const p = String(rgb).match(/[0-9]+/g).map(Number);
    const [r, g, b] = p.map((v) => { const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const bgOf = (el) => {
    const layers = [];
    let node = el;
    while (node && node !== document.documentElement) {
      const c = getComputedStyle(node).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
        layers.push(c);
        if (alphaOf(c) >= 1) break;
      }
      node = node.parentElement;
    }
    let acc = [0, 0, 0];
    for (let i = layers.length - 1; i >= 0; i--) {
      const m = layers[i].match(/[0-9.]+/g).map(Number);
      const a = m.length > 3 ? m[3] : 1;
      acc = [0, 1, 2].map((k) => m[k] * a + acc[k] * (1 - a));
    }
    return 'rgb(' + acc.map((v) => Math.round(v)).join(', ') + ')';
  };
  const out = { lowContrast: [], overflow: [], hOverflow: false };
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    // ข้อความที่ล้นขอบจอ (ยกเว้นส่วนที่เลื่อนได้)
    if (!el.closest('.matrix-scroll') && r.right > window.innerWidth + 2) {
      out.overflow.push(el.tagName + '.' + String(el.className).slice(0, 24));
    }
    // คอนทราสต์ของข้อความจริง
    const text = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!text) continue;
    const color = cs.color;
    if (color === 'rgba(0, 0, 0, 0)') continue; // gradient text
    if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) continue; // พื้นหลังไล่สี — วัดจากพิกเซลจริงไม่ได้
    const fs = parseFloat(cs.fontSize);
    const l1 = lum(color), l2 = lum(bgOf(el));
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const need = fs >= 18 ? 3 : 4.5;
    if (ratio < need) {
      out.lowContrast.push({ t: text.slice(0, 26), fs: Math.round(fs), ratio: Math.round(ratio * 100) / 100, need });
    }
  }
  out.hOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
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
      await sleep(1100);
      const raw = await evaluate(AUDIT);
      if (!raw) { console.log(`  NO-RESULT ${pg} @${w}`); problems++; continue; }
      const d = JSON.parse(raw);
      const bad = [];
      if (d.hOverflow) bad.push('หน้าล้นแนวนอน');
      if (d.overflow.length) bad.push('ล้น: ' + [...new Set(d.overflow)].slice(0, 3).join(', '));
      if (d.lowContrast.length) {
        const uniq = [...new Map(d.lowContrast.map((x) => [x.t + x.fs, x])).values()].slice(0, 4);
        bad.push('คอนทราสต์ต่ำ: ' + uniq.map((x) => `"${x.t}" ${x.ratio}:1 (ต้อง ${x.need})`).join(' / '));
      }
      if (bad.length) {
        problems++;
        console.log(`  ISSUE ${pg} @${w}: ${bad.join(' | ')}`);
      }
    }
    console.log(`  ตรวจ ${PAGES.length} หน้า @${w}px เสร็จ`);
  }
} catch (err) {
  console.error('ล้มเหลว:', err.message);
  problems++;
} finally {
  chrome.kill();
  await sleep(200);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

console.log(problems ? `\nพบปัญหา ${problems} รายการ` : '\nผ่านทั้งหมด');
process.exit(problems ? 1 : 0);
