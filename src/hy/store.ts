import { createStore } from '../lib/createStore';
import { uid } from '../lib/id';
import { TOPICS } from '../internship/curriculum';

/** Tipos de dato de alto rendimiento (lo que el ENARM pregunta y se olvida a las 2 semanas). */
export type HyKind = 'mnemo' | 'triada' | 'signo' | 'farmaco' | 'perla';
export const HY_KINDS: { id: HyKind; label: string }[] = [
  { id: 'perla', label: 'Perla' },
  { id: 'mnemo', label: 'Mnemotecnia' },
  { id: 'triada', label: 'Tríada / péntada' },
  { id: 'signo', label: 'Signo clínico' },
  { id: 'farmaco', label: 'Fármaco de elección' },
];

export interface HyItem {
  id: string;
  topicId: string | null;
  kind: HyKind;
  /** Nombre corto: «Tríada de Charcot», «MONA-BASH»… */
  title: string;
  /** La perla en una línea. */
  text: string;
  /** Explicación o cómo se usa la mnemotecnia (opcional). */
  explain: string;
  source?: { docId: string; docName: string; page: number } | null;
  /** Vino precargada con la app (datos clásicos de semiología). */
  seed?: boolean;
  starred: boolean;
  createdAt: number;
}

const topicLike = (needle: string) => TOPICS.find((t) => t.title.toLowerCase().includes(needle.toLowerCase()))?.id ?? null;

/**
 * Semilla: epónimos y tríadas clásicas de semiología (no dosis ni esquemas, que dependen de la GPC vigente).
 * Se pueden editar o borrar como cualquier otra.
 */
const SEED: [HyKind, string, string, string][] = [
  ['triada', 'Tríada de Charcot', 'Fiebre + ictericia + dolor en hipocondrio derecho → colangitis.', 'colangitis'],
  ['triada', 'Péntada de Reynolds', 'Tríada de Charcot + hipotensión + alteración del estado mental → colangitis grave (supurativa).', 'colangitis'],
  ['signo', 'Signo de Murphy', 'Interrupción de la inspiración al palpar el hipocondrio derecho → colecistitis aguda.', 'colecistitis'],
  ['signo', 'Signo de Courvoisier-Terrier', 'Vesícula palpable no dolorosa + ictericia → sospecha de neoplasia periampular (cabeza de páncreas).', 'páncreas'],
  ['signo', 'Punto de McBurney', 'Dolor en la unión del tercio externo con los dos tercios internos de la línea ombligo–espina ilíaca anterosuperior derecha → apendicitis.', 'apendicitis'],
  ['signo', 'Signo de Rovsing', 'Presión en fosa ilíaca izquierda provoca dolor en fosa ilíaca derecha → apendicitis.', 'apendicitis'],
  ['signo', 'Signos del psoas y del obturador', 'Dolor con extensión de cadera derecha (psoas) o rotación interna con cadera flexionada (obturador) → apéndice retrocecal o pélvico.', 'apendicitis'],
  ['signo', 'Signo de Blumberg', 'Dolor a la descompresión brusca → irritación peritoneal.', 'abdomen agudo'],
  ['signo', 'Signos de Cullen y Grey Turner', 'Equimosis periumbilical (Cullen) o en flancos (Grey Turner) → hemorragia retroperitoneal (p. ej., pancreatitis necrohemorrágica).', 'pancreatitis'],
  ['triada', 'Tríada de Beck', 'Hipotensión + ingurgitación yugular + ruidos cardiacos apagados → taponamiento cardiaco.', 'trauma de tórax'],
  ['triada', 'Tríada de Virchow', 'Estasis venosa + lesión endotelial + hipercoagulabilidad → trombosis.', 'trombosis venosa'],
  ['triada', 'Tríada de Cushing', 'Hipertensión + bradicardia + respiración irregular → hipertensión intracraneal (herniación inminente).', 'craneoencefálico'],
  ['triada', 'Tríada de Whipple', 'Síntomas de hipoglucemia + glucosa baja documentada + alivio al corregirla → hipoglucemia verdadera.', 'hipoglucemia'],
  ['triada', 'Tríada de Hakim-Adams', 'Alteración de la marcha + incontinencia urinaria + deterioro cognitivo → hidrocefalia normotensa.', 'demencia'],
  ['triada', 'Tríada de Mackler', 'Vómito + dolor torácico + enfisema subcutáneo → perforación esofágica (Boerhaave).', 'dolor torácico'],
  ['triada', 'Síndrome de Horner', 'Ptosis + miosis + anhidrosis ipsilaterales → lesión de la vía simpática (p. ej., tumor de Pancoast).', ''],
  ['signo', 'Respiración de Kussmaul', 'Respiración profunda y rápida → compensación de acidosis metabólica (p. ej., cetoacidosis diabética).', 'cetoacidosis'],
  ['signo', 'Signos de Kernig y Brudzinski', 'Dolor/resistencia a extender la rodilla con cadera flexionada (Kernig) o flexión de caderas al flexionar el cuello (Brudzinski) → irritación meníngea.', 'meningitis'],
  ['triada', 'Tétrada de Fallot', 'CIV + estenosis pulmonar + cabalgamiento aórtico + hipertrofia del ventrículo derecho.', 'cardiopatías congénitas'],
  ['signo', 'Signos de Chadwick y Hegar', 'Coloración violácea de cérvix y vagina (Chadwick) y reblandecimiento del istmo uterino (Hegar) → signos probables de embarazo.', 'control prenatal'],
];

const seedItems = (): HyItem[] =>
  SEED.map(([kind, title, text, key], i) => ({
    id: `seed-${i}`,
    topicId: key ? topicLike(key) : null,
    kind,
    title,
    text,
    explain: '',
    seed: true,
    starred: false,
    createdAt: 0,
  }));

export interface HyState {
  items: HyItem[];
  add: (p: Omit<HyItem, 'id' | 'createdAt' | 'starred'> & { starred?: boolean }) => string;
  update: (id: string, patch: Partial<HyItem>) => void;
  remove: (id: string) => void;
  toggleStar: (id: string) => void;
  /** Importa una lista compartida (p. ej. de un compañero). Devuelve cuántas eran nuevas. */
  importItems: (list: unknown) => number;
}

export const useHy = createStore<HyState>(
  (set, get) => ({
    items: seedItems(),
    add: (p) => {
      const id = uid();
      set((s) => ({ items: [{ ...p, starred: p.starred ?? false, id, createdAt: Date.now() }, ...s.items] }));
      return id;
    },
    update: (id, patch) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch, seed: false } : i)) })),
    remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
    toggleStar: (id) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, starred: !i.starred } : i)) })),
    importItems: (list) => {
      if (!Array.isArray(list)) throw new Error('El archivo no contiene una lista de perlas.');
      const have = new Set(get().items.map((i) => `${i.title.trim().toLowerCase()}|${i.text.trim().toLowerCase()}`));
      const kinds = new Set(HY_KINDS.map((k) => k.id));
      const fresh: HyItem[] = [];
      for (const raw of list) {
        if (!raw || typeof raw !== 'object') continue;
        const r = raw as Partial<HyItem>;
        if (typeof r.text !== 'string' || !r.text.trim()) continue;
        const title = typeof r.title === 'string' ? r.title.slice(0, 120) : '';
        const key = `${title.trim().toLowerCase()}|${r.text.trim().toLowerCase()}`;
        if (have.has(key)) continue;
        have.add(key);
        fresh.push({
          id: uid(),
          topicId: typeof r.topicId === 'string' && TOPICS.some((t) => t.id === r.topicId) ? r.topicId : null,
          kind: r.kind && kinds.has(r.kind) ? r.kind : 'perla',
          title,
          text: r.text.slice(0, 600),
          explain: typeof r.explain === 'string' ? r.explain.slice(0, 1200) : '',
          source: null,
          starred: false,
          createdAt: Date.now(),
        });
      }
      if (fresh.length) set((s) => ({ items: [...fresh, ...s.items] }));
      return fresh.length;
    },
  }),
  { key: 'hy', storage: 'idb', pick: ({ items }) => ({ items }) },
);
