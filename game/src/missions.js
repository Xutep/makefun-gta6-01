// Marisol City — story: 5 sequential missions with dialog, waypoints,
// objectives and cash rewards. Free roam after the finale.
import { MISSION_REWARDS } from './config.js';
import { dist } from './random.js';
import { makeCar } from './vehicles.js';

export const MISSION_DEFS = [
  {
    id: 1, name: 'First Fare',
    brief: 'Pick up the client at the north plaza and drive them downtown before the meter runs out.',
    dialog: [
      'Jax: Another day, another fare. Marisol City never sleeps.',
      'Client: Take me downtown, driver. And step on it — I am late for a meeting.',
    ],
    reward: MISSION_REWARDS[0],
  },
  {
    id: 2, name: 'Hot Wheels',
    brief: 'Steal the marked sports car and bring it to the garage on the east side.',
    dialog: [
      'Rosa: A cherry-red Comet is parked by the marina. Bring it to my garage, no scratches.',
      'Jax: Stealing cars before lunch. Business as usual.',
    ],
    reward: MISSION_REWARDS[1],
  },
  {
    id: 3, name: 'The Pickup',
    brief: 'Collect 3 packages around the city. Keep your wanted level at 2 stars or below.',
    dialog: [
      'Rosa: Three packages, three corners of the city. Stay cool — the cops are watching.',
      'Jax: Quiet run. I can do quiet.',
    ],
    reward: MISSION_REWARDS[2],
  },
  {
    id: 4, name: 'Heat Rising',
    brief: 'Survive a 3-star chase, then deliver the package to the hideout.',
    dialog: [
      'Rosa: The job went loud. Lose the heat, then bring the package to the hideout.',
      'Jax: Three stars and counting. Time to disappear.',
    ],
    reward: MISSION_REWARDS[3],
  },
  {
    id: 5, name: 'The Big Score',
    brief: 'Hit three stops under 4-star heat, then escape to the hideout. The whole city is watching.',
    dialog: [
      'Rosa: One last job, Jax. Three stops, the whole city on alert. Make it count.',
      'Jax: Marisol City, this is the big score.',
    ],
    reward: MISSION_REWARDS[4],
  },
];

export function createMissionState(game) {
  return {
    index: 0,
    stage: 'intro',
    timer: 0,
    waypoint: null,
    collected: 0,
    stops: [],
    dialogLine: 0,
    dialogTimer: 0,
    done: false,
  };
}

function setWaypoint(game, x, y, label) {
  game.mission.waypoint = { x, y, label };
}

export function startMission(game) {
  const m = game.mission;
  const def = MISSION_DEFS[m.index];
  if (!def) { m.done = true; return; }
  m.stage = 'active';
  m.collected = 0;
  m.dialogLine = 0;
  m.dialogTimer = 5;
  game.showDialog(def.dialog[0]);
  game.audio.sfx('mission');
  const s = game.world.spawns;
  if (def.id === 1) {
    m.timer = 90;
    setWaypoint(game, s.client.x, s.client.y, 'Pick up the client');
  } else if (def.id === 2) {
    m.timer = 120;
    const car = makeCar(s.sportsCar.x, s.sportsCar.y, 0, '#d23b3b', 'sports', true);
    car.civilianOwned = false;
    car.missionCar = true;
    game.cars.push(car);
    game.missionCar = car;
    setWaypoint(game, s.sportsCar.x, s.sportsCar.y, 'Steal the sports car');
  } else if (def.id === 3) {
    m.timer = 180;
    m.stops = [
      { x: 700, y: 500, done: false },
      { x: 2500, y: 1900, done: false },
      { x: 2800, y: 600, done: false },
    ];
    setWaypoint(game, m.stops[0].x, m.stops[0].y, 'Package 1 of 3');
  } else if (def.id === 4) {
    m.timer = 150;
    game.addWanted(3, 'the job went loud');
    setWaypoint(game, s.hideout.x, s.hideout.y, 'Lose the heat, reach the hideout');
  } else if (def.id === 5) {
    m.timer = 240;
    m.stops = [
      { x: 420, y: 1740, done: false },
      { x: 2420, y: 360, done: false },
      { x: 3060, y: 1500, done: false },
    ];
    game.addWanted(2, 'the big score is on');
    setWaypoint(game, m.stops[0].x, m.stops[0].y, 'Stop 1 of 3');
  }
}

export function completeMission(game) {
  const m = game.mission;
  const def = MISSION_DEFS[m.index];
  game.cash += def.reward;
  game.audio.sfx('cash');
  game.showToast(`Mission complete: ${def.name} — +$${def.reward}`);
  game.missionsDone += 1;
  m.index += 1;
  m.stage = 'complete';
  m.completeTimer = 3.5;
  game.missionCar = null;
  if (m.index >= MISSION_DEFS.length) {
    m.done = true;
    game.showDialog('Rosa: That is the whole score, Jax. Marisol City is yours now — free roam.');
  }
}

function playerPos(game) {
  const p = game.player;
  return p.inCar ? { x: p.inCar.x, y: p.inCar.y } : { x: p.x, y: p.y };
}

export function updateMissions(game, dt) {
  const m = game.mission;
  if (m.done) return;
  if (m.stage === 'intro') {
    startMission(game);
    return;
  }
  if (m.stage === 'complete') {
    m.completeTimer -= dt;
    if (m.completeTimer <= 0) {
      m.stage = 'intro';
      game.clearDialog();
    }
    return;
  }
  const def = MISSION_DEFS[m.index];
  m.timer -= dt;
  if (m.dialogTimer > 0) {
    m.dialogTimer -= dt;
    if (m.dialogTimer <= 0 && m.dialogLine + 1 < def.dialog.length) {
      m.dialogLine += 1;
      game.showDialog(def.dialog[m.dialogLine]);
      m.dialogTimer = 5;
    }
  }
  if (m.timer <= 0) {
    game.showToast(`Mission failed: ${def.name} — out of time`);
    m.stage = 'intro';
    m.timer = 0;
    if (def.id === 2 && game.missionCar) {
      const i = game.cars.indexOf(game.missionCar);
      if (i >= 0) game.cars.splice(i, 1);
      game.missionCar = null;
    }
    return;
  }
  const pos = playerPos(game);
  const s = game.world.spawns;
  if (def.id === 1) {
    if (m.stage === 'active' && !m.pickedUp) {
      if (dist(pos.x, pos.y, s.client.x, s.client.y) < 60) {
        m.pickedUp = true;
        game.showDialog('Client: Good, you are here. Downtown, please — fast.');
        setWaypoint(game, s.downtown.x, s.downtown.y, 'Drop off downtown');
      }
    } else if (m.pickedUp && dist(pos.x, pos.y, s.downtown.x, s.downtown.y) < 70) {
      completeMission(game);
    }
  } else if (def.id === 2) {
    const car = game.missionCar;
    if (car && !m.stolen && game.player.inCar === car) {
      m.stolen = true;
      game.showDialog('Jax: Got it. Now get it to Rosa\'s garage in one piece.');
      setWaypoint(game, s.garage.x, s.garage.y, 'Deliver to the garage');
    } else if (m.stolen && dist(pos.x, pos.y, s.garage.x, s.garage.y) < 80) {
      completeMission(game);
    }
  } else if (def.id === 3) {
    if (game.wanted > 2) {
      game.showToast('Mission failed: wanted level too high');
      m.stage = 'intro';
      return;
    }
    const stop = m.stops[m.collected];
    if (stop && dist(pos.x, pos.y, stop.x, stop.y) < 60) {
      stop.done = true;
      m.collected += 1;
      game.audio.sfx('pickup');
      game.cash += 100;
      if (m.collected >= m.stops.length) {
        completeMission(game);
      } else {
        const next = m.stops[m.collected];
        setWaypoint(game, next.x, next.y, `Package ${m.collected + 1} of 3`);
      }
    }
  } else if (def.id === 4) {
    if (game.wanted >= 3 && !m.survived) {
      m.survived = true;
      game.showDialog('Jax: They are on me. Shake them, then run for the hideout.');
    }
    if (m.survived && game.wanted <= 1 && dist(pos.x, pos.y, s.hideout.x, s.hideout.y) < 80) {
      completeMission(game);
    }
  } else if (def.id === 5) {
    const stop = m.stops[m.collected];
    if (stop && dist(pos.x, pos.y, stop.x, stop.y) < 70) {
      stop.done = true;
      m.collected += 1;
      game.audio.sfx('pickup');
      if (m.collected >= m.stops.length) {
        setWaypoint(game, s.hideout.x, s.hideout.y, 'Escape to the hideout');
        m.escaping = true;
      } else {
        const next = m.stops[m.collected];
        setWaypoint(game, next.x, next.y, `Stop ${m.collected + 1} of 3`);
      }
    } else if (m.escaping && dist(pos.x, pos.y, s.hideout.x, s.hideout.y) < 80) {
      completeMission(game);
    }
  }
}

export function missionObjectiveText(game) {
  const m = game.mission;
  if (m.done) return 'Free roam — Marisol City is yours';
  const def = MISSION_DEFS[m.index];
  if (!def) return '';
  const wp = m.waypoint;
  const pos = playerPos(game);
  const d = wp ? Math.round(dist(pos.x, pos.y, wp.x, wp.y)) : 0;
  const time = Math.max(0, Math.ceil(m.timer));
  return `${def.id}. ${def.name} — ${wp ? wp.label : def.brief} (${d}m · ${time}s)`;
}
