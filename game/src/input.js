// Keyboard and mouse, read fresh every frame. WASD or arrows move; the mouse aims; holding
// the left button (or Space) fires. 1/2/3 pick an upgrade card; P or Escape pauses; M mutes;
// R restarts from the end screens. Actions are consumed once, movement is a live direction.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;
export const ACTION_PICK_1 = 16;
export const ACTION_PICK_2 = 32;
export const ACTION_PICK_3 = 64;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 640;
  let mouseY = 360;
  let mouseDown = false;
  let clicked = false;

  /** Key code → the action it fires (0 when the key does nothing). */
  const KEY_ACTIONS = {
    Space: ACTION_CONFIRM, Enter: ACTION_CONFIRM,
    KeyP: ACTION_PAUSE, Escape: ACTION_PAUSE,
    KeyM: ACTION_MUTE, KeyR: ACTION_RESTART,
    Digit1: ACTION_PICK_1, Numpad1: ACTION_PICK_1,
    Digit2: ACTION_PICK_2, Numpad2: ACTION_PICK_2,
    Digit3: ACTION_PICK_3, Numpad3: ACTION_PICK_3,
  };

  function keyAction(code) {
    return KEY_ACTIONS[code] || 0;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    actions |= keyAction(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * 1280;
    mouseY = ((event.clientY - rect.top) / rect.height) * 720;
  }

  canvas.addEventListener('mousemove', point);
  canvas.addEventListener('mousedown', (event) => {
    point(event);
    mouseDown = true;
    clicked = true;
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalised movement direction from WASD/arrows, {x, y}. */
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.sqrt(2);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    /** Aim point in logical coordinates. */
    aim() {
      return { x: mouseX, y: mouseY };
    },
    firing() {
      return mouseDown || keys.has('Space');
    },
    /** True once per click; consumed by takeClick. */
    takeClick() {
      const was = clicked;
      clicked = false;
      return was;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
