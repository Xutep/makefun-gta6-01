// Marisol City — car physics, entering/exiting, stealing.
// A car is { x, y, angle, speed, color, type, parked, stolen, driver, id }.
import { CAR, COLORS, WORLD_W, WORLD_H } from './config.js';
import { clamp, dist } from './random.js';
import { pointInBuilding } from './world.js';

let nextId = 1;

export function makeCar(x, y, angle, color, type = 'sedan', parked = false) {
  return {
    id: nextId++,
    x, y, angle, speed: 0,
    color: color || COLORS.car[0],
    type,
    parked,
    stolen: false,
    driver: parked ? null : 'civilian',
    maxSpeed: type === 'sports' ? CAR.sportsMax : CAR.maxSpeed,
    w: type === 'truck' ? 52 : 44,
    h: type === 'truck' ? 24 : 22,
  };
}

export function driveCar(car, input, dt, game) {
  const fwd = input.down('KeyW') || input.down('ArrowUp');
  const back = input.down('KeyS') || input.down('ArrowDown');
  const left = input.down('KeyA') || input.down('ArrowLeft');
  const right = input.down('KeyD') || input.down('ArrowRight');
  const brake = input.down('Space');
  if (fwd) car.speed += CAR.accel * dt;
  if (back) car.speed -= (car.speed > 5 ? CAR.brake : CAR.accel * 0.7) * dt;
  if (brake) car.speed -= Math.sign(car.speed) * CAR.handbrake * dt;
  car.speed -= car.speed * CAR.drag * dt;
  car.speed = clamp(car.speed, -CAR.reverseMax, car.maxSpeed);
  if (Math.abs(car.speed) < 2 && !fwd && !back) car.speed = 0;
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * CAR.steer * dt * clamp(Math.abs(car.speed) / 120, 0, 1) * dir;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!pointInBuilding(game.world, nx, ny, 12)) {
    car.x = clamp(nx, 30, WORLD_W - 30);
    car.y = clamp(ny, 30, WORLD_H - 30);
  } else {
    if (Math.abs(car.speed) > 120) game.audio.sfx('crash');
    car.speed *= -0.25;
  }
  // Running over a pedestrian at speed is a crime.
  for (const ped of game.peds) {
    if (!ped.down && dist(car.x, car.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 90) {
      ped.down = true;
      ped.flee = 0;
      game.addWanted(1, 'hit a pedestrian');
    }
  }
}

export function nearestCar(game, x, y, maxD = 70) {
  let best = null;
  let bestD = maxD;
  for (const car of game.cars) {
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(game, car) {
  const p = game.player;
  car.parked = false;
  car.driver = 'player';
  if (!car.stolen && car.driver !== 'player') { /* owned by nobody in free roam */ }
  if (car.civilianOwned && !car.stolen) {
    car.stolen = true;
    game.addWanted(1, 'stole a car in view');
    game.showToast('You stole the car! The cops noticed.');
  }
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  game.audio.sfx('enter');
}

export function exitCar(game) {
  const p = game.player;
  const car = p.inCar;
  if (!car) return;
  car.speed = 0;
  const side = 34;
  const px = car.x + Math.cos(car.angle + Math.PI / 2) * side;
  const py = car.y + Math.sin(car.angle + Math.PI / 2) * side;
  p.x = clamp(px, 20, WORLD_W - 20);
  p.y = clamp(py, 20, WORLD_H - 20);
  p.inCar = null;
  game.audio.sfx('enter');
}
