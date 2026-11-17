// The garden's rules: the keeper, the embers, the moths, the boss, the shards and the
// nights. One fixed-step update; the renderer only paints what is here. The world knows
// nothing about keys, mouse or sound — the loop feeds it movement and aim, and reads back
// events.

import {
  BOSS,
  COMBO,
  CHAIN,
  Darter,
  Elder,
  FIELD,
  FLARE,
  FLAWLESS_BONUS,
  GloomOrb,
  LanternMoth,
  MOTH,
  Mote,
  NIGHTS_TO_WIN,
  NOVA,
  ORBIT,
  PLAYER,
  SHARD,
  Spitter,
  Splitter,
  UPGRADES,
  Wisp,
  mothCapForNight,
  nightTheme,
  quotaForNight,
  spawnScaleForNight,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;
export const EVENT_NIGHT_CLEAR = 8;
export const EVENT_BOSS = 16;
export const EVENT_PICKUP = 32;
export const EVENT_BURST = 64;
export const EVENT_NOVA = 128;
export const EVENT_ENRAGE = 256;
export const EVENT_WARD = 512;
export const EVENT_SPIT = 1024;
export const EVENT_FLARE = 2048;
export const EVENT_DESPERATE = 4096;

export const KIND_MOTH = 'moth';
export const KIND_DARTER = 'darter';
export const KIND_WISP = 'wisp';
export const KIND_SPLITTER = 'splitter';
export const KIND_MOTE = 'mote';
export const KIND_ELDER = 'elder';
export const KIND_SPITTER = 'spitter';
export const KIND_LANTERN_MOTH = 'lantern-moth';

const TAU = Math.PI * 2;

function freshUpgrades() {
  return {
    fireInterval: PLAYER.fireInterval,
    emberSpeed: PLAYER.emberSpeed,
    shots: 1,
    pierce: 0,
    speed: PLAYER.speed,
    pickupRadius: PLAYER.pickupRadius,
    emberDamage: PLAYER.emberDamage,
    maxHearts: PLAYER.maxHearts,
    nova: 0,
    comboWindow: COMBO.window,
    comboMax: COMBO.max,
    ward: 0,
    orbit: 0,
    chain: 0,
  };
}

export function createWorld(random) {
  const state = {
    player: { x: FIELD.width / 2, y: FIELD.height / 2, hearts: PLAYER.maxHearts, invuln: 0, fireTimer: 0, aimAngle: -Math.PI / 2 },
    upgrades: freshUpgrades(),
    embers: [],
    moths: [],
    orbs: [],
    orbiters: [],
    orbitAngle: 0,
    spitterShots: 0,
    orbsShotDown: 0,
    orbHits: 0,
    orbitHits: 0,
    chainHits: 0,
    chainFx: [],
    shards: [],
    particles: [],
    texts: [],
    boss: null,
    night: 1,
    score: 0,
    combo: 0,
    comboTimer: 0,
    shardsCollected: 0,
    quota: quotaForNight(1),
    spawnTimer: 1,
    bossSpawnTimer: 0,
    bossAnnounced: false,
    novaTimer: NOVA.cooldown,
    novaFires: 0,
    ward: 0,
    wardBlocks: 0,
    surgeTimer: 0,
    surgeTriggers: 0,
    flareTimer: 0,
    flareUses: 0,
    hitsThisNight: 0,
    flawlessNights: 0,
    /** True once the keeper keeps playing past dawn — endless nights never win again. */
    endless: false,
    time: 0,
    kills: 0,
    nightCleared: false,
    offer: [],
  };

  function resetNight(night) {
    state.night = night;
    state.quota = quotaForNight(night);
    state.shardsCollected = 0;
    state.spawnTimer = 0.8;
    state.bossSpawnTimer = 0;
    state.bossAnnounced = false;
    state.boss = null;
    state.nightCleared = false;
    state.ward = state.upgrades.ward;
    state.hitsThisNight = 0;
    state.moths.length = 0;
    state.orbs.length = 0;
    state.shards.length = 0;
    state.embers.length = 0;
  }

  function reset() {
    state.player.x = FIELD.width / 2;
    state.player.y = FIELD.height / 2;
    state.player.hearts = PLAYER.maxHearts;
    state.player.maxHearts = PLAYER.maxHearts;
    state.player.invuln = 0;
    state.player.fireTimer = 0;
    state.upgrades = freshUpgrades();
    state.embers.length = 0;
    state.moths.length = 0;
    state.orbs.length = 0;
    state.orbiters.length = 0;
    state.orbitAngle = 0;
    state.spitterShots = 0;
    state.orbsShotDown = 0;
    state.orbHits = 0;
    state.orbitHits = 0;
    state.chainHits = 0;
    state.chainFx.length = 0;
    state.shards.length = 0;
    state.particles.length = 0;
    state.texts.length = 0;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.kills = 0;
    state.nightCleared = false;
    state.novaTimer = NOVA.cooldown;
    state.novaFires = 0;
    state.ward = 0;
    state.wardBlocks = 0;
    state.surgeTimer = 0;
    state.surgeTriggers = 0;
    state.flareTimer = 0;
    state.flareUses = 0;
    state.hitsThisNight = 0;
    state.flawlessNights = 0;
    state.endless = false;
    state.time = 0;
    state.offer = [];
    resetNight(1);
  }

  function edgePoint() {
    const side = random.int(0, 3);
    const m = 24;
    if (side === 0) return { x: random.range(m, FIELD.width - m), y: -m };
    if (side === 1) return { x: random.range(m, FIELD.width - m), y: FIELD.height + m };
    if (side === 2) return { x: -m, y: random.range(m, FIELD.height - m) };
    return { x: FIELD.width + m, y: random.range(m, FIELD.height - m) };
  }

  /** One moth of any kind, at (x, y); boss-spawned moths pass a fixed wobbleSpeed, no edge pause, and 1 hp. Wisps, splitters, spitters, lantern moths, motes and elders never spawn from the boss. */
  function makeMoth(kind, x, y, wobbleSpeed, pause, hp) {
    const cfg = kind === KIND_DARTER ? Darter : kind === KIND_WISP ? Wisp : kind === KIND_SPLITTER ? Splitter : kind === KIND_SPITTER ? Spitter : kind === KIND_LANTERN_MOTH ? LanternMoth : kind === KIND_MOTE ? Mote : kind === KIND_ELDER ? Elder : MOTH;
    const scaledHp = kind === KIND_MOTH ? Math.max(1, Math.round(MOTH.hp + MOTH.hpPerNight * (state.night - 1))) : cfg.hp;
    hp = hp ?? scaledHp;
    return {
      kind, x, y, hp, maxHp: hp, radius: cfg.radius,
      speed: kind === KIND_MOTH ? Math.min(MOTH.speed + MOTH.speedPerNight * (state.night - 1), MOTH.maxSpeed) : cfg.speed,
      pause: pause ?? (kind === KIND_MOTH ? MOTH.edgePause : 0),
      wobble: random.range(0, TAU),
      wobbleSpeed: wobbleSpeed ?? random.range(1.5, 3),
      mode: 'drift',
      modeTimer: kind === KIND_DARTER ? Darter.aimTime : 0,
      fireTimer: kind === KIND_SPITTER ? random.range(1.2, Spitter.fireInterval) : 0,
      lx: 0, ly: 0, flash: 0,
    };
  }

  function spawnMoth() {
    const p = edgePoint();
    const r = random.next();
    // Night 1 keeps the old 30% darter share. From night 2, 6% of spawns are
    // lantern moths and wisps are 18% — 30% on the Wisp Tide (night 2) — and
    // 30% of the rest are darters; from night 3, 12% are splitters and 10%
    // are spitters — 20% on Spitter's Watch (night 4); from night 5, 10% of
    // the rest are elders — moths stay the majority.
    const splitterAt = state.night >= 3 ? Splitter.spawnShare : 0;
    const spitterShare = nightTheme(state.night).id === 'spitters-watch' ? 0.20 : Spitter.spawnShare;
    const spitterAt = splitterAt + (state.night >= 3 ? spitterShare * (1 - splitterAt) : 0);
    const lanternAt = spitterAt + (state.night >= 2 ? LanternMoth.spawnShare * (1 - spitterAt) : 0);
    const wispShare = nightTheme(state.night).id === 'wisp-tide' ? 0.30 : Wisp.spawnShare;
    const wispAt = lanternAt + (state.night >= 2 ? wispShare * (1 - lanternAt) : 0);
    const elderAt = wispAt + (state.night >= 5 ? Elder.spawnShare * (1 - wispAt) : 0);
    const darterAt = state.night >= 2 ? elderAt + (1 - elderAt) * 0.3 : 0.3;
    const kind = r < splitterAt ? KIND_SPLITTER : r < spitterAt ? KIND_SPITTER : r < lanternAt ? KIND_LANTERN_MOTH : r < wispAt ? KIND_WISP : r < elderAt ? KIND_ELDER : r < darterAt ? KIND_DARTER : KIND_MOTH;
    state.moths.push(makeMoth(kind, p.x, p.y));
  }

  function spawnBoss() {
    const p = edgePoint();
    const hp = BOSS.hp + BOSS.hpPerNight * (state.night - 1);
    state.boss = {
      x: p.x,
      y: p.y,
      hp,
      maxHp: hp,
      radius: BOSS.radius,
      speed: BOSS.speed,
      flash: 0,
      spawnTimer: 1.2,
      spawnInterval: BOSS.spawnInterval,
      enraged: false,
      desperate: false,
    };
    return EVENT_BOSS;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, TAU);
      const v = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: random.range(0.35, 0.8),
        maxLife: 0.8,
        size: random.range(2, 5),
        color,
      });
    }
  }

  function dropShards(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, TAU);
      const v = random.range(40, 130);
      state.shards.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: SHARD.life,
      });
    }
  }

  function addText(x, y, text, color) {
    state.texts.push({ x, y, text, color, life: 1 });
  }

  function killMoth(index, events, allowChain) {
    const moth = state.moths[index];
    state.moths.splice(index, 1);
    state.kills += 1;
    state.combo = Math.min(state.combo + COMBO.step, state.upgrades.comboMax);
    state.comboTimer = state.upgrades.comboWindow;
    // Max combo ignites a Lantern Surge: +1 ember damage for a few seconds.
    if (state.combo >= state.upgrades.comboMax && state.surgeTimer <= 0) {
      state.surgeTimer = COMBO.surgeDuration;
      state.surgeTriggers += 1;
      addText(state.player.x, state.player.y - 30, 'SURGE!', '#ffb347');
      burst(state.player.x, state.player.y, '#ffb347', 10, 160);
    }
    const gained = 10 * state.combo;
    state.score += gained;
    const darter = moth.kind === KIND_DARTER;
    const wisp = moth.kind === KIND_WISP;
    const splitter = moth.kind === KIND_SPLITTER;
    const spitter = moth.kind === KIND_SPITTER;
    const lantern = moth.kind === KIND_LANTERN_MOTH;
    const mote = moth.kind === KIND_MOTE;
    const elder = moth.kind === KIND_ELDER;
    const color = darter ? '#d86bb0' : wisp ? '#7fe0c3' : splitter ? '#c98a4b' : spitter ? '#9b6bd8' : lantern ? '#ffd94d' : mote ? '#ffd27a' : elder ? '#d9a7ff' : '#8f7bd8';
    burst(moth.x, moth.y, color, darter ? 18 : wisp ? 8 : splitter ? 22 : spitter ? 16 : lantern ? 14 : elder ? 20 : 6, 180);
    dropShards(moth.x, moth.y, darter ? Darter.shards : wisp ? Wisp.shards : splitter ? Splitter.shards : spitter ? Spitter.shards : lantern ? LanternMoth.shards : mote ? Mote.shards : elder ? Elder.shards : MOTH.shards);
    addText(moth.x, moth.y - 18, `+${gained}`, '#ffe9a8');
    // Ember Chain: the burst leaps to the nearest moth nearby, once per level.
    // Chain kills do not chain again — one leap per burst, not a cascade.
    if (allowChain !== false && state.upgrades.chain > 0) {
      let fx = moth.x;
      let fy = moth.y;
      for (let hop = 0; hop < state.upgrades.chain; hop += 1) {
        let target = -1;
        let targetD = CHAIN.range * CHAIN.range;
        for (let j = 0; j < state.moths.length; j += 1) {
          const m2 = state.moths[j];
          const dx = m2.x - fx;
          const dy = m2.y - fy;
          const d2 = dx * dx + dy * dy;
          if (d2 < targetD) { targetD = d2; target = j; }
        }
        if (target < 0) break;
        const m2 = state.moths[target];
        state.chainFx.push({ x1: fx, y1: fy, x2: m2.x, y2: m2.y, life: 0.25 });
        fx = m2.x;
        fy = m2.y;
        m2.hp -= CHAIN.damage;
        m2.flash = 0.12;
        state.chainHits += 1;
        burst(m2.x, m2.y, '#fff3c4', 5, 140);
        if (m2.hp <= 0) events = killMoth(target, events, false);
      }
    }
    if (splitter) {
      // A burst splitter tears into two fast motes — kill it at range, or deal with both.
      for (let i = 0; i < 2; i += 1) {
        const a = random.range(0, TAU);
        state.moths.push(makeMoth(KIND_MOTE, moth.x + Math.cos(a) * 18, moth.y + Math.sin(a) * 18, random.range(2, 3.5), 0, 1));
      }
    }
    return events | EVENT_BURST;
  }

  /** Ember damage right now: base, +1 while a Lantern Surge burns. */
  function emberDamage() {
    return state.upgrades.emberDamage + (state.surgeTimer > 0 ? 1 : 0);
  }

  /** Ember Nova: a ring of embers bursting out from the keeper in every direction. */
  function fireNova(events) {
    const p = state.player;
    const u = state.upgrades;
    const n = NOVA.embers + NOVA.embersPerLevel * (u.nova - 1);
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * TAU;
      state.embers.push({
        x: p.x + Math.cos(a) * (PLAYER.radius + 6),
        y: p.y + Math.sin(a) * (PLAYER.radius + 6),
        vx: Math.cos(a) * u.emberSpeed,
        vy: Math.sin(a) * u.emberSpeed,
        pierce: u.pierce,
        damage: emberDamage(),
      });
    }
    state.novaFires += 1;
    state.novaTimer = Math.max(NOVA.minCooldown, NOVA.cooldown - NOVA.cooldownPerLevel * (u.nova - 1));
    burst(p.x, p.y, '#ffb347', 14, 200);
    return events | EVENT_NOVA;
  }

  /** A spitter looses one gloom orb at the keeper — slow, glowing, shootable. */
  function fireOrb(m, events) {
    state.orbs.push({
      x: Math.min(FIELD.width, Math.max(0, m.x + m.lx * (m.radius + 10))),
      y: Math.min(FIELD.height, Math.max(0, m.y + m.ly * (m.radius + 10))),
      vx: m.lx * GloomOrb.speed,
      vy: m.ly * GloomOrb.speed,
      life: GloomOrb.life,
    });
    state.spitterShots += 1;
    return events | EVENT_SPIT;
  }

  function stepOrbs(dt, events) {
    const p = state.player;
    for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
      const o = state.orbs[i];
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.life -= dt;
      const dx = o.x - p.x;
      const dy = o.y - p.y;
      const rr = GloomOrb.radius + PLAYER.radius;
      if (dx * dx + dy * dy < rr * rr) {
        state.orbs.splice(i, 1);
        state.orbHits += 1;
        burst(o.x, o.y, '#c77dff', 10, 160);
        events = hurtPlayer(events);
        continue;
      }
      if (o.life <= 0 || o.x < -30 || o.x > FIELD.width + 30 || o.y < -30 || o.y > FIELD.height + 30) {
        state.orbs.splice(i, 1);
      }
    }
    return events;
  }

  /** Ember Orbit: the circling embers bite moths (and gloom orbs) they touch. */
  function stepOrbit(dt, events) {
    const u = state.upgrades;
    const want = u.orbit > 0 ? u.orbit + 1 : 0;
    while (state.orbiters.length < want) state.orbiters.push({ x: 0, y: 0, cd: 0 });
    while (state.orbiters.length > want) state.orbiters.pop();
    if (want === 0) return events;
    state.orbitAngle += ORBIT.turnSpeed * dt;
    const p = state.player;
    for (let i = 0; i < state.orbiters.length; i += 1) {
      const o = state.orbiters[i];
      const a = state.orbitAngle + (i / state.orbiters.length) * TAU;
      o.x = p.x + Math.cos(a) * ORBIT.radius;
      o.y = p.y + Math.sin(a) * ORBIT.radius;
      o.cd = Math.max(0, o.cd - dt);
      if (o.cd > 0) continue;
      let hit = false;
      for (let j = state.moths.length - 1; j >= 0; j -= 1) {
        const m = state.moths[j];
        const dx = o.x - m.x;
        const dy = o.y - m.y;
        const rr = 8 + m.radius;
        if (dx * dx + dy * dy < rr * rr) {
          m.hp -= ORBIT.damage;
          m.flash = 0.12;
          burst(o.x, o.y, '#ffb347', 4, 120);
          state.orbitHits += 1;
          if (m.hp <= 0) events = killMoth(j, events);
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (let j = state.orbs.length - 1; j >= 0; j -= 1) {
          const g = state.orbs[j];
          const dx = o.x - g.x;
          const dy = o.y - g.y;
          const rr = 8 + GloomOrb.radius;
          if (dx * dx + dy * dy < rr * rr) {
            state.orbs.splice(j, 1);
            state.orbsShotDown += 1;
            state.orbitHits += 1;
            burst(g.x, g.y, '#c77dff', 6, 140);
            hit = true;
            break;
          }
        }
      }
      if (hit) o.cd = ORBIT.hitCooldown;
    }
    return events;
  }

  /** The Matriarch falls: score, a burst, and her 30 shards. Shared by embers and the flare. */
  function killBoss(events) {
    const b = state.boss;
    state.score += 200 * Math.max(state.combo, 1);
    burst(b.x, b.y, '#b8579e', 40, 260);
    dropShards(b.x, b.y, BOSS.shards);
    addText(b.x, b.y - 60, '+200', '#ffe9a8');
    state.boss = null;
    return events | EVENT_BURST;
  }

  /** Lantern Flare (key E): spend 5 shards from the lantern meter to burst every moth
   * and gloom orb close to the keeper. On cooldown, or short of shards, it does nothing. */
  function flare() {
    if (state.flareTimer > 0 || state.shardsCollected < FLARE.cost) return 0;
    const p = state.player;
    state.shardsCollected -= FLARE.cost;
    state.flareTimer = FLARE.cooldown;
    state.flareUses += 1;
    let events = EVENT_FLARE;
    for (let j = state.moths.length - 1; j >= 0; j -= 1) {
      const m = state.moths[j];
      const dx = m.x - p.x;
      const dy = m.y - p.y;
      if (dx * dx + dy * dy < (FLARE.radius + m.radius) * (FLARE.radius + m.radius)) {
        m.hp -= FLARE.damage;
        m.flash = 0.12;
        if (m.hp <= 0) events = killMoth(j, events);
      }
    }
    if (state.boss) {
      const b = state.boss;
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      if (dx * dx + dy * dy < (FLARE.radius + b.radius) * (FLARE.radius + b.radius)) {
        b.hp -= FLARE.damage;
        b.flash = 0.12;
        if (b.hp <= 0) events = killBoss(events);
      }
    }
    for (let j = state.orbs.length - 1; j >= 0; j -= 1) {
      const g = state.orbs[j];
      const dx = g.x - p.x;
      const dy = g.y - p.y;
      if (dx * dx + dy * dy < (FLARE.radius + GloomOrb.radius) * (FLARE.radius + GloomOrb.radius)) {
        state.orbs.splice(j, 1);
        state.orbsShotDown += 1;
      }
    }
    burst(p.x, p.y, '#ffd97a', 26, 320);
    addText(p.x, p.y - 30, 'FLARE!', '#ffd97a');
    return events;
  }

  function hurtPlayer(events) {
    const p = state.player;
    if (p.invuln > 0 || p.hearts <= 0) return events;
    // A Lantern Ward eats the hit instead: no heart lost, combo kept, brief cover.
    if (state.ward > 0) {
      state.ward -= 1;
      state.wardBlocks += 1;
      p.invuln = 1.0;
      burst(p.x, p.y, '#ffd27a', 18, 220);
      addText(p.x, p.y - 30, 'WARD!', '#ffd27a');
      return events | EVENT_WARD;
    }
    p.hearts -= 1;
    p.invuln = PLAYER.invulnerable;
    state.combo = 0;
    state.comboTimer = 0;
    state.hitsThisNight += 1;
    burst(p.x, p.y, '#ff6b6b', 16, 220);
    events |= EVENT_HIT;
    if (p.hearts <= 0) events |= EVENT_OVER;
    return events;
  }

  function fireEmbers(aim) {
    const p = state.player;
    const u = state.upgrades;
    const base = Math.atan2(aim.y - p.y, aim.x - p.x);
    p.aimAngle = base;
    const n = u.shots;
    for (let i = 0; i < n; i += 1) {
      const offset = (i - (n - 1) / 2) * 0.22;
      const a = base + offset;
      state.embers.push({
        x: p.x + Math.cos(a) * (PLAYER.radius + 6),
        y: p.y + Math.sin(a) * (PLAYER.radius + 6),
        vx: Math.cos(a) * u.emberSpeed,
        vy: Math.sin(a) * u.emberSpeed,
        pierce: u.pierce,
        damage: emberDamage(),
      });
    }
    burst(p.x + Math.cos(base) * 22, p.y + Math.sin(base) * 22, '#ffb347', 3, 90);
  }

  function stepEmbers(dt, events) {
    const p = state.player;
    for (let i = state.embers.length - 1; i >= 0; i -= 1) {
      const e = state.embers[i];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      let dead = e.x < -20 || e.x > FIELD.width + 20 || e.y < -20 || e.y > FIELD.height + 20;
      if (!dead) {
        // Gloom orbs can be shot down — an ember that meets one bursts it.
        for (let j = state.orbs.length - 1; j >= 0; j -= 1) {
          const g = state.orbs[j];
          const rr = e.x - g.x;
          const ry = e.y - g.y;
          if (rr * rr + ry * ry < (PLAYER.emberRadius + GloomOrb.radius) * (PLAYER.emberRadius + GloomOrb.radius)) {
            state.orbs.splice(j, 1);
            state.orbsShotDown += 1;
            burst(g.x, g.y, '#c77dff', 6, 140);
            if (e.pierce > 0) e.pierce -= 1;
            else dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (let j = state.moths.length - 1; j >= 0; j -= 1) {
          const m = state.moths[j];
          const rr = e.x - m.x;
          const ry = e.y - m.y;
          if (rr * rr + ry * ry < (PLAYER.emberRadius + m.radius) * (PLAYER.emberRadius + m.radius)) {
            m.hp -= e.damage;
            m.flash = 0.12;
            burst(e.x, e.y, '#ffb347', 4, 120);
            if (m.hp <= 0) events = killMoth(j, events);
            if (e.pierce > 0) e.pierce -= 1;
            else { dead = true; }
            break;
          }
        }
      }
      if (!dead && state.boss) {
        const b = state.boss;
        const rr = e.x - b.x;
        const ry = e.y - b.y;
        if (rr * rr + ry * ry < (PLAYER.emberRadius + b.radius) * (PLAYER.emberRadius + b.radius)) {
          b.hp -= e.damage;
          b.flash = 0.12;
          burst(e.x, e.y, '#ffb347', 5, 140);
          if (b.hp <= 0) events = killBoss(events);
          if (e.pierce > 0) e.pierce -= 1;
          else dead = true;
        }
      }
      if (dead) state.embers.splice(i, 1);
    }
    return events;
  }

  function stepMoths(dt, events) {
    const p = state.player;
    for (let i = state.moths.length - 1; i >= 0; i -= 1) {
      const m = state.moths[i];
      m.flash = Math.max(0, m.flash - dt);
      if (m.pause > 0) {
        m.pause -= dt;
        continue;
      }
      m.wobble += m.wobbleSpeed * dt;
      const dx = p.x - m.x;
      const dy = p.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      if (m.kind === KIND_WISP) {
        // A wisp weaves hard side to side as it closes in — fast, but it telegraphs.
        const px = -dy / d;
        const py = dx / d;
        const weave = Math.sin(m.wobble * 2.4) * 120;
        m.x += ((dx / d) * m.speed + px * weave) * dt;
        m.y += ((dy / d) * m.speed + py * weave) * dt;
      } else if (m.kind === KIND_LANTERN_MOTH) {
        // A lantern moth flees: inside its range it runs from the keeper, faster
        // than a moth but slower than the keeper — chase it down for its 5 shards.
        if (d < LanternMoth.fleeRange) {
          m.x -= (dx / d) * m.speed * dt;
          m.y -= (dy / d) * m.speed * dt;
        } else {
          m.x += Math.cos(m.wobble) * m.speed * 0.3 * dt;
          m.y += Math.sin(m.wobble) * m.speed * 0.3 * dt;
        }
        // It never sits still at the edge: keep it inside the garden.
        m.x = Math.min(FIELD.width - m.radius, Math.max(m.radius, m.x));
        m.y = Math.min(FIELD.height - m.radius, Math.max(m.radius, m.y));
      } else if (m.kind === KIND_SPITTER) {
        // A spitter closes to its hold range, strafes, then telegraphs a shot:
        // it aims where the keeper is when the glow starts, so stepping aside dodges it.
        // The fire timer runs while it approaches too — a spitter that is left alone
        // will shoot from the dark, not only once it has arrived.
        if (m.mode === 'telegraph') {
          m.modeTimer -= dt;
          if (m.modeTimer <= 0) {
            m.mode = 'hold';
            m.fireTimer = Spitter.fireInterval;
            events = fireOrb(m, events);
          }
        } else {
          if (d > Spitter.holdRange) {
            m.x += (dx / d) * m.speed * dt;
            m.y += (dy / d) * m.speed * dt;
          } else {
            const px = -dy / d;
            const py = dx / d;
            m.x += px * Math.sin(m.wobble * 1.4) * 46 * dt;
            m.y += py * Math.sin(m.wobble * 1.4) * 46 * dt;
          }
          m.fireTimer -= dt;
          if (m.fireTimer <= 0) {
            m.mode = 'telegraph';
            m.modeTimer = Spitter.telegraph;
            m.lx = dx / d;
            m.ly = dy / d;
          }
        }
      } else if (m.kind === KIND_MOTE) {
        // A mote darts straight at the keeper, jittering — small, fast, no pause.
        m.x += (dx / d) * m.speed * dt + Math.cos(m.wobble) * 60 * dt;
        m.y += (dy / d) * m.speed * dt + Math.sin(m.wobble) * 60 * dt;
      } else if (m.kind === KIND_DARTER) {
        if (m.mode === 'drift') {
          m.modeTimer -= dt;
          m.x += (dx / d) * m.speed * 0.35 * dt + Math.cos(m.wobble) * 26 * dt;
          m.y += (dy / d) * m.speed * 0.35 * dt + Math.sin(m.wobble) * 26 * dt;
          if (m.modeTimer <= 0) {
            m.mode = 'lunge';
            m.modeTimer = Darter.lungeTime;
            m.lx = dx / d;
            m.ly = dy / d;
          }
        } else {
          m.x += m.lx * m.speed * 1.6 * dt;
          m.y += m.ly * m.speed * 1.6 * dt;
          m.modeTimer -= dt;
          if (m.modeTimer <= 0) {
            m.mode = 'drift';
            m.modeTimer = Darter.aimTime;
          }
        }
      } else {
        m.x += (dx / d) * m.speed * dt + Math.cos(m.wobble) * 34 * dt;
        m.y += (dy / d) * m.speed * dt + Math.sin(m.wobble) * 34 * dt;
      }
      const rr = m.x - p.x;
      const ry = m.y - p.y;
      if (rr * rr + ry * ry < (m.radius + PLAYER.radius) * (m.radius + PLAYER.radius)) {
        events = hurtPlayer(events);
        state.moths.splice(i, 1);
        burst(m.x, m.y, '#8f7bd8', 10, 160);
      }
    }
    return events;
  }

  function stepBoss(dt, events) {
    const b = state.boss;
    if (!b) return events;
    b.flash = Math.max(0, b.flash - dt);
    // Below half health the Matriarch enrages: faster, and she calls moths sooner.
    if (!b.enraged && b.hp <= b.maxHp / 2) {
      b.enraged = true;
      b.speed *= 1.25;
      b.spawnInterval = 2.0;
      events |= EVENT_ENRAGE;
    }
    // Below a quarter she bursts in fury — one ring of gloom orbs, once.
    // The ring is slow and shootable, but standing still inside it hurts.
    if (!b.desperate && b.hp <= b.maxHp * BOSS.desperateAt) {
      b.desperate = true;
      for (let i = 0; i < BOSS.desperateOrbs; i += 1) {
        const a = (i / BOSS.desperateOrbs) * TAU;
        state.orbs.push({
          x: Math.min(FIELD.width, Math.max(0, b.x + Math.cos(a) * (b.radius + 10))),
          y: Math.min(FIELD.height, Math.max(0, b.y + Math.sin(a) * (b.radius + 10))),
          vx: Math.cos(a) * GloomOrb.speed,
          vy: Math.sin(a) * GloomOrb.speed,
          life: GloomOrb.life,
        });
      }
      state.spitterShots += BOSS.desperateOrbs;
      burst(b.x, b.y, '#c77dff', 24, 260);
      addText(b.x, b.y - 60, 'FURY!', '#c77dff');
      events |= EVENT_DESPERATE;
    }
    const p = state.player;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    b.x += (dx / d) * b.speed * dt;
    b.y += (dy / d) * b.speed * dt;
    b.spawnTimer -= dt;
    if (b.spawnTimer <= 0 && state.moths.length < mothCapForNight(state.night)) {
      b.spawnTimer = b.spawnInterval;
      const a = random.range(0, TAU);
      // On night 6 the Matriarch calls her swiftest: darters, not moths.
      const spawnKind = state.night >= 6 ? KIND_DARTER : KIND_MOTH;
      state.moths.push(makeMoth(spawnKind, b.x + Math.cos(a) * (b.radius + 20), b.y + Math.sin(a) * (b.radius + 20), 2, 0, 1));
    }
    const rr = b.x - p.x;
    const ry = b.y - p.y;
    if (rr * rr + ry * ry < (b.radius + PLAYER.radius) * (b.radius + PLAYER.radius)) {
      events = hurtPlayer(events);
    }
    return events;
  }

  function stepShards(dt, events) {
    const p = state.player;
    const u = state.upgrades;
    for (let i = state.shards.length - 1; i >= 0; i -= 1) {
      const s = state.shards[i];
      s.life -= dt;
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < u.pickupRadius * u.pickupRadius) {
        const d = Math.sqrt(d2) || 1;
        const pull = SHARD.magnetSpeed * (1.6 - d / (u.pickupRadius * 1.6));
        s.x += (dx / d) * pull * dt;
        s.y += (dy / d) * pull * dt;
      } else {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.96;
        s.vy *= 0.96;
      }
      if (d2 < (PLAYER.radius + SHARD.radius) * (PLAYER.radius + SHARD.radius)) {
        state.shards.splice(i, 1);
        state.shardsCollected += SHARD.value;
        state.score += 5;
        events |= EVENT_PICKUP;
        continue;
      }
      if (s.life <= 0) state.shards.splice(i, 1);
    }
    return events;
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const t = state.texts[i];
      t.y -= 34 * dt;
      t.life -= dt * 0.9;
      if (t.life <= 0) state.texts.splice(i, 1);
    }
    for (let i = state.chainFx.length - 1; i >= 0; i -= 1) {
      state.chainFx[i].life -= dt;
      if (state.chainFx[i].life <= 0) state.chainFx.splice(i, 1);
    }
  }

  function rollUpgrades() {
    const pool = UPGRADES.slice();
    const picked = [];
    while (picked.length < 3 && pool.length > 0) {
      const index = Math.floor(random.next() * pool.length);
      picked.push(pool.splice(index, 1)[0]);
    }
    state.offer = picked;
    return picked;
  }

  function applyUpgrade(id) {
    const found = state.offer.find((u) => u.id === id);
    if (!found) return false;
    found.apply(state.upgrades);
    if (id === 'warm-heart') {
      state.player.maxHearts = state.upgrades.maxHearts;
      state.player.hearts = Math.min(state.player.hearts + 1, state.upgrades.maxHearts);
    }
    state.offer = [];
    return true;
  }

  /** Advance the world one fixed step. In attract mode the garden drifts on its own. */
  function step(dt, move, aim, firing, attract) {
    let events = 0;
    state.time += dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.surgeTimer > 0) state.surgeTimer -= dt;
    if (state.flareTimer > 0) state.flareTimer -= dt;
    const p = state.player;
    if (attract) {
      if (state.moths.length < 6 && random.next() < dt * 0.9) spawnMoth();
      for (let i = state.moths.length - 1; i >= 0; i -= 1) {
        const m = state.moths[i];
        m.wobble += m.wobbleSpeed * dt;
        m.x += Math.cos(m.wobble) * 40 * dt;
        m.y += 26 * dt + Math.sin(m.wobble) * 20 * dt;
        if (m.y > FIELD.height + 40) state.moths.splice(i, 1);
      }
      stepParticles(dt);
      return 0;
    }

    p.invuln = Math.max(0, p.invuln - dt);
    p.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, p.x + move.x * state.upgrades.speed * dt));
    p.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, p.y + move.y * state.upgrades.speed * dt));
    p.fireTimer -= dt;
    if (firing && p.fireTimer <= 0) {
      p.fireTimer = state.upgrades.fireInterval;
      fireEmbers(aim);
    }
    if (state.upgrades.nova > 0) {
      state.novaTimer -= dt;
      if (state.novaTimer <= 0) events = fireNova(events);
    }

    // A boss guards the lantern every 3rd night — nights 3 and 6, then 9, 12, … endless.
    const isBossNight = state.night % 3 === 0;
    if (isBossNight && !state.bossAnnounced && state.shardsCollected >= Math.floor(state.quota * 0.4)) {
      state.bossAnnounced = true;
      events |= spawnBoss();
    }
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.moths.length < mothCapForNight(state.night)) {
      state.spawnTimer = Math.max(MOTH.spawnInterval * Math.pow(MOTH.spawnScale, state.night - 1), MOTH.minSpawnInterval) * spawnScaleForNight(state.night) * random.range(0.75, 1.25);
      spawnMoth();
    }

    events = stepEmbers(dt, events);
    events = stepMoths(dt, events);
    events = stepBoss(dt, events);
    events = stepOrbs(dt, events);
    events = stepOrbit(dt, events);
    events = stepShards(dt, events);
    stepParticles(dt);

    if (events & EVENT_OVER) return events;
    const bossGone = !isBossNight || (state.bossAnnounced && state.boss === null);
    if (state.shardsCollected >= state.quota && bossGone && !state.nightCleared) {
      state.nightCleared = true;
      state.score += 100 * state.night;
      // A night cleared without losing a heart pays the Flawless bonus.
      if (state.hitsThisNight === 0) {
        state.score += FLAWLESS_BONUS;
        state.flawlessNights += 1;
        addText(state.player.x, state.player.y - 30, `FLAWLESS! +${FLAWLESS_BONUS}`, '#ffd97a');
      }
      if (state.night === NIGHTS_TO_WIN && !state.endless) return events | EVENT_WIN;
      return events | EVENT_NIGHT_CLEAR;
    }
    return events;
  }

  return { state, reset, resetNight, step, flare, rollUpgrades, applyUpgrade };
}
