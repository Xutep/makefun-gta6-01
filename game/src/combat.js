// Marisol City — combat: punch, pistol bullets, damage, pickups, effects.
import { PLAYER } from './config.js';
import { dist } from './random.js';

export function punch(game) {
  const p = game.player;
  for (const ped of game.peds) {
    if (!ped.down && dist(p.x, p.y, ped.x, ped.y) < 44) {
      ped.down = true;
      ped.downTimer = 3;
      game.addWanted(1, 'assaulted a pedestrian');
      game.spawnEffect(ped.x, ped.y, 'punch');
    }
  }
  for (const car of game.police) {
    if (dist(p.x, p.y, car.x, car.y) < 50) {
      car.speed *= 0.4;
      game.spawnEffect(car.x, car.y, 'punch');
    }
  }
}

export function shoot(game) {
  const p = game.player;
  if (p.ammo <= 0) {
    game.showToast('Out of ammo — find an ammo pickup');
    return;
  }
  p.ammo -= 1;
  p.shootCooldown = 0.28;
  game.gunshotTimer = 1.2;
  game.audio.sfx('shot');
  const m = game.screenToWorld(game.input.mouseX, game.input.mouseY);
  const a = Math.atan2(m.y - p.y, m.x - p.x);
  game.bullets.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.6 });
  game.addWanted(1, 'fired a gun');
  game.muzzle = 0.08;
}

export function updateBullets(game, dt) {
  for (const b of game.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const ped of game.peds) {
      if (!ped.down && dist(b.x, b.y, ped.x, ped.y) < 16) {
        ped.down = true;
        ped.downTimer = 4;
        b.life = 0;
        game.spawnEffect(ped.x, ped.y, 'hit');
        game.addWanted(1, 'shot a pedestrian');
      }
    }
    for (const car of game.police) {
      if (dist(b.x, b.y, car.x, car.y) < 26) {
        b.life = 0;
        car.speed *= 0.75;
        game.spawnEffect(car.x, car.y, 'hit');
      }
    }
  }
  game.bullets = game.bullets.filter((b) => b.life > 0);
}

export function damagePlayer(game, amount, cause) {
  const p = game.player;
  if (game.screen !== 'playing' || p.health <= 0) return;
  p.health -= amount;
  game.spawnEffect(p.x, p.y, 'hurt');
  if (p.health <= 0) {
    p.health = 0;
    game.gameOver(cause || 'wasted');
  }
}

export function spawnPickups(game) {
  const rng = game.rng;
  const spots = [
    { x: 700, y: 500, kind: 'ammo' },
    { x: 1600, y: 1000, kind: 'health' },
    { x: 2500, y: 1900, kind: 'ammo' },
    { x: 1100, y: 1900, kind: 'cash' },
    { x: 2800, y: 600, kind: 'health' },
    { x: 2000, y: 300, kind: 'ammo' },
  ];
  for (const s of spots) {
    game.pickups.push({ x: s.x + rng.range(-30, 30), y: s.y + rng.range(-30, 30), kind: s.kind, taken: false });
  }
}
