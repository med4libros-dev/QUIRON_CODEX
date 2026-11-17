import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { SPECIALTY, TOPICS } from '../internship/curriculum';
import { useUI } from '../store/ui';
import { folderSupported, openSummary, pickFolder, rememberedFolder, rescan, scanFolder, type ScanProgress } from './folder';
import { useSummaries, type Summary } from './store';

type Filter = 'todos' | 'probable' | 'ninguno';

/**
 * Tu carpeta de resúmenes, dentro de la app.
 *
 * Los PDFs se quedan donde están: la app guarda solo el índice (nombre, título y tema), que son
 * unos kilobytes aunque la carpeta pese gigabytes. Al indexar lee **la primera página** de cada
 * archivo, que es donde estos resúmenes traen impreso el tema, y lo empareja con tu temario.
 *
 * Lo que empareja con seguridad lo deja puesto; lo dudoso te lo muestra para que lo confirmes.
 * Nunca inventa un tema: si nada encaja, lo deja sin tema y tú decides.
 */
export function SummariesView() {
  const { folderName, summaries, missing } = useSummaries();
  const [busy, setBusy] = useState<ScanProgress | null>(null);
  const [remembered, setRemembered] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('todos');
  const [q, setQ] = useState('');
  const stop = useRef({ stop: false });
  const showToast = useUI((s) => s.showToast);

  useEffect(() => {
    void rememberedFolder().then(setRemembered);
  }, [folderName]);

  const counts = useMemo(() => {
    const n = { seguro: 0, probable: 0, ninguno: 0, manual: 0 };
    for (const s of summaries) n[s.level]++;
    return n;
  }, [summaries]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return summaries
      .filter((s) => (filter === 'todos' ? true : filter === 'probable' ? s.level === 'probable' : !s.topicId))
      .filter((s) => !needle || s.title.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle) || s.path.toLowerCase().includes(needle))
      .slice(0, 400);
  }, [summaries, filter, q]);

  const run = async (fn: () => Promise<void>) => {
    stop.current = { stop: false };
    setBusy({ done: 0, total: 0, name: '' });
    try {
      await fn();
      showToast('Carpeta indexada');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo leer la carpeta');
    } finally {
      setBusy(null);
    }
  };

  if (!folderSupported()) {
    return (
      <div className="page sum-page">
        <h2 className="page-title">Resúmenes</h2>
        <p className="muted">
          Este navegador no deja a una página leer una carpeta de tu disco. Usa la app de escritorio o Edge; ahí sí funciona.
        </p>
      </div>
    );
  }

  return (
    <div className="page sum-page">
      <header className="page-head">
        <div>
          <h2 className="page-title">Resúmenes</h2>
          <p className="muted small">
            {folderName
              ? `${folderName} · ${summaries.length} ${summaries.length === 1 ? 'archivo' : 'archivos'}, leídos de tu carpeta`
              : 'Tus ultrarresúmenes, enganchados al temario sin salir de su carpeta.'}
          </p>
        </div>
        <div className="spacer" />
        {folderName || remembered ? (
          <button className="btn ghost sm" onClick={() => void run(() => rescan((p) => setBusy(p), stop.current))} disabled={!!busy}>
            <Icon name="reset" size={15} /> Actualizar
          </button>
        ) : null}
        <button className="btn primary sm" onClick={() => void run(async () => scanFolder(await pickFolder(), (p) => setBusy(p), stop.current))} disabled={!!busy}>
          <Icon name="folder" size={15} /> {folderName ? 'Cambiar carpeta' : 'Elegir carpeta'}
        </button>
      </header>

      {busy && (
        <div className="sum-progress">
          <progress value={busy.done} max={busy.total || 1} />
          <span className="small tabular">
            {busy.done} de {busy.total || '…'}
          </span>
          <span className="small muted ellip">{busy.name}</span>
          <button className="btn ghost sm" onClick={() => (stop.current.stop = true)}>
            Parar
          </button>
        </div>
      )}

      {!folderName && !busy && (
        <section className="card sum-intro">
          <p>
            Apunta a la carpeta donde tienes tus resúmenes. La app recorre los PDFs, lee el tema que traen impreso en la primera página y los engancha a tu temario.
          </p>
          <p className="muted small">
            Los archivos no se copian ni se suben a ningún lado: se quedan en tu disco y se abren desde ahí. Se guarda solo el índice, así que tus respaldos no crecen.
            La primera pasada tarda —hay que abrir cada PDF una vez—; las siguientes son casi instantáneas.
          </p>
          {remembered && (
            <p className="small">
              Ya habías elegido <b>{remembered}</b>.{' '}
              <button className="link" onClick={() => void run(() => rescan((p) => setBusy(p), stop.current))}>
                Volver a leerla
              </button>
            </p>
          )}
        </section>
      )}

      {summaries.length > 0 && (
        <>
          <div className="sum-bar">
            <div className="seg sm" role="tablist" aria-label="Qué mostrar">
              <button role="tab" aria-selected={filter === 'todos'} onClick={() => setFilter('todos')}>
                Todos ({summaries.length})
              </button>
              <button role="tab" aria-selected={filter === 'probable'} onClick={() => setFilter('probable')}>
                Por confirmar ({counts.probable})
              </button>
              <button role="tab" aria-selected={filter === 'ninguno'} onClick={() => setFilter('ninguno')}>
                Sin tema ({counts.ninguno})
              </button>
            </div>
            <input className="input sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título o archivo" aria-label="Buscar resúmenes" />
            {counts.probable > 0 && (
              <button className="btn ghost sm" onClick={() => useSummaries.getState().confirmAll()} title="Dar por buenos todos los emparejamientos dudosos">
                <Icon name="check" size={14} /> Confirmar los {counts.probable}
              </button>
            )}
          </div>

          {missing.length > 0 && (
            <p className="small warn-text">
              {missing.length} {missing.length === 1 ? 'archivo ya no está' : 'archivos ya no están'} en la carpeta. Se quedan en el índice por si los mueves de vuelta.
            </p>
          )}

          <ul className="sum-list">
            {shown.map((s) => (
              <Row key={s.path} s={s} />
            ))}
          </ul>
          {summaries.length > shown.length && <p className="muted small">Se muestran {shown.length}. Busca para afinar.</p>}
        </>
      )}
    </div>
  );
}

function Row({ s }: { s: Summary }) {
  const assign = useSummaries((x) => x.assign);
  const topic = s.topicId ? TOPICS.find((t) => t.id === s.topicId) : null;
  return (
    <li className="sum-row" data-level={s.level}>
      <button className="sum-open" onClick={() => void openSummary(s)} title={`Abrir ${s.name}`}>
        <span className="sum-title">{s.title || s.name}</span>
        <span className="muted small ellip">
          {s.path}
          {s.pages ? ` · ${s.pages} p.` : ''}
        </span>
      </button>
      <select
        className="select sm"
        value={s.topicId ?? ''}
        onChange={(e) => assign(s.path, e.target.value || null)}
        aria-label={`Tema de ${s.title || s.name}`}
        title={topic ? `${SPECIALTY[topic.specialty].name} · ${topic.title}` : 'Sin tema'}
      >
        <option value="">Sin tema</option>
        {TOPICS.map((t) => (
          <option key={t.id} value={t.id}>
            {SPECIALTY[t.specialty].short} · {t.title}
          </option>
        ))}
      </select>
      {s.level === 'probable' && (
        <button className="icon-btn xs" onClick={() => assign(s.path, s.topicId)} title="Dar por bueno este tema" aria-label="Confirmar el tema">
          <Icon name="check" size={14} />
        </button>
      )}
    </li>
  );
}
