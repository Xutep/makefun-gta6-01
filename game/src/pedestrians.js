// Marisol City — pedestrians: walk the sidewalks, cross at intersections,
// flee from gunshots and from cars speeding at them. Cops are peds too
// (kind 'cop'), drawn in navy, and chase the player on foot at high heat.

import { COLORS } from './config.js';
import { addHeat } from './vehicles.js';
import { hitBuilding, clampToWorld, dist, angleTo, isOnRoad } from './world.js';

export function spawnPeds(G) {
  const rng = G.rng;
  for (let i = 0; i < 26; i++) {
    const pt = pickSidewalkSpot(G, rng);
    G.peds.push({
      x: pt.x, y: pt.y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(38, 70),
      shirt: rng.pick(COLORS.pedShirt),
      kind: 'civilian',
      fleeing: false,
      fleeT: 0,
      wanderT: rng.range(0, 4),
      targetAngle: rng.range(0, Math.PI * 2),
    });
  }
}

function pickSidewalkSpot(G, rng) {
  // beside a random avenue or street, just off the road
  if (rng.chance(0.5)) {
    const ax = rng.pick(G.world.avenues);
    return { x: ax + (rng.chance(0.5) ? -52 : 52), y: rng.range(240, 2160) };
  }
  const sy = rng.pick(G.world.streets);
  return { x: rng.range(240, 2960), y: sy + (rng.chance(0.5) ? -52 : 52) };
}

export function spawnCop(G, x, y) {
  G.peds.push({
    x, y,
    angle: 0,
    speed: 120,
    shirt: '#1d2f5e',
    kind: 'cop',
    fleeing: false,
    fleeT: 0,
    wanderT: 0,
    targetAngle: 0,
  });
}

// Peds within range of a gunshot or a speeding car start fleeing.
export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (ped.kind !== 'civilian') continue;
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.fleeing = true;
      ped.fleeT = 3;
      ped.targetAngle = angleTo(x, y, ped.x, ped.y) + G.rng.range(-0.5, 0.5);
    }
  }
}

export function updatePeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.kind === 'cop') {
      // foot cops chase the player when wanted >= 2
      const wanted = Math.floor(p.heat / 20);
      if (wanted >= 2 && G.state === 'play') {
        const a = angleTo(ped.x, ped.y, p.x, p.y);
        ped.angle = a;
        ped.x += Math.cos(a) * ped.speed * dt;
        ped.y += Math.sin(a) * ped.speed * dt;
        if (dist(ped.x, ped.y, p.x, p.y) < 26 && p.onFoot) {
          // caught on foot: busted timer builds
          p.bustedTimer += dt;
          if (p.bustedTimer > 1.2) {
            G.state = 'busted';
            G.audio.busted();
          }
        }
        continue;
      }
      // otherwise cops patrol the sidewalk
      ped.wanderT -= dt;
      if (ped.wanderT <= 0) {
        ped.wanderT = G.rng.range(3, 6);
        ped.targetAngle = G.rng.range(0, Math.PI * 2);
      }
      ped.angle = ped.targetAngle;
      ped.x += Math.cos(ped.angle) * 45 * dt;
      ped.y += Math.sin(ped.angle) * 45 * dt;
      continue;
    }

    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      ped.angle = ped.targetAngle;
      const nx = ped.x + Math.cos(ped.angle) * 150 * dt;
      const ny = ped.y + Math.sin(ped.angle) * 150 * dt;
      if (!hitBuilding(G.world, nx, ped.y, 10)) ped.x = nx;
      if (!hitBuilding(G.world, ped.x, ny, 10)) ped.y = ny;
      if (ped.fleeT <= 0) ped.fleeing = false;
    } else {
      // amble along, changing direction now and then
      ped.wanderT -= dt;
      if (ped.wanderT <= 0) {
        ped.wanderT = G.rng.range(2, 5);
        ped.targetAngle = G.rng.range(0, Math.PI * 2);
      }
      // steer back toward a sidewalk if wandering into a block
      if (!isOnRoad(G.world, ped.x, ped.y)) {
        const nearestAv = G.world.avenues.reduce((a, b) =>
          Math.abs(b - ped.x) < Math.abs(a - ped.x) ? b : a);
        ped.targetAngle = angleTo(ped.x, ped.y, nearestAv, ped.y);
      }
      ped.angle += (ped.targetAngle - ped.angle) * Math.min(1, dt * 3);
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (!hitBuilding(G.world, nx, ped.y, 10)) ped.x = nx;
      if (!hitBuilding(G.world, ped.x, ny, 10)) ped.y = ny;
    }
    const c = clampToWorld(ped.x, ped.y, 24);
    ped.x = c.x;
    ped.y = c.y;

    // a fast car bearing down scares peds
    if (p.car && Math.abs(p.car.speed) > 240 && dist(ped.x, ped.y, p.x, p.y) < 130) {
      ped.fleeing = true;
      ped.fleeT = 2.5;
      ped.targetAngle = angleTo(p.x, p.y, ped.x, ped.y);
    }
  }
}

// A car hitting a ped: the ped is knocked down (respawns later) and the
// player gains heat. Returns true if a ped was hit.
export function checkPedHits(G) {
  const p = G.player;
  if (!p.car || Math.abs(p.car.speed) < 60) return false;
  let hitAny = false;
  for (const ped of G.peds) {
    if (ped.kind !== 'civilian') continue;
    if (dist(ped.x, ped.y, p.car.x, p.car.y) < 30) {
      // knock the ped down and fling them aside
      ped.x += G.rng.range(-40, 40);
      ped.y += G.rng.range(-40, 40);
      ped.fleeing = true;
      ped.fleeT = 4;
      ped.targetAngle = angleTo(p.car.x, p.car.y, ped.x, ped.y);
      hitAny = true;
    }
  }
  if (hitAny) {
    G.audio.crash();
    // hitting a ped is a crime, and witnesses make it worse
    let heat = 15;
    if (G.peds.some((ped) => dist(ped.x, ped.y, p.car.x, p.car.y) < 320)) heat = 25;
    addHeat(G, heat, 'hit pedestrian');
  }
  return hitAny;
}
