// Marisol City — city generation: road grid, districts (downtown, park,
// harbour, beach), buildings, trees, spawns. Fully seeded: the same seed
// always builds the same city.

import { CFG, COLORS } from './config.js';

export function generateWorld(rng) {
  const W = CFG.worldW;
  const H = CFG.worldH;
  const avenues = [];
  const streets = [];
  for (let x = 200; x <= W - 200; x += 400) avenues.push(x);
  for (let y = 200; y <= H - 200; y += 300) streets.push(y);

  const buildings = [];
  const trees = [];
  const parks = [];
  const containers = [];

  // Block (i, j) spans avenues[i]..avenues[i+1] x streets[j]..streets[j+1].
  const block = (i, j) => ({
    x0: avenues[i] + CFG.roadW / 2 + 14,
    x1: avenues[i + 1] - CFG.roadW / 2 - 14,
    y0: streets[j] + CFG.roadW / 2 + 14,
    y1: streets[j + 1] - CFG.roadW / 2 - 14,
  });

  const isDowntown = (i, j) => i >= 2 && i <= 4 && j >= 1 && j <= 3;
  const isHarbour = (i, j) => i >= 5 && j >= 5;
  const isPark = (i, j) => i === 1 && j === 3;
  const isBeachBlock = (i, j) => streets[j + 1] > 2050;

  for (let i = 0; i < avenues.length - 1; i++) {
    for (let j = 0; j < streets.length - 1; j++) {
      const b = block(i, j);
      if (isPark(i, j)) {
        parks.push({ x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 });
        for (let t = 0; t < 14; t++) {
          trees.push({
            x: rng.range(b.x0 + 20, b.x1 - 20),
            y: rng.range(b.y0 + 20, b.y1 - 20),
            r: rng.range(10, 16),
            palm: false,
          });
        }
        continue;
      }
      if (isBeachBlock(i, j)) continue; // sand, no buildings
      if (isHarbour(i, j)) {
        // warehouses + shipping containers
        const n = rng.int(1, 2);
        for (let k = 0; k < n; k++) {
          const w = rng.range(110, 190);
          const h = rng.range(70, 110);
          buildings.push({
            x: rng.range(b.x0, b.x1 - w),
            y: rng.range(b.y0, b.y1 - h),
            w, h,
            hgt: rng.range(14, 26),
            color: rng.pick(COLORS.warehouse),
            downtown: false,
          });
        }
        for (let c = 0; c < 6; c++) {
          containers.push({
            x: rng.range(b.x0, b.x1 - 46),
            y: rng.range(b.y0, b.y1 - 20),
            w: 46, h: 20,
            color: rng.pick(['#c23b2e', '#2e6dc2', '#e8b73a', '#3aa655']),
          });
        }
        continue;
      }
      if (isDowntown(i, j)) {
        // one or two glass towers per downtown block
        const n = rng.chance(0.6) ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const w = rng.range(90, 150);
          const h = rng.range(90, 150);
          buildings.push({
            x: b.x0 + (k === 0 ? 10 : b.x1 - b.x0 - w - 10),
            y: rng.range(b.y0 + 8, b.y1 - h - 8),
            w, h,
            hgt: rng.range(60, 130),
            color: rng.pick(COLORS.downtownGlass),
            downtown: true,
          });
        }
        continue;
      }
      // residential / commercial: 2-4 smaller buildings
      const n = rng.int(2, 4);
      for (let k = 0; k < n; k++) {
        const w = rng.range(56, 110);
        const h = rng.range(56, 100);
        buildings.push({
          x: rng.range(b.x0, b.x1 - w),
          y: rng.range(b.y0, b.y1 - h),
          w, h,
          hgt: rng.range(10, 30),
          color: rng.pick(COLORS.buildingRoof),
          downtown: false,
        });
      }
    }
  }

  // Palm trees along the beach front and a few along the avenues.
  for (let x = 120; x < W - 100; x += 130) {
    trees.push({ x: x + rng.range(-20, 20), y: 2120 + rng.range(-8, 8), r: rng.range(11, 15), palm: true });
  }
  for (const ax of avenues) {
    for (let t = 0; t < 4; t++) {
      trees.push({
        x: ax + CFG.roadW / 2 + 12,
        y: rng.range(260, H - 260),
        r: rng.range(9, 13),
        palm: rng.chance(0.4),
      });
    }
  }

  // Fixed mission / gameplay landmarks on road intersections.
  const at = (ax, sy) => ({ x: avenues[ax], y: streets[sy] });
  const landmarks = {
    playerSpawn: { x: 600, y: 500 },
    hideout: { x: 600, y: 500 },
    clientSpot: at(2, 1), // (1000, 500)
    clientDest: at(6, 4), // (2600, 1400)
    sportsCarSpot: { x: 1800, y: 836 },
    garage: { x: 600, y: 1964 },
    packages: [at(1, 5), at(5, 1), at(6, 6)],
    pierDrop: { x: 3000, y: 200 },
    bigScoreStops: [at(0, 6), at(6, 0), at(3, 3)],
    policeStation: at(3, 2),
  };

  return {
    w: W, h: H, avenues, streets,
    buildings, trees, parks, containers,
    landmarks,
    beachY: 2080,
    waterY: 2240,
  };
}

// --- Queries ---------------------------------------------------------------

export function isOnRoad(world, x, y) {
  const half = CFG.roadW / 2;
  for (const ax of world.avenues) if (Math.abs(x - ax) <= half) return true;
  for (const sy of world.streets) if (Math.abs(y - sy) <= half) return true;
  return false;
}

export function onAvenue(world, x) {
  const half = CFG.roadW / 2;
  for (const ax of world.avenues) if (Math.abs(x - ax) <= half) return ax;
  return null;
}

export function onStreet(world, y) {
  const half = CFG.roadW / 2;
  for (const sy of world.streets) if (Math.abs(y - sy) <= half) return sy;
  return null;
}

// Nearest road line, for traffic cars that got shoved off the road.
export function nearestAvenue(world, x) {
  return world.avenues.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
}

export function nearestStreet(world, y) {
  return world.streets.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
}

export function hitBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export function clampToWorld(x, y, m = 30) {
  return {
    x: Math.max(m, Math.min(CFG.worldW - m, x)),
    y: Math.max(m, Math.min(CFG.worldH - m, y)),
  };
}

// A random point on a road (lane offset), for spawns.
export function randomRoadPoint(world, rng) {
  if (rng.chance(0.5)) {
    const ax = rng.pick(world.avenues);
    const lane = rng.chance(0.5) ? -16 : 16;
    return { x: ax + lane, y: rng.range(240, CFG.worldH - 240), vertical: true };
  }
  const sy = rng.pick(world.streets);
  const lane = rng.chance(0.5) ? -16 : 16;
  return { x: rng.range(240, CFG.worldW - 240), y: sy + lane, vertical: false };
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
