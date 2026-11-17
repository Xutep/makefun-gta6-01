// Marisol City — boot, fixed-timestep game loop, state machine.
// Top-down 2D open-world crime game. Vanilla JS, Canvas 2D, no libraries,
// no network. Seeded RNG only (?seed=N, ?shot=<name>&seed=1 for poses).

import { CFG } from './config.js';
import { makeRng } from './random.js';
import { generateWorld } from './world.js';
import { createInput, attachMouse, endFrame, wasPressed } from './input.js';
import { createPlayer, updatePlayerOnFoot, updatePlayerInCar } from './player.js';
import { makeCar, driveCar } from './vehicles.js';
import { spawnTraffic, spawnParked, updateTraffic } from './traffic.js';
import { spawnPeds, updatePeds, checkPedHits } from './pedestrians.js';
import { updatePolice, endPlayer } from './police.js';
import { spawnPickups, updateCombat } from './combat.js';
import { createMissions, startMission, updateMissions } from './missions.js';
import { createCamera, updateCamera, render } from './render.js';
import { drawHUD, drawTitle, drawPause, drawEndScreen } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { applyShot, holdShotWanted } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed')) || 1;
const shotName = params.get('shot');

const G = {
  ctx,
  viewW: 1280,
  viewH: 720,
  seed,
  shot: null,
  state: 'title',
  time: 0,
  clockMinutes: 8 * 60,
  rng: makeRng(seed),
  world: null,
  player: null,
  cars: [],
  police: [],
  peds: [],
  bullets: [],
  pickups: [],
  particles: [],
  missions: createMissions(),
  input: createInput(),
  camera: createCamera(),
  audio: createAudio(),
  save: loadSave(),
  stats: { bestWanted: 0 },
  toast: '',
  toastT: 0,
  pickupRespawn: 0,
  roadblockActive: false,
  dusk: false,
  missionCar: null,
  lastCrime: '',
  muted: false,
  saveT: 0,
};
window.__marisol = G;

attachMouse(G.input, canvas);

function resize() {
  const w = window.innerWidth || 1280;
  const h = window.innerHeight || 720;
  canvas.width = w;
  canvas.height = h;
  G.viewW = w;
  G.viewH = h;
}
window.addEventListener('resize', resize);
resize();

function setupDay() {
  G.rng = makeRng(seed);
  G.world = generateWorld(G.rng);
  G.cars = [];
  G.police = [];
  G.peds = [];
  G.bullets = [];
  G.pickups = [];
  G.particles = [];
  G.missions = createMissions();
  G.toast = '';
  G.toastT = 0;
  G.pickupRespawn = 0;
  G.roadblockActive = false;
  G.dusk = false;
  G.clockMinutes = 8 * 60;
  G.time = 0;

  const L = G.world.landmarks;
  G.player = createPlayer(L.playerSpawn);
  G.player.bestWantedThisRun = 0;
  if (G.save) {
    G.player.cash = G.save.cash;
    G.stats.bestWanted = G.save.bestWanted;
    G.muted = !!G.save.muted;
    G.audio.setMuted(G.muted);
  }

  // the red sports car for mission 2, parked uptown
  const mc = makeCar(L.sportsCarSpot.x, L.sportsCarSpot.y, Math.PI / 2, 'sports', '#e01e2b', { parked: true });
  G.missionCar = mc;
  G.cars.push(mc);

  spawnTraffic(G);
  spawnParked(G);
  spawnPeds(G);
  spawnPickups(G);

  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  startMission(G, 0);
}

function restartDay() {
  setupDay();
  G.state = 'play';
  G.audio.unlock();
}

function update(dt) {
  const input = G.input;
  const p = G.player;

  // mouse position in world space (for aiming)
  const cam = G.camera;
  input.mouse.worldX = (input.mouse.x - G.viewW / 2) / cam.zoom + cam.x;
  input.mouse.worldY = (input.mouse.y - G.viewH / 2) / cam.zoom + cam.y;

  // global keys
  if (wasPressed(input, 'm')) {
    G.muted = !G.muted;
    G.audio.setMuted(G.muted);
    G.toast = G.muted ? 'SOUND OFF' : 'SOUND ON';
    G.toastT = 1.5;
  }
  if (wasPressed(input, 'c')) {
    cam.targetZoom = cam.targetZoom > 1 ? 0.75 : 1.15;
  }

  if (G.state === 'title') {
    if (wasPressed(input, 'Enter', 'enter') || input.anyKey && input.mouse.clicked) {
      G.state = 'play';
      G.audio.unlock();
      input.anyKey = false;
    }
    return;
  }

  if (G.state === 'pause') {
    if (wasPressed(input, 'Escape', 'escape', 'p')) G.state = 'play';
    if (wasPressed(input, 'r')) restartDay();
    return;
  }

  if (G.state === 'busted' || G.state === 'wasted') {
    if (wasPressed(input, 'r')) restartDay();
    return;
  }

  if (G.state === 'complete') {
    // free roam continues behind the screen; R restarts the day
    if (wasPressed(input, 'r')) restartDay();
    updatePlay(dt);
    return;
  }

  // play
  if (wasPressed(input, 'Escape', 'escape', 'p')) {
    G.state = 'pause';
    return;
  }
  updatePlay(dt);
}

function updatePlay(dt) {
  const p = G.player;
  const input = G.input;

  // clock: one game minute every 2 real seconds
  G.clockMinutes += dt * 0.5;

  if (p.onFoot) {
    updatePlayerOnFoot(G, dt);
  } else {
    let throttle = 0;
    // chase poses keep driving on their own — nobody holds W in a screenshot
    if (G.shot === 'cover' || G.shot === 'chase') throttle = 1;
    if (input.keys.has('w') || input.keys.has('arrowup')) throttle += 1;
    if (input.keys.has('s') || input.keys.has('arrowdown')) throttle -= 1;
    if (throttle > 1) throttle = 1;
    let steer = 0;
    if (input.keys.has('a') || input.keys.has('arrowleft')) steer -= 1;
    if (input.keys.has('d') || input.keys.has('arrowright')) steer += 1;
    driveCar(G, p.car, throttle, steer, input.keys.has(' '), dt);
    updatePlayerInCar(G, dt);
  }

  updateTraffic(G, dt);
  updatePeds(G, dt);
  checkPedHits(G);
  updatePolice(G, dt);
  updateCombat(G, dt);
  updateMissions(G, dt);
  updateCamera(G, dt);

  // engine hum follows the player's car
  const driving = !p.onFoot && p.car;
  G.audio.engine(driving ? Math.abs(p.car.speed) / p.car.maxSpeed : 0, !!driving);

  // busted on foot: a cop stood next to the player too long
  if (p.bustedTimer > 1.2) {
    p.bustedTimer = 0;
    endPlayer(G, 'busted');
  }
  if (p.health <= 0 && G.state === 'play') {
    endPlayer(G, 'wasted');
  }

  if (G.toastT > 0) G.toastT -= dt;
  if (G.shot) holdShotWanted(G);
  // autosave at most every 5s of play (localStorage write each frame is wasteful)
  G.saveT += dt;
  if (G.state === 'play' && G.saveT > 5) {
    G.saveT = 0;
    writeSave(G);
  }
}

const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 5) {
    G.time += STEP;
    update(STEP);
    acc -= STEP;
    n++;
  }
  // render the current state
  if (G.state === 'title') {
    render(G);
    drawTitle(G);
  } else if (G.state === 'pause') {
    render(G);
    drawHUD(G);
    drawPause(G);
  } else if (G.state === 'busted' || G.state === 'wasted') {
    render(G);
    drawEndScreen(G, G.state);
  } else if (G.state === 'complete') {
    render(G);
    drawHUD(G);
    drawEndScreen(G, 'complete');
  } else {
    render(G);
    drawHUD(G);
  }
  endFrame(G.input);
  requestAnimationFrame(frame);
}

setupDay();
if (shotName) applyShot(G, shotName);
requestAnimationFrame(frame);
