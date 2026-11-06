// ตัวช่วยเรียกเครื่องมือ craft-anything ผ่าน MCP (stdio)
// ใช้: node scripts/mcp.mjs list            -> รายชื่อเครื่องมือ
//       node scripts/mcp.mjs schema <tool>    -> schema ของเครื่องมือ
//       node scripts/mcp.mjs call <tool> '<json>' -> เรียกเครื่องมือ
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(__dirname, '..', '..', 'investigation.cany');
const CLI = 'C:/Program Files/Craft Anything/craft-anything-cli.exe';

const [mode, tool, rawArgs] = process.argv.slice(2);

const child = spawn(CLI, ['mcp', '--project', PROJECT, '--allow-run', '--deep'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buf = Buffer.alloc(0);
const pending = new Map();
let id = 0;

child.stdout.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).toString('utf8').trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
child.stderr.on('data', () => {});

function send(method, params = {}, sessionId) {
  const msgId = ++id;
  const body = { jsonrpc: '2.0', id: msgId, method, params };
  if (sessionId) body.sessionId = sessionId;
  child.stdin.write(JSON.stringify(body) + '\n');
  return new Promise((resolve, reject) => {
    pending.set(msgId, resolve);
    setTimeout(() => {
      if (pending.has(msgId)) { pending.delete(msgId); reject(new Error('หมดเวลา')); }
    }, 300000);
  });
}
function notify(method, params = {}, sessionId) {
  const body = { jsonrpc: '2.0', method, params };
  if (sessionId) body.sessionId = sessionId;
  child.stdin.write(JSON.stringify(body) + '\n');
}

function out(text, code = 0) {
  console.log(text);
  process.exit(code);
}

try {
  const init = await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'craft-anything-builder', version: '1.0.0' },
  });
  const sessionId = init.result?.sessionId;
  notify('notifications/initialized', {}, sessionId);

  const list = await send('tools/list', {}, sessionId);
  const tools = list.result?.tools || [];

  if (mode === 'list') {
    out(tools.map((t) => t.name).join('\n'));
  }

  if (mode === 'schema') {
    const t = tools.find((x) => x.name === tool);
    if (!t) out(`ไม่พบเครื่องมือ ${tool}\nมี: ${tools.map((x) => x.name).join(', ')}`, 2);
    out(JSON.stringify(t, null, 2));
  }

  if (mode === 'call') {
    if (!tools.some((t) => t.name === tool)) {
      out(`ไม่พบเครื่องมือ ${tool}\nมี: ${tools.map((x) => x.name).join(', ')}`, 2);
    }
    const args = rawArgs ? JSON.parse(rawArgs) : {};
    const call = await send('tools/call', { name: tool, arguments: args }, sessionId);
    const text = (call.result?.content || []).map((c) => c.text || '').join('\n');
    if (call.result?.isError) {
      console.error('ERROR:', text);
      process.exit(1);
    }
    out(text);
  }

  out('โหมดไม่ถูกต้อง: ใช้ list | schema | call', 2);
} catch (err) {
  console.error('ล้มเหลว:', err.message);
  process.exit(1);
} finally {
  child.stdin.end();
  setTimeout(() => child.kill(), 300);
}
