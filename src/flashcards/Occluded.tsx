import type { NRect } from '../types';

/**
 * Imagen con etiquetas tapadas (oclusión). Las cajas se guardan en proporción (0–1),
 * así la misma tarjeta se ve bien en cualquier tamaño de pantalla.
 */
export function Occluded({
  src,
  boxes,
  target,
  revealed,
  alt = 'Esquema con etiquetas tapadas',
}: {
  src: string;
  boxes: NRect[];
  /** Cuál es la caja que toca adivinar. */
  target: number;
  /** true = ya se destapó la que tocaba adivinar. */
  revealed?: boolean;
  alt?: string;
}) {
  return (
    <div className="occ-wrap">
      <img src={src} alt={alt} />
      {boxes.map((b, i) =>
        i === target && revealed ? (
          <div key={i} className="occ-box target open" style={pos(b)} />
        ) : (
          <div key={i} className={`occ-box${i === target ? ' target' : ''}`} style={pos(b)}>
            {i === target ? '?' : ''}
          </div>
        ),
      )}
    </div>
  );
}

const pos = (b: NRect) => ({ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });
