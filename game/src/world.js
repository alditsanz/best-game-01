// The garden's rules: the keeper, the embers, the moths, the boss, the shards and the
// nights. One fixed-step update; the renderer only paints what is here. The world knows
// nothing about keys, mouse or sound — the loop feeds it movement and aim, and reads back
// events.

import {
  BOSS,
  BOSS_NIGHTS,
  COMBO,
  Darter,
  FIELD,
  MOTH,
  NIGHTS_TO_WIN,
  PLAYER,
  SHARD,
  UPGRADES,
  mothCapForNight,
  quotaForNight,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;
export const EVENT_NIGHT_CLEAR = 8;
export const EVENT_BOSS = 16;
export const EVENT_PICKUP = 32;
export const EVENT_BURST = 64;

export const KIND_MOTH = 'moth';
export const KIND_DARTER = 'darter';

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
  };
}

export function createWorld(random) {
  const state = {
    player: { x: FIELD.width / 2, y: FIELD.height / 2, hearts: PLAYER.maxHearts, invuln: 0, fireTimer: 0, aimAngle: -Math.PI / 2 },
    upgrades: freshUpgrades(),
    embers: [],
    moths: [],
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
    state.moths.length = 0;
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
    state.shards.length = 0;
    state.particles.length = 0;
    state.texts.length = 0;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.kills = 0;
    state.nightCleared = false;
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

  /** One moth of either kind, at (x, y); boss-spawned moths pass a fixed wobbleSpeed, no edge pause, and 1 hp. */
  function makeMoth(kind, x, y, wobbleSpeed, pause, hp) {
    const cfg = kind === KIND_DARTER ? Darter : MOTH;
    const scaledHp = kind === KIND_DARTER ? 1 : Math.max(1, Math.round(MOTH.hp + MOTH.hpPerNight * (state.night - 1)));
    hp = hp ?? scaledHp;
    return {
      kind, x, y, hp, maxHp: hp, radius: cfg.radius,
      speed: kind === KIND_DARTER ? cfg.speed : Math.min(MOTH.speed + MOTH.speedPerNight * (state.night - 1), MOTH.maxSpeed),
      pause: pause ?? (kind === KIND_MOTH ? MOTH.edgePause : 0),
      wobble: random.range(0, TAU),
      wobbleSpeed: wobbleSpeed ?? random.range(1.5, 3),
      mode: 'drift',
      modeTimer: kind === KIND_DARTER ? Darter.aimTime : 0,
      lx: 0, ly: 0, flash: 0,
    };
  }

  function spawnMoth() {
    const p = edgePoint();
    const kind = random.next() < 0.3 ? KIND_DARTER : KIND_MOTH;
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

  function killMoth(index, events) {
    const moth = state.moths[index];
    state.moths.splice(index, 1);
    state.kills += 1;
    state.combo = Math.min(state.combo + COMBO.step, COMBO.max);
    state.comboTimer = COMBO.window;
    const gained = 10 * state.combo;
    state.score += gained;
    const darter = moth.kind === KIND_DARTER;
    const color = darter ? '#d86bb0' : '#8f7bd8';
    burst(moth.x, moth.y, color, darter ? 18 : 12, 180);
    dropShards(moth.x, moth.y, darter ? Darter.shards : MOTH.shards);
    addText(moth.x, moth.y - 18, `+${gained}`, '#ffe9a8');
    return events | EVENT_BURST;
  }

  function hurtPlayer(events) {
    const p = state.player;
    if (p.invuln > 0 || p.hearts <= 0) return events;
    p.hearts -= 1;
    p.invuln = PLAYER.invulnerable;
    state.combo = 0;
    state.comboTimer = 0;
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
        damage: u.emberDamage,
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
          if (b.hp <= 0) {
            state.score += 200 * Math.max(state.combo, 1);
            burst(b.x, b.y, '#b8579e', 40, 260);
            dropShards(b.x, b.y, BOSS.shards);
            addText(b.x, b.y - 60, '+200', '#ffe9a8');
            state.boss = null;
            events |= EVENT_BURST;
          }
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
      if (m.kind === KIND_DARTER) {
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
    const p = state.player;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    b.x += (dx / d) * b.speed * dt;
    b.y += (dy / d) * b.speed * dt;
    b.spawnTimer -= dt;
    if (b.spawnTimer <= 0 && state.moths.length < mothCapForNight(state.night)) {
      b.spawnTimer = BOSS.spawnInterval;
      const a = random.range(0, TAU);
      state.moths.push(makeMoth(KIND_MOTH, b.x + Math.cos(a) * (b.radius + 20), b.y + Math.sin(a) * (b.radius + 20), 2, 0, 1));
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

    const isBossNight = BOSS_NIGHTS.includes(state.night);
    if (isBossNight && !state.bossAnnounced && state.shardsCollected >= Math.floor(state.quota * 0.4)) {
      state.bossAnnounced = true;
      events |= spawnBoss();
    }
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.moths.length < mothCapForNight(state.night)) {
      state.spawnTimer = Math.max(MOTH.spawnInterval * Math.pow(MOTH.spawnScale, state.night - 1), MOTH.minSpawnInterval) * random.range(0.75, 1.25);
      spawnMoth();
    }

    events = stepEmbers(dt, events);
    events = stepMoths(dt, events);
    events = stepBoss(dt, events);
    events = stepShards(dt, events);
    stepParticles(dt);

    if (events & EVENT_OVER) return events;
    const bossGone = !isBossNight || (state.bossAnnounced && state.boss === null);
    if (state.shardsCollected >= state.quota && bossGone && !state.nightCleared) {
      state.nightCleared = true;
      state.score += 100 * state.night;
      if (state.night >= NIGHTS_TO_WIN) return events | EVENT_WIN;
      return events | EVENT_NIGHT_CLEAR;
    }
    return events;
  }

  return { state, reset, resetNight, step, rollUpgrades, applyUpgrade };
}
