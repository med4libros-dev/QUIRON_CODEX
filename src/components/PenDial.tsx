import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon, type IconName } from './Icon';
import { DRAW_TOOLS } from '../lib/ink';
import { useTools } from '../store/tools';
import { useUI } from '../store/ui';
import type { DrawTool } from '../types';

const ICONS: Record<DrawTool, IconName> = { pen: 'pen', pencil: 'pencil', marker: 'marker', highlighter: 'highlighter' };
const TOOLS: DrawTool[] = ['pen', 'pencil', 'marker', 'highlighter'];

type Ring = 'tool' | 'color' | 'size';

/* Geometría del disco. Todo en coordenadas del SVG (viewBox 0 0 216 216). */
const C = 108;
const R0 = 32; // centro: la herramienta activa
const R1 = 56; // anillo 1: herramienta
const R2 = 82; // anillo 2: color
const R3 = 106; // anillo 3: grosor
/** El anillo de grosor no da la vuelta completa: deja un hueco abajo para tener principio y fin
 *  (y ahí cabe la lectura). Empieza fino abajo a la izquierda y engorda girando a la derecha. */
const GAP = Math.PI / 3;
const SIZE_A0 = Math.PI / 2 + GAP / 2;

const pol = (r: number, a: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Sector de corona circular, de `ri` a `ro`, entre los ángulos `a0` y `a1`. */
function sector(ri: number, ro: number, a0: number, a1: number): string {
  const [x0, y0] = pol(ro, a0);
  const [x1, y1] = pol(ro, a1);
  const [x2, y2] = pol(ri, a1);
  const [x3, y3] = pol(ri, a0);
  const big = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0} ${y0}A${ro} ${ro} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${ri} ${ri} 0 ${big} 0 ${x3} ${y3}Z`;
}

const mid = (ri: number, ro: number, a0: number, a1: number) => pol((ri + ro) / 2, (a0 + a1) / 2);

/** Los `n` sectores de un anillo, empezando arriba. */
function slices(n: number): [number, number][] {
  const step = (Math.PI * 2) / n;
  const start = -Math.PI / 2 - step / 2;
  return Array.from({ length: n }, (_, i) => [start + i * step, start + (i + 1) * step]);
}

/** Ángulo del puntero respecto al centro del disco, en radianes. */
function angleAt(svg: SVGSVGElement, e: { clientX: number; clientY: number }): number {
  const r = svg.getBoundingClientRect();
  return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
}

/** Ángulo → índice de sector, con la misma repartición que `slices`. */
function indexAt(angle: number, n: number): number {
  const turn = (angle + Math.PI / 2 + Math.PI / n + Math.PI * 4) % (Math.PI * 2);
  return Math.floor((turn / (Math.PI * 2)) * n) % n;
}

/** Ángulo → fracción 0..1 a lo largo del arco de grosor (hueco abajo). */
function fractionAt(angle: number): number {
  const turn = (angle - SIZE_A0 + Math.PI * 4) % (Math.PI * 2);
  const span = Math.PI * 2 - GAP;
  return turn > span ? (turn - span < GAP / 2 ? 1 : 0) : turn / span;
}

/**
 * Disco de instrumentos: en lugar de una barra, tres anillos concéntricos que **se giran**.
 * De dentro hacia fuera: **herramienta**, **color** y **grosor**.
 *
 * Se usa arrastrando: apoyas el lápiz en un anillo y lo giras; la selección va siguiendo el
 * dedo y se queda donde lo sueltas. Un toque suelto también vale. El grosor es continuo —
 * el arco se va engrosando— y deja un hueco abajo para que tenga principio y fin.
 *
 * Vive siempre en la misma esquina (el del PDF arriba a la derecha, el del lienzo arriba a la
 * izquierda), así la mano aprende el gesto sin mirar. Cerrado ocupa 48 px y dice con qué
 * estás escribiendo.
 *
 * Con teclado cada anillo es un deslizador (`role="slider"`): Tab para entrar, flechas para girar.
 */
export function PenDial({
  tool,
  onTool,
  corner,
  inactive = false,
}: {
  tool: DrawTool;
  onTool: (t: DrawTool) => void;
  /** Esquina donde vive el disco. */
  corner: 'tl' | 'tr';
  /** true cuando manda otra herramienta (borrador, lazo…): el disco se ve apagado. */
  inactive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [turning, setTurning] = useState<Ring | null>(null);
  const setting = useTools((s) => s.settings[tool]);
  const setToolSetting = useTools((s) => s.setToolSetting);
  const favorites = useTools((s) => s.favorites);
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const meta = DRAW_TOOLS[tool];
  const ink = setting.color === 'auto' ? 'var(--ink)' : setting.color;
  const dot = (s: number) => Math.max(2, Math.min(11, (tool === 'highlighter' ? s / 4 : s) * 0.7 + 1.5));

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  /** Mientras no sueltes, el anillo sigue al dedo aunque te salgas de él. */
  const spin = (ring: Ring, apply: (angle: number) => void) => (e: ReactPointerEvent<SVGPathElement>) => {
    const el = svg.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setTurning(ring);
    apply(angleAt(el, e));
    const move = (ev: PointerEvent) => apply(angleAt(el, ev));
    const up = () => {
      setTurning(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const pickTool = (angle: number) => onTool(TOOLS[indexAt(angle, TOOLS.length)]);
  const pickColor = (angle: number) => setToolSetting(tool, { color: meta.palette[indexAt(angle, meta.palette.length)] });
  const pickSize = (angle: number) => setToolSetting(tool, { size: Math.round(meta.min + fractionAt(angle) * (meta.max - meta.min)) });

  /** Flechas del teclado: giran el anillo un paso. */
  const keyTurn = (e: ReactKeyboardEvent, step: (d: number) => void) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    step(d);
  };

  const toolIndex = TOOLS.indexOf(tool);
  const colorIndex = Math.max(0, meta.palette.indexOf(setting.color));
  const frac = (setting.size - meta.min) / Math.max(1, meta.max - meta.min);

  if (!open) {
    return (
      <div className={`pen-dial closed ${corner}${inactive ? ' off' : ''}`} ref={box}>
        <button className="dial-knob" onClick={() => setOpen(true)} title={`${meta.label} · grosor ${setting.size}. Abrir el disco de instrumentos`} aria-expanded={false}>
          <Icon name={ICONS[tool]} size={18} />
          <i className="knob-ink" style={{ background: ink, width: dot(setting.size) * 1.6, height: dot(setting.size) * 1.6 }} />
        </button>
      </div>
    );
  }

  const sizeSpan = Math.PI * 2 - GAP;
  const markA = SIZE_A0 + frac * sizeSpan;
  const [mkx, mky] = pol((R2 + R3) / 2, markA);

  return (
    <div className={`pen-dial open ${corner}${inactive ? ' off' : ''}${turning ? ' turning' : ''}`} ref={box}>
      <svg ref={svg} viewBox="0 0 216 216" width={216} height={216} className="dial-svg">
        <defs>
          <radialGradient id="dial-bg" cx="50%" cy="38%">
            <stop offset="0%" stopColor="var(--surface)" />
            <stop offset="68%" stopColor="var(--surface-2)" />
            <stop offset="100%" stopColor="var(--surface-3)" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={R3} fill="url(#dial-bg)" stroke="var(--border-strong)" />

        {/* ---- Anillo 1 · herramienta ---- */}
        <g className="dial-ring" aria-hidden="true">
          {slices(TOOLS.length).map(([a0, a1], i) => {
            const [mx, my] = mid(R0, R1, a0, a1);
            const on = !inactive && i === toolIndex;
            return (
              <g key={TOOLS[i]} className={`dial-sec tool${on ? ' on' : ''}`}>
                <path d={sector(R0, R1, a0, a1)} />
                <g transform={`translate(${mx - 8} ${my - 8})`} className="dial-ico">
                  <Icon name={ICONS[TOOLS[i]]} size={16} />
                </g>
              </g>
            );
          })}
        </g>

        {/* ---- Anillo 2 · color ---- */}
        <g className="dial-ring" aria-hidden="true">
          {slices(meta.palette.length).map(([a0, a1], i) => (
            <path
              key={meta.palette[i] + i}
              className={`dial-sec color${i === colorIndex ? ' on' : ''}`}
              d={sector(R1, R2, a0, a1)}
              fill={meta.palette[i] === 'auto' ? 'var(--ink)' : meta.palette[i]}
            />
          ))}
        </g>

        {/* ---- Anillo 3 · grosor, continuo y con hueco abajo ---- */}
        <g className="dial-ring" aria-hidden="true">
          <path className="dial-track" d={sector(R2, R3, SIZE_A0, SIZE_A0 + sizeSpan)} />
          {Array.from({ length: 26 }, (_, i) => {
            const f = i / 25;
            const [x, y] = pol((R2 + R3) / 2, SIZE_A0 + f * sizeSpan);
            return <circle key={i} cx={x} cy={y} r={dot(meta.min + f * (meta.max - meta.min)) * 0.5} className="dial-tick" style={{ fill: ink }} />;
          })}
          <circle cx={mkx} cy={mky} r={dot(setting.size)} className="dial-dot" style={{ fill: ink, opacity: tool === 'highlighter' ? 0.6 : 1 }} />
          <circle cx={mkx} cy={mky} r={11} className="dial-mark" />
        </g>

        {/* ---- Zonas que se giran. Van encima de lo pintado. ---- */}
        <path
          className="dial-grab"
          d={sector(R0, R1, 0, Math.PI * 1.999)}
          onPointerDown={spin('tool', pickTool)}
          role="slider"
          aria-label="Instrumento"
          aria-valuetext={meta.label}
          aria-valuenow={toolIndex}
          aria-valuemin={0}
          aria-valuemax={TOOLS.length - 1}
          tabIndex={0}
          onKeyDown={(e) => keyTurn(e, (d) => onTool(TOOLS[(toolIndex + d + TOOLS.length) % TOOLS.length]))}
        />
        <path
          className="dial-grab"
          d={sector(R1, R2, 0, Math.PI * 1.999)}
          onPointerDown={spin('color', pickColor)}
          role="slider"
          aria-label="Color"
          aria-valuetext={setting.color === 'auto' ? 'Tinta, se adapta al tema' : setting.color}
          aria-valuenow={colorIndex}
          aria-valuemin={0}
          aria-valuemax={meta.palette.length - 1}
          tabIndex={0}
          onKeyDown={(e) => keyTurn(e, (d) => setToolSetting(tool, { color: meta.palette[(colorIndex + d + meta.palette.length) % meta.palette.length] }))}
        />
        <path
          className="dial-grab"
          d={sector(R2, R3, 0, Math.PI * 1.999)}
          onPointerDown={spin('size', pickSize)}
          role="slider"
          aria-label={`Grosor de ${meta.label}`}
          aria-valuenow={setting.size}
          aria-valuemin={meta.min}
          aria-valuemax={meta.max}
          tabIndex={0}
          onKeyDown={(e) => keyTurn(e, (d) => setToolSetting(tool, { size: clamp(setting.size + d, meta.min, meta.max) }))}
        />
      </svg>

      {/* Centro: con qué estás escribiendo. Un toque cierra el disco. */}
      <button className="dial-center" onClick={() => setOpen(false)} title={`${meta.label} · grosor ${setting.size}. Cerrar el disco`} aria-expanded>
        <Icon name={ICONS[tool]} size={19} />
        <i style={{ background: ink, width: dot(setting.size) * 1.7, height: dot(setting.size) * 1.7, opacity: tool === 'highlighter' ? 0.6 : 1 }} />
      </button>
      <span className="dial-read tabular" aria-hidden="true">
        {meta.label} · {setting.size}
      </span>

      <div className="dial-extras">
        <label className="dial-any" title="Elegir cualquier color" style={{ background: setting.color.startsWith('#') && !meta.palette.includes(setting.color) ? setting.color : undefined }}>
          <Icon name="palette" size={14} />
          <input
            type="color"
            value={setting.color.startsWith('#') ? setting.color : '#1f2937'}
            onChange={(e) => setToolSetting(tool, { color: e.target.value })}
            aria-label="Color personalizado"
          />
        </label>
        {favorites.map((f, i) => (
          <FavDot key={i} index={i} fav={f} tool={tool} onTool={onTool} />
        ))}
      </div>
    </div>
  );
}

/** Pluma favorita: un toque la usa, mantenerla presionada guarda aquí la pluma actual. */
function FavDot({ index, fav, tool, onTool }: { index: number; fav: { tool: DrawTool; color: string; size: number }; tool: DrawTool; onTool: (t: DrawTool) => void }) {
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saved = useRef(false);
  const settings = useTools((s) => s.settings);
  const on = fav.tool === tool && settings[tool].color === fav.color && settings[tool].size === fav.size;
  const save = () => {
    saved.current = true;
    useTools.getState().saveFavorite(index, { tool, ...settings[tool] });
    useUI.getState().showToast(`Pluma ${index + 1} guardada: ${DRAW_TOOLS[tool].label.toLowerCase()}`);
  };
  return (
    <button
      className={`dial-fav${on ? ' active' : ''}`}
      title={`Pluma ${index + 1}: ${DRAW_TOOLS[fav.tool].label} · grosor ${fav.size}. Mantén presionado para guardar aquí la pluma actual.`}
      aria-label={`Pluma favorita ${index + 1}`}
      aria-pressed={on}
      onPointerDown={() => {
        saved.current = false;
        clearTimeout(hold.current);
        hold.current = setTimeout(save, 600);
      }}
      onPointerUp={() => clearTimeout(hold.current)}
      onPointerLeave={() => clearTimeout(hold.current)}
      onContextMenu={(e) => {
        e.preventDefault();
        clearTimeout(hold.current);
        if (!saved.current) save();
      }}
      onClick={() => {
        if (saved.current) return;
        useTools.getState().setToolSetting(fav.tool, { color: fav.color, size: fav.size });
        onTool(fav.tool);
      }}
    >
      <i style={{ background: fav.color === 'auto' ? 'var(--ink)' : fav.color, opacity: fav.tool === 'highlighter' ? 0.6 : 1 }} />
    </button>
  );
}
