import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useUI } from '../../store/ui';

/**
 * Diagnóstico del lápiz: mide en TU equipo dónde se pierde el tiempo entre que mueves el lápiz
 * y aparece la tinta. No cambia nada de la app; solo mide y te deja copiar el resultado.
 *
 *  - Eventos/s y puntos/s: cuántas veces por segundo reporta el lápiz (un Surface Pen suele dar 120–240).
 *  - Dibujo: lo que tarda la app en pintar cada tramo (debería ser ~0.1 ms).
 *  - Evento → pintado: desde que el sistema marca el evento hasta que terminamos de pintar.
 *  - Cuadro: cada cuánto la pantalla se actualiza (60 Hz ≈ 16.7 ms; 120 Hz ≈ 8.3 ms).
 *  - Pintado → pantalla: espera hasta el siguiente cuadro (lo que añade el compositor de Windows).
 */
interface Stats {
  events: number;
  points: number;
  ms: number;
  drawSum: number;
  latSum: number;
  latMax: number;
  frames: number[];
  presentSum: number;
  presentN: number;
  raw: boolean;
  pen: boolean;
  pressure: boolean;
  coalesced: number;
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const q = (a: number[], p: number) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0);
const f1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

export function InkDiagnostic({ onClose }: { onClose: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const st = useRef<Stats | null>(null);
  const last = useRef<number[] | null>(null);
  const started = useRef(0);
  const pendingPaint = useRef(false);
  const [out, setOut] = useState<string | null>(null);
  const [live, setLive] = useState('Escribe unas palabras aquí con el lápiz, como si tomaras apuntes.');

  useEffect(() => {
    const c = cv.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = c.getBoundingClientRect();
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#6366f1';

    let rafId = 0;
    let prevFrame = 0;
    const frame = (t: number) => {
      const s = st.current;
      if (s) {
        if (prevFrame) s.frames.push(t - prevFrame);
        prevFrame = t;
        if (pendingPaint.current) {
          pendingPaint.current = false;
          s.presentSum += t - paintedAt;
          s.presentN++;
        }
      }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    let paintedAt = 0;

    const pt = (e: PointerEvent): number[] => [e.clientX - c.getBoundingClientRect().left, e.clientY - c.getBoundingClientRect().top];

    const onDown = (e: PointerEvent) => {
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* sin captura: el trazo sigue funcionando */
      }
      started.current = performance.now();
      prevFrame = 0;
      st.current = { events: 0, points: 0, ms: 0, drawSum: 0, latSum: 0, latMax: 0, frames: [], presentSum: 0, presentN: 0, raw: false, pen: e.pointerType === 'pen', pressure: e.pressure > 0 && e.pressure !== 0.5, coalesced: 0 };
      last.current = pt(e);
      setOut(null);
    };

    const handle = (e: PointerEvent, raw: boolean) => {
      const s = st.current;
      if (!s || !last.current) return;
      if (raw) s.raw = true;
      s.events++;
      const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      s.coalesced += list.length;
      const t0 = performance.now();
      for (const ev of list.length ? list : [e]) {
        const p = pt(ev);
        ctx.lineWidth = 1 + (ev.pressure || 0.5) * 3;
        ctx.beginPath();
        ctx.moveTo(last.current![0], last.current![1]);
        ctx.lineTo(p[0], p[1]);
        ctx.stroke();
        last.current = p;
        s.points++;
        if (ev.pressure > 0 && ev.pressure !== 0.5) s.pressure = true;
      }
      const t1 = performance.now();
      s.drawSum += t1 - t0;
      // e.timeStamp comparte origen con performance.now() en Chromium/WebView2.
      const lat = t1 - e.timeStamp;
      if (lat >= 0 && lat < 2000) {
        s.latSum += lat;
        s.latMax = Math.max(s.latMax, lat);
      }
      paintedAt = t1;
      pendingPaint.current = true;
    };
    const onMove = (e: PointerEvent) => {
      if (st.current?.raw) return; // ya lo recibimos por pointerrawupdate
      handle(e, false);
    };
    const onRaw = (e: Event) => handle(e as PointerEvent, true);

    const onUp = () => {
      const s = st.current;
      st.current = null;
      last.current = null;
      if (!s || s.events < 5) return;
      s.ms = performance.now() - started.current;
      const hz = (s.events / s.ms) * 1000;
      const phz = (s.points / s.ms) * 1000;
      const lat = s.latSum / Math.max(1, s.events);
      const draw = s.drawSum / Math.max(1, s.events);
      const fr = s.frames.filter((x) => x < 200);
      const present = s.presentSum / Math.max(1, s.presentN);
      const text =
        `Lápiz: ${s.pen ? 'sí' : 'no (mouse/dedo)'} · presión: ${s.pressure ? 'sí' : 'no'} · pointerrawupdate: ${s.raw ? 'sí' : 'no'}\n` +
        `Eventos: ${f1(hz)}/s · puntos: ${f1(phz)}/s · agrupados: ${f1(s.coalesced / Math.max(1, s.events))} por evento\n` +
        `Dibujo: ${f1(draw)} ms por evento\n` +
        `Evento → pintado: ${f1(lat)} ms (peor ${f1(s.latMax)} ms)\n` +
        `Cuadro: ${f1(avg(fr))} ms de media · p90 ${f1(q(fr, 0.9))} ms · peor ${f1(Math.max(0, ...fr))} ms\n` +
        `Pintado → pantalla: ${f1(present)} ms\n` +
        `Pantalla: ${window.devicePixelRatio}× · ${window.screen.width}×${window.screen.height} · ${navigator.hardwareConcurrency || '?'} núcleos`;
      setOut(text);
      const culprit =
        draw > 4
          ? 'La app tarda demasiado en pintar: el problema está en Quirón Codex.'
          : avg(fr) > 22 || q(fr, 0.9) > 34
            ? 'La pantalla se actualiza con saltos: algo más está consumiendo la GPU o el equipo va en ahorro de energía.'
            : lat > 40
              ? 'Los eventos del lápiz llegan tarde al programa: suele ser el controlador del Surface Pen o WebView2, no el dibujo.'
              : hz < 60
                ? 'El lápiz reporta pocos puntos por segundo: revisa el controlador o la batería del lápiz.'
                : 'Los números se ven bien: el retraso que notas viene de fuera del dibujo (pantalla o controlador).';
      setLive(culprit);
    };

    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    if ('onpointerrawupdate' in c) c.addEventListener('pointerrawupdate', onRaw);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointercancel', onUp);
    return () => {
      cancelAnimationFrame(rafId);
      c.removeEventListener('pointerdown', onDown);
      c.removeEventListener('pointermove', onMove);
      c.removeEventListener('pointerrawupdate', onRaw);
      c.removeEventListener('pointerup', onUp);
      c.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <Modal title="Diagnóstico del lápiz" onClose={onClose} width={620}>
      <div className="ink-diag">
        <p className="muted small">{live}</p>
        <canvas ref={cv} className="diag-canvas" />
        {out && <pre className="diag-out">{out}</pre>}
        <div className="field-row tight">
          <button
            className="btn ghost sm"
            onClick={() => {
              const c = cv.current;
              const ctx = c?.getContext('2d');
              if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
              setOut(null);
            }}
          >
            <Icon name="reset" size={14} /> Limpiar
          </button>
          <span className="spacer" />
          <button
            className="btn sm"
            disabled={!out}
            onClick={() => {
              void navigator.clipboard?.writeText(out ?? '');
              useUI.getState().showToast('Resultado copiado: pégamelo en el chat');
            }}
          >
            <Icon name="copy" size={14} /> Copiar resultado
          </button>
        </div>
      </div>
    </Modal>
  );
}
