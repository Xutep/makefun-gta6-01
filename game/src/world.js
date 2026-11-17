// Marisol City — city generation: roads, blocks, buildings, beach, park,
// harbour, palms, spawn points. Everything derives from the seeded RNG.
import { WORLD_W, WORLD_H, ROAD_W, AVENUES, STREETS, COLORS } from './config.js';

export function generateWorld(rng) {
  const buildings = [];
  const palms = [];
  const lamps = [];

  // Blocks are the rectangles between avenues and streets.
  for (let ai = 0; ai < AVENUES.length - 1; ai++) {
    for (let si = 0; si < STREETS.length - 1; si++) {
      const x0 = AVENUES[ai] + ROAD_W / 2 + 14;
      const x1 = AVENUES[ai + 1] - ROAD_W / 2 - 14;
      const y0 = STREETS[si] + ROAD_W / 2 + 14;
      const y1 = STREETS[si + 1] - ROAD_W / 2 - 14;
      const w = x1 - x0;
      const h = y1 - y0;
      // The park block: avenues 1420..1920, streets 820..1280.
      if (ai === 2 && si === 1) {
        for (let p = 0; p < 26; p++) {
          palms.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), park: true });
        }
        continue;
      }
      // Harbour block: south-west corner block.
      if (ai === 0 && si === 3) {
        buildings.push({
          x: x0 + w * 0.1, y: y0 + h * 0.15, w: w * 0.8, h: h * 0.3,
          color: '#7a6a55', height: 1, label: 'HARBOUR',
        });
        buildings.push({
          x: x0 + w * 0.1, y: y0 + h * 0.6, w: w * 0.35, h: h * 0.28,
          color: '#5d7a8c', height: 1, label: 'DOCKS',
        });
        continue;
      }
      const downtown = ai >= 2 && ai <= 3 && si >= 1 && si <= 2;
      const count = downtown ? rng.int(2, 4) : rng.int(1, 3);
      for (let b = 0; b < count; b++) {
        const bw = rng.range(w * 0.22, w * 0.42);
        const bh = rng.range(h * 0.22, h * 0.45);
        const bx = rng.range(x0, x1 - bw);
        const by = rng.range(y0, y1 - bh);
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: rng.pick(COLORS.buildingRoof),
          height: downtown ? rng.int(2, 4) : rng.int(1, 2),
          label: '',
        });
      }
      // Palms along the block edges.
      for (let p = 0; p < 3; p++) {
        palms.push({ x: rng.range(x0, x1), y: y0 + rng.range(0, 10), park: false });
        palms.push({ x: rng.range(x0, x1), y: y1 - rng.range(0, 10), park: false });
      }
    }
  }

  // Beach palms along the east strip.
  for (let i = 0; i < 22; i++) {
    palms.push({ x: rng.range(3010, 3140), y: rng.range(60, WORLD_H - 60), park: false });
  }
  // Street lamps at intersections.
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      lamps.push({ x: ax - ROAD_W / 2 - 6, y: sy - ROAD_W / 2 - 6 });
    }
  }

  return {
    buildings,
    palms,
    lamps,
    beachX: 3000,
    waterX: 3160,
    park: { x: AVENUES[2] + ROAD_W / 2, y: STREETS[1] + ROAD_W / 2, w: AVENUES[3] - AVENUES[2] - ROAD_W, h: STREETS[2] - STREETS[1] - ROAD_W },
    harbour: { x: 0, y: STREETS[3] + ROAD_W / 2, w: AVENUES[1] - ROAD_W / 2, h: WORLD_H - STREETS[3] - ROAD_W / 2 },
    spawns: {
      player: { x: AVENUES[1], y: STREETS[1] + 160 },
      garage: { x: AVENUES[4], y: STREETS[0] - 40 },
      hideout: { x: AVENUES[0] - 60, y: STREETS[3] + 120 },
      sportsCar: { x: AVENUES[3] + 30, y: STREETS[2] - 30 },
      client: { x: AVENUES[0] + 40, y: STREETS[0] + 40 },
      downtown: { x: AVENUES[2] + 60, y: STREETS[2] + 60 },
      beach: { x: 3060, y: 1500 },
    },
  };
}

export function isOnRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_W / 2 + 4) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < ROAD_W / 2 + 4) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y, vertical: true }; }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { x, y: sy, vertical: false }; }
  }
  return best;
}

export function pointInBuilding(world, x, y, pad = 0) {
  for (const b of world.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}
