#!/usr/bin/env node
// tools/anim-sheet.mjs
// Reusable CLI harness: serves the repo on an ephemeral free port, captures
// tools/anim-sheet.html at 2400x1350 via headless Chrome to the given PNG path,
// and cleanly shuts down the server.
//
// Usage: node tools/anim-sheet.mjs anim/run-v0.png

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sampleRunKinematics } from '../src/character.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ---------------------------------------------------------------------------
// Automated Run-Cycle Arm & Gait Kinematics Check (from ACTUAL drawCharacter joints!)
// ---------------------------------------------------------------------------
function verifyRunCycleKinematics(reportPath = null) {
  const frames = [];
  for (let i = 0; i < 12; i++) {
    frames.push(sampleRunKinematics(i / 12));
  }

  const lines = [];
  lines.push('Run-cycle kinematics read back from actual drawCharacter() rendered joints (12 frames):');
  lines.push(' F |   u   | nearUA  farUA | nInt  fInt | nThigh fThigh | nAnk  fAnk | nElbRel fElbRel | nW-Back nW-Frnt | fW-Back fW-Frnt | nElb-Bk fElb-Bk | nLowY fLowY');
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const rRel = (f.rElbow.x - f.rShoulder.x) / f.upperArmLen;
    const lRel = (f.lElbow.x - f.lShoulder.x) / f.upperArmLen;
    const nInt = 180 - f.rElbowFlex;
    const fInt = 180 - f.lElbowFlex;
    const p = (v, w = 6) => v.toFixed(1).padStart(w);
    const p2 = (v, w = 7) => v.toFixed(2).padStart(w);
    lines.push(
      `${String(i + 1).padStart(2)} | ${f.u.toFixed(3)} | ` +
      `${p(f.rUpperDeg)} ${p(f.lUpperDeg)} | ${p(nInt, 5)} ${p(fInt, 5)} | ` +
      `${p(f.rThighDeg)} ${p(f.lThighDeg)} | ${p(f.rAnkleIntDeg, 5)} ${p(f.lAnkleIntDeg, 5)} | ${p2(rRel)} ${p2(lRel)} | ` +
      `${p2(f.rHand.x - f.torsoBackX)} ${p2(f.rHand.x - f.torsoFrontX)} | ` +
      `${p2(f.lHand.x - f.torsoBackX)} ${p2(f.lHand.x - f.torsoFrontX)} | ` +
      `${p2(f.rElbow.x - f.torsoBackX)} ${p2(f.lElbow.x - f.torsoBackX)} | ` +
      `${p(f.rFootLowestY, 5)} ${p(f.lFootLowestY, 5)}`
    );
  }
  const reportText = lines.join('\n') + '\n';
  process.stdout.write(reportText);
  if (reportPath) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, reportText, 'utf8');
    console.log(`Wrote kinematics report ${reportPath}`);
  }

  const failures = [];

  // (a) Each elbow x goes >= 0.5 upper-arm lengths behind its shoulder at some frame
  //     and >= 0.35 upper-arm lengths in front at another (compact +25° forward peak!)
  const rRels = frames.map((f) => (f.rElbow.x - f.rShoulder.x) / f.upperArmLen);
  const lRels = frames.map((f) => (f.lElbow.x - f.lShoulder.x) / f.upperArmLen);
  if (Math.min(...rRels) > -0.5) failures.push(`(a) rElbow min behind shoulder = ${Math.min(...rRels).toFixed(2)}L (need <= -0.50L)`);
  if (Math.max(...rRels) < 0.35) failures.push(`(a) rElbow max in front of shoulder = ${Math.max(...rRels).toFixed(2)}L (need >= +0.35L)`);
  if (Math.min(...lRels) > -0.5) failures.push(`(a) lElbow min behind shoulder = ${Math.min(...lRels).toFixed(2)}L (need <= -0.50L)`);
  if (Math.max(...lRels) < 0.35) failures.push(`(a) lElbow max in front of shoulder = ${Math.max(...lRels).toFixed(2)}L (need >= +0.35L)`);

  // (b) The two upper-arm angles are opposite in sign (within 3° tolerance near 0) in every frame
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (Math.abs(f.rUpperDeg) > 3 && Math.abs(f.lUpperDeg) > 3 && f.rUpperDeg * f.lUpperDeg >= 0) {
      failures.push(`(b) Frame ${i + 1}: rUA=${f.rUpperDeg.toFixed(1)}° and lUA=${f.lUpperDeg.toFixed(1)}° are NOT opposite in sign`);
    }
  }

  // (c) Each arm's angle is opposite in sign to the same-side thigh angle at the swing peaks
  const rFwdPeakIdx = frames.reduce((bi, f, i) => (f.rUpperDeg > frames[bi].rUpperDeg ? i : bi), 0);
  const rBackPeakIdx = frames.reduce((bi, f, i) => (f.rUpperDeg < frames[bi].rUpperDeg ? i : bi), 0);
  const lFwdPeakIdx = frames.reduce((bi, f, i) => (f.lUpperDeg > frames[bi].lUpperDeg ? i : bi), 0);
  const lBackPeakIdx = frames.reduce((bi, f, i) => (f.lUpperDeg < frames[bi].lUpperDeg ? i : bi), 0);
  if (frames[rFwdPeakIdx].rUpperDeg * frames[rFwdPeakIdx].rThighDeg >= 0) {
    failures.push(`(c) rArm fwd peak (F${rFwdPeakIdx + 1}): rUA=${frames[rFwdPeakIdx].rUpperDeg.toFixed(1)}° vs rThigh=${frames[rFwdPeakIdx].rThighDeg.toFixed(1)}°`);
  }
  if (frames[rBackPeakIdx].rUpperDeg * frames[rBackPeakIdx].rThighDeg >= 0) {
    failures.push(`(c) rArm back peak (F${rBackPeakIdx + 1}): rUA=${frames[rBackPeakIdx].rUpperDeg.toFixed(1)}° vs rThigh=${frames[rBackPeakIdx].rThighDeg.toFixed(1)}°`);
  }
  if (frames[lFwdPeakIdx].lUpperDeg * frames[lFwdPeakIdx].lThighDeg >= 0) {
    failures.push(`(c) lArm fwd peak (F${lFwdPeakIdx + 1}): lUA=${frames[lFwdPeakIdx].lUpperDeg.toFixed(1)}° vs lThigh=${frames[lFwdPeakIdx].lThighDeg.toFixed(1)}°`);
  }
  if (frames[lBackPeakIdx].lUpperDeg * frames[lBackPeakIdx].lThighDeg >= 0) {
    failures.push(`(c) lArm back peak (F${lBackPeakIdx + 1}): lUA=${frames[lBackPeakIdx].lUpperDeg.toFixed(1)}° vs lThigh=${frames[lBackPeakIdx].lThighDeg.toFixed(1)}°`);
  }

  // (d) Interior elbow angle breathes smoothly within [62°, 112°] (closed 65-75° forward, open 100-110° back)
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const nInt = 180 - f.rElbowFlex;
    const fInt = 180 - f.lElbowFlex;
    if (nInt < 62 || nInt > 112) {
      failures.push(`(d) Frame ${i + 1}: near interior elbow=${nInt.toFixed(1)}° outside [62, 112]`);
    }
    if (fInt < 62 || fInt > 112) {
      failures.push(`(d) Frame ${i + 1}: far interior elbow=${fInt.toFixed(1)}° outside [62, 112]`);
    }
  }

  // (e) Wrist is NEVER more than 0.9 forearm lengths in front of the torso's front line (compact, zero reaching!)
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const foreLen = f.foreArmLen || 4.3;
    const maxAhead = 0.90 * foreLen;
    if (f.rHand.x - f.torsoFrontX > maxAhead) {
      failures.push(`(e) Frame ${i + 1}: near wrist is ${(f.rHand.x - f.torsoFrontX).toFixed(2)}px ahead of torso front (max ${maxAhead.toFixed(2)}px = 0.9L_fore)`);
    }
    if (f.lHand.x - f.torsoFrontX > maxAhead) {
      failures.push(`(e) Frame ${i + 1}: far wrist is ${(f.lHand.x - f.torsoFrontX).toFixed(2)}px ahead of torso front (max ${maxAhead.toFixed(2)}px = 0.9L_fore)`);
    }
  }

  // (f) Back-swinging elbow protrudes clearly behind torso back line for BOTH near and far arms
  const minNearElbBk = Math.min(...frames.map((f) => f.rElbow.x - f.torsoBackX));
  const minFarElbBk = Math.min(...frames.map((f) => f.lElbow.x - f.torsoBackX));
  if (minNearElbBk > -1.2) failures.push(`(f) near back elbow min behind torsoBackX = ${minNearElbBk.toFixed(2)}px (need <= -1.20px)`);
  if (minFarElbBk > -1.2) failures.push(`(f) far back elbow min behind torsoBackX = ${minFarElbBk.toFixed(2)}px (need <= -1.20px)`);

  if (failures.length > 0) {
    console.error('RUN KINEMATICS CHECK FAILED:');
    for (const msg of failures) console.error('  -', msg);
    process.exit(1);
  }
  console.log('RUN KINEMATICS CHECK PASSED (a, b, c, d, e, f all satisfied).');
}

// Parse CLI args: node tools/anim-sheet.mjs <out.png> [--bones] [--report <path.txt>]
const cliArgs = process.argv.slice(2);
let outArg = null;
let bonesMode = false;
let reportArg = null;
for (let i = 0; i < cliArgs.length; i++) {
  if (cliArgs[i] === '--bones') {
    bonesMode = true;
  } else if (cliArgs[i] === '--report' && i + 1 < cliArgs.length) {
    reportArg = cliArgs[++i];
  } else if (!outArg) {
    outArg = cliArgs[i];
  }
}
if (!outArg) {
  console.error('Usage: node tools/anim-sheet.mjs <output-png-path> [--bones] [--report <txt-path>]');
  process.exit(1);
}
if (outArg.endsWith('-bones.png')) bonesMode = true;
const outPath = path.isAbsolute(outArg) ? outArg : path.resolve(ROOT, outArg);
const reportPath = reportArg ? (path.isAbsolute(reportArg) ? reportArg : path.resolve(ROOT, reportArg)) : null;

verifyRunCycleKinematics(reportPath);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const full = path.resolve(ROOT, rel);
  if (!full.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(full);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/tools/anim-sheet.html${bonesMode ? '?bones=1' : ''}`;

try {
  await execFileAsync(CHROME, [
    '--headless=new',
    '--hide-scrollbars',
    '--window-size=2400,1350',
    '--virtual-time-budget=4000',
    `--screenshot=${outPath}`,
    url,
  ], { maxBuffer: 10 * 1024 * 1024 });
  console.log(`Captured ${outPath}`);
} finally {
  server.close();
}
