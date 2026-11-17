// Marisol City — WebAudio synth only. Procedural chiptune loop (bass +
// lead in A minor) plus SFX: engine hum, siren, gunshot, punch, pickup,
// crash. No audio files. Starts on the first user gesture.

export function createAudio() {
  const A = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    muted: false,
    musicTimer: 0,
    step: 0,
    started: false,
  };

  const bassLine = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
  const leadLine = [220, 261.63, 329.63, 440, 329.63, 261.63, 220, 196, 220, 261.63, 329.63, 392, 329.63, 261.63, 220, 0];

  function ensure() {
    if (A.ctx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain();
      A.master.gain.value = A.muted ? 0 : 0.5;
      A.master.connect(A.ctx.destination);
      A.musicGain = A.ctx.createGain();
      A.musicGain.gain.value = 0.16;
      A.musicGain.connect(A.master);
      A.sfxGain = A.ctx.createGain();
      A.sfxGain.gain.value = 0.5;
      A.sfxGain.connect(A.master);
      // engine hum: quiet sawtooth, pitch follows speed
      A.engineOsc = A.ctx.createOscillator();
      A.engineOsc.type = 'sawtooth';
      A.engineOsc.frequency.value = 40;
      A.engineGain = A.ctx.createGain();
      A.engineGain.gain.value = 0;
      A.engineOsc.connect(A.engineGain);
      A.engineGain.connect(A.sfxGain);
      A.engineOsc.start();
      // siren: two-tone triangle
      A.sirenOsc = A.ctx.createOscillator();
      A.sirenOsc.type = 'triangle';
      A.sirenOsc.frequency.value = 700;
      A.sirenGain = A.ctx.createGain();
      A.sirenGain.gain.value = 0;
      A.sirenOsc.connect(A.sirenGain);
      A.sirenGain.connect(A.sfxGain);
      A.sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!A.ctx || A.muted) return;
    const t0 = A.ctx.currentTime + when;
    const osc = A.ctx.createOscillator();
    const g = A.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(A.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, lowpass = 1200) {
    if (!A.ctx || A.muted) return;
    const t0 = A.ctx.currentTime;
    const len = Math.max(1, Math.floor(A.ctx.sampleRate * dur));
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const data = buf.getChannelData(0);
    // deterministic noise via a tiny LFSR so the game never calls the
    // global unseeded random source
    let lfsr = 0x9e3779b9;
    for (let i = 0; i < len; i++) {
      lfsr ^= lfsr << 13; lfsr ^= lfsr >>> 17; lfsr ^= lfsr << 5; lfsr |= 0;
      data[i] = (lfsr / 2147483648) * (1 - i / len);
    }
    const src = A.ctx.createBufferSource();
    src.buffer = buf;
    const filt = A.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = lowpass;
    const g = A.ctx.createGain();
    g.gain.value = vol;
    src.connect(filt);
    filt.connect(g);
    g.connect(A.sfxGain);
    src.start(t0);
  }

  A.unlock = function unlock() {
    if (!ensure()) return;
    if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
    if (!A.started) {
      A.started = true;
      // chiptune step sequencer: 8 steps per second
      setInterval(() => {
        if (!A.ctx || A.muted) return;
        const i = A.step % 16;
        const bass = bassLine[i];
        const lead = leadLine[i];
        if (bass) tone(bass, 0.22, 'triangle', 0.5);
        if (lead && A.step % 2 === 0) tone(lead, 0.18, 'square', 0.12);
        A.step++;
      }, 125);
    }
  };

  A.setMuted = function setMuted(m) {
    A.muted = m;
    if (A.master && A.ctx) A.master.gain.value = m ? 0 : 0.5;
  };

  A.engine = function engine(speedRatio, driving) {
    if (!A.ctx) return;
    const target = driving ? 0.05 + 0.06 * speedRatio : 0;
    A.engineGain.gain.setTargetAtTime(A.muted ? 0 : target, A.ctx.currentTime, 0.1);
    A.engineOsc.frequency.setTargetAtTime(38 + 120 * speedRatio, A.ctx.currentTime, 0.1);
  };

  A.siren = function siren(on) {
    if (!A.ctx) return;
    const now = A.ctx.currentTime;
    if (on && !A.muted) {
      A.sirenGain.gain.setTargetAtTime(0.045, now, 0.2);
      const t = now % 1;
      A.sirenOsc.frequency.setTargetAtTime(t < 0.5 ? 720 : 960, now, 0.05);
    } else {
      A.sirenGain.gain.setTargetAtTime(0, now, 0.2);
    }
  };

  A.shot = function shot() { noise(0.14, 0.5, 2400); tone(180, 0.08, 'square', 0.25); };
  A.punch = function punch() { noise(0.09, 0.4, 500); tone(90, 0.1, 'sine', 0.4); };
  A.pickup = function pickup() { tone(660, 0.1, 'sine', 0.35); tone(990, 0.16, 'sine', 0.35, 0.09); };
  A.crash = function crash() { noise(0.25, 0.5, 700); };
  A.cash = function cash() { tone(880, 0.09, 'sine', 0.3); tone(1174, 0.09, 'sine', 0.3, 0.08); tone(1568, 0.18, 'sine', 0.3, 0.16); };
  A.busted = function busted() { tone(220, 0.3, 'sawtooth', 0.3); tone(174, 0.5, 'sawtooth', 0.3, 0.28); };
  A.missionDone = function missionDone() {
    tone(523.25, 0.12, 'triangle', 0.35);
    tone(659.25, 0.12, 'triangle', 0.35, 0.12);
    tone(783.99, 0.24, 'triangle', 0.35, 0.24);
  };

  return A;
}
