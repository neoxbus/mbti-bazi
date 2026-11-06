// เครื่องมือช่วยเขียน HTML
export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// สีของคะแนนตามช่วง
export function scoreColor(score) {
  if (score >= 90) return '#4fd6a0';
  if (score >= 80) return '#7fd06a';
  if (score >= 68) return '#e6c07a';
  if (score >= 55) return '#e08b5a';
  return '#c96a6a';
}

export const BAND_TONE = {
  peak: 'peak',
  high: 'high',
  good: 'good',
  mixed: 'mixed',
  hard: 'hard',
};

export function scoreTone(score) {
  if (score >= 88) return 'peak';
  if (score >= 78) return 'high';
  if (score >= 66) return 'good';
  if (score >= 54) return 'mixed';
  return 'hard';
}

// วงแหวนคะแนน — ถ้ามีป้ายกำกับ จะให้วงสูงขึ้นและวางป้ายไว้ใต้วง ไม่ให้ทับเส้นวง
export function scoreRing(score, size = 64, label = '') {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dash = c * pct;
  // วงกลมอยู่กลางภาพเสมอ แล้วขยายพื้นที่ใต้วงไว้ให้ป้าย "/100"
  // ขอบล่างของเส้นวงคือ cy + r + ครึ่งความหนา = height/2 + size/2 - 4 + 3
  // ป้ายจึงต้องอยู่ต่ำกว่านั้นอย่างน้อย 6 พิกเซล
  const height = label ? size + 28 : size;
  const cy = height / 2;
  return `<svg class="ring" width="${size}" height="${height}" viewBox="0 0 ${size} ${height}" role="img" aria-label="คะแนน ${score} จาก 100">
    <circle class="ring-track" cx="${size / 2}" cy="${cy}" r="${r}" fill="none" stroke-width="6" />
    <circle class="ring-fill tone-${scoreTone(score)}" cx="${size / 2}" cy="${cy}" r="${r}" fill="none" stroke-width="6"
      stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}"
      transform="rotate(-90 ${size / 2} ${cy})" />
    <text x="50%" y="${cy}" text-anchor="middle" dy="0.36em" class="ring-text">${score}</text>
    ${label ? `<text x="50%" y="${height - 4}" text-anchor="middle" class="ring-sub">${esc(label)}</text>` : ''}
  </svg>`;
}

// แถบคะแนนแนวนอน
export function scoreBar(score) {
  return `<div class="bar" role="img" aria-label="คะแนน ${score} จาก 100">
    <span class="bar-fill tone-${scoreTone(score)}" style="width:${Math.max(0, Math.min(100, score))}%"></span>
  </div>`;
}

export function chip(text, { href, tone = '', extra = '' } = {}) {
  const cls = `chip ${tone} ${extra}`.trim();
  return href
    ? `<a class="${cls}" href="${href}">${text}</a>`
    : `<span class="${cls}">${text}</span>`;
}

export function elementDot(key, colors) {
  return `<span class="dot" style="background:${colors[key].color}"></span>`;
}
