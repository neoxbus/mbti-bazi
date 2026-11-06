// ถ่ายภาพหน้าเดียวที่ความกว้างที่กำหนด ใช้ตรวจด้วยตา
// ใช้: node scripts/shot.mjs <path> <width> [height] [outfile] [selector]
// หมายเหตุ: ใน bash ของ Git ให้เขียนพาธเป็น "path=/matrix/" เพื่อไม่ให้ MSYS แปลงพาธให้
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';

const CHROME = 'C:/Users/somsak/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe';
const BASE = 'http://127.0.0.1:4173';

// แปลงอาร์กิวเมนต์ให้ปลอดภัยจากการแปลงพาธของ MSYS — เช่น "/matrix/" อาจกลายเป็น
// "C:/Users/.../git-2.53.0+3-win32-x64/matrix/" เมื่อผ่าน bash ของ Git
function argPath(v) {
  let s = String(v ?? '');
  if (s.startsWith('path=')) s = s.slice(5);
  // ตัดราก MSYS ที่ถูกแทรกเข้ามาออก
  const m = s.match(/git-[^\\/]+[\\/](.*)$/i);
  if (m) s = '/' + m[1].replace(/\\/g, '/');
  return s;
}

const rawArgs = process.argv.slice(2);
// ใช้การแปลงเฉพาะพาธเว็บ (อาร์กิวเมนต์แรก) ส่วนพาธไฟล์ออกภาพคงไว้ตามเดิม
const urlPath = argPath(rawArgs[0] ?? '/');
const width = rawArgs[1] ?? '1440';
const height = rawArgs[2] ?? '900';
const outFile = rawArgs[3] ?? '';
const selector = rawArgs[4] ?? '';

const port = 9700 + Math.floor(Math.random() * 200);
const profile = mkdtempSync(join(tmpdir(), 'cany-shot-'));
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

try {
  const ws = wsConnect(await findWs());
  await ws.opened;
  await ws.send('Page.enable');
  await ws.send('Runtime.enable');
  await ws.send('Emulation.setDeviceMetricsOverride', {
    width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: Number(width) < 700,
  });
  await ws.send('Page.navigate', { url: BASE + urlPath });
  await sleep(1800);
  if (process.env.SHOT_DEBUG) console.error('navigate ไป:', JSON.stringify(BASE + urlPath));

  // เปิดสถานะที่ต้องการก่อนถ่าย เช่น SHOT_CLICK="#searchBtn" เพื่อเปิดกล่องค้นหา
  if (process.env.SHOT_CLICK) {
    await ws.send('Runtime.evaluate', {
      expression: `(() => { const e = document.querySelector(${JSON.stringify(process.env.SHOT_CLICK)});
        if (e) e.click(); return !!e; })()`,
      returnByValue: true,
    });
    await sleep(600);
  }

  // พิมพ์ข้อความลงในช่องค้นหา เช่น SHOT_TYPE="enfj"
  if (process.env.SHOT_TYPE) {
    await ws.send('Runtime.evaluate', {
      expression: `(() => { const i = document.getElementById('searchInput'); if (!i) return false;
        i.value = ${JSON.stringify(process.env.SHOT_TYPE)};
        i.dispatchEvent(new Event('input'));
        return true; })()`,
      returnByValue: true,
    });
    await sleep(400);
  }

  // ยืนยันว่าเบราว์เซอร์ไปที่หน้าที่ต้องการจริง ไม่ใช่หน้าเริ่มต้นของ Chrome
  let current = await ws.send('Runtime.evaluate', {
    expression: 'location.href',
    returnByValue: true,
  });
  let href = current.result?.result?.value || '';
  for (let attempt = 0; attempt < 3 && !href.includes(urlPath.replace(/\/$/, '')); attempt++) {
    await ws.send('Page.navigate', { url: BASE + urlPath });
    await sleep(2000);
    current = await ws.send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
    href = current.result?.result?.value || '';
  }
  if (!href.includes(urlPath.replace(/\/$/, ''))) {
    console.error('เปิดหน้าไม่สำเร็จ — อยู่ที่', href);
    throw new Error('navigation failed');
  }

  let shotOpts = { format: 'png' };
  if (selector) {
    const r = await ws.send('Runtime.evaluate', {
      expression: `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null;
        e.scrollIntoView({ block: 'center' });
        const b = e.getBoundingClientRect();
        return JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height }); })()`,
      returnByValue: true,
    });
    const raw = r.result?.result?.value;
    if (!raw) {
      console.error('ไม่พบตัวที่เลือก:', selector);
      throw new Error('selector not found');
    }
    await sleep(400);
    const r2 = await ws.send('Runtime.evaluate', {
      expression: `(() => { const b = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
        return JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height }); })()`,
      returnByValue: true,
    });
    const clip = JSON.parse(r2.result?.result?.value);
    shotOpts.clip = { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 };
  } else {
    shotOpts.captureBeyondViewport = true;
  }
  const shot = await ws.send('Page.captureScreenshot', shotOpts);
  const p = outFile || join(process.env.LOCALAPPDATA || tmpdir(), 'Temp', `shot-${Date.now()}.png`);
  writeFileSync(p, Buffer.from(shot.result.data, 'base64'));
  console.log(p);
  ws.close();
} catch (err) {
  console.error('ล้มเหลว:', err.message);
  process.exitCode = 1;
} finally {
  chrome.kill();
  await sleep(200);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
