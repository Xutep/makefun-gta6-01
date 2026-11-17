// Marisol City — combat: punch, pistol, bullets, pickups (ammo, health,
// cash). Shooting is a crime; a shot scares nearby peds and draws police.

import { CFG } from './config.js';
import { addHeat } from './vehicles.js';
import { scarePeds } from './pedestrians.js';
import { dist, angleTo } from './world.js';
import { hurtPlayer } from './player.js';

export function spawnPickups(G) {
  const rng = G.rng;
  const kinds = ['ammo', 'health', 'cash'];
  for (let i = 0; i < CFG.pickupCount; i++) {
    const pt = { x: rng.range(200, 3000), y: rng.range(200, 2100) };
    G.pickups.push({
      x: pt.x, y: pt.y,
      kind: kinds[i % kinds.length],
      bob: rng.range(0, Math.PI * 2),
    });
  }
}

export function updateCombat(G, dt) {
  const p = G.player;
  const input = G.input;

  // F: punch (on foot only)
  if (p.onFoot && input.pressed.has('f') && p.punchCooldown <= 0) {
    p.punchCooldown = 0.45;
    G.audio.punch();
    const px = p.x + Math.cos(p.angle) * CFG.punchRange;
    const py = p.y + Math.sin(p.angle) * CFG.punchRange;
    for (const ped of G.peds) {
      if (ped.kind !== 'civilian') continue;
      if (dist(ped.x, ped.y, px, py) < 34) {
        ped.fleeing = true;
        ped.fleeT = 3;
        ped.targetAngle = angleTo(p.x, p.y, ped.x, ped.y);
        addHeat(G, 8, 'assault');
      }
    }
    for (const car of G.cars) {
      if (car.driven || car.parked) continue;
      if (dist(car.x, car.y, px, py) < 40) {
        car.health -= CFG.punchDamage;
      }
    }
  }

  // mouse click: shoot pistol (on foot only)
  if (p.onFoot && input.mouse.clicked && p.shootCooldown <= 0 && p.ammo > 0) {
    p.shootCooldown = 0.28;
    p.ammo -= 1;
    const a = Math.atan2(input.mouse.worldY - p.y, input.mouse.worldX - p.x);
    G.bullets.push({
      x: p.x + Math.cos(a) * 24,
      y: p.y + Math.sin(a) * 24,
      vx: Math.cos(a) * CFG.bulletSpeed,
      vy: Math.sin(a) * CFG.bulletSpeed,
      life: 0.9,
    });
    G.audio.shot();
    scarePeds(G, p.x, p.y, 420);
    addHeat(G, 12, 'fired weapon');
    // muzzle flash particle
    G.particles.push({
      x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 30,
      vx: 0, vy: 0, life: 0.08, maxLife: 0.08, color: '#ffe27a', size: 7,
    });
  }

  // bullets fly and hit things
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      for (const ped of G.peds) {
        if (dist(ped.x, ped.y, b.x, b.y) < 14) {
          dead = true;
          ped.fleeing = true;
          ped.fleeT = 4;
          ped.targetAngle = angleTo(b.x, b.y, ped.x, ped.y);
          if (ped.kind === 'cop') addHeat(G, 20, 'shot a cop');
          break;
        }
      }
    }
    if (!dead) {
      for (const car of G.cars) {
        if (car.driven) continue;
        if (dist(car.x, car.y, b.x, b.y) < 26) {
          dead = true;
          car.health -= CFG.pistolDamage;
          if (car.kind === 'police') addHeat(G, 15, 'shot police car');
          if (car.health <= 0) {
            // car wreck: smoke + it stops
            car.ai = null;
            car.speed = 0;
            for (let k = 0; k < 12; k++) {
              G.particles.push({
                x: car.x, y: car.y,
                vx: G.rng.range(-60, 60), vy: G.rng.range(-60, 60),
                life: G.rng.range(0.5, 1.2), maxLife: 1.2,
                color: '#666666', size: G.rng.range(3, 7),
              });
            }
          }
          break;
        }
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }

  // pickups
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pk = G.pickups[i];
    pk.bob += dt * 3;
    if (dist(p.x, p.y, pk.x, pk.y) < 34) {
      if (pk.kind === 'ammo' && p.ammo < CFG.maxAmmo) {
        p.ammo = Math.min(CFG.maxAmmo, p.ammo + 12);
      } else if (pk.kind === 'health' && p.health < 100) {
        p.health = Math.min(100, p.health + 30);
      } else if (pk.kind === 'cash') {
        p.cash += 50;
        G.audio.cash();
      } else {
        continue; // full — leave the pickup
      }
      G.audio.pickup();
      G.pickups.splice(i, 1);
      // respawn a fresh one elsewhere after a while
      G.pickupRespawn = 12;
    }
  }
  if (G.pickupRespawn > 0) {
    G.pickupRespawn -= dt;
    if (G.pickupRespawn <= 0) {
      G.pickups.push({
        x: G.rng.range(200, 3000), y: G.rng.range(200, 2100),
        kind: ['ammo', 'health', 'cash'][G.rng.int(0, 2)],
        bob: 0,
      });
    }
  }

  // particles age
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const pt = G.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) G.particles.splice(i, 1);
  }
}
