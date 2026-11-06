// ตรวจเลย์เอาต์ของเว็บที่สร้างแล้ว ด้วยเบราว์เซอร์จริง — ใช้ตรวจซ้ำได้
// ใช้งาน: node scripts/inspect.mjs <url> [width] [height]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';

const CHROME = 'C:/Users/somsak/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe';
const url = process.argv[2] || 'http://127.0.0.1:4173/';
const width = Number(process.argv[3] || 1440);
const height = Number(process.argv[4] || 900);
const port = 9500 + Math.floor(Math.random() * 400);

const profile = mkdtempSync(join(tmpdir(), 'cany-inspect-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  `--window-size=${width},${height}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--hide-scrollbars', '--disable-extensions',
], { stdio: ['ignore', 'ignore', 'ignore'] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const tabs = await res.json();
      const page = tabs.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('chrome ไม่ตอบสนอง');
}

// สร้างคำขอ WebSocket แบบเบา ๆ (ไม่ต้อง dependency)
function wsConnect(wsUrl) {
  const u = new URL(wsUrl);
  const key = Buffer.from(Math.random().toString(36)).toString('base64').slice(0, 22) + '==';
  const sock = createConnection({ host: u.hostname, port: Number(u.port) });
  let buf = Buffer.alloc(0);
  let resolveOpen;
  const waiters = new Map();
  const events = [];
  const opened = new Promise((r) => (resolveOpen = r));

  sock.on('connect', () => {
    sock.write(
      `GET ${u.pathname}${u.search} HTTP/1.1\r\n` +
      `Host: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
    );
  });

  function parse() {
    while (true) {
      if (buf.length < 2) return;
      const b1 = buf[0], b2 = buf[1];
      const masked = (b2 & 0x80) !== 0;
      let len = b2 & 0x7f;
      let offset = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); offset = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); offset = 10; }
      if (masked) offset += 4;
      if (buf.length < offset + len) return;
      const payload = buf.slice(offset, offset + len);
      buf = buf.slice(offset + len);
      if ((b1 & 0x0f) === 1) { // text frame
        const msg = JSON.parse(payload.toString('utf8'));
        if (msg.id && waiters.has(msg.id)) { waiters.get(msg.id)(msg); waiters.delete(msg.id); }
        else if (msg.method) events.push(msg);
      }
    }
  }

  sock.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    const idx = buf.indexOf('\r\n\r\n');
    if (idx >= 0 && !resolveOpen.done) { buf = buf.slice(idx + 4); resolveOpen.done = true; resolveOpen(); }
    parse();
  });

  sock.on('error', () => {}); // ปิดการเชื่อมต่อไม่ควรทำให้สคริปต์พัง
  sock.on('close', () => {});
  sock.on('end', () => {});

  let id = 0;
  function send(method, params = {}) {
    const msgId = ++id;
    const payload = Buffer.from(JSON.stringify({ id: msgId, method, params }), 'utf8');
    const mask = Buffer.from([0, 0, 0, 0]);
    let header;
    if (payload.length < 126) {
      header = Buffer.from([0x81, 0x80 | payload.length]);
    } else if (payload.length < 65536) {
      header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    sock.write(Buffer.concat([header, mask, payload]));
    return new Promise((resolve) => waiters.set(msgId, resolve));
  }

  return { opened, send, close: () => sock.end(), events };
}

const AUDIT = `(() => {
  const out = {};
  const q = (s) => document.querySelector(s);
  const qa = (s) => Array.from(document.querySelectorAll(s));
  out.title = document.title;
  out.url = location.pathname;
  out.viewport = innerWidth + 'x' + innerHeight;
  out.docWidth = document.documentElement.scrollWidth + '/' + document.documentElement.clientWidth;
  out.hOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;

  // องค์ประกอบหลัก
  out.h1 = q('h1') ? q('h1').innerText.trim().slice(0, 60) : null;
  out.h1Size = q('h1') ? getComputedStyle(q('h1')).fontSize : null;
  out.sections = qa('main section').length;
  out.cards = qa('.card, .type-card, .stem-card').length;
  out.links = qa('a').length;
  out.footer = !!q('.site-footer');

  // สิ่งที่ล้นกรอบ (ยกเว้นตารางที่เลื่อนได้)
  const bad = [];
  qa('body *').forEach((el) => {
    if (el.closest('.matrix-scroll')) return;
    const r = el.getBoundingClientRect();
    if (r.width > innerWidth + 2 || r.right > innerWidth + 2) {
      bad.push(el.tagName + '.' + String(el.className).slice(0, 24) + ' w=' + Math.round(r.width) + ' r=' + Math.round(r.right));
    }
  });
  out.overflowing = bad.slice(0, 6);

  // สายตาที่ควรมี
  out.emptyText = qa('h1, h2, h3, p, .chip, .pick').filter((el) => !el.innerText.trim() && !el.querySelector('svg')).length;
  out.brokenImages = qa('img').filter((i) => !i.complete || i.naturalWidth === 0).length;
  out.svgCount = qa('svg').length;

  // ความกว้างของเนื้อหา
  const w = q('.wrap');
  out.contentWidth = w ? Math.round(w.getBoundingClientRect().width) : null;

  // สีและความต่างของข้อความ
  function lum(c) {
    const m = c.match(/[\\d.]+/g).map(Number);
    const f = m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  }
  function ratio(a, b) { const l1 = lum(a), l2 = lum(b); return +(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))).toFixed(2); }
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const contrasts = {};
  [['h1', 'h1'], ['body', 'p'], ['muted', '.breadcrumb'], ['card', '.card p']].forEach(([k, sel]) => {
    const el = q(sel); if (!el) return;
    const cs = getComputedStyle(el);
    let bg = cs.backgroundColor;
    if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') bg = bodyBg;
    contrasts[k] = cs.color + ' on ' + bg + ' = ' + ratio(cs.color, bg);
  });
  out.contrast = contrasts;

  // ตรวจว่าสคริปต์ทำงาน
  out.jsLoaded = typeof window.__PAIRS__ !== 'undefined' || !!q('#finder') || !!q('#matrix');
  if (q('#matrix')) {
    out.matrixCells = qa('#matrix tbody td').length;
    out.matrixCount = q('#matrixCount') ? q('#matrixCount').textContent : null;
  }
  if (q('#finder')) {
    out.picks = qa('[data-pick-type]').length + '/' + qa('[data-pick-stem]').length;
  }
  // การ์ดสิบเทพ (ถ้ามี)
  if (q('.god-card')) {
    out.godLabel = q('.god-label').textContent;
    out.godName = q('.god-name').innerText.replace(/\\n/g, ' ');
    out.godRole = q('.god-role').textContent;
    out.godRel = q('.god-rel').textContent;
  }
  // แถบคะแนนและวงแหวน
  out.bars = qa('.bar-fill').length;
  out.rings = qa('.ring').length;
  return JSON.stringify(out);
})()`;

try {
  const wsUrl = await findWs();
  const ws = wsConnect(wsUrl);
  await ws.opened;
  await ws.send('Page.enable');
  await ws.send('Runtime.enable');
  await ws.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
  await ws.send('Page.navigate', { url });
  await sleep(2500);
  const res = await ws.send('Runtime.evaluate', { expression: AUDIT, returnByValue: true });
  const raw = res.result?.result?.value;
  if (!raw) {
    console.log('ไม่ได้ผลลัพธ์:', JSON.stringify(res).slice(0, 500));
  } else {
    console.log(JSON.stringify(JSON.parse(raw), null, 2));
  }
  // ภาพหน้าจอ
  const shot = await ws.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  if (shot.result?.data) {
    const out = process.env.SHOT_PATH || join(process.cwd(), 'shot.png');
    writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    console.log('ภาพ:', out);
  }
  ws.close();
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
  await sleep(200);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(process.exitCode || 0);
}
