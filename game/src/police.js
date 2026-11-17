// Marisol City — wanted level and police: spawn pursuit cars scaled to the
// wanted level, foot cops at 2+, roadblocks at 3+. Heat decays when the
// player is unseen; switching cars or laying low cools things faster.

import { CFG } from './config.js';
import { makeCar, driveCar, addHeat } from './vehicles.js';
import { spawnCop } from './pedestrians.js';
import { dist, angleTo, randomRoadPoint } from './world.js';
import { hurtPlayer } from './player.js';

export function wantedLevel(G) {
  return Math.min(CFG.maxWanted, Math.floor(G.player.heat / CFG.heatPerStar));
}

function policeTarget(G) {
  // one pursuit car per star (up to 5), plus foot cops at 2+
  const wanted = wantedLevel(G);
  return { cars: wanted, cops: wanted >= 2 ? wanted - 1 : 0 };
}

export function updatePolice(G, dt) {
  const p = G.player;
  const wanted = wantedLevel(G);

  // --- heat decay ---------------------------------------------------------
  const policeNear = G.police.some((car) => dist(car.x, car.y, p.x, p.y) < 420);
  const decay = policeNear ? CFG.heatDecay * 0.3 : (p.car ? CFG.heatDecayHidden : CFG.heatDecay);
  if (wanted > 0 && !G.missions.heatLock) {
    p.heat = Math.max(0, p.heat - decay * dt);
  }
  if (wanted > p.bestWantedThisRun) p.bestWantedThisRun = wanted;

  // --- spawn / despawn ----------------------------------------------------
  const target = policeTarget(G);
  if (G.police.length < target.cars && G.state === 'play') {
    spawnPoliceCar(G);
  }
  if (G.police.length > target.cars) {
    // drop the furthest one
    let worst = null;
    let worstD = -1;
    for (const car of G.police) {
      const d = dist(car.x, car.y, p.x, p.y);
      if (d > worstD) { worstD = d; worst = car; }
    }
    if (worst) {
      G.police.splice(G.police.indexOf(worst), 1);
      G.cars.splice(G.cars.indexOf(worst), 1);
    }
  }
  const cops = G.peds.filter((ped) => ped.kind === 'cop').length;
  if (cops < target.cops && G.state === 'play') {
    const pt = randomRoadPoint(G.world, G.rng);
    spawnCop(G, pt.x, pt.y);
  }

  // --- roadblocks at 3+ ----------------------------------------------------
  if (wanted >= 3 && !G.roadblockActive) {
    G.roadblockActive = true;
    placeRoadblock(G);
  }
  if (wanted < 3) G.roadblockActive = false;

  // --- pursuit ------------------------------------------------------------
  // Each chaser aims at a slightly offset point so they trail in formation
  // instead of all piling onto the same spot and stalling the player.
  for (const car of G.police) {
    car.ramCooldown -= dt;
    const side = ((car.id % 3) - 1) * 46;
    const tx = p.x + Math.cos(p.angle + Math.PI / 2) * side;
    const ty = p.y + Math.sin(p.angle + Math.PI / 2) * side;
    const targetAngle = angleTo(car.x, car.y, tx, ty);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 1.6));
    const speedBoost = 1 + wanted * 0.04;
    const throttle = Math.abs(diff) < 1.2 ? 1 : 0.4;
    const prevMax = car.maxSpeed;
    car.maxSpeed = CFG.policeMax * speedBoost;
    driveCar(G, car, throttle, steer, false, dt);
    car.maxSpeed = prevMax;

    // ramming the player's car: a nudge and a little damage, not a full stop
    const d = dist(car.x, car.y, p.x, p.y);
    if (d < 46 && car.ramCooldown <= 0) {
      car.ramCooldown = 0.9;
      G.audio.crash();
      if (p.car) {
        p.car.speed *= 0.82;
        if (hurtPlayer(G, 4)) endPlayer(G, 'wasted');
      } else if (p.onFoot) {
        p.bustedTimer += 0.6;
      }
    }
  }

  // siren sound while any police car is close
  const anyNear = G.police.some((car) => dist(car.x, car.y, p.x, p.y) < 700);
  G.audio.siren(anyNear && wanted > 0);
}

function spawnPoliceCar(G) {
  const p = G.player;
  // spawn on a road point 500-800px away, off the player's screen
  let pt = null;
  for (let tries = 0; tries < 12; tries++) {
    const cand = randomRoadPoint(G.world, G.rng);
    const d = dist(cand.x, cand.y, p.x, p.y);
    if (d > 520 && d < 900) { pt = cand; break; }
  }
  if (!pt) pt = randomRoadPoint(G.world, G.rng);
  const car = makeCar(pt.x, pt.y, angleTo(pt.x, pt.y, p.x, p.y), 'police', '#f2f2f2', { ai: 'police' });
  car.speed = 200;
  G.police.push(car);
  G.cars.push(car);
}

function placeRoadblock(G) {
  const p = G.player;
  // two police cars parked across the road ahead of the player
  const ahead = p.car ? p.car.angle : p.angle;
  const bx = p.x + Math.cos(ahead) * 320;
  const by = p.y + Math.sin(ahead) * 320;
  const perp = ahead + Math.PI / 2;
  for (const off of [-34, 34]) {
    const car = makeCar(
      bx + Math.cos(perp) * off,
      by + Math.sin(perp) * off,
      ahead + Math.PI / 2,
      'police', '#f2f2f2',
      { ai: 'police', parked: true },
    );
    car.speed = 0;
    G.police.push(car);
    G.cars.push(car);
  }
  G.toast = 'ROADBLOCK AHEAD!';
  G.toastT = 3;
}

export function endPlayer(G, how) {
  if (G.state !== 'play') return;
  G.state = how; // 'busted' | 'wasted'
  G.audio.busted();
  G.audio.siren(false);
  G.audio.engine(0, false);
}
