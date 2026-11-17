// Marisol City — procedural WebAudio: a chiptune loop (bass + lead) and
// synthesized SFX. No audio files. Everything is guarded so the game runs
// silently when audio is unavailable (headless screenshots) or muted.
export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    musicOn: false,
    master: null,
    musicGain: null,
    step: 0,
    timer: null,
    ensure() {
      if (audio.ctx || typeof window === 'undefined') return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audio.ctx = new AC();
        audio.master = audio.ctx.createGain();
        audio.master.gain.value = 0.5;
        audio.master.connect(audio.ctx.destination);
        audio.musicGain = audio.ctx.createGain();
        audio.musicGain.gain.value = 0.12;
        audio.musicGain.connect(audio.master);
      } catch {
        audio.ctx = null;
      }
    },
    toggleMute() {
      audio.muted = !audio.muted;
      if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
      return audio.muted;
    },
    tone(freq, dur, type, vol, when = 0, slideTo = 0) {
      if (!audio.ctx || audio.muted) return;
      try {
        const t0 = audio.ctx.currentTime + when;
        const osc = audio.ctx.createOscillator();
        const g = audio.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        osc.connect(g);
        g.connect(audio.master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      } catch { /* ignore */ }
    },
    sfx(name) {
      if (!audio.ctx || audio.muted) return;
      if (name === 'shot') audio.tone(920, 0.12, 'square', 0.25, 0, 120);
      else if (name === 'punch') audio.tone(160, 0.1, 'sine', 0.3, 0, 60);
      else if (name === 'pickup') { audio.tone(660, 0.09, 'sine', 0.22); audio.tone(990, 0.14, 'sine', 0.22, 0.08); }
      else if (name === 'crash') audio.tone(90, 0.25, 'sawtooth', 0.3, 0, 40);
      else if (name === 'siren') { audio.tone(700, 0.35, 'sine', 0.12, 0, 950); audio.tone(950, 0.35, 'sine', 0.12, 0.35, 700); }
      else if (name === 'mission') { audio.tone(523, 0.12, 'triangle', 0.25); audio.tone(659, 0.12, 'triangle', 0.25, 0.12); audio.tone(784, 0.22, 'triangle', 0.25, 0.24); }
      else if (name === 'cash') { audio.tone(880, 0.08, 'sine', 0.2); audio.tone(1174, 0.16, 'sine', 0.2, 0.07); }
      else if (name === 'enter') audio.tone(320, 0.08, 'triangle', 0.18, 0, 480);
    },
    startMusic() {
      if (!audio.ctx || audio.musicOn || audio.muted) return;
      audio.musicOn = true;
      // A-minor groove: bass roots + a simple lead phrase, 8 steps per bar.
      const bassNotes = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
      const leadNotes = [220, 261.63, 329.63, 261.63, 220, 196, 246.94, 293.66];
      audio.timer = window.setInterval(() => {
        if (audio.muted || !audio.ctx) return;
        const i = audio.step % 8;
        const t = audio.ctx.currentTime;
        const bOsc = audio.ctx.createOscillator();
        const bGain = audio.ctx.createGain();
        bOsc.type = 'triangle';
        bOsc.frequency.value = bassNotes[i];
        bGain.gain.setValueAtTime(0.5, t);
        bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        bOsc.connect(bGain);
        bGain.connect(audio.musicGain);
        bOsc.start(t);
        bOsc.stop(t + 0.3);
        if (i % 2 === 0) {
          const lOsc = audio.ctx.createOscillator();
          const lGain = audio.ctx.createGain();
          lOsc.type = 'square';
          lOsc.frequency.value = leadNotes[i];
          lGain.gain.setValueAtTime(0.12, t);
          lGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
          lOsc.connect(lGain);
          lGain.connect(audio.musicGain);
          lOsc.start(t);
          lOsc.stop(t + 0.24);
        }
        audio.step += 1;
      }, 300);
    },
    stopMusic() {
      if (audio.timer) window.clearInterval(audio.timer);
      audio.timer = null;
      audio.musicOn = false;
    },
  };
  return audio;
}
