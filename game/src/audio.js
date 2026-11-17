// All sound is synthesised with WebAudio — no audio files, nothing to download. Short
// blips and chimes for every action, plus a soft two-note ambient pad that drifts under
// play. The context starts on the first user gesture; shot mode never touches it.

export function createAudio() {
  let ctx = null;
  let master = null;
  let padNodes = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, freq, delay) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    /** Call from any user gesture; safe to call repeatedly. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      if (!ensure()) return;
      tone(720, 0.09, 'square', 0.10, 340);
    },
    burst(combo) {
      if (!ensure()) return;
      const base = 520 + Math.min(combo, 8) * 45;
      tone(base, 0.16, 'sine', 0.16, base * 1.6);
      tone(base * 1.5, 0.12, 'sine', 0.08, base * 2, 0.03);
      noise(0.12, 0.10, 2400);
    },
    pickup() {
      if (!ensure()) return;
      tone(880, 0.08, 'sine', 0.09, 1320);
    },
    hurt() {
      if (!ensure()) return;
      tone(180, 0.28, 'sawtooth', 0.18, 70);
      noise(0.2, 0.14, 900);
    },
    lantern() {
      if (!ensure()) return;
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.12, null, i * 0.09));
    },
    upgrade() {
      if (!ensure()) return;
      [392, 523, 659].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, null, i * 0.07));
    },
    boss() {
      if (!ensure()) return;
      tone(110, 0.6, 'sawtooth', 0.16, 55);
      tone(165, 0.6, 'sawtooth', 0.10, 82, 0.1);
    },
    victory() {
      if (!ensure()) return;
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.5, 'triangle', 0.13, null, i * 0.12));
    },
    defeat() {
      if (!ensure()) return;
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.45, 'triangle', 0.12, null, i * 0.16));
    },
    /** The ambient pad: two detuned sines breathing slowly under play. */
    startPad() {
      if (!ensure() || padNodes) return;
      const gain = ctx.createGain();
      gain.gain.value = 0.0;
      gain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 2);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      const o1 = ctx.createOscillator();
      o1.type = 'sine';
      o1.frequency.value = 220;
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = 277.18;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      o1.connect(filter);
      o2.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      o1.start();
      o2.start();
      lfo.start();
      padNodes = { gain, o1, o2, lfo };
    },
    stopPad() {
      if (!padNodes || !ctx) return;
      const nodes = padNodes;
      padNodes = null;
      nodes.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      setTimeout(() => {
        try { nodes.o1.stop(); nodes.o2.stop(); nodes.lfo.stop(); } catch { /* already stopped */ }
      }, 600);
    },
  };
}
