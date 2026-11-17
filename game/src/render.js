// Everything the eye sees: the ember-garden, the keeper, the moths, the boss, the shards,
// the HUD and the five screens (title, play, upgrade, paused, game over, victory). The
// renderer never changes the world; it paints the state it is given.

import { FIELD, FONT, NIGHTS_TO_WIN, PALETTE, PLAYER } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

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
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
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

  function fitCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || FIELD.width;
    const h = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    return dpr;
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
      ctx.arc(x + 32, FIELD.height - 8, 26, Math.PI, Math.PI * 2);
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
      ctx.fillStyle = `rgba(255, 233, 168, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
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
    ctx.arc(p.x, p.y, 74, 0, Math.PI * 2);
    ctx.fill();

    // The keeper: a hooded figure carrying the lantern.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aimAngle);
    ctx.fillStyle = '#2c2350';
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.radius - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerRing;
    ctx.beginPath();
    ctx.arc(4, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    // The lantern arm points where the keeper aims.
    ctx.strokeStyle = '#2c2350';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(PLAYER.radius + 8, 0);
    ctx.stroke();
    ctx.fillStyle = PALETTE.lanternGlow;
    ctx.beginPath();
    ctx.arc(PLAYER.radius + 12, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMoth(m, time) {
    const flash = m.flash > 0;
    const body = flash ? '#d9ccff' : m.kind === 'darter' ? '#d86bb0' : '#8f7bd8';
    const wing = flash ? '#efe8ff' : m.kind === 'darter' ? '#a04a86' : '#6b57b8';
    const flap = Math.sin(time * 14 + m.wobble * 4) * 0.5;
    ctx.save();
    ctx.translate(m.x, m.y);
    const ang = Math.atan2(0, 1);
    ctx.rotate(ang);
    ctx.fillStyle = wing;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * (0.5 + flap * 0.4));
      ctx.beginPath();
      ctx.ellipse(side * m.radius * 0.9, 0, m.radius * 0.95, m.radius * 0.55, side * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, m.radius * 0.55, m.radius * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1538';
    ctx.beginPath();
    ctx.arc(-3, -m.radius * 0.35, 2, 0, Math.PI * 2);
    ctx.arc(3, -m.radius * 0.35, 2, 0, Math.PI * 2);
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
    const flap = Math.sin(time * 9) * 0.4;
    ctx.save();
    ctx.translate(b.x, b.y);
    const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, b.radius * 2.2);
    glow.addColorStop(0, 'rgba(184, 87, 158, 0.4)');
    glow.addColorStop(1, 'rgba(184, 87, 158, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#e59ad2' : '#7a3a72';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * (0.6 + flap * 0.3));
      ctx.beginPath();
      ctx.ellipse(side * b.radius * 0.95, 0, b.radius, b.radius * 0.55, side * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = flash ? '#e59ad2' : PALETTE.boss;
    ctx.beginPath();
    ctx.ellipse(0, 0, b.radius * 0.5, b.radius * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(-10, -12, 4, 0, Math.PI * 2);
    ctx.arc(10, -12, 4, 0, Math.PI * 2);
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
    for (const e of state.embers) {
      const glow = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, 14);
      glow.addColorStop(0, 'rgba(255, 243, 196, 0.9)');
      glow.addColorStop(0.4, 'rgba(255, 179, 71, 0.7)');
      glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.emberCore;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    drawPlayer(state, time);
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = `700 18px ${FONT}`;
    ctx.textAlign = 'center';
    for (const t of state.texts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life));
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHearts(state) {
    const max = Math.max(state.player.maxHearts || 0, state.upgrades.maxHearts);
    for (let i = 0; i < max; i += 1) {
      drawHeart(ctx, 34 + i * 30, 34, 22, i < state.player.hearts);
    }
  }

  function drawHud(state, muted) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // A dim panel keeps the left HUD readable over the keeper's glow.
    ctx.fillStyle = 'rgba(13, 10, 26, 0.55)';
    roundRect(ctx, 12, 12, 260, 132, 14);
    ctx.fill();
    drawHearts(state);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(`Score ${state.score}`, 24, 78);
    ctx.font = `600 18px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Night ${Math.min(state.night, NIGHTS_TO_WIN)} / ${NIGHTS_TO_WIN}`, 24, 104);
    if (state.combo > 1) {
      ctx.fillStyle = '#ffb347';
      ctx.font = `700 22px ${FONT}`;
      ctx.fillText(`Combo ×${state.combo}`, 24, 134);
    }
    // Lantern meter: shards collected toward this night's quota.
    const mx = FIELD.width - 324;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, mx, 22, 300, 26, 13);
    ctx.fill();
    const frac = Math.min(1, state.shardsCollected / state.quota);
    ctx.fillStyle = PALETTE.lanternGlow;
    roundRect(ctx, mx + 3, 25, Math.max(8, 294 * frac), 20, 10);
    ctx.fill();
    ctx.fillStyle = '#241b47';
    ctx.font = `700 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`Lantern ${Math.min(state.shardsCollected, state.quota)} / ${state.quota}`, mx + 150, 41);
    ctx.textAlign = 'left';
    if (state.boss) {
      const bx = FIELD.width / 2 - 200;
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, bx, 96, 400, 18, 9);
      ctx.fill();
      ctx.fillStyle = PALETTE.boss;
      roundRect(ctx, bx + 2, 98, Math.max(6, 396 * (state.boss.hp / state.boss.maxHp)), 14, 7);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = `700 16px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('GLOOM MATRIARCH', FIELD.width / 2, 88);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 14px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(muted ? 'M — sound off' : 'M — mute · P — pause', FIELD.width - 24, FIELD.height - 18);
    ctx.textAlign = 'left';
  }

  function dim() {
    ctx.fillStyle = 'rgba(10, 7, 24, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawTitle(state, best) {
    drawWorld(state, 0);
    dim();
    panel(FIELD.width / 2 - 330, 108, 660, 500);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.lanternGlow;
    ctx.font = `700 64px ${FONT}`;
    ctx.fillText('EMBERKEEPER', FIELD.width / 2, 190);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('Keep the last lantern lit through seven nights.', FIELD.width / 2, 228);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 18px ${FONT}`;
    ctx.fillText('Gloom-moths drift in from the dark. Burst them, gather', FIELD.width / 2, 292);
    ctx.fillText('their light, and light each lantern before dawn.', FIELD.width / 2, 318);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText('WASD / arrows — move      Mouse — aim      Click / Space — shoot embers', FIELD.width / 2, 372);
    ctx.fillText('Between nights, pick 1 of 3 upgrades      P — pause      M — mute', FIELD.width / 2, 400);
    ctx.fillStyle = PALETTE.lanternGlow;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText('Press Space or click to begin', FIELD.width / 2, 470);
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 18px ${FONT}`;
      ctx.fillText(`Best score ${best}`, FIELD.width / 2, 512);
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 15px ${FONT}`;
    ctx.fillText('An original game — no libraries, no network, all art and sound made here.', FIELD.width / 2, 566);
    ctx.textAlign = 'left';
  }

  function drawUpgrade(state, best) {
    drawWorld(state, 0);
    dim();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.lanternGlow;
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText(`Night ${state.night} done — the lantern burns brighter`, FIELD.width / 2, 120);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('Choose one blessing for the night ahead', FIELD.width / 2, 158);
    const cards = state.offer;
    const cw = 300;
    const ch = 240;
    const gap = 28;
    const total = cards.length * cw + (cards.length - 1) * gap;
    const x0 = FIELD.width / 2 - total / 2;
    const y0 = 210;
    cards.forEach((card, i) => {
      const x = x0 + i * (cw + gap);
      ctx.fillStyle = PALETTE.card;
      roundRect(ctx, x, y0, cw, ch, 16);
      ctx.fill();
      ctx.strokeStyle = PALETTE.cardEdge;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = PALETTE.lanternGlow;
      ctx.font = `700 30px ${FONT}`;
      ctx.fillText(`${i + 1}`, x + cw / 2, y0 + 52);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `700 24px ${FONT}`;
      ctx.fillText(card.title, x + cw / 2, y0 + 104);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `400 17px ${FONT}`;
      const words = card.blurb.split(' ');
      let line = '';
      let ly = y0 + 146;
      for (const w of words) {
        if ((line + ' ' + w).trim().length > 26) {
          ctx.fillText(line.trim(), x + cw / 2, ly);
          ly += 24;
          line = w;
        } else line += ' ' + w;
      }
      ctx.fillText(line.trim(), x + cw / 2, ly);
    });
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText('Click a card, or press 1 / 2 / 3', FIELD.width / 2, y0 + ch + 52);
    ctx.fillText(`Score ${state.score} · Best ${best}`, FIELD.width / 2, y0 + ch + 84);
    ctx.textAlign = 'left';
  }

  function drawPaused(state) {
    drawWorld(state, 0);
    dim();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 52px ${FONT}`;
    ctx.fillText('Paused', FIELD.width / 2, 330);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText('Press P or Space to keep playing', FIELD.width / 2, 376);
    ctx.textAlign = 'left';
  }

  function drawOver(state, best) {
    drawWorld(state, 0);
    dim();
    panel(FIELD.width / 2 - 300, 160, 600, 380);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `700 52px ${FONT}`;
    ctx.fillText('The light went out', FIELD.width / 2, 250);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText(`Night ${state.night} · ${state.kills} moths burst`, FIELD.width / 2, 306);
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(`Score ${state.score}`, FIELD.width / 2, 356);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText(`Best ${best}`, FIELD.width / 2, 392);
    ctx.fillStyle = PALETTE.lanternGlow;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText('Press R or click to try again', FIELD.width / 2, 462);
    ctx.textAlign = 'left';
  }

  function drawWin(state, best) {
    drawWorld(state, 0);
    dim();
    panel(FIELD.width / 2 - 330, 130, 660, 440);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.lanternGlow;
    ctx.font = `700 56px ${FONT}`;
    ctx.fillText('DAWN BREAKS', FIELD.width / 2, 220);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('Seven lanterns lit. The garden is yours again.', FIELD.width / 2, 266);
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(`Score ${state.score} · ${state.kills} moths burst`, FIELD.width / 2, 330);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText(`Best ${best}`, FIELD.width / 2, 366);
    ctx.fillStyle = PALETTE.lanternGlow;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText('Press R or click to play again', FIELD.width / 2, 462);
    ctx.fillText('Keep playing? Press Space for endless nights', FIELD.width / 2, 496);
    ctx.textAlign = 'left';
  }

  return {
    draw(state, screen, best, muted, time) {
      const dpr = fitCanvas();
      const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, FIELD.width, FIELD.height);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_UPGRADE) drawUpgrade(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused(state);
      else if (screen === SCREEN_OVER) drawOver(state, best);
      else if (screen === SCREEN_WIN) drawWin(state, best);
      else {
        drawWorld(state, time);
        drawHud(state, muted);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return dpr;
    },
  };
}
