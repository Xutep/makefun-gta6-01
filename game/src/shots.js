// Marisol City — deterministic `?shot=` poses for screenshots.
// Each pose fixes the player, cars, police and mission state so the four
// screenshots are reproducible with `?shot=<name>&seed=1`.
import { makeCar } from './vehicles.js';
import { AVENUES, STREETS } from './config.js';

function clearPolice(game) {
  game.police = [];
  game.cars = game.cars.filter((c) => c.driver !== 'police');
}

function addPoliceBehind(game, px, py, angle, count, wanted) {
  for (let i = 0; i < count; i++) {
    const bx = px - Math.cos(angle) * (90 + i * 70) + (i % 2 === 0 ? 26 : -26);
    const by = py - Math.sin(angle) * (90 + i * 70) + (i % 2 === 0 ? 10 : -10);
    const car = makeCar(bx, by, angle, '#1e4fa3', 'police', false);
    car.driver = 'police';
    car.speed = 300;
    car.maxSpeed = 460;
    car.siren = i * 0.4;
    game.police.push(car);
    game.cars.push(car);
  }
  game.wanted = wanted;
  game.bestWanted = Math.max(game.bestWanted, wanted);
}

export function applyShot(game, name) {
  const p = game.player;
  const s = game.world.spawns;
  clearPolice(game);
  game.screen = 'playing';
  game.frozen = true;
  game.dialog = null;
  if (name === 'cover') {
    // Driving a sports car mid-chase, wanted 3, police behind, mission live.
    const car = makeCar(AVENUES[2], STREETS[2] - 10, 0, '#d23b3b', 'sports', false);
    car.driver = 'player';
    car.speed = 320;
    game.cars.push(car);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    addPoliceBehind(game, car.x, car.y, 0, 2, 3);
    game.mission.index = 1;
    game.mission.stage = 'active';
    game.mission.timer = 96;
    game.mission.waypoint = { x: game.world.spawns.garage.x, y: game.world.spawns.garage.y, label: 'Deliver to the garage' };
    game.cash = 2400;
    game.showToast('Mission: Hot Wheels — deliver the Comet GT');
  } else if (name === 'foot') {
    // On foot downtown, pedestrians + traffic around, waypoint visible.
    p.inCar = null;
    p.x = AVENUES[2] + 40;
    p.y = STREETS[2] + 30;
    p.angle = -Math.PI / 2;
    p.ammo = 18;
    game.mission.index = 2;
    game.mission.stage = 'active';
    game.mission.timer = 150;
    game.mission.waypoint = { x: 2500, y: 1900, label: 'Package 2 of 3' };
    game.mission.stops = [
      { x: 700, y: 500, done: true },
      { x: 2500, y: 1900, done: false },
      { x: 2800, y: 600, done: false },
    ];
    game.mission.collected = 1;
    game.cash = 1300;
    game.wanted = 1;
  } else if (name === 'chase') {
    // Police pursuit near the beach at dusk, wanted 4. The player car sits
    // just west of the sand so it stays inside the frame, not at its edge.
    game.dusk = true;
    const car = makeCar(2920, 1500, -Math.PI / 2, '#2f6fd0', 'sedan', false);
    car.driver = 'player';
    car.speed = 380;
    game.cars.push(car);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    addPoliceBehind(game, car.x, car.y, -Math.PI / 2, 3, 4);
    game.mission.index = 3;
    game.mission.stage = 'active';
    game.mission.timer = 88;
    game.mission.waypoint = { x: s.hideout.x, y: s.hideout.y, label: 'Lose the heat, reach the hideout' };
    game.cash = 3100;
    game.showToast('Wanted level 4 — lose the cops!');
  } else if (name === 'mission') {
    // Mission dialog + objective marker + car at a pickup point.
    p.inCar = null;
    p.x = 700;
    p.y = 560;
    p.angle = Math.PI / 4;
    p.ammo = 24;
    const car = makeCar(730, 500, Math.PI / 2, '#e8b93b', 'sedan', false);
    car.driver = 'player';
    game.cars.push(car);
    game.mission.index = 2;
    game.mission.stage = 'active';
    game.mission.timer = 172;
    game.mission.stops = [
      { x: 700, y: 500, done: false },
      { x: 2500, y: 1900, done: false },
      { x: 2800, y: 600, done: false },
    ];
    game.mission.waypoint = { x: 700, y: 500, label: 'Package 1 of 3' };
    game.showDialog('Rosa: Three packages, three corners of the city. Stay cool — the cops are watching.');
    game.cash = 1300;
    game.wanted = 0;
  }
  game.camera.x = (p.inCar ? p.inCar.x : p.x) - game.viewW / 2;
  game.camera.y = (p.inCar ? p.inCar.y : p.y) - game.viewH / 2;
}
