// Marisol City — boot, game loop (fixed timestep), state machine.
// Entry point: game/src/main.js, loaded as a module from game/index.html.
import { AVENUES, STREETS, DAY_LENGTH_SECONDS, PLAYER } from './config.js';
import { makeRng, clamp } from './random.js';
import { generateWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { createPlayer, updatePlayer } from './player.js';
import { driveCar, exitCar, makeCar } from './vehicles.js';
import { spawnTraffic, spawnParked, updateTraffic } from './traffic.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { addWanted, updatePolice, clearPolice } from './police.js';
import { punch, shoot, updateBullets, damagePlayer, spawnPickups } from './combat.js';
import { createMissionState, updateMissions } from './missions.js';
import { createCamera, updateCamera, render } from './render.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed')) || 20261117;
const shotName = params.get('shot') || '';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const rng = makeRng(seed);
const world = generateWorld(rng);

const game = {
  rng,
  world,
  worldAvenues: AVENUES,
  worldStreets: STREETS,
  input: createInput(canvas),
  audio: createAudio(),
  ctx,
  camera: createCamera(),
  screen: 'title',
  time: 0,
  clock: 8 * 3600,
  cash: 250,
  wanted: 0,
  wantedTimer: 0,
  bestWanted: 0,
  missionsDone: 0,
  mission: null,
  missionCar: null,
  player: null,
  cars: [],
  peds: [],
  police: [],
  roadblocks: [],
  bullets: [],
  pickups: [],
  effects: [],
  gunshotTimer: 0,
  muzzle: 0,
  toast: null,
  toastTimer: 0,
  dialog: null,
  dusk: false,
  frozen: false,
  zoomOut: false,
  blink: true,
  blinkTimer: 0,
  ePressed: false,
  cPressed: false,
  mPressed: false,
  escPressed: false,
  enterPressed: false,
  saveData: loadSave(),
  deathCause: '',
  viewW: canvas.width,
  viewH: canvas.height,
  addWanted(stars, reason) { addWanted(game, stars, reason); },
  showToast(text) { game.toast = text; game.toastTimer = 3.2; },
  showDialog(text) { game.dialog = text; },
  clearDialog() { game.dialog = null; },
  spawnEffect(x, y, kind) { game.effects.push({ x, y, kind, life: 0.5, max: 0.5 }); },
  punch(g) { punch(g); },
  shoot(g) { shoot(g); },
  damagePlayer(amount, cause) { damagePlayer(game, amount, cause); },
  busted() {
    if (game.screen !== 'playing') return;
    game.screen = 'busted';
    clearPolice(game);
    game.audio.sfx('crash');
    game.audio.stopMusic();
    writeSave(game);
  },
  gameOver(cause) {
    game.deathCause = cause;
    game.screen = 'gameover';
    clearPolice(game);
    game.audio.stopMusic();
    writeSave(game);
  },
  clockText() {
    const total = Math.floor(game.clock);
    const h = Math.floor(total / 3600) % 24;
    const m = Math.floor((total % 3600) / 60);
    const sun = h >= 6 && h < 18 ? '☀' : '☾';
    return `${sun} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}  ·  Day 1`;
  },
  screenToWorld(sx, sy) {
    const cam = game.camera;
    return { x: cam.x + sx / cam.zoom, y: cam.y + sy / cam.zoom };
  },
};

game.player = createPlayer(world.spawns.player);
game.mission = createMissionState(game);
// Exposed for automated play-tests (Playwright) only; the game never reads it.
window.__game = game;
if (game.saveData) {
  game.missionsDone = game.saveData.missionsDone || 0;
  game.cash = game.saveData.cash ?? 250;
  game.bestWanted = game.saveData.bestWanted || 0;
  if (game.saveData.muted) game.audio.muted = true;
}

spawnTraffic(game, 14);
spawnParked(game, 10);
spawnPeds(game, 26);
spawnPickups(game);
// The player's own starter car, parked on the avenue just south of the spawn.
const starter = makeCar(world.spawns.player.x, world.spawns.player.y + 140, Math.PI / 2, '#3fae6a', 'sedan', true);
starter.civilianOwned = false;
game.cars.push(starter);

if (shotName) {
  applyShot(game, shotName);
  game.audio.muted = true;
}

function update(dt) {
  game.time += dt;
  game.blinkTimer += dt;
  if (game.blinkTimer > 0.6) {
    game.blinkTimer = 0;
    game.blink = !game.blink;
  }
  game.viewW = canvas.width;
  game.viewH = canvas.height;
  const input = game.input;
  // Global keys (edge-triggered so quick taps always register).
  if (input.wasPressed('KeyM')) {
    game.audio.ensure();
    game.audio.toggleMute();
    game.showToast(game.audio.muted ? 'Muted' : 'Sound on');
  }
  if (input.wasPressed('KeyC')) game.zoomOut = !game.zoomOut;
  if (input.wasPressed('Escape')) {
    if (game.screen === 'playing') game.screen = 'paused';
    else if (game.screen === 'paused') game.screen = 'playing';
  }

  if (game.screen === 'title') {
    if (input.wasPressed('Enter')) {
      game.audio.ensure();
      game.audio.startMusic();
      game.screen = 'playing';
    }
    updateCamera(game, dt);
    return;
  }
  if (game.screen === 'paused') {
    if (input.wasPressed('Enter')) game.screen = 'playing';
    return;
  }
  if (game.screen === 'busted' || game.screen === 'gameover' || game.screen === 'complete') {
    if (input.wasPressed('Enter')) resetRun();
    return;
  }
  if (game.screen !== 'playing') return;
  if (game.frozen) {
    updateCamera(game, dt);
    return;
  }

  // Clock: a full day every DAY_LENGTH_SECONDS of play.
  game.clock = (game.clock + dt * (86400 / DAY_LENGTH_SECONDS)) % 86400;
  game.gunshotTimer = Math.max(0, game.gunshotTimer - dt);
  game.muzzle = Math.max(0, game.muzzle - dt);
  if (game.toastTimer > 0) {
    game.toastTimer -= dt;
    if (game.toastTimer <= 0) game.toast = null;
  }
  game.effects = game.effects.filter((fx) => (fx.life -= dt) > 0);

  const p = game.player;
  if (p.inCar) {
    driveCar(p.inCar, input, dt, game);
    if (input.wasPressed('KeyE')) exitCar(game);
  } else {
    updatePlayer(game, dt);
  }
  updateTraffic(game, dt);
  updatePeds(game, dt);
  updatePolice(game, dt);
  updateBullets(game, dt);
  updateMissions(game, dt);
  updateCamera(game, dt);
  if (game.mission.done && game.screen === 'playing') {
    game.screen = 'complete';
    game.audio.stopMusic();
    writeSave(game);
  }
}

function resetRun() {
  const p = game.player;
  p.health = PLAYER.maxHealth;
  p.ammo = PLAYER.pistolAmmo;
  p.inCar = null;
  p.x = game.world.spawns.player.x;
  p.y = game.world.spawns.player.y;
  game.wanted = 0;
  game.mission = createMissionState(game);
  game.missionCar = null;
  clearPolice(game);
  game.bullets = [];
  game.screen = 'playing';
  game.audio.ensure();
  game.audio.startMusic();
}

// Fixed timestep: 60 Hz simulation, render every frame.
let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  let guard = 0;
  while (acc >= STEP && guard < 5) {
    update(STEP);
    acc -= STEP;
    guard += 1;
  }
  render(game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
