// Marisol City — rendering: camera, city, cars, peds, effects, waypoint
// marker. Top-down Canvas 2D, pseudo-3D building faces, day/dusk tint.

import { CFG, COLORS } from './config.js';
import { dist } from './world.js';

export function createCamera() {
  return { x: 0, y: 0, zoom: 1, targetZoom: 1 };
}

export function updateCamera(G, dt) {
  const cam = G.camera;
  const p = G.player;
  const vw = G.viewW / cam.zoom;
  const vh = G.viewH / cam.zoom;
  const tx = Math.max(vw / 2, Math.min(CFG.worldW - vw / 2, p.x));
  const ty = Math.max(vh / 2, Math.min(CFG.worldH - vh / 2, p.y));
  cam.x += (tx - cam.x) * Math.min(1, dt * 5);
  cam.y += (ty - cam.y) * Math.min(1, dt * 5);
  cam.zoom += (cam.targetZoom - cam.zoom) * Math.min(1, dt * 4);
}

function worldToScreen(G, x, y) {
  const cam = G.camera;
  return {
    x: (x - cam.x) * cam.zoom + G.viewW / 2,
    y: (y - cam.y) * cam.zoom + G.viewH / 2,
  };
}

export function render(G) {
  const ctx = G.ctx;
  const world = G.world;
  const cam = G.camera;
  ctx.clearRect(0, 0, G.viewW, G.viewH);

  const vw = G.viewW / cam.zoom;
  const vh = G.viewH / cam.zoom;
  const left = cam.x - vw / 2 - 40;
  const top = cam.y - vh / 2 - 40;
  const right = cam.x + vw / 2 + 40;
  const bottom = cam.y + vh / 2 + 40;

  ctx.save();
  ctx.translate(G.viewW / 2, G.viewH / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  // ground
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(left, top, right - left, bottom - top);

  // beach + water
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(left, Math.max(top, world.beachY), right - left, Math.max(0, Math.min(bottom, CFG.worldH) - Math.max(top, world.beachY)));
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(left, Math.max(top, world.waterY), right - left, Math.max(0, Math.min(bottom, CFG.worldH) - Math.max(top, world.waterY)));
  ctx.fillStyle = COLORS.waterDeep;
  for (let x = Math.floor(left / 90) * 90; x < right; x += 90) {
    ctx.fillRect(x, world.waterY + 30, 46, 4);
    ctx.fillRect(x + 30, world.waterY + 70, 46, 4);
  }

  // parks
  for (const pk of world.parks) {
    if (pk.x > right || pk.x + pk.w < left || pk.y > bottom || pk.y + pk.h < top) continue;
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.fillStyle = COLORS.pond;
    ctx.beginPath();
    ctx.ellipse(pk.x + pk.w * 0.62, pk.y + pk.h * 0.55, 46, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRoads(G, left, top, right, bottom);

  // harbour containers
  for (const c of world.containers) {
    if (c.x > right || c.x + c.w < left || c.y > bottom || c.y + c.h < top) continue;
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
  }

  // buildings with pseudo-3D side faces
  for (const b of world.buildings) {
    if (b.x > right || b.x + b.w < left || b.y > bottom || b.y + b.h < top) continue;
    const h = Math.min(b.hgt, 60) * 0.55;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + h * 0.4, b.y + h * 0.4, b.w, b.h);
    ctx.fillStyle = shade(b.color, -28);
    ctx.fillRect(b.x, b.y + b.h, b.w, h * 0.4);
    ctx.fillStyle = shade(b.color, -14);
    ctx.fillRect(b.x + b.w, b.y + h * 0.4, h * 0.4, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    if (b.downtown) {
      // glass tower windows
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      for (let wy = b.y + 8; wy < b.y + b.h - 8; wy += 14) {
        for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 14) {
          ctx.fillRect(wx, wy, 7, 5);
        }
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 4);
    }
  }

  // trees
  for (const t of world.trees) {
    if (t.x < left || t.x > right || t.y < top || t.y > bottom) continue;
    ctx.fillStyle = COLORS.treeTrunk;
    ctx.fillRect(t.x - 2, t.y - 2, 4, 5);
    ctx.fillStyle = t.palm ? COLORS.palm : COLORS.tree;
    ctx.beginPath();
    ctx.arc(t.x, t.y - 3, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 6, t.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // pickups
  for (const pk of G.pickups) {
    if (pk.x < left || pk.x > right || pk.y < top || pk.y > bottom) continue;
    const bob = Math.sin(pk.bob) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.fillStyle = pk.kind === 'ammo' ? '#ffd21a' : pk.kind === 'health' ? '#ff5a5a' : '#3aa655';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'ammo' ? 'A' : pk.kind === 'health' ? '+' : '$', 0, 1);
    ctx.restore();
  }

  // mission markers (packages / stops): pulsing diamonds
  drawMissionMarkers(G);

  // cars (parked first, then moving, player car last)
  const cars = [...G.cars].sort((a, b) => (a.driven ? 1 : 0) - (b.driven ? 1 : 0));
  for (const car of cars) drawCar(G, car);

  // pedestrians
  for (const ped of G.peds) drawPed(G, ped);

  // player on foot
  const p = G.player;
  if (p.onFoot) drawPlayerOnFoot(G, p);

  // bullets
  ctx.fillStyle = '#ffe27a';
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // particles
  for (const pt of G.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // waypoint beacon
  drawWaypoint(G);

  ctx.restore();

  // dusk tint for the beach chase shot
  if (G.dusk) {
    const grad = ctx.createLinearGradient(0, 0, 0, G.viewH);
    grad.addColorStop(0, 'rgba(255, 120, 40, 0.20)');
    grad.addColorStop(1, 'rgba(120, 40, 120, 0.30)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, G.viewW, G.viewH);
  }
}

function drawRoads(G, left, top, right, bottom) {
  const ctx = G.ctx;
  const world = G.world;
  const half = CFG.roadW / 2;
  ctx.fillStyle = COLORS.road;
  for (const ax of world.avenues) {
    if (ax + half < left || ax - half > right) continue;
    ctx.fillRect(ax - half, top, CFG.roadW, bottom - top);
  }
  for (const sy of world.streets) {
    if (sy + half < top || sy - half > bottom) continue;
    ctx.fillRect(left, sy - half, right - left, CFG.roadW);
  }
  // sidewalks: lighter strips along each road edge
  ctx.fillStyle = COLORS.sidewalk;
  for (const ax of world.avenues) {
    if (ax + half < left || ax - half > right) continue;
    ctx.fillRect(ax - half - 10, top, 10, bottom - top);
    ctx.fillRect(ax + half, top, 10, bottom - top);
  }
  for (const sy of world.streets) {
    if (sy + half < top || sy - half > bottom) continue;
    ctx.fillRect(left, sy - half - 10, right - left, 10);
    ctx.fillRect(left, sy + half, right - left, 10);
  }
  // lane dashes
  ctx.fillStyle = COLORS.lane;
  for (const ax of world.avenues) {
    if (ax + half < left || ax - half > right) continue;
    for (let y = Math.floor(top / 44) * 44; y < bottom; y += 44) {
      if (nearIntersection(world, ax, y)) continue;
      ctx.fillRect(ax - 2, y, 4, 22);
    }
  }
  for (const sy of world.streets) {
    if (sy + half < top || sy - half > bottom) continue;
    for (let x = Math.floor(left / 44) * 44; x < right; x += 44) {
      if (nearIntersection(world, x, sy)) continue;
      ctx.fillRect(x, sy - 2, 22, 4);
    }
  }
  // crosswalks at intersections
  ctx.fillStyle = COLORS.crosswalk;
  for (const ax of world.avenues) {
    for (const sy of world.streets) {
      if (ax < left - 60 || ax > right + 60 || sy < top - 60 || sy > bottom + 60) continue;
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(ax - half + 4, sy + i * 12 - 3, 14, 6);
        ctx.fillRect(ax + half - 18, sy + i * 12 - 3, 14, 6);
      }
    }
  }
}

function nearIntersection(world, x, y) {
  for (const sy of world.streets) if (Math.abs(y - sy) < 56) return true;
  for (const ax of world.avenues) if (Math.abs(x - ax) < 56) return true;
  return false;
}

function drawCar(G, car) {
  const ctx = G.ctx;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
  // body
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 7);
  ctx.fill();
  // police livery
  if (car.kind === 'police') {
    ctx.fillStyle = COLORS.policeBlack;
    ctx.fillRect(-car.w / 2 + 6, -car.h / 2, car.w - 12, 5);
    ctx.fillRect(-car.w / 2 + 6, car.h / 2 - 5, car.w - 12, 5);
    // flashing light bar
    const flash = Math.floor(G.time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2a2a' : '#2a6bff';
    ctx.fillRect(-6, -car.h / 2 - 2, 12, 5);
    ctx.fillStyle = flash ? '#2a6bff' : '#ff2a2a';
    ctx.fillRect(-6, car.h / 2 - 3, 12, 5);
  }
  // windshield + roof
  ctx.fillStyle = 'rgba(20, 30, 45, 0.85)';
  ctx.fillRect(car.w * 0.12, -car.h / 2 + 3, car.w * 0.2, car.h - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-car.w * 0.22, -car.h / 2 + 4, car.w * 0.24, car.h - 8);
  // headlights
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(car.w / 2 - 2, -car.h / 2 + 3, 3, 5);
  ctx.fillRect(car.w / 2 - 2, car.h / 2 - 8, 3, 5);
  // wheels
  ctx.fillStyle = '#14161a';
  ctx.fillRect(-car.w / 2 + 6, -car.h / 2 - 3, 10, 5);
  ctx.fillRect(-car.w / 2 + 6, car.h / 2 - 2, 10, 5);
  ctx.fillRect(car.w / 2 - 16, -car.h / 2 - 3, 10, 5);
  ctx.fillRect(car.w / 2 - 16, car.h / 2 - 2, 10, 5);
  // wreck smoke
  if (car.health <= 0) {
    ctx.fillStyle = 'rgba(80,80,80,0.7)';
    ctx.beginPath();
    ctx.arc(-car.w / 4, 0, 8 + Math.sin(G.time * 5) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // mission car marker (only while it is still parked, waiting to be stolen)
  if (car === G.missionCar && car.parked) {
    const s = worldToScreen(G, car.x, car.y);
    ctx.save();
    ctx.fillStyle = COLORS.waypoint;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼ STEAL THIS CAR', s.x, s.y - 34);
    ctx.restore();
  }
}

function drawPed(G, ped) {
  const ctx = G.ctx;
  const bob = ped.fleeing ? 2 : Math.sin(G.time * 6 + ped.x) * 1.5;
  ctx.save();
  ctx.translate(ped.x, ped.y + bob * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3 - 2, 5, 0, Math.PI * 2);
  ctx.fill();
  if (ped.kind === 'cop') {
    ctx.fillStyle = '#0f1c3f';
    ctx.beginPath();
    ctx.arc(0, -3, 5.5, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffd21a';
    ctx.fillRect(-5, -4, 10, 2);
  }
  ctx.restore();
}

function drawPlayerOnFoot(G, p) {
  const ctx = G.ctx;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 9, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle);
  // orange jacket, dark jeans — Jax Moreno
  ctx.fillStyle = COLORS.player;
  roundRect(ctx, -9, -8, 18, 16, 6);
  ctx.fill();
  ctx.fillStyle = '#222831';
  ctx.fillRect(7, -6, 5, 12);
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(10, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d2f5e';
  ctx.beginPath();
  ctx.arc(10, -1, 5.5, Math.PI, 0);
  ctx.fill();
  // pistol in hand when aiming
  if (p.ammo > 0) {
    ctx.fillStyle = '#222222';
    ctx.fillRect(12, -2, 9, 3);
  }
  ctx.restore();
}

function drawMissionMarkers(G) {
  const ctx = G.ctx;
  const M = G.missions;
  if (M.freeRoam || !M.steps[M.step]) return;
  const step = M.steps[M.step];
  if (step.kind === 'collect' || step.kind === 'deliver' || step.kind === 'board') {
    const pulse = 1 + Math.sin(G.time * 4) * 0.15;
    ctx.save();
    ctx.translate(step.x, step.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = 'rgba(255, 210, 26, 0.25)';
    ctx.fillRect(-20 * pulse, -20 * pulse, 40 * pulse, 40 * pulse);
    ctx.strokeStyle = COLORS.waypoint;
    ctx.lineWidth = 3;
    ctx.strokeRect(-16 * pulse, -16 * pulse, 32 * pulse, 32 * pulse);
    ctx.restore();
  }
  // client waiting marker
  if (M.index === 0 && M.step === 0) {
    const L = G.world.landmarks;
    ctx.save();
    ctx.fillStyle = '#4a7de8';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼ CLIENT', L.clientSpot.x, L.clientSpot.y - 30);
    ctx.restore();
  }
}

function drawWaypoint(G) {
  const ctx = G.ctx;
  const wp = G.missions.waypoint;
  if (!wp || G.state !== 'play') return;
  const cam = G.camera;
  const s = worldToScreen(G, wp.x, wp.y);
  const d = dist(G.player.x, G.player.y, wp.x, wp.y);
  // on-screen: draw a beacon column
  if (s.x > 0 && s.x < G.viewW && s.y > 0 && s.y < G.viewH) {
    ctx.save();
    ctx.strokeStyle = COLORS.waypoint;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 18 + Math.sin(G.time * 4) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.waypoint;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // off-screen: edge arrow pointing at it
  const margin = 60;
  const cx = Math.max(margin, Math.min(G.viewW - margin, s.x));
  const cy = Math.max(margin, Math.min(G.viewH - margin, s.y));
  if (cx !== s.x || cy !== s.y) {
    const a = Math.atan2(s.y - G.viewH / 2, s.x - G.viewW / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = COLORS.waypoint;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // distance label near the arrow / beacon
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,20,0.72)';
  const label = `${Math.round(d)}m`;
  ctx.font = 'bold 13px sans-serif';
  const w = ctx.measureText(label).width + 12;
  ctx.fillRect(cx - w / 2, cy + 16, w, 20);
  ctx.fillStyle = COLORS.waypoint;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + 26);
  ctx.restore();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
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
