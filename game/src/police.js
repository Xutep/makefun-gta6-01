// Marisol City — wanted level, police pursuit, roadblocks, busted.
import { WORLD_W, WORLD_H, WANTED_DECAY_SECONDS } from './config.js';
import { clamp, dist, angleTo, angleLerp } from './random.js';
import { makeCar } from './vehicles.js';

export function addWanted(game, stars, reason) {
  if (game.wanted >= 5) return;
  const before = game.wanted;
  game.wanted = clamp(game.wanted + stars, 0, 5);
  game.wantedTimer = WANTED_DECAY_SECONDS;
  game.bestWanted = Math.max(game.bestWanted, game.wanted);
  if (game.wanted > before) {
    game.showToast(`Wanted level ${game.wanted} — ${reason}`);
    if (game.wanted >= 2) game.audio.sfx('siren');
  }
}

export function policeTargetCount(wanted) {
  return wanted <= 0 ? 0 : wanted === 1 ? 1 : wanted === 2 ? 2 : wanted === 3 ? 3 : wanted === 4 ? 4 : 6;
}

export function updatePolice(game, dt) {
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  // Decay: laying low out of sight drops the heat.
  if (game.wanted > 0) {
    const nearestCop = game.police.reduce((m, c) => Math.min(m, dist(c.x, c.y, px, py)), Infinity);
    const hidden = nearestCop > 520 && !(p.inCar && Math.abs(p.inCar.speed) > 120);
    if (hidden) {
      game.wantedTimer -= dt;
      if (game.wantedTimer <= 0) {
        game.wanted -= 1;
        game.wantedTimer = WANTED_DECAY_SECONDS;
        game.showToast(game.wanted === 0 ? 'You lost the cops.' : `Wanted level ${game.wanted}`);
      }
    } else {
      game.wantedTimer = WANTED_DECAY_SECONDS;
    }
  }
  // Spawn pursuit cars up to the wanted count.
  const want = policeTargetCount(game.wanted);
  while (game.police.length < want) {
    const edge = game.rng.int(0, 3);
    let x = px;
    let y = py;
    if (edge === 0) { x = px + 620; y = py - 200; }
    if (edge === 1) { x = px - 620; y = py + 200; }
    if (edge === 2) { x = px + 200; y = py + 620; }
    if (edge === 3) { x = px - 200; y = py - 620; }
    x = clamp(x, 40, WORLD_W - 40);
    y = clamp(y, 40, WORLD_H - 40);
    const car = makeCar(x, y, angleTo(x, y, px, py), '#1e4fa3', 'police', false);
    car.driver = 'police';
    car.speed = 200;
    car.maxSpeed = 380 + game.wanted * 32;
    car.siren = 0;
    game.police.push(car);
    game.cars.push(car);
  }
  while (game.police.length > want) {
    const car = game.police.pop();
    const i = game.cars.indexOf(car);
    if (i >= 0) game.cars.splice(i, 1);
  }
  // Pursuit steering: chase the player, ram on foot, match speed in a car.
  for (const car of game.police) {
    const target = angleTo(car.x, car.y, px, py);
    car.angle = angleLerp(car.angle, target, clamp(2.4 * dt, 0, 1));
    const wantSpeed = p.inCar ? Math.min(car.maxSpeed, Math.abs(p.inCar.speed) + 60) : 260;
    car.speed += clamp(wantSpeed - car.speed, -500 * dt, 320 * dt);
    car.x = clamp(car.x + Math.cos(car.angle) * car.speed * dt, 30, WORLD_W - 30);
    car.y = clamp(car.y + Math.sin(car.angle) * car.speed * dt, 30, WORLD_H - 30);
    car.siren += dt;
    if (car.siren > 1.6) { car.siren = 0; game.audio.sfx('siren'); }
    // Busted: a police car catches the player on foot, or rams the car hard.
    if (!p.inCar && dist(car.x, car.y, p.x, p.y) < 30) {
      game.busted();
    }
    if (p.inCar && dist(car.x, car.y, p.inCar.x, p.inCar.y) < 34 && Math.abs(car.speed) > 200) {
      p.inCar.speed *= 0.55;
      car.speed *= 0.5;
      game.audio.sfx('crash');
      game.damagePlayer(8, 'rammed by police');
    }
  }
  // Roadblocks at wanted 3+: striped barriers ahead on the player's road.
  game.roadblocks = game.wanted >= 3 ? [{ x: px + 420, y: py, angle: 0 }] : [];
}

export function clearPolice(game) {
  for (const car of game.police) {
    const i = game.cars.indexOf(car);
    if (i >= 0) game.cars.splice(i, 1);
  }
  game.police = [];
  game.roadblocks = [];
}
