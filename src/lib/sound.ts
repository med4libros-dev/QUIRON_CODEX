let audio: AudioContext | null = null;

/** Campanita suave de tres notas (sin archivos de audio). */
export function chime() {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    const now = ctx.currentTime;
    [660, 880, 990].forEach((freq, i) => {
      const t = now + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch {
    /* audio no disponible */
  }
}

export function notify(body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Quirón Codex', { body, silent: true });
    }
  } catch {
    /* notificaciones no disponibles */
  }
}
