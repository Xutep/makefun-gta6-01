// Marisol City — tuning constants and palette.
// All sizes in world pixels; speeds in pixels per second.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 96;
export const AVENUES = [420, 920, 1420, 1920, 2420, 2920];
export const STREETS = [360, 820, 1280, 1740, 2200];
export const COLORS = {
  grass: '#5da24a',
  parkGrass: '#4c9440',
  sand: '#e8d28a',
  water: '#2f7fb8',
  road: '#3a3f46',
  roadLine: '#e8d44d',
  sidewalk: '#9aa0a6',
  buildingRoof: ['#c96f4a', '#7d8aa5', '#b5a06a', '#8a6f9e', '#5f8f7b', '#a55454'],
  buildingGlass: '#3d6f8e',
  palm: '#2f7a3d',
  car: ['#d23b3b', '#2f6fd0', '#e8b93b', '#e8e8e8', '#222831', '#3fae6a', '#c96fd0'],
  police: '#1e4fa3',
  player: '#f2c14e',
  hudBg: 'rgba(8, 14, 24, 0.72)',
  hudText: '#f5f2e8',
  accent: '#ffb347',
};
export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 265,
  radius: 13,
  maxHealth: 100,
  punchDamage: 12,
  pistolDamage: 34,
  pistolAmmo: 24,
  maxAmmo: 60,
};
export const CAR = {
  accel: 420,
  brake: 620,
  reverseMax: 150,
  maxSpeed: 460,
  sportsMax: 560,
  steer: 2.6,
  handbrake: 900,
  drag: 0.55,
};
export const WANTED_DECAY_SECONDS = 26;
export const MISSION_REWARDS = [400, 900, 1200, 1800, 3500];
export const DAY_LENGTH_SECONDS = 240;
