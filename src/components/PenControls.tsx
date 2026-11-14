import { Icon, type IconName } from './Icon';
import { DRAW_TOOLS } from '../lib/ink';
import { useTools } from '../store/tools';
import type { DrawTool } from '../types';

const ICONS: Record<DrawTool, IconName> = { pen: 'pen', pencil: 'pencil', marker: 'marker', highlighter: 'highlighter' };
export const DRAW_TOOL_ORDER: DrawTool[] = ['pen', 'pencil', 'marker', 'highlighter'];

/** Selector de instrumento (si se pasa onTool) + paleta + color libre + grosor. */
export function PenControls({
  tool,
  onTool,
  showTools = true,
  inactive = false,
}: {
  tool: DrawTool;
  onTool?: (t: DrawTool) => void;
  showTools?: boolean;
  /** true cuando otra herramienta (p. ej. borrador) está activa: no marca selección ni muestra ajustes. */
  inactive?: boolean;
}) {
  const setting = useTools((s) => s.settings[tool]);
  const setToolSetting = useTools((s) => s.setToolSetting);
  const meta = DRAW_TOOLS[tool];
  const custom = !meta.palette.includes(setting.color);
  const preview = setting.color === 'auto' ? 'var(--ink)' : setting.color;

  return (
    <div className="pen-controls">
      {showTools && onTool && (
        <div className="seg" role="radiogroup" aria-label="Instrumento">
          {DRAW_TOOL_ORDER.map((t) => (
            <button key={t} className={!inactive && tool === t ? 'active' : ''} onClick={() => onTool(t)} title={DRAW_TOOLS[t].label} aria-label={DRAW_TOOLS[t].label}>
              <Icon name={ICONS[t]} size={17} />
            </button>
          ))}
        </div>
      )}
      {!inactive && (
      <>
      <div className="swatches">
        {meta.palette.map((c) => (
          <button
            key={c}
            className={`swatch${setting.color === c ? ' active' : ''}${c === 'auto' ? ' auto' : ''}`}
            style={c === 'auto' ? undefined : { background: c }}
            title={c === 'auto' ? 'Tinta (se adapta al tema)' : c}
            aria-label={`Color ${c === 'auto' ? 'tinta' : c}`}
            onClick={() => setToolSetting(tool, { color: c })}
          />
        ))}
        <label className={`swatch custom${custom ? ' active' : ''}`} title="Elegir cualquier color" style={custom ? { background: setting.color } : undefined}>
          <input
            type="color"
            value={setting.color.startsWith('#') ? setting.color : '#1f2937'}
            onChange={(e) => setToolSetting(tool, { color: e.target.value })}
            aria-label="Color personalizado"
          />
        </label>
      </div>
      <label className="size-control" title={`Grosor: ${setting.size}`}>
        <span
          className="size-preview"
          style={{
            width: Math.min(26, Math.max(4, tool === 'highlighter' ? setting.size / 2 : setting.size + 2)),
            height: Math.min(26, Math.max(4, tool === 'highlighter' ? setting.size / 2 : setting.size + 2)),
            background: preview,
            opacity: tool === 'highlighter' ? 0.5 : 1,
          }}
        />
        <input
          type="range"
          min={meta.min}
          max={meta.max}
          step={1}
          value={setting.size}
          onChange={(e) => setToolSetting(tool, { size: Number(e.target.value) })}
          aria-label={`Grosor de ${meta.label}`}
        />
        <span className="small muted tabular size-num">{setting.size}</span>
      </label>
      </>
      )}
    </div>
  );
}
