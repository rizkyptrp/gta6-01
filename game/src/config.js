// Static configuration for Solara Bay: the city layout, the palette, the
// story cast and the mission script. Nothing here touches the renderer, so
// the HUD, the minimap and the missions all read the same truth.

export const CITY = {
  seed: 20261117,
  halfSize: 420,
  blockSize: 64,
  roadWidth: 14,
  streetCount: 11,
  beachZ: 400,
};

export const PALETTE = {
  skyTop: 0x2f7fc9,
  skyBottom: 0xffe3a3,
  sun: 0xfff2c0,
  road: 0x2b2f36,
  roadLine: 0xf5d76e,
  sidewalk: 0x9aa3a8,
  grass: 0x4f9e4d,
  sand: 0xe8d29a,
  sea: 0x1f7fa8,
  buildingColors: [0xd8c9a8, 0xb8c7d9, 0xe0a37e, 0xa8c6b0, 0xd9a0a0, 0xcfc4e0, 0x9fb8c8, 0xe8d29a],
  glass: 0x7fc4e8,
  carColors: [0xc0392b, 0x2471a3, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xecf0f1, 0x1a1a1a, 0xe67e22, 0x16a085],
};

// Districts of Solara Bay, drawn on the minimap and named in mission text.
export const DISTRICTS = [
  { name: 'Downtown', x: 0, z: -40, radius: 150 },
  { name: 'Marina', x: -260, z: 300, radius: 110 },
  { name: 'Old Town', x: 250, z: 220, radius: 120 },
  { name: 'The Docks', x: -280, z: -260, radius: 110 },
  { name: 'Palm Heights', x: 260, z: -240, radius: 110 },
  { name: 'Boardwalk', x: 0, z: 390, radius: 170 },
];

export const CAST = {
  hero: 'Mara Voss',
  fixer: 'Delia Crane',
  rival: 'Rocco Kane',
  cop: 'Chief Alda Reyes',
  mechanic: 'Tomas "Wrench" Ibarra',
};

// The five story missions. Each step is a waypoint the player must reach,
// sometimes with a timer, a wanted level, or enemies to clear first.
export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'MISSION 1 — FIRST WHEELS',
    briefing: 'Delia needs a driver. Steal any car on the street and bring it to her garage in Old Town.',
    steps: [
      { kind: 'stealCar', text: 'Steal a car — walk up to one and press E', x: 0, z: 0 },
      { kind: 'reach', text: 'Drive to Delia\'s garage in Old Town', x: 250, z: 220, radius: 22 },
    ],
    reward: 300,
  },
  {
    id: 'the-drop',
    title: 'MISSION 2 — THE DROP',
    briefing: 'A package for the Marina crew. Take the car to the docks before the buyers walk — 90 seconds.',
    steps: [
      { kind: 'reach', text: 'Deliver the package to the Marina — 90 seconds!', x: -260, z: 300, radius: 20, timer: 90 },
    ],
    reward: 500,
  },
  {
    id: 'heat',
    title: 'MISSION 3 — HEAT',
    briefing: 'Rocco Kane tipped off the Bay Police. Lose the 2-star wanted level, then meet Delia at the Boardwalk.',
    steps: [
      { kind: 'loseWanted', text: 'Lose the cops — break line of sight and stay hidden', x: 0, z: 0 },
      { kind: 'reach', text: 'Meet Delia on the Boardwalk', x: 0, z: 390, radius: 20 },
    ],
    reward: 700,
  },
  {
    id: 'payback',
    title: 'MISSION 4 — PAYBACK',
    briefing: 'Kane\'s crew is waiting at the Docks warehouse. Clear them out — click to shoot, stay behind cover.',
    steps: [
      { kind: 'reach', text: 'Reach the Docks warehouse', x: -280, z: -260, radius: 26 },
      { kind: 'combat', text: 'Take down Kane\'s crew (4 rivals)', x: -280, z: -260, radius: 30, enemies: 4 },
    ],
    reward: 1000,
  },
  {
    id: 'big-score',
    title: 'MISSION 5 — THE BIG SCORE',
    briefing: 'The last job: grab the cash from the Downtown bank, then lose a 3-star wanted level and escape by boat at the Marina.',
    steps: [
      { kind: 'reach', text: 'Hit the Downtown bank vault', x: 0, z: -40, radius: 18 },
      { kind: 'loseWanted', text: 'Escape the 3-star manhunt', x: 0, z: 0 },
      { kind: 'reach', text: 'Escape by boat at the Marina', x: -260, z: 300, radius: 20 },
    ],
    reward: 2500,
  },
];

export const CONTROLS_TEXT = {
  foot: 'WASD walk · SHIFT sprint · E steal car · Click shoot · P pause',
  car: 'W drive · S brake · A/D steer · SPACE handbrake · E exit car · P pause',
};

export const SAVE_KEY = 'solara-bay-save-v1';
