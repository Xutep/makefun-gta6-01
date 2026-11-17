// Marisol City — story missions: 5 sequential jobs with dialog, waypoints,
// timers and fail conditions. After the last one the city is free roam.

import { MISSIONS } from './config.js';
import { dist } from './world.js';
import { wantedLevel } from './police.js';

export function createMissions() {
  return {
    index: 0, // current mission (0-based)
    done: 0, // missions completed
    steps: [],
    step: 0,
    waypoint: null,
    objective: '',
    timer: null,
    heatLock: false,
    surviveT: 0,
    dialogQueue: [],
    dialog: null,
    dialogT: 0,
    freeRoam: false,
  };
}

function setObjective(G, text) {
  G.missions.objective = text;
}

function setWaypoint(G, x, y, label) {
  G.missions.waypoint = { x, y, label };
}

function queueDialog(G, lines) {
  for (const [speaker, text] of lines) G.missions.dialogQueue.push({ speaker, text });
}

function startStep(G) {
  const M = G.missions;
  const step = M.steps[M.step];
  if (!step) return;
  if (step.kind === 'goto' || step.kind === 'collect' || step.kind === 'deliver') {
    setWaypoint(G, step.x, step.y, step.label);
    setObjective(G, step.label);
  } else if (step.kind === 'survive') {
    M.surviveT = step.seconds;
    M.timer = step.seconds;
    setObjective(G, `Survive the chase — ${step.seconds}s`);
    setWaypoint(G, G.player.x, G.player.y, 'Survive!');
  } else if (step.kind === 'board') {
    setWaypoint(G, step.x, step.y, step.label);
    setObjective(G, step.label);
  }
}

export function startMission(G, idx) {
  const M = G.missions;
  const L = G.world.landmarks;
  M.index = idx;
  M.step = 0;
  M.timer = null;
  M.heatLock = false;
  const def = MISSIONS[idx];
  queueDialog(G, def.dialog);

  if (idx === 0) {
    M.steps = [
      { kind: 'board', x: L.clientSpot.x, y: L.clientSpot.y, label: 'Pick up the client downtown (get in a car)' },
      { kind: 'deliver', x: L.clientDest.x, y: L.clientDest.y, label: 'Drive the client to the harbour district', time: 150 },
    ];
  } else if (idx === 1) {
    M.steps = [
      { kind: 'steal', x: L.sportsCarSpot.x, y: L.sportsCarSpot.y, label: 'Steal the red sports car uptown' },
      { kind: 'deliver', x: L.garage.x, y: L.garage.y, label: 'Bring it to Rico\'s garage' },
    ];
  } else if (idx === 2) {
    M.steps = L.packages.map((pk, i) => ({
      kind: 'collect', x: pk.x, y: pk.y, label: `Collect package ${i + 1} of 3 (stay under 3 stars)`,
    }));
  } else if (idx === 3) {
    M.steps = [
      { kind: 'survive', seconds: 60, label: 'Survive the 3-star chase' },
      { kind: 'deliver', x: L.pierDrop.x, y: L.pierDrop.y, label: 'Drop the package at the pier' },
    ];
  } else {
    M.steps = [
      ...L.bigScoreStops.map((s, i) => ({
        kind: 'collect', x: s.x, y: s.y, label: `Hit stop ${i + 1} of 3 — the Big Score`,
      })),
      { kind: 'deliver', x: L.hideout.x, y: L.hideout.y, label: 'Escape to the hideout!' },
    ];
  }
  startStep(G);
}

function completeStep(G) {
  const M = G.missions;
  M.step++;
  if (M.step >= M.steps.length) {
    completeMission(G);
  } else {
    startStep(G);
  }
}

function completeMission(G) {
  const M = G.missions;
  const def = MISSIONS[M.index];
  G.player.cash += def.reward;
  M.done++;
  G.audio.missionDone();
  G.audio.cash();
  queueDialog(G, def.complete);
  G.toast = `MISSION COMPLETE — ${def.name}  +$${def.reward}`;
  G.toastT = 4;
  M.heatLock = false;
  if (M.index === 3) {
    // heat from mission 4 cools off fast once it is done
    G.player.heat = Math.min(G.player.heat, 20);
  }
  if (M.index >= MISSIONS.length - 1) {
    M.freeRoam = true;
    M.objective = 'Free roam — Marisol City is yours. All 5 missions complete!';
    M.waypoint = null;
    G.state = 'complete';
    return;
  }
  startMission(G, M.index + 1);
}

function failMission(G, reason) {
  const M = G.missions;
  G.toast = `MISSION FAILED — ${reason}`;
  G.toastT = 4;
  G.audio.busted();
  // restart the same mission from its first step
  startMission(G, M.index);
}

export function updateMissions(G, dt) {
  const M = G.missions;
  const p = G.player;

  // dialog: one line at a time, 5s each or E to skip
  if (!M.dialog && M.dialogQueue.length > 0) {
    M.dialog = M.dialogQueue.shift();
    M.dialogT = 5;
  }
  if (M.dialog) {
    M.dialogT -= dt;
    if (M.dialogT <= 0 || G.input.pressed.has('e')) {
      M.dialog = null;
    }
  }

  if (M.freeRoam || G.state !== 'play') return;
  const step = M.steps[M.step];
  if (!step) return;

  // mission 4 / 5 heat lock: wanted is forced while the mission runs
  if (M.index === 3 && M.step === 0) {
    M.heatLock = true;
    p.heat = Math.max(p.heat, 60); // 3 stars
  }
  if (M.index === 4) {
    M.heatLock = true;
    p.heat = Math.max(p.heat, 80); // 4 stars
  }

  // mission 3: too much heat fails the deal
  if (M.index === 2 && wantedLevel(G) > 2) {
    failMission(G, 'the deal is off — too much heat');
    return;
  }

  // timers
  if (step.time && M.timer === null) M.timer = step.time;
  if (M.timer !== null && (step.kind === 'deliver' || step.kind === 'survive')) {
    M.timer -= dt;
    if (step.kind === 'survive') {
      M.surviveT = M.timer;
      setObjective(G, `Survive the chase — ${Math.ceil(Math.max(0, M.timer))}s`);
    } else {
      setObjective(G, `${step.label} — ${Math.ceil(Math.max(0, M.timer))}s left`);
    }
    if (M.timer <= 0) {
      if (step.kind === 'survive') {
        M.heatLock = false;
        p.heat = 40; // heat drops to 2 stars after the chase
        M.timer = null;
        completeStep(G);
      } else {
        failMission(G, 'out of time');
      }
      return;
    }
  }

  const d = dist(p.x, p.y, step.x, step.y);
  switch (step.kind) {
    case 'board': {
      // client boards only when the player arrives in a car
      if (d < 70) {
        if (p.car) {
          G.toast = 'Client aboard — drive!';
          G.toastT = 2;
          M.timer = null;
          completeStep(G);
        } else {
          setObjective(G, 'Pick up the client — you need a car first!');
        }
      }
      break;
    }
    case 'steal': {
      if (p.car && p.car === G.missionCar) {
        completeStep(G);
      } else if (d < 60) {
        setObjective(G, 'Press E to steal the red sports car');
      }
      break;
    }
    case 'collect':
    case 'deliver': {
      if (d < 64) {
        if (step.kind === 'collect') {
          G.audio.pickup();
          G.particles.push({
            x: step.x, y: step.y, vx: 0, vy: -40,
            life: 0.8, maxLife: 0.8, color: '#ffd21a', size: 6,
          });
        }
        M.timer = null;
        completeStep(G);
      }
      break;
    }
    case 'survive': {
      // handled by the timer above
      break;
    }
    default:
      break;
  }
}
