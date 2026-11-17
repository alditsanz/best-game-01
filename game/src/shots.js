// The screenshot scenes behind ?shot=start|play|upgrade|win. Each one plays the real rules
// forward from a fresh world for a fixed time (or until the night clears / dawn breaks),
// steered by a simple autopilot — it fires at the nearest moth, keeps its distance from
// them, and gathers shards when the way is clear — so the frame is what a real game looks
// like and the same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { EVENT_NIGHT_CLEAR, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const LIMIT_SECONDS = 1500;

/** Where the autopilot wants to go, and whether it fires, for this state. A sloppy pilot
 * only fires at close moths, so more of them are alive in the frame. `spareBoss` leaves
 * the Matriarch alone (the play scene wants her in the frame, alive). The pilot aims at
 * the nearest foe — boss or moth — so it never stands still while a moth closes in. */
function autopilot(state, sloppy, spareBoss) {
  const p = state.player;
  let nearest = null;
  let nearestD = Infinity;
  for (const m of state.moths) {
    const d = (m.x - p.x) * (m.x - p.x) + (m.y - p.y) * (m.y - p.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = m;
    }
  }
  let foe = nearest;
  if (!spareBoss && state.boss) {
    const bd = (state.boss.x - p.x) * (state.boss.x - p.x) + (state.boss.y - p.y) * (state.boss.y - p.y);
    if (bd < nearestD) {
      nearestD = bd;
      foe = state.boss;
    }
  }
  const aim = foe ? { x: foe.x, y: foe.y } : { x: FIELD.width / 2, y: FIELD.height / 2 };
  let mx = 0;
  let my = 0;
  const danger = Math.sqrt(nearestD);
  if (foe && danger < 120) {
    // Kite away from the nearest moth, circling so the garden never corners the keeper.
    mx += (p.x - foe.x) / (danger || 1);
    my += (p.y - foe.y) / (danger || 1);
    mx += (-(p.y - foe.y) / (danger || 1)) * 0.6;
    my += ((p.x - foe.x) / (danger || 1)) * 0.6;
  } else {
    // The way is clear enough: go for the nearest shard.
    let shard = null;
    let shardD = Infinity;
    for (const s of state.shards) {
      const d = (s.x - p.x) * (s.x - p.x) + (s.y - p.y) * (s.y - p.y);
      if (d < shardD) {
        shardD = d;
        shard = s;
      }
    }
    if (shard && shardD < 340 * 340) {
      mx += (shard.x - p.x) / (Math.sqrt(shardD) || 1);
      my += (shard.y - p.y) / (Math.sqrt(shardD) || 1);
    } else {
      mx += (FIELD.width / 2 - p.x) / 400;
      my += (FIELD.height / 2 - p.y) / 400;
    }
  }
  // Step aside from a close gloom orb — it is slow, but it still costs a heart.
  let orb = null;
  let orbD = Infinity;
  for (const g of state.orbs) {
    const d = (g.x - p.x) * (g.x - p.x) + (g.y - p.y) * (g.y - p.y);
    if (d < orbD) {
      orbD = d;
      orb = g;
    }
  }
  if (orb && Math.sqrt(orbD) < 170) {
    const od = Math.sqrt(orbD) || 1;
    mx += ((p.x - orb.x) / od) * 1.6;
    my += ((p.y - orb.y) / od) * 1.6;
  }
  const len = Math.hypot(mx, my) || 1;
  const firing = sloppy ? foe !== null && danger < 320 : foe !== null;
  return { move: { x: mx / len, y: my / len }, aim, firing };
}

/** Run the world forward until `stop(events)` is true or the time limit is hit. */
function runUntil(world, stop, limitSeconds, sloppy, spareBoss) {
  const steps = Math.floor(limitSeconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const auto = autopilot(world.state, sloppy, spareBoss);
    const events = world.step(STEP, auto.move, auto.aim, auto.firing, false);
    if (stop(events)) return events;
  }
  return 0;
}

/**
 * Set `world` to the named scene (start, play, upgrade or win; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'upgrade' && name !== 'win') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, { x: 640, y: 360 }, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Clear nights 1 and 2 with the sharp pilot, then play night 3 — a boss night —
    // sloppily until the Matriarch arrives, and a little longer: a busy, dramatic frame.
    for (let n = 1; n <= 2; n += 1) {
      const ev = runUntil(
        world,
        (e) => (e & EVENT_NIGHT_CLEAR) !== 0 || (e & EVENT_OVER) !== 0,
        LIMIT_SECONDS,
      );
      if (ev & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score };
      if (!(ev & EVENT_NIGHT_CLEAR)) return { screen: SCREEN_PLAY, best: world.state.score };
      world.rollUpgrades();
      const first = world.state.offer[0];
      if (first) world.applyUpgrade(first.id);
      world.resetNight(world.state.night + 1);
    }
    runUntil(
      world,
      (e) => (e & EVENT_OVER) !== 0 || world.state.boss !== null,
      LIMIT_SECONDS,
      true,
      true,
    );
    runUntil(world, (e) => (e & EVENT_OVER) !== 0, 5, true, true);
    return { screen: world.state.player.hearts <= 0 ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'upgrade') {
    const events = runUntil(world, (e) => (e & EVENT_NIGHT_CLEAR) !== 0 || (e & EVENT_OVER) !== 0, LIMIT_SECONDS);
    if (events & EVENT_NIGHT_CLEAR) {
      world.rollUpgrades();
      return { screen: SCREEN_UPGRADE, best: world.state.score };
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  // win: clear night after night until dawn breaks.
  let guard = 0;
  while (guard < 8) {
    guard += 1;
    const events = runUntil(
      world,
      (e) => (e & EVENT_NIGHT_CLEAR) !== 0 || (e & EVENT_WIN) !== 0 || (e & EVENT_OVER) !== 0,
      LIMIT_SECONDS,
    );
    if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    if (events & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score };
    if (events & EVENT_NIGHT_CLEAR) {
      world.rollUpgrades();
      const first = world.state.offer[0];
      if (first) world.applyUpgrade(first.id);
      world.resetNight(world.state.night + 1);
      continue;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  return { screen: SCREEN_OVER, best: world.state.score };
}
