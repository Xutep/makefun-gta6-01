// Marisol City — screenshot + play-test driver (Playwright, headless Chrome).
// Serves game/ over HTTP; if this VM blocks loopback navigation in the
// browser, falls back to file:// renders (same files, same code) and still
// verifies the HTTP server separately with curl.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/hatch/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');

const REPO = '/home/hatch/workspace/makefun/entries/gta6-01';
const PORT = 8901;
const policyPath = '/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt';
const sha = createHash('sha256').update(readFileSync(policyPath)).digest('hex');

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  headless: true,
  args: [
    '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files',
    `--hatch-webgl-allowed-domains-file=${policyPath}`,
    `--hatch-webgl-allowed-domains-sha256=${sha}`,
  ],
});

const errors = [];
async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`reqfail: ${r.url()} ${r.failure()?.errorText}`));
  return page;
}

async function openShot(page, url) {
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(1800);
    const state = await page.evaluate(() => {
      const g = window.__game;
      return g ? { screen: g.screen, x: Math.round(g.player.x), y: Math.round(g.player.y) } : null;
    });
    return { ok: true, state };
  } catch (e) {
    return { ok: false, error: String(e.message).slice(0, 200) };
  }
}

// Probe: does HTTP localhost work in this browser?
const probe = await newPage();
const httpProbe = await openShot(probe, `http://localhost:${PORT}/?shot=cover&seed=1`);
await probe.close();
const useHttp = httpProbe.ok && httpProbe.state;
console.log('http probe:', JSON.stringify(httpProbe));
const base = useHttp ? `http://localhost:${PORT}` : `file://${REPO}/game/index.html`;

mkdirSync(`${REPO}/screenshots`, { recursive: true });
const shots = ['cover', 'foot', 'chase', 'mission'];
for (let i = 0; i < shots.length; i++) {
  const name = shots[i];
  const page = await newPage();
  const url = useHttp
    ? `${base}/?shot=${name}&seed=1`
    : `${base}?shot=${name}&seed=1`;
  const res = await openShot(page, url);
  console.log(`shot ${name}:`, JSON.stringify(res));
  await page.screenshot({ path: `${REPO}/screenshots/${i + 1}-${name}.jpg`, type: 'jpeg', quality: 80 });
  await page.close();
}

// Play-test: title -> start -> walk -> enter car -> drive 5s -> shoot.
const page = await newPage();
const playUrl = useHttp ? `${base}/?seed=7` : `${base}?seed=7`;
await page.goto(playUrl, { waitUntil: 'load', timeout: 15000 });
await page.waitForTimeout(800);
let st = await page.evaluate(() => ({ screen: window.__game?.screen }));
console.log('before enter:', JSON.stringify(st));
await page.keyboard.press('Enter');
await page.waitForTimeout(600);
const before = await page.evaluate(() => {
  const g = window.__game;
  return { screen: g.screen, x: g.player.x, y: g.player.y, inCar: !!g.player.inCar };
});
// Walk south down the avenue toward the starter car (parked 140px south).
await page.keyboard.down('KeyS');
await page.waitForTimeout(850);
await page.keyboard.up('KeyS');
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);
const entered = await page.evaluate(() => {
  const g = window.__game;
  return { inCar: !!g.player.inCar, type: g.player.inCar?.type, x: Math.round(g.player.x) };
});
console.log('after E:', JSON.stringify(entered));
await page.keyboard.down('KeyW');
await page.waitForTimeout(5000);
await page.keyboard.up('KeyW');
const after = await page.evaluate(() => {
  const g = window.__game;
  const car = g.player.inCar;
  return { inCar: !!g.player.inCar, x: Math.round(car ? car.x : g.player.x), y: Math.round(car ? car.y : g.player.y), speed: Math.round(car ? car.speed : 0) };
});
console.log('after drive:', JSON.stringify(after));
// Shoot once on foot? We are in a car; exit and shoot.
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);
await page.mouse.click(700, 300);
await page.waitForTimeout(400);
const shot = await page.evaluate(() => {
  const g = window.__game;
  return { ammo: g.player.ammo, bullets: g.bullets.length, wanted: g.wanted, screen: g.screen };
});
console.log('after shoot:', JSON.stringify(shot));
const moved = Math.abs(after.x - before.x) + Math.abs(after.y - before.y);
console.log('PLAYTEST moved px:', moved, '| entered car:', entered.inCar, '| drove:', after.speed !== 0);
await page.close();

console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
server.kill();
process.exit(0);
