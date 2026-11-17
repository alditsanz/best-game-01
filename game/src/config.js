// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Nights to light before dawn breaks and the game is won. */
export const NIGHTS_TO_WIN = 7;

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

/** A spitter is a slow, bloated moth that stops at range and spits slow gloom orbs at the keeper — the first enemy that shoots back. Orbs can be shot down or dodged. */
export const Spitter = {
  radius: 14,
  speed: 80,
  hp: 2,
  shards: 3,
  /** Share of spawns that are spitters, from night 3 on. */
  spawnShare: 0.10,
  /** It holds at about this distance from the keeper before it starts spitting. */
  holdRange: 280,
  /** Seconds between shots, and the telegraph before each one. */
  fireInterval: 2.8,
  telegraph: 0.4,
};

/** A lantern moth swallowed a shard of the lantern: it glows gold, it flees from the
 * keeper, and bursting it drops 5 shards. Hunt it — it will not come to you. */
export const LanternMoth = {
  radius: 11,
  speed: 190,
  hp: 1,
  shards: 5,
  /** Share of spawns that are lantern moths, from night 2 on. */
  spawnShare: 0.06,
  /** Inside this range it runs from the keeper instead of drifting. */
  fleeRange: 260,
};

/** A gloom orb: what a spitter spits. Slow, glowing, one hit — shoot it down or step aside. */
export const GloomOrb = {
  radius: 8,
  speed: 150,
  life: 7,
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
  /** Below this fraction of health she bursts in fury: one ring of gloom orbs. */
  desperateAt: 0.25,
  desperateOrbs: 8,
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

/** Moths alive at once, by night: the garden gets busier as the nights pass. Night 5 is
 * the Swarm Night — three more at once. Endless nights (8+) keep the cap at 24 and
 * add +3 only on Swarm nights. */
export function mothCapForNight(night) {
  const base = Math.min(8 + night * 2, 24);
  if (night <= NIGHTS_TO_WIN) return base + (night >= 5 ? 3 : 0) + (night >= NIGHTS_TO_WIN ? 2 : 0);
  const theme = nightTheme(night).id;
  return base + (theme === 'swarm' ? 3 : 0);
}

/** Spawn-interval multiplier by night: night 5 swarms, the last night is the Dawn Rush.
 * Endless nights swarm only on Swarm nights. */
export function spawnScaleForNight(night) {
  if (night <= NIGHTS_TO_WIN) {
    if (night === 5) return 0.8;
    return night >= NIGHTS_TO_WIN ? 0.85 : 1;
  }
  return nightTheme(night).id === 'swarm' ? 0.8 : 1;
}

/** What makes this night different from the others — every night has a name, and most
 * have a real spawn effect, not just a label. Night 2 is the Wisp Tide (wisps are
 * 30% of spawns, not 18%); night 4 is Spitter's Watch (spitters are 20% of spawns);
 * night 5 is the Swarm Night (faster spawns, higher cap — see the two functions
 * above); night 6 the Matriarch calls her swiftest (she spawns darters, not moths);
 * night 7 is the Dawn Rush. */
export function nightTheme(night) {
  if (night === 1) return { id: 'first-dark', name: 'First Dark', blurb: 'the garden wakes' };
  if (night === 2) return { id: 'wisp-tide', name: 'Wisp Tide', blurb: 'wisps swarm — 30% of spawns' };
  if (night === 3) return { id: 'matriarch-wakes', name: 'The Matriarch Wakes', blurb: 'she guards the lantern' };
  if (night === 4) return { id: 'spitters-watch', name: "Spitter's Watch", blurb: 'spitters double — 20% of spawns' };
  if (night === 5) return { id: 'swarm', name: 'Swarm Night', blurb: 'the garden spawns faster' };
  if (night === 6) return { id: 'matriarch-returns', name: 'The Matriarch Returns', blurb: 'she calls her swiftest' };
  if (night === NIGHTS_TO_WIN) return { id: 'dawn-rush', name: 'Dawn Rush', blurb: 'hold the line until dawn' };
  // Endless nights (8+) cycle the three modifiers, so no two endless nights play the same.
  const cycle = ['swarm', 'wisp-tide', 'spitters-watch'][(night - NIGHTS_TO_WIN - 1) % 3];
  if (cycle === 'swarm') return { id: 'swarm', name: 'Swarm Night', blurb: 'the garden spawns faster' };
  if (cycle === 'wisp-tide') return { id: 'wisp-tide', name: 'Wisp Tide', blurb: 'wisps swarm — 30% of spawns' };
  return { id: 'spitters-watch', name: "Spitter's Watch", blurb: 'spitters double — 20% of spawns' };
}

/** Ember Orbit: embers circling the keeper that bite moths (and gloom orbs) on contact. */
export const ORBIT = {
  radius: 120,
  turnSpeed: 2.6,
  damage: 1,
  hitCooldown: 0.5,
};

/** Lantern Flare: press E to spend shards from the lantern meter and burst every
 * moth (and gloom orb) close to the keeper. Shards are the night's quota, so a
 * flare buys safety with progress — and it has a cooldown. */
export const FLARE = {
  cost: 5,
  radius: 220,
  damage: 2,
  cooldown: 8,
};

/** Clearing a night without losing a heart pays a Flawless bonus. */
export const FLAWLESS_BONUS = 250;

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
    id: 'ember-orbit',
    title: 'Ember Orbit',
    blurb: 'Embers circle you, biting moths — and gloom orbs — on contact.',
    apply: (u) => { u.orbit += 1; },
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
  spitter: '#9b6bd8',
  spitterDark: '#6b3fb0',
  gloomOrb: '#c77dff',
  lanternMoth: '#ffd94d',
  lanternMothDark: '#c9a227',
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
