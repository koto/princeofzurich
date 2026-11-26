// 5x7 bitmap font, rows encoded as base32 chars (5 bits per row, MSB = left pixel).
const G = {
  ' ': '0000000', A: 'ehhvhhh', B: 'uhhuhhu', C: 'ehggghe', D: 'uhhhhhu', E: 'vgguggv', F: 'vgguggg', G: 'ehgnhhf', H: 'hhhvhhh',
  I: 'e44444e', J: '72222ic', K: 'hikokih', L: 'ggggggv', M: 'hrlhhhh', N: 'hpljhhh', O: 'ehhhhhe', P: 'uhhuggg', Q: 'ehhhlid',
  R: 'uhhukih', S: 'fge11he', T: 'v444444', U: 'hhhhhhe', V: 'hhhaaa4', W: 'hhhllrh', X: 'hha4ahh', Y: 'hha4444', Z: 'v1248gv',
  Ä: 'a0ehvhh', Ö: 'a0ehhhe', Ü: 'a0hhhhe', É: '24vgugv', È: '84vgugv', À: '84ehvhh',
  0: 'ehjlphe', 1: '4c4444e', 2: 'eh1248v', 3: 'u11e11u', 4: '26aiv22', 5: 'vgu11he', 6: '68guhhe', 7: 'v124888', 8: 'ehhehhe', 9: 'ehhf12c',
  '.': '00000cc', ',': '0000c48', ':': '0cc0cc0', '!': '4444404', '?': 'eh12404', "'": 'c480000', '"': 'aa00000', '-': '000v000',
  '+': '044v440', '/': '11248gg', '(': '2488842', ')': '8422248', '%': 'op248j3', '=': '00v0v00', '<': '248g842', '>': '8421248',
  _: '000000v', '*': '04lel40', ';': '0cc0c48', '&': 'cdlgmhf',
};
const rows = {};
for (const k in G) rows[k] = [...G[k]].map((ch) => parseInt(ch, 32));

const KEEP = new Set(['Ä', 'Ö', 'Ü', 'É', 'È', 'À']);
export function norm(s) {
  let out = '';
  for (const ch of String(s).toUpperCase().replace(/[“”]/g, '"').replace(/’/g, "'").replace(/[—–]/g, '-')) {
    if (KEEP.has(ch)) out += ch;
    else out += ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  return out;
}
export function textWidth(s, sc = 1) { return norm(s).length * 6 * sc - sc; }
export function drawText(ctx, s, x, y, color = '#fff', sc = 1, align = 'left') {
  s = norm(s);
  if (align === 'center') x -= Math.floor(textWidth(s, sc) / 2); else if (align === 'right') x -= textWidth(s, sc);
  ctx.fillStyle = color;
  for (let i = 0; i < s.length; i++) {
    const g = rows[s[i]] || rows['?'];
    for (let r = 0; r < 7; r++) { const v = g[r]; if (!v) continue; for (let c = 0; c < 5; c++) if (v & (16 >> c)) ctx.fillRect(x + (i * 6 + c) * sc, y + r * sc, sc, sc); }
  }
}
export function wrap(s, max) {
  const out = []; let line = '';
  for (const w of norm(s).split(' ')) {
    if ((line + ' ' + w).trim().length > max) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line); return out;
}
