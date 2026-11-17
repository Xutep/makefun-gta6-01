// Marisol City — civilian traffic: cars lane-following the road network,
// stopping at intersections sometimes, slowing for the car ahead.
import { AVENUES, STREETS, ROAD_W, COLORS, WORLD_W, WORLD_H } from './config.js';
import { clamp, dist } from './random.js';
import { makeCar } from './vehicles.js';

export function spawnTraffic(game, count) {
  const rng = game.rng;
  for (let i = 0; i < count; i++) {
    const vertical = rng.chance(0.5);
    let car;
    if (vertical) {
      const ax = rng.pick(AVENUES);
      const dir = rng.chance(0.5) ? 1 : -1;
      car = makeCar(ax + (dir > 0 ? 22 : -22), rng.range(60, WORLD_H - 60), dir > 0 ? Math.PI / 2 : -Math.PI / 2, rng.pick(COLORS.car), 'sedan', false);
      car.road = { vertical: true, line: ax, dir };
    } else {
      const sy = rng.pick(STREETS);
      const dir = rng.chance(0.5) ? 1 : -1;
      car = makeCar(rng.range(60, WORLD_W - 60), sy + (dir > 0 ? 22 : -22), dir > 0 ? 0 : Math.PI, rng.pick(COLORS.car), 'sedan', false);
      car.road = { vertical: false, line: sy, dir };
    }
    car.speed = rng.range(90, 170);
    car.cruise = car.speed;
    car.driver = 'civilian';
    car.civilianOwned = true;
    car.stopTimer = rng.range(0, 6);
    game.cars.push(car);
  }
}

export function spawnParked(game, count) {
  const rng = game.rng;
  for (let i = 0; i < count; i++) {
    const vertical = rng.chance(0.5);
    let car;
    if (vertical) {
      const ax = rng.pick(AVENUES);
      car = makeCar(ax + ROAD_W / 2 - 14, rng.range(100, WORLD_H - 100), Math.PI / 2, rng.pick(COLORS.car), rng.chance(0.25) ? 'sports' : 'sedan', true);
    } else {
      const sy = rng.pick(STREETS);
      car = makeCar(rng.range(100, WORLD_W - 100), sy + ROAD_W / 2 - 14, 0, rng.pick(COLORS.car), rng.chance(0.25) ? 'sports' : 'sedan', true);
    }
    car.civilianOwned = true;
    game.cars.push(car);
  }
}

export function updateTraffic(game, dt) {
  for (const car of game.cars) {
    if (car.driver !== 'civilian' || car.parked || !car.road) continue;
    // Slow for the car ahead on the same road.
    let target = car.cruise;
    for (const other of game.cars) {
      if (other === car || !other.road || other.road.vertical !== car.road.vertical || other.road.line !== car.road.line) continue;
      const along = car.road.vertical ? (other.y - car.y) * car.road.dir : (other.x - car.x) * car.road.dir;
      const side = car.road.vertical ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
      if (along > 0 && along < 70 && side < 30) { target = 0; break; }
    }
    // Random pause at intersections.
    car.stopTimer -= dt;
    const nearCross = car.road.vertical
      ? STREETS.some((sy) => Math.abs(car.y - sy) < 46)
      : AVENUES.some((ax) => Math.abs(car.x - ax) < 46);
    if (nearCross && car.stopTimer <= 0) {
      car.stopTimer = game.rng.range(2, 7);
      car.waiting = game.rng.chance(0.4) ? game.rng.range(0.8, 2.2) : 0;
    }
    if (car.waiting > 0) {
      car.waiting -= dt;
      target = 0;
    }
    car.speed += clamp(target - car.speed, -260 * dt, 180 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    // Wrap around the world edges and keep on the road line.
    if (car.road.vertical) {
      car.x = car.road.line + (car.road.dir > 0 ? 22 : -22);
      car.y = ny;
      if (car.y > WORLD_H + 60) car.y = -60;
      if (car.y < -60) car.y = WORLD_H + 60;
    } else {
      car.y = car.road.line + (car.road.dir > 0 ? 22 : -22);
      car.x = nx;
      if (car.x > WORLD_W + 60) car.x = -60;
      if (car.x < -60) car.x = WORLD_W + 60;
    }
    // Keep clear of the player car: nudge aside instead of ramming.
    const p = game.player;
    if (p.inCar && dist(car.x, car.y, p.inCar.x, p.inCar.y) < 60) {
      car.speed = Math.max(0, car.speed - 200 * dt);
    }
  }
}
