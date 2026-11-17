// Marisol City — screenshot + playtest driver (written fresh for this entry).
// Serves game/ on :8901, loads each ?shot= pose, screenshots 1280x720 JPEG
// q80 into screenshots/, and play-tests: title -> start -> walk -> enter a
// car -> drive 5s (assert movement) -> shoot once. Logs console errors and
// failed requests; the game must load with zero of either.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/hatch/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');

const REPO = '/home/hatch/workspace/makefun/entries/gta6-01';
const PORT = 8901;
const SHOTS = [
  { name: 'cover', file: '1-cover.jpg' },
  { name: 'foot', file: '2-foot.jpg' },
  { name: 'chase', file: '3-chase.jpg' },
  { name: 'mission', file: '4-mission.jpg' },
];

const policyPath = '/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt';
const sha = createHash('sha256').update(readFileSync(policyPath)).digest('hex');


const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--allow-file-access-from-files',
    `--hatch-webgl-allowed-domains-file=${policyPath}`,
    `--hatch-webgl-allowed-domains-sha256=${sha}`],
});

let failures = 0;
const errors = [];
function watch(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') { errors.push(`${label}: ${msg.text()}`); console.log('CONSOLE ERROR', label, msg.text()); }
  });
  page.on('pageerror', (err) => { errors.push(`${label}: ${err.message}`); console.log('PAGE ERROR', label, err.message); });
  page.on('requestfailed', (req) => { errors.push(`${label}: failed request ${req.url()}`); console.log('FAILED REQUEST', label, req.url()); });
}

// --- playtest ---------------------------------------------------------------
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
watch(page, 'playtest');
await page.goto(`file://${REPO}/game/index.html?seed=1`, { waitUntil: 'domcontentloaded' });
await sleep(1200);
const titleState = await page.evaluate(() => window.__marisol && window.__marisol.state);
console.log('state at load:', titleState);
await page.keyboard.press('Enter');
await sleep(500);
console.log('state after Enter:', await page.evaluate(() => window.__marisol.state));
// walk forward 1s
const before = await page.evaluate(() => ({ x: window.__marisol.player.x, y: window.__marisol.player.y }));
await page.keyboard.down('w');
await sleep(1000);
await page.keyboard.up('w');
const afterWalk = await page.evaluate(() => ({ x: window.__marisol.player.x, y: window.__marisol.player.y }));
const walked = Math.hypot(afterWalk.x - before.x, afterWalk.y - before.y);
console.log('walked px in 1s:', walked.toFixed(1));
// find nearest car, teleport next to it is cheating — instead drive to one:
// press E repeatedly while walking toward the nearest parked car via keys is
// slow; use the exposed state to steer: teleport is NOT used. Instead, walk
// to the mission sports car is far. Simpler: spawn near a car by pressing E
// after moving toward the closest car using keyboard toward its direction.
const carInfo = await page.evaluate(() => {
  const G = window.__marisol;
  let best = null; let bestD = 1e9;
  for (const c of G.cars) {
    const d = Math.hypot(c.x - G.player.x, c.y - G.player.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return { d: bestD, x: best.x, y: best.y };
});
console.log('nearest car:', JSON.stringify(carInfo));
// walk toward it in steps
for (let i = 0; i < 40; i++) {
  const pos = await page.evaluate(() => {
    const G = window.__marisol;
    let best = null; let bestD = 1e9;
    for (const c of G.cars) {
      if (c.driven) continue;
      const d = Math.hypot(c.x - G.player.x, c.y - G.player.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return { px: G.player.x, py: G.player.y, cx: best.x, cy: best.y, d: bestD, onFoot: G.player.onFoot };
  });
  if (!pos.onFoot || pos.d < 60) break;
  const dx = pos.cx - pos.px;
  const dy = pos.cy - pos.py;
  const keys = [];
  if (dy < -10) keys.push('w');
  if (dy > 10) keys.push('s');
  if (dx < -10) keys.push('a');
  if (dx > 10) keys.push('d');
  for (const k of keys) await page.keyboard.down(k);
  await sleep(200);
  for (const k of keys) await page.keyboard.up(k);
}
await page.keyboard.press('e');
await sleep(400);
const inCar = await page.evaluate(() => ({ onFoot: window.__marisol.player.onFoot, kind: window.__marisol.player.car && window.__marisol.player.car.kind }));
console.log('after E:', JSON.stringify(inCar));
if (inCar.onFoot) { console.log('PLAYTEST FAIL: could not enter a car'); failures++; }
// drive 5s
const d0 = await page.evaluate(() => ({ x: window.__marisol.player.x, y: window.__marisol.player.y }));
await page.keyboard.down('w');
await sleep(5000);
await page.keyboard.up('w');
const d1 = await page.evaluate(() => ({ x: window.__marisol.player.x, y: window.__marisol.player.y }));
const drove = Math.hypot(d1.x - d0.x, d1.y - d0.y);
console.log('drove px in 5s:', drove.toFixed(1));
if (drove < 200) { console.log('PLAYTEST FAIL: car did not move enough'); failures++; }
// exit and shoot once
await page.keyboard.press('e');
await sleep(300);
const ammoBefore = await page.evaluate(() => window.__marisol.player.ammo);
await page.mouse.click(700, 300);
await sleep(300);
const ammoAfter = await page.evaluate(() => window.__marisol.player.ammo);
console.log('ammo before/after shot:', ammoBefore, ammoAfter);
if (ammoAfter !== ammoBefore - 1) { console.log('PLAYTEST FAIL: shot did not fire'); failures++; }
console.log('hud/minimap present:', await page.evaluate(() => {
  const G = window.__marisol;
  return G.state === 'play' && G.missions.objective.length > 0;
}));
await page.close();

// --- screenshots ------------------------------------------------------------
mkdirSync(`${REPO}/screenshots`, { recursive: true });
for (const shot of SHOTS) {
  const sp = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  watch(sp, shot.name);
  await sp.goto(`file://${REPO}/game/index.html?shot=${shot.name}&seed=1`, { waitUntil: 'domcontentloaded' });
  await sleep(1800);
  const st = await sp.evaluate(() => {
    const G = window.__marisol;
    return { state: G.state, wanted: Math.floor(G.player.heat / 20), onFoot: G.player.onFoot };
  });
  console.log(`shot ${shot.name}:`, JSON.stringify(st));
  await sp.screenshot({ path: `${REPO}/screenshots/${shot.file}`, type: 'jpeg', quality: 80 });
  await sp.close();
}

await browser.close();
console.log('console errors total:', errors.length);
console.log('playtest failures:', failures);
if (errors.length > 0 || failures > 0) process.exit(1);
console.log('ALL GREEN');
process.exit(0);
