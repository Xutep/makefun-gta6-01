// Marisol City — on-foot player: walk/run, punch, shoot, pickups.
import { PLAYER, WORLD_W, WORLD_H } from './config.js';
import { clamp, dist, angleTo } from './random.js';
import { pointInBuilding } from './world.js';
import { nearestCar, enterCar, exitCar } from './vehicles.js';

export function createPlayer(spawn) {
  return {
    x: spawn.x, y: spawn.y,
    angle: -Math.PI / 2,
    health: PLAYER.maxHealth,
    ammo: PLAYER.pistolAmmo,
    inCar: null,
    punchCooldown: 0,
    shootCooldown: 0,
    running: false,
    moving: false,
  };
}

export function updatePlayer(game, dt) {
  const p = game.player;
  const input = game.input;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  if (p.inCar) return;
  const a = input.axis();
  const len = Math.hypot(a.x, a.y) || 1;
  const run = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.running = run && (a.x !== 0 || a.y !== 0);
  p.moving = a.x !== 0 || a.y !== 0;
  const nx = p.x + (a.x / len) * speed * dt * (p.moving ? 1 : 0);
  const ny = p.y + (a.y / len) * speed * dt * (p.moving ? 1 : 0);
  if (p.moving) {
    if (!pointInBuilding(game.world, nx, p.y, 10)) p.x = clamp(nx, 16, WORLD_W - 16);
    if (!pointInBuilding(game.world, p.x, ny, 10)) p.y = clamp(ny, 16, WORLD_H - 16);
    p.angle = Math.atan2(a.y, a.x);
  }
  // Aim at the mouse.
  const m = game.screenToWorld(input.mouseX, input.mouseY);
  p.angle = angleTo(p.x, p.y, m.x, m.y);
  // Enter / exit a car.
  if (input.wasPressed('KeyE')) {
    const car = nearestCar(game, p.x, p.y);
    if (car) enterCar(game, car);
  }
  // Punch.
  if (input.down('KeyF') && p.punchCooldown <= 0) {
    p.punchCooldown = 0.45;
    game.audio.sfx('punch');
    game.punch(game);
  }
  // Shoot with the mouse.
  if (input.clicked && p.shootCooldown <= 0) {
    input.clicked = false;
    game.shoot(game);
  } else {
    input.clicked = false;
  }
  // Pickups.
  for (const pk of game.pickups) {
    if (!pk.taken && dist(p.x, p.y, pk.x, pk.y) < 26) {
      pk.taken = true;
      if (pk.kind === 'ammo') {
        p.ammo = Math.min(PLAYER.maxAmmo, p.ammo + 12);
        game.showToast('+12 ammo');
      } else if (pk.kind === 'health') {
        p.health = Math.min(PLAYER.maxHealth, p.health + 30);
        game.showToast('+30 health');
      } else if (pk.kind === 'cash') {
        game.cash += 150;
        game.showToast('+$150 found cash');
      }
      game.audio.sfx('pickup');
    }
  }
}
