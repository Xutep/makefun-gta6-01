// Marisol City — civilian traffic AI: cars follow the road grid in lanes,
// turn at intersections sometimes, slow for the car ahead, stop briefly at
// busy crossings. All decisions come from the seeded RNG.

import { CFG, COLORS } from './config.js';
import { makeCar, driveCar, addCrash } from './vehicles.js';
import { onAvenue, onStreet, randomRoadPoint, dist, nearestAvenue, nearestStreet } from './world.js';

export function spawnTraffic(G) {
  const rng = G.rng;
  for (let i = 0; i < CFG.trafficCount; i++) {
    const pt = randomRoadPoint(G.world, rng);
    const kind = rng.chance(0.12) ? 'truck' : rng.chance(0.15) ? 'taxi' : 'sedan';
    const color = kind === 'taxi' ? COLORS.taxiYellow : rng.pick(COLORS.carPaint);
    const car = makeCar(pt.x, pt.y, pt.vertical ? Math.PI / 2 : 0, kind, color, {
      ai: 'traffic',
      vertical: pt.vertical,
    });
    car.speed = rng.range(90, 170);
    // face a random direction along the road
    if (pt.vertical && rng.chance(0.5)) car.angle = -Math.PI / 2;
    if (!pt.vertical && rng.chance(0.5)) car.angle = Math.PI;
    G.cars.push(car);
  }
}

export function spawnParked(G) {
  const rng = G.rng;
  for (let i = 0; i < CFG.parkedCount; i++) {
    const pt = randomRoadPoint(G.world, rng);
    // park just off the road edge, hugging the kerb
    const off = rng.chance(0.5) ? -44 : 44;
    const x = pt.vertical ? pt.x + off : pt.x;
    const y = pt.vertical ? pt.y : pt.y + off;
    const kind = rng.chance(0.2) ? 'sports' : 'sedan';
    const color = kind === 'sports' ? rng.pick(COLORS.sportsPaint) : rng.pick(COLORS.carPaint);
    const car = makeCar(x, y, pt.vertical ? Math.PI / 2 : 0, kind, color, { parked: true });
    G.cars.push(car);
  }
}

// Steering input (-1..1) that turns the car toward a target heading.
function steerToward(angle, targetAngle) {
  let diff = targetAngle - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.max(-1, Math.min(1, diff * 1.6));
}

function carAhead(G, car, lookDist) {
  let best = null;
  let bestD = lookDist;
  for (const other of G.cars) {
    if (other === car || other.parked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    if (forward <= 0 || forward > lookDist) continue;
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (side < 26 && forward < bestD) { bestD = forward; best = other; }
  }
  return best;
}

export function updateTraffic(G, dt) {
  const rng = G.rng;
  for (const car of G.cars) {
    if (car.ai !== 'traffic') continue;
    car.turnCooldown -= dt;
    if (car.stopped > 0) {
      car.stopped -= dt;
      driveCar(G, car, 0, 0, false, dt);
      continue;
    }
    // decide a turn at an intersection
    const av = onAvenue(G.world, car.x);
    const st = onStreet(G.world, car.y);
    if (av !== null && st !== null && car.turnCooldown <= 0) {
      if (rng.chance(0.3)) {
        // turn onto the cross road
        if (car.vertical) {
          car.vertical = false;
          car.angle = rng.chance(0.5) ? 0 : Math.PI;
          car.y = st + (rng.chance(0.5) ? -16 : 16);
        } else {
          car.vertical = true;
          car.angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
          car.x = av + (rng.chance(0.5) ? -16 : 16);
        }
        car.turnCooldown = 2;
      } else {
        car.turnCooldown = 0.5;
      }
      // sometimes pause at the crossing
      if (rng.chance(0.12)) car.stopped = rng.range(0.8, 2.2);
    }
    // lane keeping: steer toward a point 60px ahead on the correct lane.
    // Aiming at a lookahead point (not a raw lateral error) works for every
    // heading, and recovers a car that separation shoved off the road.
    const offRoad = onAvenue(G.world, car.x) === null && onStreet(G.world, car.y) === null;
    let steer = 0;
    if (car.vertical) {
      const laneX = (onAvenue(G.world, car.x) ?? nearestAvenue(G.world, car.x)) + (Math.sin(car.angle) > 0 ? 16 : -16);
      const fwd = Math.sin(car.angle) >= 0 ? 1 : -1;
      const ta = Math.atan2(fwd * 60, laneX - car.x);
      steer = steerToward(car.angle, ta);
    } else {
      const laneY = (onStreet(G.world, car.y) ?? nearestStreet(G.world, car.y)) + (Math.cos(car.angle) > 0 ? 16 : -16);
      const fwd = Math.cos(car.angle) >= 0 ? 1 : -1;
      const ta = Math.atan2(laneY - car.y, fwd * 60);
      steer = steerToward(car.angle, ta);
    }
    // slow for the car ahead, and crawl while off-road
    let throttle = offRoad ? 0.3 : 0.55;
    const ahead = carAhead(G, car, 90);
    if (ahead) throttle = ahead.speed < car.speed ? 0 : 0.25;
    driveCar(G, car, throttle, steer, false, dt);
  }

  // soft car-car separation so traffic does not pile up
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const a = G.cars[i];
      const b = G.cars[j];
      if (a.parked && b.parked) continue;
      const d = dist(a.x, a.y, b.x, b.y);
      if (d > 0 && d < 40) {
        const push = (40 - d) / 2;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        a.x -= Math.cos(ang) * push;
        a.y -= Math.sin(ang) * push;
        b.x += Math.cos(ang) * push;
        b.y += Math.sin(ang) * push;
        if (Math.abs(a.speed) > 150 || Math.abs(b.speed) > 150) {
          addCrash(G, (a.x + b.x) / 2, (a.y + b.y) / 2);
          a.speed *= 0.6;
          b.speed *= 0.6;
        }
      }
    }
  }
}
