// Marisol City — HUD: health, cash, wanted stars, vehicle + speed, ammo,
// mission objective, minimap, clock, controls hint, dialog box, toasts.
// Plus the title / pause / busted / wasted / complete screens.

import { CFG, COLORS } from './config.js';
import { wantedLevel } from './police.js';

export function drawHUD(G) {
  const ctx = G.ctx;
  const p = G.player;
  const W = G.viewW;
  const H = G.viewH;

  // --- top-left: health + cash -------------------------------------------
  ctx.save();
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, 12, 12, 250, 64, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('JAX MORENO', 24, 34);
  // health bar
  ctx.fillStyle = '#333';
  ctx.fillRect(24, 42, 150, 12);
  ctx.fillStyle = p.health > 50 ? '#3aa655' : p.health > 25 ? '#e8b73a' : '#e84a4a';
  ctx.fillRect(24, 42, 150 * Math.max(0, p.health / 100), 12);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '12px sans-serif';
  ctx.fillText(`${Math.ceil(p.health)}`, 180, 53);
  ctx.fillStyle = '#7de87a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`$${Math.floor(p.cash)}`, 24, 70);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '12px sans-serif';
  ctx.fillText(p.onFoot ? 'ON FOOT' : `${p.car ? p.car.kind.toUpperCase() : ''}  ${Math.round(Math.abs(p.car ? p.car.speed : 0) * 0.36)} km/h`, 120, 70);
  ctx.restore();

  // --- top-center: wanted stars -------------------------------------------
  const wanted = wantedLevel(G);
  ctx.save();
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, W / 2 - 75, 12, 150, 40, 8);
  ctx.fill();
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted ? COLORS.star : COLORS.starEmpty;
    ctx.fillText('★', W / 2 - 52 + i * 26, 40);
  }
  ctx.restore();

  // --- top-right: minimap ---------------------------------------------------
  drawMinimap(G);

  // --- clock (below minimap) ----------------------------------------------
  ctx.save();
  const hh = Math.floor(G.clockMinutes / 60) % 24;
  const mm = Math.floor(G.clockMinutes % 60);
  const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  ctx.fillStyle = COLORS.hudBg;
  ctx.fillRect(W - 232, 190, 220, 30);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${clock}  •  MISSION ${G.missions.done}/5`, W - 122, 210);
  ctx.restore();

  // --- mission objective line ----------------------------------------------
  ctx.save();
  ctx.fillStyle = COLORS.hudBg;
  const obj = G.missions.objective || 'Explore Marisol City';
  ctx.font = 'bold 15px sans-serif';
  const ow = ctx.measureText(obj).width + 28;
  roundRect(ctx, 12, H - 118, Math.min(ow, W - 24), 34, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.hudAccent;
  ctx.textAlign = 'left';
  ctx.fillText(`◆ ${obj}`, 24, H - 96);
  ctx.restore();

  // --- ammo + controls hint (bottom-left) -----------------------------------
  ctx.save();
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, 12, H - 76, 300, 64, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Ammo  ${p.ammo} / ${CFG.maxAmmo}`, 24, H - 52);
  ctx.fillStyle = '#bdb8a8';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move/drive • E enter car • F punch • Click shoot', 24, H - 34);
  ctx.fillText('Space handbrake • C zoom • M mute • Esc pause', 24, H - 18);
  ctx.restore();

  // --- toast ----------------------------------------------------------------
  if (G.toastT > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, G.toastT);
    ctx.fillStyle = COLORS.hudBg;
    ctx.font = 'bold 18px sans-serif';
    const tw = ctx.measureText(G.toast).width + 32;
    roundRect(ctx, W / 2 - tw / 2, 64, tw, 36, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.hudAccent;
    ctx.textAlign = 'center';
    ctx.fillText(G.toast, W / 2, 88);
    ctx.restore();
  }

  // --- dialog box ------------------------------------------------------------
  const M = G.missions;
  if (M.dialog) {
    ctx.save();
    const bw = Math.min(720, W - 80);
    const bx = (W - bw) / 2;
    const by = H - 210;
    ctx.fillStyle = COLORS.dialogBg;
    roundRect(ctx, bx, by, bw, 76, 10);
    ctx.fill();
    ctx.strokeStyle = COLORS.hudAccent;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 1, by + 1, bw - 2, 74);
    ctx.fillStyle = COLORS.hudAccent;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(M.dialog.speaker, bx + 18, by + 26);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '15px sans-serif';
    wrapText(ctx, M.dialog.text, bx + 18, by + 50, bw - 36, 19);
    ctx.fillStyle = '#bdb8a8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('E to continue', bx + bw - 14, by + 66);
    ctx.restore();
  }
}

function drawMinimap(G) {
  const ctx = G.ctx;
  const W = G.viewW;
  const mw = 220;
  const mh = 165;
  const mx = W - mw - 12;
  const my = 12;
  const sx = mw / CFG.worldW;
  const sy = mh / CFG.worldH;

  ctx.save();
  ctx.fillStyle = 'rgba(8, 12, 20, 0.78)';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#ffd21a';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx + 1, my + 1, mw - 2, mh - 2);

  // water + beach
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(mx, my + G.world.waterY * sy, mw, mh - G.world.waterY * sy);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(mx, my + G.world.beachY * sy, mw, (G.world.waterY - G.world.beachY) * sy);
  // park
  ctx.fillStyle = '#3f8f3a';
  for (const pk of G.world.parks) {
    ctx.fillRect(mx + pk.x * sx, my + pk.y * sy, pk.w * sx, pk.h * sy);
  }
  // roads
  ctx.strokeStyle = '#8a8d92';
  ctx.lineWidth = 2;
  for (const ax of G.world.avenues) {
    ctx.beginPath();
    ctx.moveTo(mx + ax * sx, my);
    ctx.lineTo(mx + ax * sx, my + mh);
    ctx.stroke();
  }
  for (const st of G.world.streets) {
    ctx.beginPath();
    ctx.moveTo(mx, my + st * sy);
    ctx.lineTo(mx + mw, my + st * sy);
    ctx.stroke();
  }
  // police dots
  ctx.fillStyle = '#ff2a2a';
  for (const car of G.police) {
    ctx.beginPath();
    ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // waypoint diamond
  const wp = G.missions.waypoint;
  if (wp) {
    ctx.fillStyle = COLORS.waypoint;
    const wx = mx + wp.x * sx;
    const wy = my + wp.y * sy;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(Math.PI / 4);
    const s = 5 + Math.sin(G.time * 4) * 1.5;
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.restore();
  }
  // player arrow
  const p = G.player;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ff7a1a';
  ctx.lineWidth = 2;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, cy);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- full screens ------------------------------------------------------------

export function drawTitle(G) {
  const ctx = G.ctx;
  const W = G.viewW;
  const H = G.viewH;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#ff9a3d');
  grad.addColorStop(0.55, '#e85d75');
  grad.addColorStop(1, '#2f3a6e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // sun + skyline silhouette
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(W * 0.88, H * 0.16, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 24, 50, 0.85)';
  const skyline = [120, 200, 150, 260, 180, 230, 300, 170, 210, 260, 140, 190];
  let sx = 0;
  for (const h of skyline) {
    ctx.fillRect(sx, H - 120 - h, 110, h + 120);
    sx += 108;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, H - 120, W, 120);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 18;
  ctx.fillText('MARISOL CITY', W / 2, H * 0.34);
  ctx.shadowBlur = 0;
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('An open-world crime game in the spirit of GTA 6', W / 2, H * 0.34 + 44);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#f5f2e8';
  ctx.fillText('Jax Moreno, driver-for-hire. Five jobs. One city. No brakes.', W / 2, H * 0.34 + 76);

  // prompt pulses but never fully disappears, so it reads in any screenshot
  ctx.save();
  ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(G.time * 2));
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#ffd21a';
  ctx.fillText('PRESS ENTER TO START', W / 2, H * 0.62);
  ctx.restore();
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#e8e6df';
  ctx.fillText('WASD move / drive  •  E enter car  •  F punch  •  Mouse aim + Click shoot', W / 2, H * 0.70);
  ctx.fillText('Space handbrake  •  C camera zoom  •  M mute  •  Esc pause', W / 2, H * 0.70 + 24);
  if (G.save) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#cfe8ff';
    ctx.fillText(`Welcome back — ${G.save.missionsDone} mission(s) done, $${G.save.cash} banked, best wanted ${G.save.bestWanted}★`, W / 2, H * 0.70 + 52);
  }
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(245,242,232,0.75)';
  ctx.fillText('A 100% original game. Nothing from any commercial series. Built for make.fun gta6-01.', W / 2, H - 24);
  ctx.restore();
}

export function drawPause(G) {
  const ctx = G.ctx;
  ctx.fillStyle = 'rgba(8, 12, 20, 0.72)';
  ctx.fillRect(0, 0, G.viewW, G.viewH);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText('PAUSED', G.viewW / 2, G.viewH / 2 - 30);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#e8e6df';
  ctx.fillText('Esc to resume  •  R to restart the day', G.viewW / 2, G.viewH / 2 + 16);
  ctx.restore();
}

export function drawEndScreen(G, kind) {
  const ctx = G.ctx;
  const W = G.viewW;
  const H = G.viewH;
  ctx.fillStyle = kind === 'complete' ? 'rgba(20, 60, 30, 0.82)' : 'rgba(10, 10, 18, 0.85)';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.textAlign = 'center';
  if (kind === 'busted') {
    ctx.fillStyle = '#4a7de8';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('BUSTED!', W / 2, H / 2 - 60);
    ctx.fillStyle = '#f5f2e8';
    ctx.font = '20px sans-serif';
    ctx.fillText('The Marisol PD caught up with Jax. The day starts over — the city remembers nothing.', W / 2, H / 2 - 10);
  } else if (kind === 'wasted') {
    ctx.fillStyle = '#e84a4a';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('WASTED', W / 2, H / 2 - 60);
    ctx.fillStyle = '#f5f2e8';
    ctx.font = '20px sans-serif';
    ctx.fillText('Jax went down in Marisol City. The city keeps moving without him.', W / 2, H / 2 - 10);
  } else {
    ctx.fillStyle = '#ffd21a';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('MARISOL IS YOURS', W / 2, H / 2 - 60);
    ctx.fillStyle = '#f5f2e8';
    ctx.font = '20px sans-serif';
    ctx.fillText(`All 5 missions complete — $${Math.floor(G.player.cash)} banked. Free roam the city, Jax.`, W / 2, H / 2 - 10);
  }
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#ffd21a';
  ctx.save();
  ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(G.time * 2));
  ctx.fillText('PRESS R TO PLAY AGAIN', W / 2, H / 2 + 48);
  ctx.restore();
  ctx.restore();
}
