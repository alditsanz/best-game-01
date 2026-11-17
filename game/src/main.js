// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between six screens: title, play, upgrade, paused, game over and victory.
// After a victory, Space keeps playing endless nights (the lanterns stay lit).
//
// ?seed=N fixes the garden's pattern. ?shot=start|play|upgrade|win (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, NIGHTS_TO_WIN, STEP, nightTheme } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_BOSS, EVENT_BURST, EVENT_DESPERATE, EVENT_ENRAGE, EVENT_FLARE, EVENT_HIT, EVENT_NIGHT_CLEAR, EVENT_NOVA, EVENT_OVER, EVENT_PICKUP, EVENT_SPIT, EVENT_WARD, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_FLARE, ACTION_MUTE, ACTION_PAUSE, ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3, ACTION_RESTART, createInput } from './input.js';
import { CARD, createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false, world.state.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let endless = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    endless = false;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startPad();
    announce(`Playing. Night 1 of 7. ${world.state.player.hearts} hearts.`);
  }

  function endGame(won) {
    if (won) {
      screen = SCREEN_WIN;
      audio.victory();
      announce(`Dawn breaks. You win. Score ${world.state.score}. Best ${best}.`);
    } else {
      screen = SCREEN_OVER;
      audio.defeat();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function nightCleared() {
    world.rollUpgrades();
    screen = SCREEN_UPGRADE;
    audio.lantern();
    announce(`Night ${world.state.night} done. Choose one blessing.`);
  }

  function pickUpgrade(index) {
    const card = world.state.offer[index];
    if (!card) return;
    if (!world.applyUpgrade(card.id)) return;
    audio.upgrade();
    world.resetNight(world.state.night + 1);
    screen = SCREEN_PLAY;
    const theme = nightTheme(world.state.night);
    announce(world.state.night >= NIGHTS_TO_WIN
      ? `Night ${world.state.night}. The Dawn Rush — hold the line!`
      : `Night ${world.state.night}. ${theme.name} — ${theme.blurb}. ${world.state.player.hearts} hearts.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_PLAY && (actions & ACTION_FLARE)) {
      const ev = world.flare();
      if (ev & EVENT_FLARE) {
        audio.flare();
        announce('Lantern Flare — the dark burns back.');
      }
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_RESTART) startGame();
      else if (actions & ACTION_CONFIRM) {
        if (screen === SCREEN_WIN && !endless) {
          // Keep playing: endless nights, the lanterns stay lit.
          endless = true;
          world.resetNight(world.state.night + 1);
          screen = SCREEN_PLAY;
          announce(`Endless night ${world.state.night}.`);
        } else startGame();
      }
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_PICK_1) pickUpgrade(0);
      else if (actions & ACTION_PICK_2) pickUpgrade(1);
      else if (actions & ACTION_PICK_3) pickUpgrade(2);
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopPad();
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      audio.startPad();
      announce('Playing.');
    }
  }

  function handleClicks() {
    if (!input.takeClick()) return;
    audio.unlock();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
    else if (screen === SCREEN_WIN) startGame(); else if (screen === SCREEN_UPGRADE) {
      // A click on a card picks it: cards sit in a row across the middle.
      const aim = input.aim();
      const cards = world.state.offer;
      const { w: cw, h: ch, gap, y: y0 } = CARD;
      const total = cards.length * cw + (cards.length - 1) * gap;
      const x0 = FIELD.width / 2 - total / 2;
      for (let i = 0; i < cards.length; i += 1) {
        const x = x0 + i * (cw + gap);
        if (aim.x >= x && aim.x <= x + cw && aim.y >= y0 && aim.y <= y0 + ch) {
          pickUpgrade(i);
          return;
        }
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, { x: 640, y: 360 }, false, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, input.direction(), input.aim(), input.firing(), false);
    if (events & EVENT_BURST) audio.burst(world.state.combo);
    if (events & EVENT_NOVA) audio.nova();
    if (events & EVENT_SPIT) audio.spit();
    if (events & EVENT_WARD) {
      audio.ward();
      announce('The ward holds — no heart lost.');
    }
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_HIT) {
      audio.hurt();
      announce(world.state.player.hearts === 1 ? 'Hit. 1 heart left.' : `Hit. ${world.state.player.hearts} hearts left.`);
    }
    if (events & EVENT_BOSS) {
      audio.boss();
      announce('The Gloom Matriarch comes for the lantern.');
    }
    if (events & EVENT_ENRAGE) {
      audio.boss();
      announce('The Matriarch is enraged — she moves faster now!');
    }
    if (events & EVENT_DESPERATE) {
      audio.fury();
      announce('The Matriarch bursts in fury — dodge the ring of orbs!');
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_NIGHT_CLEAR) nightCleared();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    handleClicks();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.isMuted(), world.state.time);
  }

  // Leaving the tab pauses a running game rather than letting moths close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopPad();
      announce('Paused.');
    }
  });

  announce('Emberkeeper. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
