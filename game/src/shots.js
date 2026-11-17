// Marisol City — deterministic ?shot= poses for the screenshots. Each pose
// sets a fixed player / car / police / mission state from the seeded world,
// so the same URL always renders the same scene (modulo a few seconds of
// live simulation after the pose settles).

import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';
import { wantedLevel } from './police.js';

export function applyShot(G, name) {
  const L = G.world.landmarks;
  const p = G.player;
  G.shot = name;
  G.state = 'play';
  G.missions.dialog = null;
  G.missions.dialogQueue = [];

  if (name === 'cover') {
    // player driving the red sports car mid-chase, 3 stars, police behind
    startMission(G, 1);
    G.missions.dialog = null;
    G.missions.dialogQueue = [];
    const car = G.missionCar;
    car.x = 1400; car.y = 800; car.angle = 0; car.speed = 380; car.parked = false;
    p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y; p.angle = 0;
    car.driven = true; car.ai = null;
    p.heat = 60; // 3 stars
    G.roadblockActive = true; // no roadblock in the pose — the chase is the shot
    G.missions.objective = 'Bring it to Rico\'s garage';
    G.missions.waypoint = { x: L.garage.x, y: L.garage.y, label: 'Garage' };
    spawnChasers(G, 2, 1400, 800, 260);
    G.camera.zoom = 0.9;
    G.camera.targetZoom = 0.9;
  } else if (name === 'foot') {
    // on foot downtown, pedestrians + traffic around, waypoint + mission text
    startMission(G, 0);
    G.missions.dialog = null;
    G.missions.dialogQueue = [];
    p.x = 1400; p.y = 500; p.angle = Math.PI / 2; p.onFoot = true; p.car = null;
    p.heat = 0;
    G.missions.objective = 'Pick up the client downtown (get in a car)';
    G.missions.waypoint = { x: L.clientSpot.x, y: L.clientSpot.y, label: 'Client' };
    G.camera.zoom = 1.1;
    G.camera.targetZoom = 1.1;
  } else if (name === 'chase') {
    // police pursuit near the beach at dusk, 4 stars
    startMission(G, 3);
    G.missions.dialog = null;
    G.missions.dialogQueue = [];
    G.dusk = true;
    // eastbound on the beachfront street (y=2000) so sand + water show below
    const car = G.cars.find((c) => c.kind === 'sedan' && !c.driven && !c.parked) || G.cars[0];
    car.x = 1400; car.y = 2000; car.angle = 0; car.speed = 400; car.parked = false;
    p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y; p.angle = 0;
    car.driven = true; car.ai = null;
    p.heat = 80; // 4 stars
    G.roadblockActive = true; // no roadblock in the pose — the chase is the shot
    G.missions.objective = 'Survive the chase — 60s';
    G.missions.waypoint = { x: L.pierDrop.x, y: L.pierDrop.y, label: 'Pier' };
    spawnChasers(G, 3, 1400, 2000, 260);
    G.camera.zoom = 0.95;
    G.camera.targetZoom = 0.95;
  } else if (name === 'mission') {
    // mission dialog box + objective marker + car at a pickup point
    startMission(G, 2);
    // parked just north of the first package so the marker is on-screen below
    const car = G.cars.find((c) => c.kind === 'sedan' && !c.driven && !c.parked) || G.cars[0];
    car.x = 600; car.y = 1500; car.angle = Math.PI / 2; car.speed = 0; car.parked = false;
    p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y; p.angle = Math.PI / 2;
    car.driven = true; car.ai = null;
    p.heat = 20; // 1 star
    G.missions.objective = 'Collect package 1 of 3 (stay under 3 stars)';
    G.missions.waypoint = { x: L.packages[0].x, y: L.packages[0].y, label: 'Package' };
    G.missions.dialog = {
      speaker: 'Mara',
      text: 'Three packages, three corners of the city. Cops are jumpy today. Keep it quiet.',
    };
    G.missions.dialogT = 999;
    G.camera.zoom = 1.05;
    G.camera.targetZoom = 1.05;
  }
  // snap the camera onto the player so the pose is framed at once
  G.camera.x = p.x;
  G.camera.y = p.y;
}

function spawnChasers(G, n, px, py, gap) {
  for (let i = 0; i < n; i++) {
    const car = makeCar(px - (i + 1) * gap, py + (i % 2 === 0 ? 34 : -34), 0, 'police', '#f2f2f2', { ai: 'police' });
    car.speed = 320; // trailing the player, not ramming it at once
    G.police.push(car);
    G.cars.push(car);
  }
}

// keep the wanted level visible in the shot even if heat decays
export function holdShotWanted(G) {
  if (!G.shot) return;
  const want = G.shot === 'cover' ? 60 : G.shot === 'chase' ? 80 : G.shot === 'mission' ? 20 : 0;
  if (want > 0) G.player.heat = Math.max(G.player.heat, want);
  if (G.shot === 'mission' && G.missions.dialog) G.missions.dialogT = 999;
}
