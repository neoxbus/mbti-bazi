// เสิร์ฟไฟล์คงที่เพื่อดูผลบนเครื่อง — ปิดเมื่อได้รับ Ctrl+C
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const safe = normalize(rel).replace(/^([/\\])+/, '');
    let file = join(dist, safe);

    try {
      const s = await stat(file);
      if (s.isDirectory()) file = join(file, 'index.html');
    } catch {
      // ไม่พบไฟล์ — ส่งหน้า 404 (ถ้าหน้า 404 เองยังไม่พร้อม เช่นกำลัง build ครั้งใหม่ ให้ตอบ 404 เปล่าแทน)
      let body = '<h1>404</h1>';
      let status = 404;
      try {
        body = await readFile(join(dist, '404.html'));
      } catch {
        body = '<!doctype html><meta charset="utf-8"><h1>404 — ไม่พบหน้านี้</h1>';
      }
      res.writeHead(status, { 'Content-Type': MIME['.html'] });
      res.end(body);
      return;
    }

    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch (err) {
    // ถ้าตอบไปแล้ว (เช่น 404 ที่ส่งครึ่งทางแล้วค้าง) ห้ามเขียน header ซ้ำ — แค่จบการตอบ
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(err));
    } else {
      res.end();
    }
  }
}).listen(PORT, () => console.log(`เสิร์ฟที่ http://127.0.0.1:${PORT}`));
