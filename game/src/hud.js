// Marisol City — HUD: health, cash, wanted stars, speed, ammo, mission
// line, minimap, clock, toasts, dialog box, title/pause/game-over screens.
import { COLORS, WORLD_W, WORLD_H } from './config.js';
import { missionObjectiveText } from './missions.js';
import { clamp } from './random.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.hudBg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

function stars(ctx, x, y, wanted) {
  ctx.font = '20px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted ? '#ffcf3f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * 24, y);
  }
}

export function drawMinimap(ctx, game, x, y, size) {
  const scale = size / WORLD_W;
  panel(ctx, x - 6, y - 6, size + 12, (size * WORLD_H) / WORLD_W + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, (size * WORLD_H) / WORLD_W);
  ctx.clip();
  ctx.fillStyle = '#274d2a';
  ctx.fillRect(x, y, size, (size * WORLD_H) / WORLD_W);
  ctx.fillStyle = '#e8d28a';
  ctx.fillRect(x + 3000 * scale, y, size - 3000 * scale, (size * WORLD_H) / WORLD_W);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(x + 3160 * scale, y, size - 3160 * scale, (size * WORLD_H) / WORLD_W);
  ctx.fillStyle = '#3a3f46';
  for (const ax of game.worldAvenues) ctx.fillRect(x + (ax - 48) * scale, y, 96 * scale, (size * WORLD_H) / WORLD_W);
  for (const sy of game.worldStreets) ctx.fillRect(x, y + (sy - 48) * scale, size, 96 * scale);
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  if (game.mission.waypoint) {
    const wx = x + game.mission.waypoint.x * scale;
    const wy = y + game.mission.waypoint.y * scale;
    ctx.fillStyle = '#ffcf3f';
    ctx.beginPath();
    ctx.arc(wx, wy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.stroke();
  }
  for (const car of game.police) {
    ctx.fillStyle = '#4d8dff';
    ctx.beginPath();
    ctx.arc(x + car.x * scale, y + car.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffb347';
  ctx.save();
  ctx.translate(x + px * scale, y + py * scale);
  ctx.rotate(p.angle);
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function drawHUD(ctx, game, vw, vh) {
  const p = game.player;
  ctx.textBaseline = 'alphabetic';
  // Top-left: health, cash, stars.
  panel(ctx, 12, 12, 250, 86);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('JAX MORENO', 24, 34);
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 42, 180, 12);
  ctx.fillStyle = p.health > 30 ? '#4caf50' : '#e53935';
  ctx.fillRect(24, 42, 180 * clamp(p.health / 100, 0, 1), 12);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '14px sans-serif';
  ctx.fillText(`$${game.cash}`, 24, 74);
  ctx.fillText(`Ammo ${p.inCar ? '—' : p.ammo}`, 110, 74);
  stars(ctx, 24, 92, game.wanted);
  // Top-right: minimap + clock.
  const mmSize = 190;
  drawMinimap(ctx, game, vw - mmSize - 18, 12, mmSize);
  const mmH = (mmSize * WORLD_H) / WORLD_W + 12;
  panel(ctx, vw - mmSize - 18, 12 + mmH + 8, mmSize + 12, 30);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(game.clockText(), vw - mmSize - 6, 12 + mmH + 28);
  // Bottom-left: vehicle / speed.
  panel(ctx, 12, vh - 64, 250, 52);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 14px sans-serif';
  if (p.inCar) {
    ctx.fillText(`${p.inCar.type === 'sports' ? 'Comet GT' : p.inCar.type === 'police' ? 'Police Cruiser' : 'Sedan'}`, 24, vh - 42);
    ctx.font = '13px sans-serif';
    ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.22)} km/h  ·  E exit  ·  Space brake`, 24, vh - 22);
  } else {
    ctx.fillText('On foot', 24, vh - 42);
    ctx.font = '13px sans-serif';
    ctx.fillText('WASD move · E enter car · F punch · Click shoot', 24, vh - 22);
  }
  // Bottom-center: mission objective.
  const obj = missionObjectiveText(game);
  ctx.font = 'bold 14px sans-serif';
  const ow = ctx.measureText(obj).width + 28;
  panel(ctx, (vw - ow) / 2, vh - 46, ow, 34);
  ctx.fillStyle = '#ffcf3f';
  ctx.fillText(obj, (vw - ow) / 2 + 14, vh - 23);
  // Waypoint arrow at screen edge.
  drawWaypointArrow(ctx, game, vw, vh);
  // Dialog box.
  if (game.dialog) {
    const dw = Math.min(vw - 80, 640);
    panel(ctx, (vw - dw) / 2, vh - 150, dw, 64);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '15px sans-serif';
    wrapText(ctx, game.dialog, (vw - dw) / 2 + 16, vh - 126, dw - 32, 20);
  }
  // Toast.
  if (game.toast && game.toastTimer > 0) {
    ctx.font = 'bold 15px sans-serif';
    const tw = ctx.measureText(game.toast).width + 28;
    panel(ctx, (vw - tw) / 2, 116, tw, 32);
    ctx.fillStyle = '#fff';
    ctx.fillText(game.toast, (vw - tw) / 2 + 14, 138);
  }
  // Mute + controls hint.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '12px sans-serif';
  ctx.fillText('M mute · C zoom · Esc pause', vw - 210, vh - 12);
}

function drawWaypointArrow(ctx, game, vw, vh) {
  const wp = game.mission.waypoint;
  if (!wp || game.mission.done) return;
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const dx = wp.x - px;
  const dy = wp.y - py;
  const d = Math.hypot(dx, dy);
  if (d < 90) return;
  const a = Math.atan2(dy, dx);
  const cx = vw / 2 + Math.cos(a) * 110;
  const cy = vh / 2 + Math.sin(a) * 110;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = '#ffcf3f';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffcf3f';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`${Math.round(d)}m`, cx - 12, cy - 16);
}

export function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export function drawTitle(ctx, game, vw, vh) {
  ctx.fillStyle = '#0b1c2e';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#ff9e3d';
  ctx.fillRect(0, vh * 0.62, vw, 4);
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MARISOL CITY', vw / 2, vh * 0.3);
  ctx.fillStyle = '#f5f2e8';
  ctx.font = '22px sans-serif';
  ctx.fillText('An open-world crime game in the spirit of GTA 6', vw / 2, vh * 0.3 + 40);
  ctx.font = '16px sans-serif';
  ctx.fillText('Jax Moreno, driver-for-hire, takes one last job across a sun-soaked coastal city.', vw / 2, vh * 0.3 + 72);
  ctx.fillText('Steal cars, outrun the cops, run five missions — and make the big score.', vw / 2, vh * 0.3 + 98);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = game.blink ? '#ffcf3f' : '#f5f2e8';
  ctx.fillText('PRESS ENTER TO PLAY', vw / 2, vh * 0.52);
  ctx.fillStyle = '#cfe3ef';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD / arrows — move & drive · E — enter / exit car · F — punch · Mouse + click — shoot', vw / 2, vh * 0.7);
  ctx.fillText('Space — handbrake · C — camera zoom · M — mute · Esc — pause', vw / 2, vh * 0.7 + 26);
  if (game.saveData) {
    ctx.fillText(`Saved progress: ${game.saveData.missionsDone} mission(s) done · $${game.saveData.cash}`, vw / 2, vh * 0.7 + 56);
  }
  ctx.textAlign = 'left';
}

export function drawOverlay(ctx, game, vw, vh, title, lines) {
  ctx.fillStyle = 'rgba(5, 10, 18, 0.78)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText(title, vw / 2, vh * 0.38);
  ctx.fillStyle = '#f5f2e8';
  ctx.font = '18px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, vw / 2, vh * 0.38 + 44 + i * 30));
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = game.blink ? '#ffcf3f' : '#f5f2e8';
  ctx.fillText('PRESS ENTER', vw / 2, vh * 0.38 + 44 + lines.length * 30 + 40);
  ctx.textAlign = 'left';
}
