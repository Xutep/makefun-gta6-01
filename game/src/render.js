// Marisol City — camera + drawing: city, cars, peds, bullets, effects.
// Everything is Canvas 2D shapes; no images, no network.
import { COLORS, WORLD_W, WORLD_H, ROAD_W, AVENUES, STREETS } from './config.js';
import { clamp } from './random.js';
import { drawHUD, drawTitle, drawOverlay } from './hud.js';

export function createCamera() {
  return { x: 0, y: 0, zoom: 1, targetZoom: 1 };
}

export function updateCamera(game, dt) {
  const cam = game.camera;
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  cam.targetZoom = game.zoomOut ? 0.62 : 1;
  cam.zoom += (cam.targetZoom - cam.zoom) * clamp(3 * dt, 0, 1);
  const vw = game.viewW / cam.zoom;
  const vh = game.viewH / cam.zoom;
  cam.x += (px - vw / 2 - cam.x) * clamp(6 * dt, 0, 1);
  cam.y += (py - vh / 2 - cam.y) * clamp(6 * dt, 0, 1);
  cam.x = clamp(cam.x, -80, WORLD_W - vw + 80);
  cam.y = clamp(cam.y, -80, WORLD_H - vh + 80);
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = car.w;
  const h = car.h;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w, h);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 6);
  ctx.fill();
  ctx.fillStyle = '#1d2b3a';
  ctx.fillRect(-w * 0.18, -h / 2 + 3, w * 0.3, h - 6);
  ctx.fillStyle = '#f5e9c8';
  ctx.fillRect(w / 2 - 3, -h / 2 + 2, 3, 5);
  ctx.fillRect(w / 2 - 3, h / 2 - 7, 3, 5);
  ctx.fillStyle = '#e53935';
  ctx.fillRect(-w / 2, -h / 2 + 2, 3, 5);
  ctx.fillRect(-w / 2, h / 2 - 7, 3, 5);
  if (car.type === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-w * 0.05, -h / 2 + 1, w * 0.28, h - 2);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 2, 3);
    ctx.textAlign = 'left';
    const flash = Math.floor(car.siren * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
    ctx.beginPath();
    ctx.arc(-w * 0.28, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#2d6bff' : '#ff2d2d';
    ctx.beginPath();
    ctx.arc(-w * 0.28 + 9, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.missionCar) {
    ctx.strokeStyle = '#ffcf3f';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
  }
  ctx.restore();
}

function drawPedShape(ctx, ped, time) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.down) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(time * 10 + ped.x) * 2;
  ctx.rotate(ped.angle + Math.PI / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(-5, 2 + bob * 0.3, 4, 8);
  ctx.fillRect(1, 2 - bob * 0.3, 4, 8);
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.roundRect(-6, -7, 12, 12, 4);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, -11, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCity(ctx, game, dusk) {
  const w = game.world;
  ctx.fillStyle = dusk ? '#4a7a3d' : COLORS.grass;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Park.
  ctx.fillStyle = COLORS.parkGrass;
  ctx.fillRect(w.park.x, w.park.y, w.park.w, w.park.h);
  ctx.fillStyle = '#7ec8e8';
  ctx.beginPath();
  ctx.ellipse(w.park.x + w.park.w / 2, w.park.y + w.park.h / 2, 70, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  // Beach + water.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(w.beachX, 0, WORLD_W - w.beachX, WORLD_H);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(w.waterX, 0, WORLD_W - w.waterX, WORLD_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (let y = 40; y < WORLD_H; y += 130) {
    ctx.beginPath();
    ctx.moveTo(w.waterX + 8, y);
    ctx.quadraticCurveTo(w.waterX + 22, y + 12, w.waterX + 8, y + 24);
    ctx.stroke();
  }
  // Roads.
  ctx.fillStyle = COLORS.road;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_W / 2, WORLD_W, ROAD_W);
  // Sidewalks.
  ctx.fillStyle = COLORS.sidewalk;
  for (const ax of AVENUES) {
    ctx.fillRect(ax - ROAD_W / 2 - 12, 0, 12, WORLD_H);
    ctx.fillRect(ax + ROAD_W / 2, 0, 12, WORLD_H);
  }
  for (const sy of STREETS) {
    ctx.fillRect(0, sy - ROAD_W / 2 - 12, WORLD_W, 12);
    ctx.fillRect(0, sy + ROAD_W / 2, WORLD_W, 12);
  }
  // Lane dashes.
  ctx.fillStyle = COLORS.roadLine;
  for (const ax of AVENUES) {
    for (let y = 0; y < WORLD_H; y += 64) ctx.fillRect(ax - 2, y, 4, 30);
  }
  for (const sy of STREETS) {
    for (let x = 0; x < WORLD_W; x += 64) ctx.fillRect(x, sy - 2, 30, 4);
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(ax - ROAD_W / 2 + 8 + i * 12, sy - ROAD_W / 2 - 10, 6, 20);
      }
    }
  }
  // Buildings with height shading + labels.
  for (const b of w.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = COLORS.buildingGlass;
    const cols = Math.max(2, Math.floor(b.w / 34));
    const rows = Math.max(2, Math.floor(b.h / 30));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        ctx.fillRect(b.x + 8 + cx * ((b.w - 16) / cols), b.y + 8 + cy * ((b.h - 16) / rows), (b.w - 16) / cols - 6, (b.h - 16) / rows - 6);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    if (b.label) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
      ctx.textAlign = 'left';
    }
  }
  // Palms.
  for (const palm of w.palms) {
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 2, palm.y - 12);
    ctx.stroke();
    ctx.fillStyle = COLORS.palm;
    for (let f = 0; f < 5; f++) {
      const a = (f / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(palm.x + 2 + Math.cos(a) * 8, palm.y - 12 + Math.sin(a) * 6, 9, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Harbour water + docks.
  ctx.fillStyle = '#2f6f9e';
  ctx.fillRect(0, WORLD_H - 60, w.harbour.w, 60);
  ctx.fillStyle = '#8a7a5a';
  ctx.fillRect(0, WORLD_H - 72, w.harbour.w, 12);
}

export function render(game) {
  const ctx = game.ctx;
  const vw = game.viewW;
  const vh = game.viewH;
  const dusk = game.dusk;
  ctx.clearRect(0, 0, vw, vh);
  if (game.screen === 'title') {
    drawTitle(ctx, game, vw, vh);
    return;
  }
  const cam = game.camera;
  ctx.save();
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
  drawCity(ctx, game, dusk);
  // Pickups.
  for (const pk of game.pickups) {
    if (pk.taken) continue;
    ctx.fillStyle = pk.kind === 'ammo' ? '#ffd23f' : pk.kind === 'health' ? '#ff5d5d' : '#7ed07e';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'ammo' ? 'A' : pk.kind === 'health' ? '+' : '$', pk.x, pk.y + 4);
    ctx.textAlign = 'left';
  }
  // Mission stops.
  for (const stop of game.mission.stops || []) {
    if (stop.done) continue;
    ctx.strokeStyle = '#ffcf3f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(stop.x, stop.y, 26 + Math.sin(game.time * 4) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffcf3f';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◆', stop.x, stop.y + 6);
    ctx.textAlign = 'left';
  }
  // Waypoint marker.
  if (game.mission.waypoint && !game.mission.done) {
    const wp = game.mission.waypoint;
    ctx.fillStyle = '#ffcf3f';
    ctx.beginPath();
    ctx.moveTo(wp.x, wp.y - 34);
    ctx.lineTo(wp.x - 10, wp.y - 16);
    ctx.lineTo(wp.x + 10, wp.y - 16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Roadblocks.
  for (const rb of game.roadblocks) {
    ctx.save();
    ctx.translate(rb.x, rb.y);
    ctx.fillStyle = '#ff5d5d';
    ctx.fillRect(-40, -8, 80, 16);
    ctx.fillStyle = '#fff';
    for (let i = -35; i < 40; i += 16) ctx.fillRect(i, -8, 8, 16);
    ctx.restore();
  }
  // Cars (parked + traffic + police + player car).
  for (const car of game.cars) drawCarShape(ctx, car);
  // Pedestrians.
  for (const ped of game.peds) drawPedShape(ctx, ped, game.time);
  // Player on foot.
  const p = game.player;
  if (!p.inCar) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillRect(-6, 2, 5, 9);
    ctx.fillRect(1, 2, 5, 9);
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.roundRect(-7, -8, 14, 13, 4);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(0, -12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(-6, -14, 12, 3);
    // Pistol in hand.
    ctx.fillStyle = '#222';
    ctx.fillRect(4, -4, 12, 4);
    ctx.restore();
    // Aim line.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 46, p.y + Math.sin(p.angle) * 46);
    ctx.stroke();
  }
  // Bullets.
  ctx.fillStyle = '#ffe27a';
  for (const b of game.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Effects.
  for (const fx of game.effects) {
    const a = Math.max(0, fx.life / fx.max);
    ctx.fillStyle = fx.kind === 'hurt' ? `rgba(255,40,40,${a})` : `rgba(255,210,63,${a})`;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, 6 + (1 - a) * 18, 0, Math.PI * 2);
    ctx.fill();
  }
  // Dusk tint for the chase shot.
  if (dusk) {
    ctx.fillStyle = 'rgba(255, 120, 60, 0.10)';
    ctx.fillRect(cam.x, cam.y, vw / cam.zoom, vh / cam.zoom);
  }
  ctx.restore();
  drawHUD(ctx, game, vw, vh);
  if (game.screen === 'paused') {
    drawOverlay(ctx, game, vw, vh, 'PAUSED', ['Take a breath, Jax.', 'Esc — resume · Enter — resume']);
  } else if (game.screen === 'busted') {
    drawOverlay(ctx, game, vw, vh, 'BUSTED', ['The Marisol PD caught up with you.', `Missions done: ${game.missionsDone} · Cash: $${game.cash}`]);
  } else if (game.screen === 'gameover') {
    drawOverlay(ctx, game, vw, vh, 'WASTED', [`${game.deathCause || 'Jax went down.'}`, `Missions done: ${game.missionsDone} · Cash: $${game.cash}`]);
  } else if (game.screen === 'complete') {
    drawOverlay(ctx, game, vw, vh, 'THE BIG SCORE', ['All five missions done. Marisol City is yours.', `Final cash: $${game.cash} · Best wanted: ${game.bestWanted}★`]);
  }
}
