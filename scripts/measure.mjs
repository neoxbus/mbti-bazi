// ตรวจขนาดจริงของตารางกติกาที่ความกว้างต่าง ๆ ด้วยการวัดจริงในเบราว์เซอร์
// ใช้: node scripts/measure.mjs <path> <selector> [widths...]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';

const CHROME = 'C:/Users/somsak/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe';
const BASE = 'http://127.0.0.1:4173';
const [urlPath = '/', selector = '.rule-table', ...widthArgs] = process.argv.slice(2);
const widths = widthArgs.length ? widthArgs.map(Number) : [1440, 768, 390];

const port = 9800 + Math.floor(Math.random() * 150);
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

try {
  await send('Page.enable');
  await send('Runtime.enable');
  let pageFails = 0;

  for (const w of widths) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700 });
    await send('Page.navigate', { url: BASE + urlPath });
    await sleep(1500);

    const data = await evaluate(`(() => {
      const alphaOf = (c) => { const m = String(c).match(/[0-9.]+/g); return m && m.length > 3 ? Number(m[3]) : 1; };
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const cells = Array.from(el.querySelectorAll('span')).map((s) => {
        const cs = getComputedStyle(s);
        const r = s.getBoundingClientRect();
        // หาสีพื้นหลังที่ใกล้ที่สุดเพื่อคำนวณคอนทราสต์ (รวมชั้นโปร่งใส)
        let bg = 'rgb(0,0,0)';
        let alpha = 1;
        const layers = [];
        let node = s;
        while (node && node !== document.documentElement) {
          const c = getComputedStyle(node).backgroundColor;
          if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
            layers.push(c);
            if (alphaOf(c) >= 1) break;
          }
          node = node.parentElement;
        }
        // ผสมชั้นจากล่างขึ้นบน
        let acc = [0, 0, 0];
        for (let i = layers.length - 1; i >= 0; i--) {
          const m = layers[i].match(/[0-9.]+/g).map(Number);
          const a = m.length > 3 ? m[3] : 1;
          acc = [0, 1, 2].map((k) => m[k] * a + acc[k] * (1 - a));
        }
        bg = 'rgb(' + acc.map((v) => Math.round(v)).join(', ') + ')';
        alpha = 1;
        return {
          text: s.textContent.trim().slice(0, 22),
          fs: Math.round(parseFloat(cs.fontSize) * 10) / 10,
          color: cs.color,
          bg,
          bgAlpha: alphaOf(bg),
          w: Math.round(r.width),
          h: Math.round(r.height),
          overflow: r.right > window.innerWidth + 1,
        };
      });
      // ตรวจว่ามีข้อความที่ล้นกรอบหรือถูกตัด
      const clipped = Array.from(el.querySelectorAll('*')).filter((n) => {
        return n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1;
      }).map((n) => n.tagName + '.' + String(n.className).slice(0, 20));
      return JSON.stringify({
        boxW: Math.round(b.width), boxH: Math.round(b.height),
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        cells, clipped,
      });
    })()`);

    const d = JSON.parse(data);
    console.log(`\n--- ความกว้าง ${w}px ---`);
    console.log(`กล่อง: ${d.boxW}x${d.boxH} | ล้นหน้า: ${d.pageOverflow} (${d.scrollW} vs ${d.clientW})`);
    console.log(`ข้อความถูกตัด: ${d.clipped.length ? d.clipped.join(', ') : 'ไม่มี'}`);
    const overflow = d.cells.filter((c) => c.overflow);
    console.log(`เซลล์ล้นขอบจอ: ${overflow.length ? overflow.map((c) => c.text).join(', ') : 'ไม่มี'}`);

    // คำนวณคอนทราสต์ของข้อความจริง (WCAG) — ข้ามตัวที่ไม่มีตัวอักษร (แถบสี, จุดประกอบ)
    const lum = (rgb) => {
      const [r, g, b] = rgb.match(/[0-9]+/g).map(Number).map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const seen = new Set();
    let fails = 0;
    for (const c of d.cells) {
      if (!c.text) continue; // ไม่ใช่ข้อความ — ข้าม
      if (c.color === 'rgba(0, 0, 0, 0)') continue; // สีโปร่งใส (เช่น gradient text)
      const key = c.color + '|' + c.bg + '|' + c.fs;
      if (seen.has(key)) continue;
      seen.add(key);
      const l1 = lum(c.color), l2 = lum(c.bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const need = c.fs >= 18 ? 3 : 4.5;
      if (ratio < need) {
        fails++;
        console.log(
          `  FAIL คอนทราสต์ ${ratio.toFixed(2)}:1 (ต้อง >=${need}) ` +
          `${c.fs}px สี ${c.color} บน ${c.bg} — "${c.text}"`
        );
      }
    }
    if (!fails) console.log(`  คอนทราสต์ผ่านทุกข้อความ (${seen.size} แบบ)`);
    pageFails += fails;
  }
  console.log(pageFails ? `\nพบข้อความที่คอนทราสต์ไม่ผ่าน ${pageFails} รายการ` : '\nคอนทราสต์ผ่านทั้งหมด');
} catch (err) {
  console.error('ล้มเหลว:', err.message);
} finally {
  chrome.kill();
  await sleep(200);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
