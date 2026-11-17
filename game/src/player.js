// Marisol City — on-foot player: walk/run, punch, enter/exit cars, pickups,
// health. Movement is blocked by buildings and world bounds.

import { CFG } from './config.js';
import { hitBuilding, clampToWorld, dist } from './world.js';
import { enterCar, exitCar, nearestCar } from './vehicles.js';

export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    angle: -Math.PI / 2,
    onFoot: true,
    car: null,
    health: CFG.startHealth,
    cash: CFG.startCash,
    ammo: CFG.startAmmo,
    heat: 0,
    speed: 0,
    moving: false,
    punchCooldown: 0,
    shootCooldown: 0,
    hurtCooldown: 0,
    bustedTimer: 0,
  };
}

export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  let dx = 0;
  let dy = 0;
  if (input.keys.has('w') || input.keys.has('arrowup')) dy -= 1;
  if (input.keys.has('s') || input.keys.has('arrowdown')) dy += 1;
  if (input.keys.has('a') || input.keys.has('arrowleft')) dx -= 1;
  if (input.keys.has('d') || input.keys.has('arrowright')) dx += 1;

  const running = input.keys.has('shift');
  const speed = running ? CFG.runSpeed : CFG.walkSpeed;
  p.moving = dx !== 0 || dy !== 0;
  if (p.moving) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    const nx = p.x + dx * speed * dt;
    const ny = p.y + dy * speed * dt;
    // axis-separated collision so the player slides along walls
    if (!hitBuilding(G.world, nx, p.y, 12)) p.x = nx;
    if (!hitBuilding(G.world, p.x, ny, 12)) p.y = ny;
    const c = clampToWorld(p.x, p.y, 20);
    p.x = c.x;
    p.y = c.y;
    p.angle = Math.atan2(dy, dx);
  }

  // face the mouse only while actually aiming (mouse held)
  if (input.mouse.down) {
    const wx = input.mouse.worldX;
    const wy = input.mouse.worldY;
    if (dist(p.x, p.y, wx, wy) > 30) p.angle = Math.atan2(wy - p.y, wx - p.x);
  }

  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (p.hurtCooldown > 0) p.hurtCooldown -= dt;

  // E: enter nearest car
  if (input.pressed.has('e')) {
    const car = nearestCar(G, p.x, p.y, CFG.interactRange + 30, (c) => !c.driven);
    if (car) {
      enterCar(G, car);
      G.audio.pickup();
    }
  }
}

export function updatePlayerInCar(G, dt) {
  const p = G.player;
  const car = p.car;
  const input = G.input;
  let throttle = 0;
  if (input.keys.has('w') || input.keys.has('arrowup')) throttle += 1;
  if (input.keys.has('s') || input.keys.has('arrowdown')) throttle -= 1;
  let steer = 0;
  if (input.keys.has('a') || input.keys.has('arrowleft')) steer -= 1;
  if (input.keys.has('d') || input.keys.has('arrowright')) steer += 1;
  const handbrake = input.keys.has(' ');

  // driving handled by vehicles.driveCar in main update; keep player synced
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = car.speed;

  if (input.pressed.has('e')) exitCar(G);
  if (p.hurtCooldown > 0) p.hurtCooldown -= dt;
}

// Damage the player (from police rams, bullets, crashes). Returns true if dead.
export function hurtPlayer(G, dmg) {
  const p = G.player;
  if (p.hurtCooldown > 0 || G.state !== 'play') return false;
  p.health -= dmg;
  p.hurtCooldown = 0.5;
  if (p.health <= 0) {
    p.health = 0;
    return true;
  }
  return false;
}
