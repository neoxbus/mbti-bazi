// ตรวจหลายหน้าในเบราว์เซอร์เดียว — เร็วกว่าการเปิดใหม่ทุกหน้า
// ใช้: node scripts/check-pages.mjs [--all]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const CHROME = 'C:/Users/somsak/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe';
const BASE = 'http://127.0.0.1:4173';
const WIDTHS = [1440, 768, 390];
const port = 9700 + Math.floor(Math.random() * 200);

const profile = mkdtempSync(join(tmpdir(), 'cany-pages-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--hide-scrollbars', '--disable-extensions', '--disable-dev-shm-usage',
], { stdio: ['ignore', 'ignore', 'ignore'] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findWs() {
  for (let i = 0; i < 80; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = tabs.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('chrome ไม่ตอบสนอง');
}

function wsConnect(wsUrl) {
  const u = new URL(wsUrl);
  const key = Buffer.from(Math.random().toString(36)).toString('base64').slice(0, 22) + '==';
  const sock = createConnection({ host: u.hostname, port: Number(u.port) });
  sock.on('error', () => {});
  let buf = Buffer.alloc(0);
  const waiters = new Map();
  let resolveOpen;
  const opened = new Promise((r) => (resolveOpen = r));

  sock.on('connect', () => {
    sock.write(
      `GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\n` +
      `Connection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
    );
  });

  function parse() {
    for (;;) {
      if (buf.length < 2) return;
      const b1 = buf[0], b2 = buf[1];
      const masked = (b2 & 0x80) !== 0;
      let len = b2 & 0x7f, offset = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); offset = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); offset = 10; }
      if (masked) offset += 4;
      if (buf.length < offset + len) return;
      const payload = buf.slice(offset, offset + len);
      buf = buf.slice(offset + len);
      if ((b1 & 0x0f) === 1) {
        const msg = JSON.parse(payload.toString('utf8'));
        if (msg.id && waiters.has(msg.id)) { waiters.get(msg.id)(msg); waiters.delete(msg.id); }
      }
    }
  }

  sock.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    const idx = buf.indexOf('\r\n\r\n');
    if (idx >= 0 && !resolveOpen.done) { buf = buf.slice(idx + 4); resolveOpen.done = true; resolveOpen(); }
    parse();
  });

  let id = 0;
  function send(method, params = {}) {
    const msgId = ++id;
    const payload = Buffer.from(JSON.stringify({ id: msgId, method, params }), 'utf8');
    const mask = Buffer.alloc(4);
    let header;
    if (payload.length < 126) header = Buffer.from([0x81, 0x80 | payload.length]);
    else if (payload.length < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(payload.length, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(payload.length), 2); }
    sock.write(Buffer.concat([header, mask, payload]));
    return new Promise((resolve) => waiters.set(msgId, resolve));
  }
  return { opened, send, close: () => sock.end() };
}

const AUDIT = `(() => {
  const out = {};
  const q = (s) => document.querySelector(s);
  const qa = (s) => Array.from(document.querySelectorAll(s));
  out.h1 = q('h1') ? q('h1').innerText.trim().slice(0, 50) : null;
  out.h1Count = qa('h1').length;
  out.hOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const bad = [];
  qa('body *').forEach((el) => {
    if (el.closest('.matrix-scroll')) return;
    const r = el.getBoundingClientRect();
    if (r.width > innerWidth + 2 || r.right > innerWidth + 2) bad.push(el.tagName + '.' + String(el.className).slice(0, 22));
  });
  out.overflowing = bad.slice(0, 4);
  out.emptyText = qa('h1, h2, h3, p, .chip, .pick').filter((el) => !el.innerText.trim() && !el.querySelector('svg')).length;
  out.brokenImages = qa('img').filter((i) => !i.complete || i.naturalWidth === 0).length;
  out.title = document.title;
  out.navLinks = qa('.site-nav a, .nav a').length;
  return JSON.stringify(out);
})()`;

// รวบรวม URL
const all = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full);
    else if (e === 'index.html') all.push('/' + relative(DIST, full).replace(/\\/g, '/').replace(/index\.html$/, ''));
  }
})(DIST);
all.push('/404.html');

const sample = process.argv[2] === '--all'
  ? all
  : all.filter((u) => /^\/(mbti|stems)\/[a-z]+\/$/.test(u)).slice(0, 6)
    .concat(['/', '/matrix/', '/mbti/', '/stems/', '/elements/', '/tengods/', '/about/', '/404.html']);

// จำกัดความกว้างที่ต้องการตรวจ: --all [--width=1440]
const widthArg = process.argv.find((a) => a.startsWith('--width='));
const useWidths = widthArg ? [Number(widthArg.split('=')[1])] : WIDTHS;

console.log(`ตรวจ ${sample.length} หน้า × ${useWidths.length} ความกว้าง\n`);

// ทดสอบเครื่องมือ "หาธาตุของตัวเอง" แบบอัตโนมัติ
const FINDER = `(() => {
  const out = {};
  const d = document.getElementById('birthDate');
  if (!d) return JSON.stringify({ skip: 'no finder' });
  d.value = '1990-05-15';
  d.dispatchEvent(new Event('change'));
  document.querySelector('[data-pick-type="INFP"]').click();
  const r = document.getElementById('finderResult');
  out.shown = r.classList.contains('show');
  out.note = document.getElementById('birthNote').textContent;
  out.stem = (document.querySelector('[data-pick-stem][aria-pressed="true"]') || {}).textContent;
  out.god = (document.querySelector('#finderResult .god-name') || {}).textContent;
  out.score = (document.querySelector('#finderResult .pair-score .num') || {}).textContent;
  out.paragraphs = document.querySelectorAll('#finderResult .result-body p').length;
  const a = document.querySelector('#finderResult a.btn');
  out.link = a ? a.getAttribute('href') : null;
  document.querySelector('[data-pick-stem="ren"]').click();
  out.afterManual = (document.querySelector('#finderResult .pair-score .num') || {}).textContent;
  out.afterManualGod = (document.querySelector('#finderResult .god-name') || {}).textContent;
  return JSON.stringify(out);
})()`;

let problems = 0;
let checked = 0;
let shotIndex = 0;

try {
  const ws = wsConnect(await findWs());
  await ws.opened;
  await ws.send('Page.enable');
  await ws.send('Runtime.enable');

  for (const url of sample) {
    for (const w of useWidths) {
      await ws.send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700 });
      await ws.send('Page.navigate', { url: BASE + url });
      await sleep(900);
      const res = await ws.send('Runtime.evaluate', { expression: AUDIT, returnByValue: true });
      const raw = res.result?.result?.value;
      if (!raw) { console.log(`  NO-RESULT ${url} @${w}`); problems++; continue; }
      const d = JSON.parse(raw);
      checked++;
      const bad = [];
      if (d.hOverflow) bad.push('ล้นแนวนอน');
      if (d.overflowing?.length) bad.push('ล้น: ' + d.overflowing.join(', '));
      if (d.emptyText > 0) bad.push(`ข้อความว่าง ${d.emptyText}`);
      if (d.brokenImages > 0) bad.push('รูปเสีย');
      if (d.h1Count !== 1) bad.push(`h1 ${d.h1Count} ตัว`);
      if (!d.title) bad.push('ไม่มี title');
      if (bad.length) { problems++; console.log(`  ISSUE ${url} @${w}: ${bad.join(' | ')}`); }

      // เก็บภาพหน้าแรกที่ความกว้างเดสก์ท็อปไว้ตรวจด้วยตา
      if (w === 1440 && ['/', '/matrix/', '/pair/intj-geng/', '/tengods/'].includes(url)) {
        const shot = await ws.send('Page.captureScreenshot', { format: 'png' });
        if (shot.result?.data) {
          const p = join(process.env.LOCALAPPDATA || tmpdir(), 'Temp', `cany-${++shotIndex}.png`);
          writeFileSync(p, Buffer.from(shot.result.data, 'base64'));
          console.log(`  shot: ${p}`);
        }
      }
    }
  }
  ws.close();
} catch (err) {
  console.error('ล้มเหลว:', err.message);
  problems++;
} finally {
  chrome.kill();
  await sleep(200);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

console.log(`\nตรวจแล้ว ${checked} ครั้ง, พบปัญหา ${problems}`);
process.exit(problems ? 1 : 0);
