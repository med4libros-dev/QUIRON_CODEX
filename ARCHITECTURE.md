# Quirón Codex — Arquitectura

Estación de estudio personal para medicina. **Local-first**: todo vive en el navegador (sin servidor, sin cuenta) y funciona sin internet, salvo el motor de síntesis con IA, que es opcional.

## Stack y por qué

| Capa | Elección | Razón |
|---|---|---|
| UI | React 19 + TypeScript | Componentes tipados y renderizado concurrente. |
| Build | Vite 6 | Arranque instantáneo; el worker de pdf.js se sirve como archivo aparte. |
| PDF | pdf.js (`pdfjs-dist` 6) | Es el estándar de facto. El parseo ocurre en un Web Worker y la UI no se congela. |
| Estado | Store propio (`lib/createStore.ts`, ~100 líneas) | API tipo Zustand, sin dependencias. Usa selectores y guardado diferido. |
| Persistencia | IndexedDB + localStorage | Los PDFs y la tinta van en IndexedDB (binario, cientos de MB); la configuración, en localStorage. |
| Exportar | `pdf-lib` | Genera el PDF en el navegador con texto real seleccionable, más la tinta como imagen. |
| Tinta | Canvas 2D propio | Usa la presión del lápiz, eventos *coalesced* y doble capa. No necesita librerías. |

## Estructura

```
src/
├── main.tsx                 Punto de entrada; pide almacenamiento persistente
├── App.tsx                  Shell: tema, rail, top bar y vistas
├── internship/              Módulo Internado: temario, planificador anual, dashboard, asistente
├── types.ts                 Modelo de datos (Doc, Highlight, Note, Stroke, Session, Goal…)
├── styles/global.css        Sistema visual, tokens claro/oscuro
├── lib/
│   ├── createStore.ts       Store reactivo + persistencia diferida + flush al cerrar
│   ├── idb.ts               IndexedDB: kv · pdfs · ink
│   ├── pdf.ts               Carga de pdf.js, extracción de texto por área y por páginas
│   ├── ink.ts               Render de trazos (presión → grosor), exportar hoja a PNG
│   ├── exportPdf.ts         Nota (HTML + tinta) → PDF con pdf-lib
│   ├── exportWord.ts        Nota → Word (.doc)
│   ├── html.ts              Sanitizar HTML pegado/IA; HTML → bloques/texto
│   ├── synth/local.ts       Síntesis extractiva offline
│   ├── synth/claude.ts      Síntesis con Claude (opcional, con API key)
│   ├── backup.ts            Respaldo: archivo .json y carpeta automática (File System Access)
│   ├── stats.ts             Métricas: enfoque, sesiones, metas, racha
│   ├── date.ts · sound.ts · pointer.ts · id.ts
├── store/
│   ├── settings.ts          Tema, vista, proporción del split, doc/nota activos, IA
│   ├── library.ts           PDFs, resaltados/subrayados, tinta, post-its, marcadores → IndexedDB
│   ├── notes.ts             Notas (texto) y cuadernos       → IndexedDB
│   ├── tools.ts             Instrumentos: color/grosor por pluma, lápiz, rotulador, marcatextos
│   ├── bridge.ts            Puente PDF → nota (insertar marcadores como enlaces)
│   ├── planner.ts           Materias, sesiones, metas, registros de foco → localStorage
│   └── pomodoro.ts          Temporizador basado en timestamp → localStorage
├── components/
│   ├── Icon · Modal · FilePick · PenControls (instrumento + paleta + grosor)
│   └── layout/ NavRail · TopBar · SplitPane · LayoutControls
└── features/
    ├── pdf/       PdfWorkspace (barra) · PdfViewer (páginas + capas) · StickyNote · BookmarksMenu · FileManager
    ├── notes/     NotesPanel (ámbito PDF/cuaderno) · TextEditor (tipo Word) · InkCanvas
    ├── notebooks/ NotebooksView · NotebookDialog
    ├── synth/     SynthPanel
    ├── calendar/  CalendarView (semana/mes) · SessionDialog · SubjectsDialog
    ├── progress/  ProgressView (estadísticas, metas, mapa de calor, materias)
    └── pomodoro/  Pomodoro (UI) · usePomodoroTicker (reloj global)
```

## Flujo de la pantalla de estudio

```
┌───────── NavRail ─┬──────────────────── TopBar (título · Pomodoro) ────────────────────┐
│ Estudio           │ PdfWorkspace                     ┃ NotesPanel                       │
│ Calendario        │  barra: biblioteca · herramientas┃  pestañas: Texto · Lienzo · Síntesis
│ Progreso          │         · colores · zoom · página┃  selector de nota · exportar PDF │
│                   │  PdfViewer (páginas diferidas)   ┃  TextEditor | InkCanvas | SynthPanel
│ Tema              │  + FileManager (panel lateral)   ┃                                  │
└───────────────────┴────────────────────── SplitPane (arrastrable) ───────────────────────┘
```

- Cada nota pertenece a un PDF (`docId`) o es **general** (`docId = null`). Al cambiar de PDF cambian también sus notas.
- **Distribución**: intercambiar lados y «solo PDF / solo notas» se resuelven con CSS (`order` y `hidden`), sin desmontar componentes. Un panel oculto conserva su último ancho para no re-renderizar páginas.
- La vista de Estudio **se mantiene montada** al ir a Calendario o Progreso, así que el PDF no se recarga.

## Rendimiento con PDFs pesados

1. **Render diferido**: un `IntersectionObserver` (margen de 700 px) decide qué páginas dibujar. Al salir de la vista, una página libera su canvas y llama a `page.cleanup()`. En la prueba con 800 páginas quedaron 3 canvases vivos tras recorrer el documento completo.
2. **Render fuera de pantalla**: se dibuja en un canvas oculto y se copia de una vez, así no hay parpadeo al hacer zoom. Los renders pendientes se cancelan con `task.cancel()`.
3. **DPR limitado a 2×**: nitidez en pantallas Surface sin multiplicar la memoria.
4. **Página actual por búsqueda binaria** sobre `offsetTop`, en `requestAnimationFrame`.
5. **Resaltados normalizados** (0–1): no se recalculan con el zoom.
6. **El texto y la tinta se guardan por separado**: escribir no reserializa los trazos. La tinta se carga solo al abrir la nota.
7. **Escrituras diferidas** (200–700 ms) y *flush* en `pagehide`/`visibilitychange`.

## Módulo Internado

- `internship/curriculum.ts`: 6 especialidades y 139 temas con prioridad y minutos estimados; búsqueda de GPC restringida a dominios oficiales.
- `internship/planner.ts`: función pura `generatePlan(config, temas)` → plan día por día (~10 ms por año). Las reglas están documentadas en ROADMAP.md.
- `internship/store.ts`: configuración del plan y lecciones completadas (`alq:internship`, incluida en el respaldo).
- Los IDs de lección son estables (`tema:parte`, `tema:rN`, `tema:fN`), así que ajustar el plan conserva lo marcado.
- `openLesson.ts`: integra con Estudio (cuaderno por especialidad + nota del tema con plantilla).

## Respaldo y portabilidad

- `lib/backup.ts` reúne localStorage (`alq:*`), IndexedDB `kv` e `ink`, y opcionalmente los PDFs.
- **Carpeta automática**: el usuario elige una carpeta (ideal: OneDrive). Se escriben `quiron-codex-datos.json` y `pdfs/<id>.pdf` (solo los PDFs nuevos) cada 2 minutos y al ocultar la ventana. El acceso a la carpeta se guarda en IndexedDB; el navegador pide reconfirmar el permiso por sesión.
- Al restaurar se congela la persistencia (`freezePersistence`) para que la app abierta no sobrescriba lo restaurado antes de recargar.
- `Quiron Codex.html`: compilación de un solo archivo (JS, CSS y el worker de pdf.js incrustados como Blob) que funciona abierta directamente desde el disco (`file://`).

## Lápiz (Surface Pen)

- Presión real → grosor. El mouse se detecta (presión fija 0.5) y usa grosor constante.
- `getCoalescedEvents()` recupera todos los puntos del lápiz (más de 120 Hz) para trazos suaves.
- Botón borrador del lápiz (`button 5` / `buttons & 32`) → borra por trazo.
- **Solo lápiz** (activado por defecto, también en el PDF): los toques con dedo o palma no dibujan ni anotan; el dedo desplaza.
- Coordenadas lógicas de hoja A4 (1000 × 1414): los trazos no se deforman al redimensionar el panel.
- Deshacer/rehacer (Ctrl+Z / Ctrl+Y), hojas rayadas, cuadriculadas o lisas, marcatextos translúcido.

## Síntesis

- **Local** (por defecto, gratis y offline): pondera tus resaltados (×3), tus notas (×2) y el texto del PDF (×1). Extrae conceptos clave, ideas principales, resaltados agrupados por categoría de color y preguntas tipo *cloze*.
- **Claude** (opcional): envía el mismo material a la API de Anthropic con tu clave y devuelve HTML saneado. Tiene instrucciones de no inventar nada fuera del material.
- El resultado se guarda como nota (marcada ✦) y se exporta a PDF.

## Capas de una página del PDF

```
canvas del PDF (pdf.js) → capa de texto seleccionable (TextLayer, solo páginas visibles) → resaltados/subrayados (div %) → tinta guardada (canvas) → trazo en vivo (canvas)
→ capa de interacción (según herramienta) → post-its → cinta de marcador
```
Toda anotación usa coordenadas relativas a la página: se mantiene en su lugar con cualquier zoom o ancho de panel.

## Cuadernos

Una nota tiene `docId` (PDF de origen, opcional) y `notebookId` (cuaderno, opcional). El panel de notas muestra un **ámbito**: las notas del PDF abierto o las de un cuaderno. Si el PDF tiene materia y existe un cuaderno de esa materia, las notas nuevas se archivan ahí automáticamente.

## Fase 2 (módulos nuevos)

| Módulo | Archivo | Persistencia |
|---|---|---|
| Documentos, casos y ficha de guardia por tema | `src/internship/topicStore.ts` | IndexedDB `kv:topics` |
| Flashcards + programación SM-2 | `src/flashcards/store.ts`, `FlashcardUI.tsx` | IndexedDB `kv:cards` |
| Escalas y calculadoras | `src/clinical/calculators.ts` (declarativas: campos + `compute`) | — |
| Menú de perlas y avisos | `src/features/pearls/PearlMenu.tsx`, `src/store/ui.ts` | — |
| Recortes en el lienzo | `src/lib/crop.ts`, `src/lib/inkImages.ts` | IndexedDB `ink:<noteId>:img` |
| Modo supervivencia | `survivalMoves` y `applyAdjustments` en `planner.ts`; `survival`/`shifts` en el store del internado | localStorage `alq:internship` |

- El plan anual sigue siendo determinista: `applyAdjustments(generatePlan(config), shifts)` superpone las lecciones movidas sin regenerar nada. Los días no afectados son los mismos objetos.
- El puente `bridge.ts` ahora apunta a una nota concreta (`noteId`) y puede añadir al final (`append`), pedir una pestaña (`requestTab`) o avisar cambios del lienzo (`inkRev`).
- El respaldo ya copiaba todas las claves de `kv` e `ink`: las de la Fase 2 entran sin cambios.

## Fase 3a (módulos nuevos)

| Módulo | Archivo | Persistencia |
|---|---|---|
| Nota médica (SOAP/ingreso/postqx/egreso) | `src/soap/templates.ts`, `SoapModal.tsx` | Plantillas: localStorage `alq:soap`. Datos del paciente: solo memoria |
| Perlas HY | `src/hy/store.ts`, `HyView.tsx` | IndexedDB `kv:hy` |
| Mini reproductor | `src/features/music/store.ts`, `MiniPlayer.tsx` | Preferencias en `alq:music`; carpeta recordada en `kv:music:dir` (handle, no se respalda) |
| Estilo cristal + paleta Parnaso | tokens bajo `[data-look='glass'][data-theme=…]` en `global.css`; `settings.look`; `--accent-2` = pizarra | localStorage `alq:settings` |

- **Identidad**: el producto se llama Quirón Codex. Por compatibilidad se mantienen los identificadores internos de almacenamiento (`indexedDB 'alquimia'`, claves `alq:*`): cambiarlos borraría el progreso existente.
- **Escritorio (Tauri 2)**: `src-tauri/` (Rust mínimo: solo el plugin *opener*). La ventana carga el mismo `dist/` de Vite; `withGlobalTauri` expone `window.__TAURI__.opener`, que `lib/platform.ts` usa para abrir enlaces externos en el navegador. `dragDropEnabled: false` para que arrastrar PDFs siga funcionando con HTML5. WebView2 conserva IndexedDB/localStorage en el perfil de la app (origen distinto del navegador → migración por Respaldo). Compilación: `.github/workflows/instalador-windows.yml` (windows-latest + tauri-action) o `construir-escritorio.bat`.
- El desenfoque (`backdrop-filter`) se aplica solo a barras, tarjetas y ventanas; las páginas del PDF, las hojas y el editor siguen opacos para no costar GPU al desplazarse.

## Fase 3b (módulos nuevos)

| Módulo | Archivo | Persistencia |
|---|---|---|
| Simulacros (banco, intentos, generador) | `src/exam/store.ts`, `generate.ts`, `ExamView.tsx` | IndexedDB `kv:exam` |
| Dominio por tema + refuerzo | `src/analytics/mastery.ts`, `MasteryMap.tsx`, `applyReinforcement` en `planner.ts` | Derivado (sin guardar) |
| Turno | `src/ward/store.ts`, `WardView.tsx` | localStorage `qc:ward` (fuera de respaldos, caduca) |
| Búsqueda global | `src/search/SearchModal.tsx`, `lib/pageIndex.ts` | Índice por página en `kv:search:<docId>` como objeto (no se respalda; se reconstruye) |
| Voz | `src/lib/tts.ts`, `components/TtsBar.tsx` | Velocidad en `alq:tts` |
| Fármacos por peso | `src/drugs/store.ts` (`computeDose` puro), `DrugPanel.tsx` | IndexedDB `kv:drugs` |

- Los ids de refuerzo son `tema:w<lunes>`: estables en la semana; si se marcan, no reaparecen.
- La generación usa la misma API key de la síntesis; el material va con marcadores `[p. N]` y la respuesta se valida (`sanitizeQuestion`) antes de entrar al banco.

## v0.5 (módulos nuevos)

| Módulo | Archivo | Persistencia |
|---|---|---|
| Bitácora (procedimientos, diario) | `src/logbook/store.ts`, `LogbookView.tsx` | IndexedDB `kv:logbook` |
| Signos vitales por edad | `src/vitals/store.ts`, `VitalsTable.tsx`; `VitalsRow` en `WardView.tsx` | IndexedDB `kv:vitals`; signos del paciente en `qc:ward` |
| Ensayo del pase de visita | `src/ward/RoundsModal.tsx` (`roundsScript` puro) | — |
| Recordatorios | `src/lib/notify.ts`, `lib/reminders.ts`; plugin `tauri-plugin-notification` | Avisos ya enviados en `qc:remindedDaily`, `qc:shiftWarned`, `WardTask.notified` |
| Modo noche | `nightActive` en `App.tsx`, `[data-night]` + `.night-veil` en CSS | `alq:settings` (`night`, `nightFrom`, `nightTo`) |
| Respaldo cifrado | `encryptText` / `decryptIfNeeded` en `lib/backup.ts` | Bandera `alq:backupEnc` (no entra al respaldo); contraseña solo en memoria |
| IA (mnemotecnias, diagrama, subrayados) | `src/ai/features.ts`, `MnemoGen.tsx`, `DiagramModal.tsx`, `HlQuizModal.tsx`; `lib/claude.ts` | Resultados a `hy`, `exam` o tinta del lienzo (`ink:<nota>:img`) |
| Lectura y páginas clave | `markRead` / `setBookmarkKind` en `store/library.ts` | `kv:library` (`read`, `Bookmark.kind`) |
| Comparador | `src/features/pdf/CompareView.tsx` (`PdfViewer persistPage={false}`) | — |
| Plantillas y huecos | `TEMPLATE_SECTIONS` en `openLesson.ts`, `lib/completeness.ts` | — |
| Inicio | `src/home/HomeCards.tsx` (fármaco del día, resumen semanal) | Derivado |
| Mapa de GPC | `GpcMap` en `Temario.tsx` | Derivado |
| «Me lo preguntaron» | `asked?` en `Question`, `HyItem`, `Card`; `components/AskedToggle.tsx` | En cada store |

- El cifrado envuelve todo el JSON del respaldo: `{app, enc:1, kdf, iter, salt, iv, data}`. Si el cifrado está activo y bloqueado, ni la descarga ni la carpeta escriben nada en claro.
- Todo lo que genera la IA usa solo el material del usuario (GPC con `[p. N]`, apuntes o subrayados) y se valida antes de guardarse; nada entra sin que el usuario lo elija o lo revise.

## v0.5.1 (pulido visual)

- `NavRail.tsx`: vistas + menús emergentes (`.rail-pop`, en portal) «Herramientas» y «Ajustes».
- `components/Fold.tsx`: `useFold(id)` recuerda tarjetas plegadas en `qc:folds` (solo este equipo).
- `KpiStrip` en `InternshipView.tsx`; fecha del ENARM en `alq:settings.enarmDate`.
- `ui.nightOn` (lo calcula App) → aviso en `TopBar`.

## v0.6

| Módulo | Archivo | Persistencia |
|---|---|---|
| Huecos (cloze) | `src/flashcards/ClozeModal.tsx` (`suggestCloze`, `buildCloze` puros) | Tarjetas normales en `kv:cards` (frente con «_____») |
| PDF anotado | `src/lib/exportAnnotated.ts` (usa `toWinAnsi`/`wrap` de `exportPdf.ts`) | — (descarga) |
| Menú «⋯» del PDF | `MoreMenu` en `PdfWorkspace.tsx` | — |
| Novedades y atajos | `src/home/WhatsNew.tsx`, `src/version.ts` | `qc:seenVersion` (solo este equipo) |
| Preferencias (IA) | `PrefsDialog.tsx` | `alq:settings.apiKey/model` |

## v0.6.5

- **Carga diferida**: `React.lazy` para Calendario, Cuadernos, Progreso, Simulacros, Turno, Perlas HY y Bitácora (`App.tsx`); `import('pdf-lib')` dentro de `buildPdf` y `buildAnnotatedPdf`. Vite separa esos trozos; la compilación de archivo único los incrusta.
- **Ahorro de batería**: `settings.saver` → `[data-saver='on']` (sin `glass-drift`, desenfoque 8 px, sin animaciones de vista).
- **Retrato**: `SplitPane` usa `(orientation: portrait) and (max-width: 1100px)` → `.split.vertical`.
- **Seguridad**: `flushPersistence` y `setPersistErrorHandler` en `createStore.ts`; `applyData` guarda `kv:safety:prerestore` (objeto, fuera de respaldos) y `undoLastRestore` reemplaza todo con `replace: true`; `saveToFolder` relee y valida lo escrito; fallas en `qc:backupError` + evento `qc:backup`.

## v0.6.6 · Tinta de baja latencia

- `lib/ink.ts`: `ctx2d` (canvas con `data-live` → `{ desynchronized: true }`), `drawLiveSegments` (dibuja solo los tramos nuevos con la geometría de `drawStroke`), `drawLiveTip` (último medio tramo + puntos predichos en una capa que se borra cada evento) y `liveOpacity`.
- `InkCanvas.tsx` y `PdfViewer.tsx`: tres capas por hoja (base, en vivo, punta); los puntos llegan por `pointerrawupdate` cuando existe (si no, `pointermove` con `getCoalescedEvents`); al soltar, el trazo definitivo se dibuja en la base y entonces se limpian las capas en vivo.

## v0.7

| Módulo | Archivo | Notas |
|---|---|---|
| Lazo y formas | `src/lib/shapes.ts` (puro) | `recognizeShape`, `strokesInLasso`, `applyXf`, `strokesBox` |
| Zoom | `src/lib/usePinchZoom.ts` | Vista previa por `transform`, zoom real al soltar; `settings.inkZoom` |
| Tinta sin trabas | `src/lib/inkBusy.ts`, `src/lib/groups.ts` | `performance.now()`; grupos por página que conservan identidad |
| Reloj de estudio | `src/lib/autoFocus.ts` | Suma minutos a `planner.logs`; para a los 2 min sin actividad |
| Motor de IA | `src/lib/ai.ts`, `src/lib/useAi.ts` | Claude (`/v1/messages`) o Gemini (`generateContent`, `thinkingBudget: 0` en flash) |
| Diagnóstico | `src/features/prefs/InkDiagnostic.tsx` | Mide latencia de entrada, dibujo y cuadros |

- El trazo que acabas de soltar se pinta en la capa base y se marca como «ya dibujado»: el efecto de redibujo lo detecta y no repite la hoja. La lista de trazos se actualiza en la primera pausa (250 ms) y el guardado en la siguiente (600 ms), nunca en medio de un trazo.
- Las hojas fuera de vista liberan sus canvas (`IntersectionObserver`, margen 900 px).

## v0.8

| Módulo | Archivo | Notas |
|---|---|---|
| Visión del motor de IA | `src/lib/ai.ts` | `callAi({ images })`: bloques `image` (Claude) o `inlineData` (Gemini). Sin imágenes el cuerpo no cambia |
| Reconocer la letra | `src/lib/inkOcr.ts` | `renderNoteSheet` (PNG 1200 px) → transcripción → `Note.inkText`; una petición por hoja |
| Buscar en el PDF | `src/lib/findInPage.ts` | Recorre la capa de texto letra por letra (plegado 1:1) y devuelve rectángulos en % |
| Pestañas y márgenes | `src/store/settings.ts` | `openDocs`, `closeDoc`, `pdfCrop`; el recorte es `clip-path` + márgenes negativos, la página conserva su tamaño real |
| Índice del PDF | `src/lib/pdf.ts` | `outlineOf` resuelve destinos con `getDestination`/`getPageIndex`, en memoria |
| Oclusión | `src/flashcards/OcclusionModal.tsx`, `Occluded.tsx` | `Card.occlusion {boxes(0–1), target}`: una tarjeta por etiqueta, imagen compartida |
| Papelera | `src/store/trash.ts` | 30 días; la nota viaja con sus trazos e imágenes, el PDF conserva su archivo hasta purgarse |
| Historial de notas | `src/lib/noteHistory.ts` | `hist:<noteId>` en `kv` (objeto, no texto); máximo 20, una versión cada 8 min o al borrar mucho |
| Dictado | `src/lib/dictation.ts` | `SpeechRecognition` del sistema, es-MX, se reanuda solo; sin soporte lo dice |
| Paquete móvil | `src/lib/studyPack.ts` | Un `.html` autocontenido de solo lectura, con filtro; sin PDFs |
| Calendario | `src/lib/ics.ts` | Eventos de día completo: rotaciones, guardias (`isGuardia`) y sesiones |
| Sincronización | `src/lib/backup.ts` | `folderExportedAt` lee solo la fecha; `alq:folderSeen` marca lo ya visto; `qc:sync` avisa a la interfaz |

- El editor se refresca cuando la nota cambia desde fuera (historial, papelera, sincronización) salvo si estás escribiendo en ese momento.
- Borrar una nota, una guía o una hoja pasa primero por la papelera; purga al abrir la app.

## Modelo de datos (resumen)

`DocMeta` · `Highlight{page, rect(0–1), color, text, style: box|underline, thickness}` · `Sticky{page, x, y, text, color, open}` · `Bookmark{page, label}` · `Notebook{name, subjectId, color}` · `Note{docId|null, notebookId|null, html, inkPages, paper, kind, inkText?, tags?}` · `Stroke{page, tool: pen|pencil|marker|highlighter, color, size, points[x,y,presión]}` · `Subject` · `StudySession{date, topic, subjectId, minutes, done, docId}` · `Goal{metric, target, period, subjectId}` · `FocusLog{date, minutes, subjectId}`

## Próximos pasos sugeridos

- **Exportar el PDF anotado** (incrustar resaltados, tinta y post-its en el propio PDF con pdf-lib).
- **Sincronización automática en la nube**: hoy la carpeta compartida avisa y trae a petición (v0.8). Un adaptador sobre `createStore` (Supabase o servidor propio) podría replicar `kv`, `pdfs` e `ink` sin intervención.

- **Fuente Unicode incrustada** al exportar (para griego y símbolos sin transliterar).
- **PWA instalable** (service worker) para abrirla como app en Windows.
