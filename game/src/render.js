// Everything the eye sees: the ember-garden, the keeper, the moths, the boss, the shards,
// the HUD and the five screens (title, play, upgrade, paused, game over, victory). The
// renderer never changes the world; it paints the state it is given.

import { DIFFICULTIES, FEATS, FIELD, FONT, NIGHTS_TO_WIN, PALETTE, PLAYER, REALMS, difficultyById, nightTheme, realmForNight } from './config.js';

const TAU = Math.PI * 2;

/** Font string: weight + px size in the game's one font stack. */
const F = (w, s) => `${w} ${s}px ${FONT}`;

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** Upgrade-card geometry (w/h/gap/top), shared by the upgrade screen and main.js's click picker. */
export const CARD = { w: 300, h: 210, gap: 28, y: 148 };

/** Road-card geometry (w/h/gap/top), shared by the upgrade screen and main.js's click picker. */
export const PATH_CARD = { w: 300, h: 118, gap: 28, y: 412 };

/** Difficulty-card geometry (w/h/gap/top), shared by the title screen and main.js's click picker. */
export const DIFF_CARD = { w: 220, h: 76, gap: 16, y: 512 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHeart(ctx, x, y, size, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-9, -3, -5, -9, 0, -4);
  ctx.bezierCurveTo(5, -9, 9, -3, 0, 5);
  ctx.closePath();
  ctx.fillStyle = filled ? PALETTE.heart : PALETTE.heartEmpty;
  ctx.fill();
  ctx.restore();
}

function drawLantern(ctx, x, y, scale, lit, flicker) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (lit) {
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 46 + flicker * 6);
    glow.addColorStop(0, 'rgba(255, 217, 122, 0.55)');
    glow.addColorStop(1, 'rgba(255, 217, 122, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#3a2d6b';
  ctx.fillRect(-2, -26, 4, 8);
  ctx.fillStyle = lit ? PALETTE.lanternGlow : '#4a3f6e';
  ctx.beginPath();
  ctx.moveTo(-11, -18);
  ctx.lineTo(11, -18);
  ctx.lineTo(8, 12);
  ctx.lineTo(-8, 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2c2350';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#2c2350';
  ctx.fillRect(-13, 12, 26, 4);
  ctx.fillRect(-13, -21, 26, 3);
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let fireflies = [];
  for (let i = 0; i < 26; i += 1) {
    fireflies.push({
      x: (i * 197) % FIELD.width,
      y: (i * 131) % FIELD.height,
      phase: i * 0.7,
      speed: 0.4 + (i % 5) * 0.12,
    });
  }

  /** One line of text: colour + font + fillText (alignment stays the caller's). */
  function text(str, x, y, color, font) {
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.fillText(str, x, y);
  }

  /** One filled circle. */
  function dot(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  /** One filled rounded rectangle. */
  function fillRound(x, y, w, h, r, color) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
  }

  function fitCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || FIELD.width;
    const h = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function drawGarden(state, time) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const sky = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    sky.addColorStop(0, '#171233');
    sky.addColorStop(0.7, PALETTE.garden);
    sky.addColorStop(1, PALETTE.ground);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // Hedge rows top and bottom, with gaps the moths drift through.
    ctx.fillStyle = PALETTE.hedge;
    for (let x = 0; x < FIELD.width; x += 64) {
      ctx.beginPath();
      ctx.arc(x + 32, 8, 26, 0, Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 32, FIELD.height - 8, 26, Math.PI, TAU);
      ctx.fill();
    }

    // Lit lanterns for the nights already won, unlit ones for the nights ahead.
    for (let n = 0; n < NIGHTS_TO_WIN; n += 1) {
      const x = 90 + n * ((FIELD.width - 180) / (NIGHTS_TO_WIN - 1));
      const lit = n < state.night - 1 || (state.night > NIGHTS_TO_WIN && n < NIGHTS_TO_WIN);
      drawLantern(ctx, x, 52, 0.8, lit, Math.sin(time * 3 + n) * 0.5 + 0.5);
    }

    // Fireflies drifting through the dark.
    for (const f of fireflies) {
      const x = (f.x + Math.sin(time * f.speed + f.phase) * 30 + FIELD.width) % FIELD.width;
      const y = (f.y + Math.cos(time * f.speed * 0.8 + f.phase) * 18 + FIELD.height) % FIELD.height;
      const alpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(time * 2 + f.phase * 3));
      dot(x, y, 2.2, `rgba(255, 233, 168, ${alpha})`);
    }

    // Soft light pools on the ground: large, very dim, fixed by index — the
    // field reads as a garden with lit patches, not a flat dark void.
    for (let i = 0; i < 5; i += 1) {
      const px = 180 + ((i * 271) % 920);
      const py = 170 + ((i * 197) % 420);
      const pool = ctx.createRadialGradient(px, py, 10, px, py, 130);
      pool.addColorStop(0, 'rgba(87, 70, 143, 0.12)');
      pool.addColorStop(1, 'rgba(87, 70, 143, 0)');
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.arc(px, py, 130, 0, TAU);
      ctx.fill();
    }

    // Grass tufts and the odd dim ember-flower, fixed positions from the index
    // so the garden looks the same every frame.
    for (let i = 0; i < 54; i += 1) {
      const gx = (i * 373 + 61) % FIELD.width;
      const gy = 110 + ((i * 211 + 37) % 520);
      const flower = i % 6 === 0;
      ctx.strokeStyle = flower ? '#3a2d6b' : '#241b47';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx - 5, gy);
      ctx.lineTo(gx - 7, gy - 8);
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx, gy - 10);
      ctx.moveTo(gx + 5, gy);
      ctx.lineTo(gx + 7, gy - 8);
      ctx.stroke();
      if (flower) dot(gx, gy - 12, 3, '#6b57b8');
    }
  }

  function drawPlayer(state, time) {
    const p = state.player;
    const blink = p.invuln > 0 && Math.floor(time * 12) % 2 === 0;
    if (blink) return;
    const glow = ctx.createRadialGradient(p.x, p.y, 6, p.x, p.y, 74);
    glow.addColorStop(0, 'rgba(255, 217, 122, 0.5)');
    glow.addColorStop(1, 'rgba(255, 217, 122, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 74, 0, TAU);
    ctx.fill();

    // The keeper: a hooded figure carrying the lantern.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aimAngle);
    dot(0, 0, PLAYER.radius, '#2c2350');
    dot(0, 0, PLAYER.radius - 4, PALETTE.player);
    dot(4, 0, 5, PALETTE.playerRing);
    // The lantern arm points where the keeper aims.
    ctx.strokeStyle = '#2c2350';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(PLAYER.radius + 8, 0);
    ctx.stroke();
    dot(PLAYER.radius + 12, 0, 6, PALETTE.lanternGlow);
    ctx.restore();
  }

  function drawMoth(m, time) {
    const flash = m.flash > 0;
    const darter = m.kind === 'darter';
    const wisp = m.kind === 'wisp';
    const splitter = m.kind === 'splitter';
    const spitter = m.kind === 'spitter';
    const lantern = m.kind === 'lantern-moth';
    const mote = m.kind === 'mote';
    const elder = m.kind === 'elder';
    const body = flash ? '#d9ccff' : darter ? PALETTE.darter : wisp ? PALETTE.wisp : splitter ? PALETTE.splitter : spitter ? PALETTE.spitter : lantern ? PALETTE.lanternMoth : mote ? PALETTE.mote : elder ? PALETTE.elder : PALETTE.moth;
    const wing = flash ? '#efe8ff' : darter ? '#a04a86' : wisp ? PALETTE.wispDark : splitter ? PALETTE.splitterDark : spitter ? PALETTE.spitterDark : lantern ? PALETTE.lanternMothDark : elder ? PALETTE.elderDark : PALETTE.mothDark;
    if (lantern) {
      // A lantern moth glows gold — the only bright thing in the dark besides the keeper.
      ctx.save();
      ctx.translate(m.x, m.y);
      const pulse = 0.5 + 0.5 * Math.sin(time * 6 + m.wobble);
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, m.radius * 2.4);
      glow.addColorStop(0, `rgba(255, 217, 77, ${0.5 + pulse * 0.3})`);
      glow.addColorStop(1, 'rgba(255, 217, 77, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, m.radius * 2.4, 0, TAU);
      ctx.fill();
      const flap = Math.sin(time * 16 + m.wobble * 4) * 0.5;
      ctx.fillStyle = flash ? '#efe8ff' : wing;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.rotate(side * (0.5 + flap * 0.4));
        ctx.beginPath();
        ctx.ellipse(side * m.radius * 0.9, 0, m.radius * 0.95, m.radius * 0.55, side * 0.5, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = flash ? '#d9ccff' : body;
      ctx.beginPath();
      ctx.ellipse(0, 0, m.radius * 0.55, m.radius * 0.8, 0, 0, TAU);
      ctx.fill();
      dot(0, 0, m.radius * 0.35, '#fff3c4');
      ctx.restore();
      return;
    }
    if (spitter) {
      // A spitter is a dark-violet moth with a glowing maw — and when it telegraphs
      // a shot, the maw flares bright, so the keeper knows to step aside.
      ctx.save();
      ctx.translate(m.x, m.y);
      const telegraph = m.mode === 'telegraph';
      const pulse = 0.5 + 0.5 * Math.sin(time * (telegraph ? 18 : 5) + m.wobble);
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, m.radius * (telegraph ? 2.6 : 1.8));
      glow.addColorStop(0, `rgba(199, 125, 255, ${telegraph ? 0.75 : 0.3 + pulse * 0.25})`);
      glow.addColorStop(1, 'rgba(199, 125, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, m.radius * 2.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = flash ? '#efe8ff' : wing;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(side * m.radius * 0.85, 0, m.radius * 0.9, m.radius * 0.5, side * 0.4, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = flash ? '#d9ccff' : body;
      ctx.beginPath();
      ctx.ellipse(0, 0, m.radius * 0.6, m.radius * 0.85, 0, 0, TAU);
      ctx.fill();
      dot(0, m.radius * 0.25, telegraph ? 6 : 4 + pulse * 2, telegraph ? '#f0d4ff' : PALETTE.gloomOrb);
      if (m.maxHp > 1) {
        ctx.fillStyle = '#3a2d6b';
        ctx.fillRect(-m.radius, -m.radius - 10, m.radius * 2, 4);
        ctx.fillStyle = '#ff7d9c';
        ctx.fillRect(-m.radius, -m.radius - 10, (m.radius * 2 * m.hp) / m.maxHp, 4);
      }
      ctx.restore();
      return;
    }
    if (elder) {
      // An elder is a big pale-violet moth with long antennae and a gold-eyed stare.
      ctx.save();
      ctx.translate(m.x, m.y);
      const flap = Math.sin(time * 8 + m.wobble * 4) * 0.35;
      ctx.fillStyle = flash ? '#efe8ff' : wing;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.rotate(side * (0.5 + flap * 0.3));
        ctx.beginPath();
        ctx.ellipse(side * m.radius * 0.9, 0, m.radius * 0.95, m.radius * 0.6, side * 0.45, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = flash ? '#d9ccff' : body;
      ctx.beginPath();
      ctx.ellipse(0, 0, m.radius * 0.55, m.radius * 0.85, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = flash ? '#d9ccff' : body;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -m.radius * 0.7);
      ctx.quadraticCurveTo(-12, -m.radius * 1.3, -18, -m.radius * 1.1);
      ctx.moveTo(4, -m.radius * 0.7);
      ctx.quadraticCurveTo(12, -m.radius * 1.3, 18, -m.radius * 1.1);
      ctx.stroke();
      ctx.fillStyle = '#ffd97a';
      ctx.beginPath();
      ctx.arc(-4, -m.radius * 0.35, 2.5, 0, TAU);
      ctx.arc(4, -m.radius * 0.35, 2.5, 0, TAU);
      ctx.fill();
      if (m.maxHp > 1) {
        ctx.fillStyle = '#3a2d6b';
        ctx.fillRect(-m.radius, -m.radius - 10, m.radius * 2, 4);
        ctx.fillStyle = '#ff7d9c';
        ctx.fillRect(-m.radius, -m.radius - 10, (m.radius * 2 * m.hp) / m.maxHp, 4);
      }
      ctx.restore();
      return;
    }
    if (mote) {
      // A mote is a bright ember-dot with tiny wings — small, fast, unmistakable.
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.fillStyle = flash ? '#d9ccff' : wing;
      ctx.beginPath();
      ctx.ellipse(-m.radius * 0.8, 0, m.radius * 0.8, m.radius * 0.4, -0.5, 0, TAU);
      ctx.ellipse(m.radius * 0.8, 0, m.radius * 0.8, m.radius * 0.4, 0.5, 0, TAU);
      ctx.fill();
      dot(0, 0, m.radius, body);
      dot(0, 0, m.radius * 0.45, '#fff3c4');
      ctx.restore();
      return;
    }
    if (splitter) {
      // A splitter is a bloated amber moth with a glowing cracked core — it looks heavy.
      ctx.save();
      ctx.translate(m.x, m.y);
      const pulse = 0.5 + 0.5 * Math.sin(time * 5 + m.wobble);
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, m.radius * 1.8);
      glow.addColorStop(0, `rgba(255, 210, 122, ${0.35 + pulse * 0.25})`);
      glow.addColorStop(1, 'rgba(255, 210, 122, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, m.radius * 1.8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = flash ? '#efe8ff' : wing;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(side * m.radius * 0.85, 0, m.radius * 0.9, m.radius * 0.5, side * 0.4, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = flash ? '#d9ccff' : body;
      ctx.beginPath();
      ctx.ellipse(0, 0, m.radius * 0.62, m.radius * 0.85, 0, 0, TAU);
      ctx.fill();
      dot(0, 0, m.radius * 0.3, '#fff3c4');
      ctx.strokeStyle = '#8a5a28';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-m.radius * 0.4, -m.radius * 0.3);
      ctx.lineTo(0, 0);
      ctx.lineTo(m.radius * 0.4, -m.radius * 0.35);
      ctx.stroke();
      if (m.maxHp > 1) {
        ctx.fillStyle = '#3a2d6b';
        ctx.fillRect(-m.radius, -m.radius - 10, m.radius * 2, 4);
        ctx.fillStyle = '#ff7d9c';
        ctx.fillRect(-m.radius, -m.radius - 10, (m.radius * 2 * m.hp) / m.maxHp, 4);
      }
      ctx.restore();
      return;
    }
    if (wisp) {
      // A wisp is a small darting diamond with a teal trail — nothing else looks like it.
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(Math.sin(time * 6 + m.wobble) * 0.5);
      const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 22);
      glow.addColorStop(0, 'rgba(127, 224, 195, 0.55)');
      glow.addColorStop(1, 'rgba(127, 224, 195, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, TAU);
      ctx.fill();
      ctx.fillStyle = flash ? '#d9ccff' : body;
      ctx.beginPath();
      ctx.moveTo(0, -m.radius);
      ctx.lineTo(m.radius * 0.7, 0);
      ctx.lineTo(0, m.radius);
      ctx.lineTo(-m.radius * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#eafff6';
      dot(0, 0, 3, '#eafff6');
      ctx.restore();
      return;
    }
    const flap = Math.sin(time * 14 + m.wobble * 4) * 0.5;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.fillStyle = wing;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * (0.5 + flap * 0.4));
      ctx.beginPath();
      ctx.ellipse(side * m.radius * 0.9, 0, m.radius * 0.95, m.radius * 0.55, side * 0.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, m.radius * 0.55, m.radius * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1c1538';
    ctx.beginPath();
    ctx.arc(-3, -m.radius * 0.35, 2, 0, TAU);
    ctx.arc(3, -m.radius * 0.35, 2, 0, TAU);
    ctx.fill();
    if (m.maxHp > 1) {
      ctx.fillStyle = '#3a2d6b';
      ctx.fillRect(-m.radius, -m.radius - 10, m.radius * 2, 4);
      ctx.fillStyle = '#ff7d9c';
      ctx.fillRect(-m.radius, -m.radius - 10, (m.radius * 2 * m.hp) / m.maxHp, 4);
    }
    ctx.restore();
  }

  function drawBoss(b, time) {
    const flash = b.flash > 0;
    const enraged = !!b.enraged;
    const flap = Math.sin(time * 9) * 0.4;
    ctx.save();
    ctx.translate(b.x, b.y);
    const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, b.radius * 2.2);
    glow.addColorStop(0, enraged ? 'rgba(255, 80, 80, 0.5)' : 'rgba(184, 87, 158, 0.4)');
    glow.addColorStop(1, enraged ? 'rgba(255, 80, 80, 0)' : 'rgba(184, 87, 158, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius * 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = flash ? '#e59ad2' : enraged ? '#8f2a4a' : '#7a3a72';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * (0.6 + flap * 0.3));
      ctx.beginPath();
      ctx.ellipse(side * b.radius * 0.95, 0, b.radius, b.radius * 0.55, side * 0.45, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = flash ? '#e59ad2' : enraged ? '#c23a5e' : PALETTE.boss;
    ctx.beginPath();
    ctx.ellipse(0, 0, b.radius * 0.5, b.radius * 0.75, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(-10, -12, 4, 0, TAU);
    ctx.arc(10, -12, 4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawWorld(state, time) {
    drawGarden(state, time);
    for (const s of state.shards) {
      const tw = 0.7 + 0.3 * Math.sin(time * 6 + s.x);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = `rgba(255, 233, 168, ${tw})`;
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(-2.5, -2.5, 5, 5);
      ctx.restore();
    }
    for (const m of state.moths) drawMoth(m, time);
    if (state.boss) drawBoss(state.boss, time);
    for (const g of state.orbs) {
      const glow = ctx.createRadialGradient(g.x, g.y, 1, g.x, g.y, 20);
      glow.addColorStop(0, 'rgba(240, 212, 255, 0.9)');
      glow.addColorStop(0.4, 'rgba(199, 125, 255, 0.7)');
      glow.addColorStop(1, 'rgba(199, 125, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 20, 0, TAU);
      ctx.fill();
      dot(g.x, g.y, 6, '#f0d4ff');
    }
    for (const e of state.embers) {
      const glow = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, 14);
      glow.addColorStop(0, 'rgba(255, 243, 196, 0.9)');
      glow.addColorStop(0.4, 'rgba(255, 179, 71, 0.7)');
      glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 14, 0, TAU);
      ctx.fill();
      dot(e.x, e.y, 4, PALETTE.emberCore);
    }
    drawPlayer(state, time);
    for (const o of state.orbiters) {
      const glow = ctx.createRadialGradient(o.x, o.y, 1, o.x, o.y, 16);
      glow.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
      glow.addColorStop(0.4, 'rgba(255, 179, 71, 0.7)');
      glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(o.x, o.y, 16, 0, TAU);
      ctx.fill();
      dot(o.x, o.y, 5, PALETTE.emberCore);
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      dot(pt.x, pt.y, pt.size, pt.color);
    }
    ctx.globalAlpha = 1;
    for (const fx of state.chainFx) {
      ctx.globalAlpha = Math.max(0, fx.life / 0.25);
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(fx.x1, fx.y1);
      ctx.lineTo(fx.x2, fx.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const t of state.texts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life));
      text(t.text, t.x, t.y, t.color, F(700, 18));
    }
    ctx.globalAlpha = 1;
  }

  function drawHearts(state) {
    const max = Math.max(state.player.maxHearts || 0, state.upgrades.maxHearts);
    for (let i = 0; i < max; i += 1) {
      drawHeart(ctx, 34 + i * 30, 34, 22, i < state.player.hearts);
    }
    // Lantern Ward charges: gold shields after the hearts, one per hit absorbed.
    for (let i = 0; i < (state.ward || 0); i += 1) {
      const x = 34 + max * 30 + i * 24;
      ctx.save();
      ctx.translate(x, 34);
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(8, -5);
      ctx.lineTo(8, 2);
      ctx.quadraticCurveTo(8, 9, 0, 12);
      ctx.quadraticCurveTo(-8, 9, -8, 2);
      ctx.lineTo(-8, -5);
      ctx.closePath();
      ctx.fillStyle = '#ffd27a';
      ctx.fill();
      ctx.restore();
    }
  }

  /** What is alive in the garden right now, by kind: "Moths 8 · Darters 2 · Wisps 1". */
  function censusLine(state) {
    const names = { moth: 'Moths', darter: 'Darters', wisp: 'Wisps', splitter: 'Splitters', spitter: 'Spitters', 'lantern-moth': 'Lantern', mote: 'Motes', elder: 'Elders' };
    const counts = {};
    for (const m of state.moths) counts[m.kind] = (counts[m.kind] || 0) + 1;
    const parts = Object.keys(names).filter((k) => counts[k]).map((k) => `${names[k]} ${counts[k]}`);
    if (state.boss) parts.unshift('Matriarch!');
    return parts.length ? parts.join(' · ') : 'Garden clear';
  }

  /** What comes after this night. */
  function nextLine(state) {
    if (state.night < NIGHTS_TO_WIN) {
      const t = nightTheme(state.night + 1);
      return `NEXT Night ${state.night + 1} — ${t.name}`;
    }
    if (state.night === NIGHTS_TO_WIN) return 'NEXT Dawn — light the last lantern';
    const t = nightTheme(state.night + 1);
    return `NEXT Endless ${state.night + 1} — ${t.name}`;
  }

  function drawHud(state, muted) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // The lines stack, so the panel grows to fit them — hearts on top, then the
    // score, the night, the win/lose stakes, the census and what comes next.
    const lines = [];
    lines.push({ str: `Score ${state.score}`, color: PALETTE.text, font: F(700, 26) });
    lines.push({ str: state.night > NIGHTS_TO_WIN ? `Endless Night ${state.night}` : `Night ${Math.min(state.night, NIGHTS_TO_WIN)} / ${NIGHTS_TO_WIN}`, color: PALETTE.muted, font: F(600, 18) });
    const diff = difficultyById(state.difficulty);
    lines.push({ str: `${diff.title} · Score ×${diff.scoreMult}`, color: PALETTE.muted, font: F(600, 15) });
    const theme = nightTheme(state.night);
    if (state.night !== NIGHTS_TO_WIN) lines.push({ str: `${theme.name} — ${theme.blurb}`, color: '#c77dff', font: F(700, 18) });
    if (state.combo > 1) lines.push({ str: `Combo ×${state.combo}`, color: '#ffb347', font: F(700, 22) });
    if (state.surgeTimer > 0) lines.push({ str: `SURGE +1 dmg ${Math.ceil(state.surgeTimer)}s`, color: '#ff9d5c', font: F(700, 18) });
    if (state.orbiters.length > 0) lines.push({ str: `Orbit ×${state.orbiters.length}`, color: '#ffd97a', font: F(700, 18) });
    if (state.night === NIGHTS_TO_WIN) lines.push({ str: 'DAWN RUSH — hold the line!', color: '#ff6b6b', font: F(700, 18) });
    lines.push({ str: state.endless ? `Endless — survive · LOSE all ${state.player.maxHearts} hearts` : `WIN light 7 lanterns · LOSE all ${state.player.maxHearts} hearts`, color: PALETTE.muted, font: F(600, 15) });
    lines.push({ str: censusLine(state), color: PALETTE.text, font: F(600, 15) });
    lines.push({ str: nextLine(state), color: '#c77dff', font: F(600, 15) });
    // A dim panel keeps the left HUD readable over the keeper's glow.
    fillRound(12, 12, 352, 46 + lines.length * 22 + 8, 14, 'rgba(13, 10, 26, 0.55)');
    drawHearts(state);
    let y = 78;
    for (const l of lines) {
      text(l.str, 24, y, l.color, l.font);
      y += 22;
    }
    // Lantern meter: shards collected toward this night's quota.
    const mx = FIELD.width - 324;
    fillRound(mx, 22, 300, 26, 13, PALETTE.panel);
    const frac = Math.min(1, state.shardsCollected / state.quota);
    fillRound(mx + 3, 25, Math.max(8, 294 * frac), 20, 10, PALETTE.lanternGlow);
    // The meter text sits on the gold fill AND the dark panel, so it gets a
    // dark outline and a pale face — legible at any fill level. (Before: dark
    // navy text, so the "/ quota" tail vanished into the panel below ~60%.)
    ctx.textAlign = 'center';
    ctx.font = F(700, 16);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(13, 10, 26, 0.85)';
    ctx.strokeText(`Lantern ${Math.min(state.shardsCollected, state.quota)} / ${state.quota}`, mx + 150, 41);
    text(`Lantern ${Math.min(state.shardsCollected, state.quota)} / ${state.quota}`, mx + 150, 41, '#ffe9a8', F(700, 16));
    ctx.textAlign = 'left';
    if (state.boss) {
      const bx = FIELD.width / 2 - 200;
      fillRound(bx, 96, 400, 18, 9, PALETTE.panel);
      fillRound(bx + 2, 98, Math.max(6, 396 * (state.boss.hp / state.boss.maxHp)), 14, 7, state.boss.enraged ? '#ff5050' : PALETTE.boss);
      ctx.textAlign = 'center';
      text(state.boss.enraged ? 'GLOOM MATRIARCH — ENRAGED' : 'GLOOM MATRIARCH', FIELD.width / 2, 88, PALETTE.text, F(700, 16));
      ctx.textAlign = 'left';
    }
    if (state.upgrades.nova > 0) {
      ctx.textAlign = 'right';
      text(state.novaTimer <= 0.5 ? 'Nova READY' : `Nova ${Math.ceil(state.novaTimer)}s`, FIELD.width - 24, 72, '#ffb347', F(700, 16));
      ctx.textAlign = 'left';
    }
    // Lantern Flare (E): ready, cooling down, or short of shards.
    ctx.textAlign = 'right';
    const flareY = state.upgrades.nova > 0 ? 96 : 72;
    text(
      state.flareTimer > 0 ? `Flare ${Math.ceil(state.flareTimer)}s`
        : state.shardsCollected >= 5 ? 'E — Flare READY'
          : 'Flare needs 5 shards',
      FIELD.width - 24, flareY,
      state.flareTimer > 0 || state.shardsCollected < 5 ? PALETTE.muted : '#ffd97a',
      F(700, 16),
    );
    ctx.textAlign = 'left';
    ctx.textAlign = 'right';
    text(muted ? 'M — sound off' : 'M — mute · P — pause', FIELD.width - 24, FIELD.height - 18, PALETTE.muted, F(600, 14));
    ctx.textAlign = 'left';
  }

  /** The dim veil over the garden behind a screen: 0.72 for the end screens,
   * 0.45 for the title, so the live garden shows through around the panel. */
  function dim(alpha) {
    ctx.fillStyle = `rgba(10, 7, 24, ${alpha ?? 0.72})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  /** A panel: solid by default; the title passes a translucent fill so the
   * garden behind it stays faintly visible. */
  function panel(x, y, w, h, color) {
    ctx.fillStyle = color ?? PALETTE.panel;
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawTitle(state, best, records) {
    drawWorld(state, 0);
    dim(0.45);
    panel(FIELD.width / 2 - 360, 76, 720, 600, 'rgba(30, 23, 56, 0.86)');
    const diff = difficultyById(state.difficulty);
    ctx.textAlign = 'center';
    text('EMBERKEEPER', FIELD.width / 2, 150, PALETTE.lanternGlow, F(700, 64));
    text('Keep the last lantern lit through seven nights.', FIELD.width / 2, 186, PALETTE.text, F(600, 22));
    // The stakes, in one glance: the goal, how you win, how you lose.
    const stakes = [
      { label: 'GOAL', color: '#4a90d9', desc: 'Light all seven lanterns before dawn' },
      { label: 'WIN', color: '#4caf7d', desc: "Fill each night's lantern quota — boss nights need her gone too" },
      { label: 'LOSE', color: '#ff6b6b', desc: `Lose all ${diff.hearts} hearts and the light goes out` },
    ];
    stakes.forEach((s, i) => {
      const y = 222 + i * 26;
      const lx = FIELD.width / 2 - 330;
      fillRound(lx, y - 19, 64, 24, 7, s.color);
      text(s.label, lx + 32, y, '#0d0a1a', F(700, 14));
      ctx.textAlign = 'left';
      text(s.desc, lx + 78, y, PALETTE.text, F(600, 17));
      ctx.textAlign = 'center';
    });
    // How to keep the light, in three steps.
    text('HOW TO KEEP THE LIGHT', FIELD.width / 2, 322, PALETTE.lanternGlow, F(700, 18));
    const steps = [
      { title: '1 · SHOOT', lines: ['Click or Space fires', 'embers at the moths'] },
      { title: '2 · GATHER', lines: ['Burst moths, collect', 'the light shards'] },
      { title: '3 · CHOOSE', lines: ['Pick a blessing and', 'a road each night'] },
    ];
    const sw = 220;
    const sgap = 16;
    const sx0 = FIELD.width / 2 - (steps.length * sw + (steps.length - 1) * sgap) / 2;
    steps.forEach((s, i) => {
      const x = sx0 + i * (sw + sgap);
      fillRound(x, 336, sw, 80, 12, PALETTE.card);
      text(s.title, x + sw / 2, 366, PALETTE.lanternGlow, F(700, 18));
      text(s.lines[0], x + sw / 2, 390, PALETTE.text, F(400, 15));
      text(s.lines[1], x + sw / 2, 410, PALETTE.text, F(400, 15));
    });
    text('8 FOES · 12 UPGRADES · 3-PHASE BOSS · 7 NAMED NIGHTS · 3 DIFFICULTIES · ENDLESS', FIELD.width / 2, 446, PALETTE.muted, F(600, 17));
    text('WASD move · Mouse aim · E Flare · P pause · M mute', FIELD.width / 2, 470, PALETTE.muted, F(600, 16));
    // The keeping: three difficulties, picked with 1 / 2 / 3 or a click. Keeper
    // is the intended game; Rookie is gentler with an extra heart; Inferno
    // spawns faster and pays half as much score again.
    text('CHOOSE YOUR KEEPING — PRESS 1 / 2 / 3 OR CLICK', FIELD.width / 2, 498, PALETTE.lanternGlow, F(700, 18));
    const { w: dw, h: dh, gap: dgap, y: dy0 } = DIFF_CARD;
    const dtotal = DIFFICULTIES.length * dw + (DIFFICULTIES.length - 1) * dgap;
    const dx0 = FIELD.width / 2 - dtotal / 2;
    DIFFICULTIES.forEach((d, i) => {
      const x = dx0 + i * (dw + dgap);
      const selected = d.id === state.difficulty;
      fillRound(x, dy0, dw, dh, 12, PALETTE.card);
      ctx.strokeStyle = selected ? PALETTE.lanternGlow : PALETTE.cardEdge;
      ctx.lineWidth = selected ? 3 : 2;
      ctx.stroke();
      text(selected ? `✓ ${i + 1} · ${d.title.toUpperCase()}` : `${i + 1} · ${d.title.toUpperCase()}`, x + dw / 2, dy0 + 26, selected ? PALETTE.lanternGlow : PALETTE.text, F(700, 18));
      text(`Spawn ×${d.spawnRate} · ${d.hearts} hearts`, x + dw / 2, dy0 + 48, PALETTE.text, F(400, 15));
      text(`Score ×${d.scoreMult} · ${d.tagline}`, x + dw / 2, dy0 + 66, PALETTE.muted, F(400, 14));
    });
    const runs = (records && records.runs) || [];
    text(best > 0 ? `Best ${best}` + (runs.length ? ` · Last runs ${runs.join(' · ')}` : '') : 'No lantern lit yet — be the first', FIELD.width / 2, 606, PALETTE.muted, F(600, 17));
    text('Press Space or click to begin', FIELD.width / 2, 634, PALETTE.lanternGlow, F(700, 24));
    text('An original game — no libraries, no network, all art and sound made here.', FIELD.width / 2, 660, PALETTE.muted, F(400, 15));
    ctx.textAlign = 'left';
  }

  /** The road map: the four realms in order, the one this night belongs to lit gold. */
  function drawRealmStrip(state, y) {
    const current = realmForNight(state.night).id;
    const shown = REALMS.map((r) => ({ name: r.id === current ? `● ${r.name}` : r.name, current: r.id === current }));
    const gap = 46;
    ctx.font = F(700, 16);
    let total = 0;
    for (const s of shown) total += ctx.measureText(s.name).width;
    total += (shown.length - 1) * gap;
    let x = FIELD.width / 2 - total / 2;
    ctx.textAlign = 'left';
    shown.forEach((s, i) => {
      const w = ctx.measureText(s.name).width;
      text(s.name, x, y, s.current ? PALETTE.lanternGlow : PALETTE.muted, F(700, 16));
      if (i < shown.length - 1) text('→', x + w + 14, y, PALETTE.muted, F(700, 16));
      x += w + gap;
    });
    ctx.textAlign = 'center';
  }

  function drawUpgrade(state, best) {
    drawWorld(state, 0);
    dim();
    ctx.textAlign = 'center';
    const grade = state.grades[state.night] || '—';
    text(`Night ${state.night} done — Grade ${grade} · the lantern burns brighter`, FIELD.width / 2, 84, PALETTE.lanternGlow, F(700, 34));
    text('Choose one blessing for the night ahead', FIELD.width / 2, 118, PALETTE.text, F(600, 22));
    const cards = state.offer;
    const { w: cw, h: ch, gap, y: y0 } = CARD;
    const total = cards.length * cw + (cards.length - 1) * gap;
    const x0 = FIELD.width / 2 - total / 2;
    cards.forEach((card, i) => {
      const x = x0 + i * (cw + gap);
      const taken = state.pickedUpgrade === card.id;
      fillRound(x, y0, cw, ch, 16, PALETTE.card);
      ctx.strokeStyle = taken ? PALETTE.lanternGlow : PALETTE.cardEdge;
      ctx.lineWidth = taken ? 3 : 2;
      ctx.stroke();
      text(`${i + 1}`, x + cw / 2, y0 + 52, PALETTE.lanternGlow, F(700, 30));
      text(card.title, x + cw / 2, y0 + 100, PALETTE.text, F(700, 24));
      const words = card.blurb.split(' ');
      let line = '';
      let ly = y0 + 140;
      for (const w of words) {
        if ((line + ' ' + w).trim().length > 26) {
          text(line.trim(), x + cw / 2, ly, PALETTE.muted, F(400, 17));
          ly += 24;
          line = w;
        } else line += ' ' + w;
      }
      text(line.trim(), x + cw / 2, ly, PALETTE.muted, F(400, 17));
      if (taken) text('TAKEN', x + cw / 2, y0 + ch - 16, PALETTE.lanternGlow, F(700, 16));
    });
    // The road to the next night: every road has its toll and its gift.
    text('Choose a road to the next night — every road has its toll and its gift', FIELD.width / 2, 396, PALETTE.text, F(600, 20));
    const roads = state.paths;
    const { w: rw, h: rh, gap: rgap, y: ry0 } = PATH_CARD;
    const rtotal = roads.length * rw + (roads.length - 1) * rgap;
    const rx0 = FIELD.width / 2 - rtotal / 2;
    roads.forEach((road, i) => {
      const x = rx0 + i * (rw + rgap);
      const taken = state.pickedPath === road.id;
      fillRound(x, ry0, rw, rh, 14, PALETTE.card);
      ctx.strokeStyle = taken ? PALETTE.lanternGlow : PALETTE.cardEdge;
      ctx.lineWidth = taken ? 3 : 2;
      ctx.stroke();
      ctx.textAlign = 'left';
      text(`${i + 4}`, x + 20, ry0 + 34, PALETTE.lanternGlow, F(700, 20));
      text(road.title, x + 52, ry0 + 34, PALETTE.text, F(700, 20));
      text(`RISK  ${road.risk}`, x + 20, ry0 + 66, '#ff9d9d', F(600, 15));
      text(`GIFT  ${road.reward}`, x + 20, ry0 + 92, '#8fe0a8', F(600, 15));
      ctx.textAlign = 'center';
      if (taken) text('TAKEN', x + rw / 2, ry0 + rh - 10, PALETTE.lanternGlow, F(700, 14));
    });
    drawRealmStrip(state, 574);
    text('Click a card and a road — or press 1 / 2 / 3, then 4 / 5 / 6', FIELD.width / 2, 612, PALETTE.muted, F(600, 18));
    text(`Score ${state.score} · Best ${best}`, FIELD.width / 2, 646, PALETTE.muted, F(600, 18));
    ctx.textAlign = 'left';
  }

  function drawPaused(state) {
    drawWorld(state, 0);
    dim();
    ctx.textAlign = 'center';
    text('Paused', FIELD.width / 2, 330, PALETTE.text, F(700, 52));
    text('Press P or Space to keep playing', FIELD.width / 2, 376, PALETTE.muted, F(600, 20));
    ctx.textAlign = 'left';
  }

  /** Ember accuracy: hits over embers fired, as a whole percent (100 when nothing fired). */
  function accuracy(state) {
    if (state.shotsFired <= 0) return 100;
    return Math.round((100 * state.shotsHit) / state.shotsFired);
  }

  function drawOver(state, best) {
    drawWorld(state, 0);
    dim();
    panel(FIELD.width / 2 - 300, 160, 600, 380);
    ctx.textAlign = 'center';
    const diff = difficultyById(state.difficulty);
    text('The light went out', FIELD.width / 2, 250, PALETTE.danger, F(700, 52));
    text(`Night ${state.night} · ${state.kills} moths burst · ${diff.title}`, FIELD.width / 2, 306, PALETTE.text, F(600, 22));
    text(`Score ${state.score}`, FIELD.width / 2, 356, PALETTE.text, F(700, 30));
    text(`Best ${best}`, FIELD.width / 2, 392, PALETTE.muted, F(600, 18));
    text(`Accuracy ${accuracy(state)}% · ${state.shotsFired} embers fired`, FIELD.width / 2, 424, PALETTE.muted, F(600, 18));
    text(`Feats ${state.feats.length} / 10 unlocked`, FIELD.width / 2, 452, PALETTE.muted, F(600, 18));
    text('Press R or click to try again', FIELD.width / 2, 496, PALETTE.lanternGlow, F(700, 22));
    ctx.textAlign = 'left';
  }

  /** One letter grade per night, coloured: S gold, A teal, B blue, C ember. */
  function gradeColor(g) {
    if (g === 'S') return '#ffd97a';
    if (g === 'A') return '#7fe0c3';
    if (g === 'B') return '#8fb8ff';
    return '#ff9d5c';
  }

  function drawWin(state, best) {
    drawWorld(state, 0);
    dim();
    panel(FIELD.width / 2 - 430, 88, 860, 580);
    ctx.textAlign = 'center';
    text('DAWN BREAKS', FIELD.width / 2, 164, PALETTE.lanternGlow, F(700, 56));
    text('Seven lanterns lit. The garden is yours again.', FIELD.width / 2, 200, PALETTE.text, F(600, 22));
    // The seven nights, graded.
    text('THE SEVEN NIGHTS', FIELD.width / 2, 232, PALETTE.muted, F(700, 16));
    const gw = 100;
    const ggap = 10;
    const gx0 = FIELD.width / 2 - (7 * gw + 6 * ggap) / 2;
    for (let n = 1; n <= NIGHTS_TO_WIN; n += 1) {
      const x = gx0 + (n - 1) * (gw + ggap);
      fillRound(x, 242, gw, 58, 10, PALETTE.card);
      text(`NIGHT ${n}`, x + gw / 2, 266, PALETTE.muted, F(600, 13));
      text(state.grades[n] || '—', x + gw / 2, 292, gradeColor(state.grades[n] || '—'), F(700, 26));
    }
    // The run, counted ten ways.
    const mins = Math.floor(state.time / 60);
    const secs = Math.floor(state.time % 60);
    const stats = [
      { label: 'SCORE', value: String(state.score) },
      { label: 'MOTHS BURST', value: String(state.kills) },
      { label: 'ACCURACY', value: `${accuracy(state)}%` },
      { label: 'EMBERS FIRED', value: String(state.shotsFired) },
      { label: 'FLAWLESS NIGHTS', value: String(state.flawlessNights) },
      { label: 'NOVA FIRES', value: String(state.novaFires) },
      { label: 'CHAIN HITS', value: String(state.chainHits) },
      { label: 'SURGE TRIGGERS', value: String(state.surgeTriggers) },
      { label: 'ORBS SHOT DOWN', value: String(state.orbsShotDown) },
      { label: 'TIME', value: `${mins}:${String(secs).padStart(2, '0')}` },
    ];
    const sw = 148;
    const sgap = 8;
    const sx0 = FIELD.width / 2 - (5 * sw + 4 * sgap) / 2;
    stats.forEach((s, i) => {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = sx0 + col * (sw + sgap);
      const y = 318 + row * 72;
      fillRound(x, y, sw, 62, 10, PALETTE.card);
      text(s.label, x + sw / 2, y + 22, PALETTE.muted, F(600, 12));
      text(s.value, x + sw / 2, y + 48, PALETTE.text, F(700, 22));
    });
    // The feats: what this run earned, and what it did not.
    text(`FEATS ${state.feats.length} / 10`, FIELD.width / 2, 482, PALETTE.lanternGlow, F(700, 16));
    ctx.textAlign = 'left';
    FEATS.forEach((f, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = FIELD.width / 2 - 380 + col * 390;
      const y = 500 + row * 22;
      const got = state.feats.includes(f.id);
      text(got ? `✓ ${f.title}` : `· ${f.title}`, x, y, got ? PALETTE.lanternGlow : PALETTE.muted, F(600, 15));
    });
    ctx.textAlign = 'center';
    text(`Best ${best} · ${difficultyById(state.difficulty).title} · Score ×${difficultyById(state.difficulty).scoreMult}`, FIELD.width / 2, 624, PALETTE.muted, F(600, 18));
    text('Press R or click to play again · Space for endless nights', FIELD.width / 2, 648, PALETTE.lanternGlow, F(700, 20));
    ctx.textAlign = 'left';
  }

  return {
    draw(state, screen, best, muted, time, records) {
      fitCanvas();
      const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, FIELD.width, FIELD.height);
      if (screen === SCREEN_TITLE) drawTitle(state, best, records);
      else if (screen === SCREEN_UPGRADE) drawUpgrade(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused(state);
      else if (screen === SCREEN_OVER) drawOver(state, best);
      else if (screen === SCREEN_WIN) drawWin(state, best);
      else {
        drawWorld(state, time);
        drawHud(state, muted);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
  };
}
