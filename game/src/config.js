// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Nights to light before dawn breaks and the game is won. */
export const NIGHTS_TO_WIN = 7;

/** A boss (Gloom Matriarch) guards the lantern on these nights (1-based). */
export const BOSS_NIGHTS = [3, 6];

export const PLAYER = {
  radius: 16,
  speed: 300,
  fireInterval: 0.22,
  emberSpeed: 620,
  emberRadius: 5,
  emberDamage: 1,
  maxHearts: 3,
  invulnerable: 1.6,
  pickupRadius: 110,
};

export const MOTH = {
  radius: 15,
  speed: 62,
  speedPerNight: 7,
  maxSpeed: 150,
  hp: 1,
  hpPerNight: 0.35,
  shards: 2,
  spawnInterval: 1.15,
  spawnScale: 0.9,
  minSpawnInterval: 0.55,
  /** Seconds a moth waits at the edge, shivering, before it starts drifting in. */
  edgePause: 0.8,
};

export const Darter = {
  radius: 11,
  speed: 170,
  hp: 1,
  shards: 3,
  /** A darter pauses, aims, then lunges at the keeper. */
  aimTime: 0.9,
  lungeTime: 0.55,
};

/** A wisp is small, fast and weaves side to side — hard to hit, easy to dodge. */
export const Wisp = {
  radius: 9,
  speed: 175,
  hp: 1,
  shards: 2,
  /** Share of spawns that are wisps, from night 2 on. */
  spawnShare: 0.18,
};

/** A splitter is a slow, bloated moth with 2 hp — burst it and it tears into two fast motes. */
export const Splitter = {
  radius: 18,
  speed: 55,
  hp: 2,
  shards: 1,
  /** Share of spawns that are splitters, from night 3 on. */
  spawnShare: 0.12,
};

/** A mote is what a splitter leaves behind: tiny, fast, 1 hp — and it still bites. */
export const Mote = {
  radius: 7,
  speed: 180,
  hp: 1,
  shards: 1,
};

/** An elder is a big old moth, slow and tough (3 hp) but heavy with 4 shards. */
export const Elder = {
  radius: 20,
  speed: 45,
  hp: 3,
  shards: 4,
  /** Share of spawns that are elders, from night 5 on. */
  spawnShare: 0.10,
};

/** Ember Nova: a ring of embers bursting from the keeper on a timer. */
export const NOVA = {
  cooldown: 6,
  cooldownPerLevel: 0.8,
  minCooldown: 3.5,
  embers: 6,
  embersPerLevel: 2,
};

export const BOSS = {
  radius: 52,
  speed: 42,
  hp: 26,
  hpPerNight: 8,
  shards: 30,
  spawnInterval: 2.4,
  contactDamage: 1,
};

export const SHARD = {
  radius: 7,
  value: 1,
  magnetSpeed: 320,
  life: 20,
};

/** Shards needed to light the lantern on night n (1-based). */
export function quotaForNight(night) {
  return 14 + (night - 1) * 8;
}

/** Moths alive at once, by night: the garden gets busier as the nights pass. */
export function mothCapForNight(night) {
  return Math.min(8 + night * 2, 24) + (night >= NIGHTS_TO_WIN ? 2 : 0);
}

/** Spawn-interval multiplier by night: the last night is the Dawn Rush — faster. */
export function spawnScaleForNight(night) {
  return night >= NIGHTS_TO_WIN ? 0.85 : 1;
}

export const COMBO = {
  window: 2.5,
  step: 1,
  max: 8,
  /** Seconds of +1 ember damage when the combo hits its max — the Lantern Surge. */
  surgeDuration: 4,
};

/** Upgrade cards offered between nights. id, title, flavour, apply(state). */
export const UPGRADES = [
  {
    id: 'swift-embers',
    title: 'Swift Embers',
    blurb: 'Embers fly 35% faster and fire 20% quicker.',
    apply: (u) => { u.fireInterval *= 0.8; u.emberSpeed *= 1.35; },
  },
  {
    id: 'spread-shot',
    title: 'Tri-Flame',
    blurb: 'Shoot three embers in a fan instead of one.',
    apply: (u) => { u.shots += 2; },
  },
  {
    id: 'piercing-embers',
    title: 'Piercing Embers',
    blurb: 'Embers pass through one extra moth.',
    apply: (u) => { u.pierce += 1; },
  },
  {
    id: 'swift-boots',
    title: 'Mothwing Boots',
    blurb: 'Move 25% faster through the garden.',
    apply: (u) => { u.speed *= 1.25; },
  },
  {
    id: 'wide-net',
    title: 'Wide Net',
    blurb: 'Shards drift to you from twice as far.',
    apply: (u) => { u.pickupRadius *= 2; },
  },
  {
    id: 'heavy-embers',
    title: 'Heavy Embers',
    blurb: 'Each ember hits twice as hard.',
    apply: (u) => { u.emberDamage += 1; },
  },
  {
    id: 'ember-nova',
    title: 'Ember Nova',
    blurb: 'Every few seconds a ring of embers bursts from you.',
    apply: (u) => { u.nova += 1; },
  },
  {
    id: 'ember-echo',
    title: 'Ember Echo',
    blurb: 'Your combo lasts 2s longer and can climb to ×12.',
    apply: (u) => { u.comboWindow += 2; u.comboMax += 4; },
  },
  {
    id: 'lantern-ward',
    title: 'Lantern Ward',
    blurb: 'A ward that absorbs one hit each night, then renews.',
    apply: (u) => { u.ward += 1; },
  },
  {
    id: 'warm-heart',
    title: 'Warm Heart',
    blurb: 'Mend one heart now, and carry one more.',
    apply: (u) => { u.maxHearts += 1; },
  },
];

export const PALETTE = {
  backdrop: '#0d0a1a',
  garden: '#14102a',
  ground: '#1c1538',
  hedge: '#241b47',
  lanternGlow: '#ffd97a',
  ember: '#ffb347',
  emberCore: '#fff3c4',
  player: '#ffd97a',
  playerRing: '#fff3c4',
  moth: '#8f7bd8',
  mothDark: '#6b57b8',
  darter: '#d86bb0',
  wisp: '#7fe0c3',
  wispDark: '#3fae8c',
  splitter: '#c98a4b',
  splitterDark: '#8a5a28',
  mote: '#ffd27a',
  elder: '#d9a7ff',
  elderDark: '#a06fd0',
  boss: '#b8579e',
  shard: '#ffe9a8',
  text: '#f4ead8',
  muted: '#a99fc7',
  danger: '#ff6b6b',
  panel: '#1e1738',
  panelEdge: '#3a2d6b',
  card: '#251c48',
  cardEdge: '#57468f',
  heart: '#ff7d9c',
  heartEmpty: '#4a3f6e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberkeeper.best';
