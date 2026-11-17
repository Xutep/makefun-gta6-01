// Marisol City — car physics, entering/exiting, stealing. Arcade model:
// accelerate / brake-reverse / steer scaled by speed, handbrake drift,
// building collision with a bounce, car-car soft collision.

import { CFG } from './config.js';
import { hitBuilding, clampToWorld, dist } from './world.js';

let nextCarId = 1;

export function makeCar(x, y, angle, kind, color, opts = {}) {
  const maxSpeed =
    kind === 'sports' ? CFG.sportsMax
    : kind === 'police' ? CFG.policeMax
    : kind === 'truck' ? CFG.truckMax
    : CFG.carMax;
  return {
    id: nextCarId++,
    x, y, angle,
    speed: 0,
    kind, // 'sedan' | 'sports' | 'taxi' | 'truck' | 'police'
    color,
    w: kind === 'truck' ? 52 : 44,
    h: kind === 'truck' ? 22 : 20,
    maxSpeed,
    parked: !!opts.parked,
    driven: false,
    ai: opts.ai || null, // 'traffic' | 'police' | null
    targetSpeed: 0,
    steer: 0,
    health: 100,
    siren: kind === 'police',
    // police pursuit state
    ramCooldown: 0,
    // traffic state
    vertical: opts.vertical ?? true,
    turnCooldown: 0,
    stopped: 0,
  };
}

// Drive one car with inputs: throttle -1..1, steer -1..1, handbrake bool.
export function driveCar(G, car, throttle, steer, handbrake, dt) {
  const prevX = car.x;
  const prevY = car.y;

  if (throttle > 0) car.speed += CFG.carAccel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 5) car.speed -= CFG.carBrake * dt;
    else car.speed -= CFG.carAccel * 0.6 * dt;
  }
  const drag = handbrake ? CFG.handbrakeDrag : CFG.drag;
  car.speed -= car.speed * drag * dt;
  if (car.speed > car.maxSpeed) car.speed = car.maxSpeed;
  if (car.speed < -CFG.carMaxReverse) car.speed = -CFG.carMaxReverse;
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;

  const speedRatio = Math.min(1, Math.abs(car.speed) / car.maxSpeed);
  const steerAmount = steer * CFG.steerRate * speedRatio * (car.speed < 0 ? -1 : 1);
  car.angle += steerAmount * dt * (handbrake ? 1.5 : 1);

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // Building collision: slide back and bounce.
  const hit = hitBuilding(G.world, car.x, car.y, 20);
  if (hit) {
    car.x = prevX;
    car.y = prevY;
    if (Math.abs(car.speed) > 120) {
      addCrash(G, car.x, car.y);
      if (car.driven) G.audio.crash();
    }
    car.speed *= -0.35;
  }
  const c = clampToWorld(car.x, car.y, 40);
  if (c.x !== car.x || c.y !== car.y) {
    car.x = c.x;
    car.y = c.y;
    car.speed *= 0.5;
  }
  return car;
}

export function addCrash(G, x, y) {
  for (let i = 0; i < 10; i++) {
    G.particles.push({
      x, y,
      vx: G.rng.range(-120, 120), vy: G.rng.range(-120, 120),
      life: G.rng.range(0.3, 0.7), maxLife: 0.7,
      color: '#ffcf5a', size: G.rng.range(2, 5),
    });
  }
}

export function nearestCar(G, x, y, maxDist, filter) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (filter && !filter(car)) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// Enter the nearest car. Stealing a civilian car in view of a ped or cop
// raises heat. Returns the car or null.
export function enterCar(G, car) {
  const p = G.player;
  const witnessed = car.kind !== 'police' && (
    G.peds.some((ped) => dist(ped.x, ped.y, car.x, car.y) < 320) ||
    G.police.some((cop) => dist(cop.x, cop.y, car.x, car.y) < 320)
  );
  if (car.parked) {
    car.parked = false;
    if (witnessed) {
      addHeat(G, 20, 'car theft witnessed');
    }
  }
  car.driven = true;
  car.ai = null;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  return car;
}

export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.driven = false;
  car.speed = 0;
  // step out to the side of the car
  const side = Math.PI / 2;
  p.x = car.x + Math.cos(car.angle + side) * 34;
  p.y = car.y + Math.sin(car.angle + side) * 34;
  const b = hitBuilding(G.world, p.x, p.y, 12);
  if (b) {
    p.x = car.x + Math.cos(car.angle - side) * 34;
    p.y = car.y + Math.sin(car.angle - side) * 34;
  }
  const c = clampToWorld(p.x, p.y, 20);
  p.x = c.x; p.y = c.y;
  p.angle = car.angle;
  p.car = null;
  p.onFoot = true;
}

export function addHeat(G, amount, reason) {
  G.player.heat = Math.min(100, G.player.heat + amount);
  const wanted = Math.floor(G.player.heat / CFG.heatPerStar);
  if (wanted > G.stats.bestWanted) G.stats.bestWanted = wanted;
  if (reason) G.lastCrime = reason;
}
