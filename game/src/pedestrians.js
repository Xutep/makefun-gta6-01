// Marisol City — pedestrians: stroll the sidewalks, flee from gunshots,
// speeding cars and police chases.
import { WORLD_W, WORLD_H, AVENUES, STREETS } from './config.js';
import { clamp, dist } from './random.js';

const SHIRTS = ['#e86a6a', '#6a9ae8', '#e8c96a', '#7ed07e', '#c96ad0', '#e8e8e8', '#6ad0c9'];

export function spawnPeds(game, count) {
  const rng = game.rng;
  for (let i = 0; i < count; i++) {
    const vertical = rng.chance(0.5);
    let x;
    let y;
    if (vertical) {
      x = rng.pick(AVENUES) + (rng.chance(0.5) ? 62 : -62);
      y = rng.range(80, WORLD_H - 80);
    } else {
      x = rng.range(80, WORLD_W - 80);
      y = rng.pick(STREETS) + (rng.chance(0.5) ? 62 : -62);
    }
    game.peds.push({
      x, y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(45, 80),
      shirt: rng.pick(SHIRTS),
      tx: x, ty: y,
      flee: 0,
      down: false,
      downTimer: 0,
    });
  }
}

function pickTarget(game, ped) {
  const rng = game.rng;
  const vertical = rng.chance(0.5);
  if (vertical) {
    ped.tx = rng.pick(AVENUES) + (rng.chance(0.5) ? 62 : -62);
    ped.ty = rng.range(80, WORLD_H - 80);
  } else {
    ped.tx = rng.range(80, WORLD_W - 80);
    ped.ty = rng.pick(STREETS) + (rng.chance(0.5) ? 62 : -62);
  }
}

export function updatePeds(game, dt) {
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const playerSpeed = p.inCar ? Math.abs(p.inCar.speed) : 0;
  for (const ped of game.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) ped.down = false;
      continue;
    }
    // Flee danger: gunfire nearby, a fast car close, or high wanted heat.
    const dPlayer = dist(ped.x, ped.y, px, py);
    if ((game.gunshotTimer > 0 && dPlayer < 420) || (playerSpeed > 200 && dPlayer < 150) || (game.wanted >= 3 && dPlayer < 260)) {
      ped.flee = 2.5;
    }
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.y - py, ped.x - px);
      ped.angle = away;
      ped.x = clamp(ped.x + Math.cos(away) * 150 * dt, 16, WORLD_W - 16);
      ped.y = clamp(ped.y + Math.sin(away) * 150 * dt, 16, WORLD_H - 16);
      continue;
    }
    if (dist(ped.x, ped.y, ped.tx, ped.ty) < 24) pickTarget(game, ped);
    const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    ped.angle = a;
    ped.x = clamp(ped.x + Math.cos(a) * ped.speed * dt, 16, WORLD_W - 16);
    ped.y = clamp(ped.y + Math.sin(a) * ped.speed * dt, 16, WORLD_H - 16);
  }
}
