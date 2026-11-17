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
| Pack visual «Códice» (único) | tokens bajo `[data-look='codice'][data-theme=…]` en `global.css`; `settings.look` fija en `'codice'`; `--accent` = tinta roja, `--accent-2` = cardenillo; serif Lora incrustada en `styles/fonts.css` | localStorage `alq:settings` (el tema; el pack ya no se elige) |

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
- **Ahorro de batería**: `settings.saver` → `[data-saver='on']` (sin animaciones de vista). Desde la 0.11 el pack no tiene desenfoques ni fondo animado que apagar.
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

## v0.9

| Módulo | Archivo | Notas |
|---|---|---|
| Repaso FSRS | `src/flashcards/fsrs.ts` | Estabilidad y dificultad con los pesos por defecto; `intervalFor(s, retención)`; las tarjetas de SM-2 se convierten al primer repaso (`fromSm2`) |
| Doble plana | `src/features/pdf/PdfViewer.tsx` | `cols = 2` reduce la escala a la mitad y `.pdf-scroll[data-spread]` acomoda en filas; las anotaciones siguen en coordenadas de página |
| Barra flotante | `src/features/pdf/PdfWorkspace.tsx` | Solo en pantalla completa; se enciende con el puntero a menos de 90 px del borde |
| Hojas del lienzo | `src/features/notes/SheetsDialog.tsx` | Miniaturas con `renderInkPage`; `reorderSheets` y `mergeSheet` reusan `remap`/`applyXf`; la fusión baja el contenido si cabe |
| Temario editable | `src/internship/curriculumStore.ts` + `applyCurriculumEdits` | Los cambios se guardan aparte y se aplican **en memoria** sobre `TOPICS`/`TOPIC` (misma referencia); `rev` dispara el recálculo del plan |
| Historial de simulacros | `src/exam/History.tsx` | Tendencia en SVG, aciertos por especialidad y repetición de las falladas |
| Glosario de abreviaturas | `src/lib/inkOcr.ts` | `systemWithGlossary()` añade tus abreviaturas al prompt; `recognizeNotes` transcribe un cuaderno |
| Espacio y revisión | `src/features/backup/StorageReview.tsx` | `storage.estimate()`, tamaño real de cada PDF desde IndexedDB y prueba de escritura en la carpeta |
| Agenda del turno | `src/ward/WardView.tsx` | Pendientes con hora de todos los pacientes, ordenados; atajos de hora al capturar |

- `createStore` admite `onHydrate`: lo usa el temario para aplicar tus cambios en cuanto vuelven del disco.

## v0.10 · Widgets

| Módulo | Archivo | Notas |
|---|---|---|
| Rutado de la ventana | `src/main.tsx`, `src/lib/widgets.ts` | La misma página sirve de app o de widget según `?widget=<tipo>`; un widget no respalda ni recalcula el plan |
| Widgets | `src/widget/WidgetApp.tsx` | Cápsula, pendientes del turno, repaso y captura rápida; compactos y de una mirada |
| Sincronía entre ventanas | `src/lib/windowSync.ts` + `createStore` | Cada escritura anuncia su clave por `BroadcastChannel`; las demás ventanas releen **solo esa** clave, sin volver a escribir (no viajan datos por el canal) |
| Lado escritorio | `src-tauri/src/lib.rs` | Comandos `open_widget` / `close_widget` / `list_widgets` / `close_self`; ventanas sin decoración, `always_on_top`, fuera de la barra de tareas |
| Atajos del sistema | `tauri-plugin-global-shortcut` | `Ctrl+Alt+Q/K/G`; la búsqueda llega al front como evento `qc://search` |

- Los widgets son ventanas del mismo origen: comparten IndexedDB y localStorage con la app, por eso basta con avisar qué cambió.
- En el navegador no hay widgets (no se puede poner una ventana sobre otra app) y la interfaz lo dice en lugar de fallar.

## v0.11 · Códice

| Módulo | Archivo | Notas |
|---|---|---|
| Pack visual único | `src/styles/global.css` (sección «CÓDICE · identidad visual») | `settings.look` queda fija en `'codice'` y sale del guardado: un `'glass'` o `'pistache'` viejo ya no se aplica. Se retiró el selector de `NavRail` |
| Tipografía incrustada | `src/styles/fonts.css` | Lora variable (400–700, normal e itálica), subconjunto latino con `pyftsubset --flavor=woff`, en base64 (~120 KB). Sin peticiones a internet, también en el HTML de un solo archivo. OFL en `src/styles/fonts/` |
| Once estilos de hoja | `.ink-page[data-paper=…]` en `global.css`; `PaperStyle` en `types.ts` | Solo CSS sobre `--line` (44 px lógicos × zoom), así que escalan solos y no entran en `renderInkPage` ni en las exportaciones. `plate` dibuja el marco con `box-shadow` interior en `calc(var(--line) * 0.7)` (el *spread* no admite %) |
| Hojas continuas | `InkCanvas.tsx` (`reserved` / `pages`), `settings.inkAuto` | `pages = reserved + 1` cuando hay tinta en la última hoja. La hoja de más es virtual: no se persiste, se retira al borrar los trazos, el organizador recibe `reserved` y las operaciones de hoja (insertar, quitar) también trabajan sobre `reserved` |

- La identidad se apoya en tres niveles de papel y en la regla de que `--paper` es siempre la superficie más clara: `f4.py` lo comprueba midiendo la luminancia de `--paper`, `--surface` y `--bg` en día y noche.
- No quedan `backdrop-filter`, gradientes de color de fondo ni `--glow-*` activos; los tokens siguen definidos como inertes porque otras reglas los referencian.

## v0.12 · El lienzo manda

| Módulo | Archivo | Notas |
|---|---|---|
| Lazo → texto | `lib/ink.ts:renderInkCrop`, `lib/inkOcr.ts:recognizeCrop`, `features/notes/InkCropModal.tsx` | Dibuja solo la caja de la selección con 16 px de aire y la manda al motor de IA; modo «fórmula» cambia el prompt, no el recorte |
| Tamaño de hoja | `SheetKind` en `types.ts`, `SHEETS`/`sheetH` en `lib/ink.ts` | El ancho lógico sigue en 1000 y solo cambia el alto, así los trazos guardados no se deforman. `rollo` son hojas de 4242 sin separación visible |
| Fondo de hoja | `Note.sheetBg`, `lib/inkImages.ts:fileToDataUrl` | Imagen reescalada a 1400 px y guardada como JPEG en la nota |
| Miniaturas | `features/notes/SheetRail.tsx` | Una miniatura por hoja, dibujadas en serie con `renderInkPage`; no se guarda ninguna imagen |
| Margen del PDF | `settings.pdfMargin`, `features/pdf/PdfViewer.tsx` | El elemento de página crece pero la escala de la tinta no: lo escrito en la franja tiene x > 1000. Lo que se posiciona sobre la página (resaltados, post-its, coincidencias) divide sus medidas horizontales entre 1 + margen |
| Grabar la clase | `lib/classAudio.ts`, `features/notes/ClassAudioBar.tsx`, `Stroke.t` | MediaRecorder; el blob va al almacén binario con clave `audio:<nota>` y el respaldo lo salta por prefijo. Tocar un trazo con la escucha abierta busca con `hitsStroke` y salta a `t − 2 s` |
| Examen largo | `exam/LongExam.tsx`, `Runner` con `chain` | Bloques encadenados; cada uno llama a `addAttempt`, así el historial y la tendencia no cambian |
| OCR en segundo plano | `lib/inkOcrAuto.ts` | Una nota por vuelta cada 90 s, solo notas en reposo (3 min), nunca con el lápiz abajo; media hora de espera tras fallar y tres intentos como máximo |
| Sincronización automática | `startSyncWatch` + `settings.syncAuto` | Revisa cada 2 min; trae sin preguntar solo si no hay cambios locales ni cifrado bloqueado, y si no, cae en la barra de siempre |

- Accesibilidad: `--border-strong` pasa a `#938565` / `#7a6a57` para llegar a 3:1 contra `--surface` (WCAG 1.4.11, el borde identifica el control); `.input:focus-visible` recupera el anillo que `outline: none` se comía; `::selection` y el borrador de recorte dejan el verde del tema anterior.

## v0.13 · Lo que faltaba

| Módulo | Archivo | Notas |
|---|---|---|
| Tamaño de hoja al exportar | `lib/exportPdf.ts` (`ExportInput.sheet`), `SheetsDialog`, `inkOcr` | `renderInkPage`/`renderInkCrop` reciben el alto; antes la exportación seguía fija en 1414 y deformaba lo apaisado y el rollo |
| Transcribir la clase | `lib/classAudio.ts:transcribeClass`, `lib/ai.ts` (`AiCall.audio`), `Note.classText` | El audio viaja como `inlineData` de Gemini; con Claude se rechaza con un mensaje que dice qué cambiar. Grabación a 32 kbps y tope de 16 MB por petición |
| Virtualización del lienzo | `InkCanvas` (`win`, `sheetPx`, `VIRTUAL_FROM`) | Solo se montan las hojas visibles ±2; dos separadores conservan el alto total. El alto de hoja se mide del DOM, no se calcula |
| Margen → tarjeta | `features/pdf/PdfWorkspace.tsx`, `renderInkCrop(pageW)` | Los trazos del margen tienen x > 1000, así que el recorte necesita un ancho mayor que el de la página |
| Ponerme al día | `planner.ts:catchUpMoves`, `lateCount`, `store.catchUp` | Reparte por capacidad real en 21 días; los repasos no se alejan más de 7; nada entra en guardias ni en días en supervivencia; lo que no cabe se queda |
| Mini-examen | `exam/MiniExam.tsx` | Reusa `Runner` en modo estudio con los temas del día; se carga con `lazy` para no engordar el arranque |
| Flujogramas | `lib/shapes.ts:flowTemplate`, `snapArrowToBoxes` | Las plantillas son trazos normales; el enganche busca cajas (rectángulo cerrado ≥ 60 × 30) a ≤ 46 de la punta o la cola |
| Capas | `Stroke.layer`, `tools.layer`/`showDraft`, `drawStroke` | El borrador se pinta al 38 %; ocultarlo solo lo filtra antes de agrupar por hoja |
| PWA | `public/manifest.webmanifest`, `public/sw.js`, `main.tsx:registerServiceWorker` | Red primero, caché como respaldo; se salta todo lo que no sea del mismo origen (las APIs de IA nunca se cachean) y no se registra en Tauri ni en `file://` |

## v0.14 · Disco de instrumentos

| Módulo | Archivo | Notas |
|---|---|---|
| Disco | `src/components/PenDial.tsx` | Tres coronas circulares en un SVG de 216×216. Lo que se ve (sectores, iconos, puntos) va con `pointer-events: none`; encima hay tres `path.dial-grab` invisibles, uno por anillo, que son los que se agarran |
| Giro | `spin(ring, apply)` | `setPointerCapture` + escuchas de `pointermove`/`pointerup` en `window`, así el giro sigue aunque el dedo se salga del anillo. `angleAt` da el ángulo respecto al centro del SVG |
| Reparto | `indexAt(angle, n)` / `fractionAt(angle)` | Los anillos de instrumento y color son cíclicos (sectores iguales desde arriba); el de grosor usa un arco de 2π − GAP con el hueco abajo, y devuelve una fracción continua |
| Teclado | `role="slider"` + `onKeyDown` | Tab entra en cada anillo y las flechas lo giran un paso; el grosor se mueve de uno en uno dentro de `min`/`max` |

- El botón del centro se ancla a 108 px (el centro del SVG), no al 50 % del contenedor: debajo del disco van las plumas favoritas, y con 50 % el botón bajaba y se comía el sector inferior del primer anillo.
- `PenControls` y su CSS (`.pen-controls`, `.fav-pens`, `.fav-pen`) se retiran: el disco cubre instrumento, color, grosor y favoritas.

## v0.15 · Resúmenes de la carpeta

| Módulo | Archivo | Notas |
|---|---|---|
| Índice | `src/summaries/store.ts` | Solo metadatos: `{path, name, size, title, topicId, level, score, pages, indexedAt}`. Persiste en `kv` (clave `summaries`); los PDFs **nunca** entran a `pdfs` |
| Carpeta | `src/summaries/folder.ts` | `showDirectoryPicker` y el handle guardado en `kv` (`summaries:dir`), igual que música y respaldo. `open_` lo cachea en la sesión: evita una ida a IndexedDB por página y sirve de respaldo si el navegador se niega a guardar el permiso |
| Lectura | `readHead(file)` | Abre el PDF, pide **solo la página 1**, junta los `items` respetando `hasEOL` y lo pasa a `titleFromPage`. Después lo destruye: nada queda en memoria |
| Título | `src/lib/summaryTitle.ts` | `stripHeader` quita el encabezado de serie al principio del renglón («C.O. RESUMEN PED 10»), un filtro de basura descarta renglones de plantilla, `undouble` colapsa el texto duplicado que deja pdf.js con los títulos sombreados y `stripTail` quita la firma del autor al final |
| Emparejado | `similarity` / `matchTopic` | Cobertura de palabras en **ambos sentidos** (el temario es más largo que el título), con raíz aproximada (`stem`), diccionario de siglas (RCP, EVC, IAM, EPOC, ERC, LRA, TEP…) y pista de especialidad por la ruta. Dos umbrales: ≥ 0.8 `seguro`, ≥ 0.45 `probable`, por debajo `ninguno` |
| Lector | `src/lib/pdf.ts` | `loadPdfData` es la costura: si el `docId` empieza por `sum:`, el archivo se lee de la carpeta en vez de IndexedDB. Resaltados, tinta, post-its y búsqueda funcionan sin cambios |
| Biblioteca | `addExternalDoc` (`store/library.ts`) | Registra el `DocMeta` de un resumen sin guardar bytes |

- El `docId` de un resumen es `sum:<ruta relativa>`: estable mientras no muevas el archivo, y nunca choca con los PDFs propios.
- Una segunda revisión no vuelve a abrir lo que ya conoce (compara ruta + tamaño) y deja en `missing` lo que ya no está en la carpeta.

## v0.16 · Que no se pierda nada

| Módulo | Archivo | Notas |
|---|---|---|
| Copias por día | `lib/backup.ts`: `keepPrevious`, `prune`, `history`, `historyFile` | Antes de sobrescribir `quiron-codex-datos.json` se guarda el anterior en `historial/quiron-codex-datos-<día>.json`. Se conservan 7 diarias y, más atrás, las de los lunes (4 semanas) |
| De qué día es un respaldo | `dayOfBackup(file)` | Lee el `exportedAt` de los primeros 400 bytes del propio archivo; la fecha del sistema de archivos solo se usa si está cifrado o ilegible, porque OneDrive la reescribe al sincronizar |
| Carpeta sin permiso recordado | `chooseFolder` | El handle se cachea en memoria antes de intentar guardarlo en `kv`; si el navegador se niega, la carpeta sirve igual en esa sesión |
| Borrados que cuentan | `lib/idb.ts` `del` | Incrementa el contador de cambios, así el respaldo automático no se salta una sesión que terminó borrando |

- La prueba `v16.py` cubre el ciclo completo: respaldar → borrar `kv`, `ink` y `alq:*` → traer de la carpeta → comprobar que la perla y el plan volvieron, y restaurar la copia de un día anterior. La carpeta se simula en la propia página (handles con la forma del selector del sistema) porque OPFS con un handle guardado en IndexedDB tumba al Chromium headless al recargar.

## v0.17 · Bolsillo

| Módulo | Archivo | Notas |
|---|---|---|
| Caparazón de teléfono | `src/pocket/PocketApp.tsx` | Tres franjas (`grid-template-rows: auto 1fr auto`) con `100dvh`: título, contenido y cuatro pestañas abajo. No reimplementa nada: reusa `CalculatorCard`, `DrugPanel` y `FlashcardReview`, y lee las fichas de `topicStore` |
| Cuándo entra | `useNarrowScreen(560)` en `App.tsx` | `matchMedia` con escucha, no una medida al arrancar: el Fold pasa de ~344 px a ~690 px sin recargar y la app cambia en el momento. `settings.pocketFull` recuerda «Ver todo» |
| Objetivos táctiles | `@media (pointer: coarse)` en `global.css` | Hasta la 0.16 solo crecían algunos componentes; ahora el piso es 44 px para `.btn`, `.icon-btn`, `.fold-btn`, `.rail-btn`, campos, casillas y los renglones de lista (WCAG 2.5.8) |
| Medidas del Fold 5 | `v17.py` | Cerrado 904×2316 @2.625 → **344×882** css; abierto 1812×2176 → **690×829** css. La suite comprueba ambas, el cambio en vivo y que no haya desborde horizontal ni controles chicos |

- Bolsillo es solo lectura en las fichas de guardia: capturar con una mano en una guardia no es un caso real, y evita escribir en el almacén desde el teléfono.

## v0.18 · Actualizaciones y primera vez

| Módulo | Archivo | Notas |
|---|---|---|
| Aviso de versión | `lib/update.ts`, `features/backup/UpdateBar.tsx` | Consulta `releases/latest` de GitHub como mucho una vez al día (`qc:updateChecked`), a los 8 s de arrancar y nunca antes. Sin internet o con GitHub caído devuelve `null` sin ruido. `qc:updateSeen` recuerda la versión que rechazaste |
| Comparar versiones | `isNewer(a, b)` | Número por número, no como texto: «0.9.0» no es más nueva que «0.10.0» |
| Dónde aplica | `updatesMatter()` | Solo en la app de escritorio (Tauri). En el navegador y el teléfono la PWA ya se actualiza al recargar |
| Qué falta por hacer | `home/FirstRun.tsx` | Tarjeta en Inicio con los pendientes reales (respaldo, resúmenes, fichas de guardia), cada uno con su porqué y su acción. Se calcula del estado, así que un punto desaparece en cuanto se resuelve; `qc:firstRunHidden` la oculta para siempre |

- **La actualización silenciosa queda pendiente**: `tauri-plugin-updater` exige una llave de firma minisign, y ni `npm` ni el binario del CLI de Tauri son alcanzables desde el entorno donde se construye este proyecto. El aviso cubre el 80 % sin tocar el pipeline de releases.

## v0.19 · Estrategia de estudio

| Módulo | Archivo | Notas |
|---|---|---|
| Evidencia | `strategy/evidence.ts` | `gather()` arma el retrato real desde los almacenes que ya existen: cumplimiento del plan hasta hoy, minutos por día de la semana y por hora (de `planner.logs`), mediana diaria, días activos de los últimos 21, temas flojos (`analytics/mastery`), olvidos de tarjetas y aciertos de simulacros. `summarize()` lo pasa a texto para el motor |
| Cuestionario | `strategy/questions.ts` | Dos bloques con usos distintos: «circunstancias» ajusta el plan (es aritmética sobre tiempo disponible); «preferencias» **solo** elige qué herramienta sugerir. `BLOCK_NOTE` lo dice en pantalla |
| Propuestas | `strategy/propose.ts` | `localProposals()` son reglas deterministas (sirven sin clave y de respaldo). `aiProposals()` manda evidencia + respuestas con un catálogo cerrado de acciones. `sanitize()` descarta lo que no está en el catálogo y recorta cada número a su rango |
| Pantalla | `strategy/StrategyModal.tsx` | Cuestionario → propuestas → aplicar una por una. Cada aplicación es un `setConfig`/`setRetention`/`setReminders` normal, así que el plan se recalcula como siempre y las lecciones marcadas se conservan |

- La IA no planifica: el planificador determinista sigue siendo la única fuente del plan, y la IA solo propone valores para sus parámetros. Eso mantiene el plan explicable y acota el daño de una respuesta mala.
- `v19.py` incluye un motor que devuelve basura a propósito (acciones inexistentes, 9000 minutos, `primaryShare: 5`, una vista `javascript:`) y comprueba que nada de eso entra.

## v0.20 · iPad, colapsar y web pública

| Módulo | Archivo | Notas |
|---|---|---|
| Alto real de la ventana | `global.css` `.app`, `.modal` | `100vh` en iOS mide la ventana sin la barra de direcciones: la app quedaba más alta que la pantalla y `body { overflow: hidden }` hacía inalcanzable el panel de abajo. `100dvh` (con `100vh` antes, de respaldo) mide lo visible y se reajusta |
| Colapsar | `components/layout/SplitPane.tsx` | Dos asas dentro del propio separador (posicionadas absolutas, `z-index` por encima de las barras de los paneles) que alternan `paneMode`, y una pestaña `.split-back` para volver. `onPointerDown` con `stopPropagation` para no iniciar un arrastre al tocarlas |
| Web pública | `.github/workflows/web.yml` | Compila con Vite y publica en GitHub Pages en cada push a main. `base: './'` y rutas relativas en `manifest.webmanifest`, `sw.js`, `index.html` y el registro del service worker: la misma compilación sirve en la raíz y bajo `/QUIRON_CODEX/`. Pages se enciende una vez a mano (el token del workflow no puede crear el sitio) |

- No se pudo reproducir Safari localmente (no hay WebKit instalable en el entorno de construcción), así que el arreglo de `dvh` se razonó desde el código y se verificó la geometría en tamaño de iPad; la confirmación final es en el dispositivo.

## v0.22 · Respaldo donde no hay carpetas

| Módulo | Archivo | Notas |
|---|---|---|
| Cuándo avisar | `lib/backup.ts` `fileBackupOverdue()` | Devuelve `null` si el dispositivo sí tiene carpetas (ahí no hay que recordar nada) o si no hay nada que perder; `Infinity` si nunca se ha respaldado aquí. `qc:fileBackupAt` lo marca cada descarga |
| La barra | `features/backup/FileBackupBar.tsx` | Se monta en la app y en Bolsillo. «Mañana» (`qc:fileBackupSnooze`) la calla 24 h, no para siempre: un respaldo que depende de que te acuerdes no es un respaldo |
| Qué cuenta como «hay algo que perder» | mismo archivo | El plan del internado ya es trabajo del usuario, así que basta con que exista; no se espera a que haya notas |

## Modelo de datos (resumen)

`DocMeta` · `Highlight{page, rect(0–1), color, text, style: box|underline, thickness}` · `Sticky{page, x, y, text, color, open}` · `Bookmark{page, label}` · `Notebook{name, subjectId, color}` · `Note{docId|null, notebookId|null, html, inkPages, paper: 11 estilos, sheet?: a4|carta|apaisada|rollo, sheetBg?, kind, inkText?, classText?, tags?}` · `Stroke{page, tool: pen|pencil|marker|highlighter, color, size, points[x,y,presión], t?: segundo de la grabación, layer?: 'draft'}` · `Summary{path, title, topicId, level, score, pages}` (índice de la carpeta de resúmenes; sin bytes) · `Subject` · `StudySession{date, topic, subjectId, minutes, done, docId}` · `Goal{metric, target, period, subjectId}` · `FocusLog{date, minutes, subjectId}`

## Próximos pasos sugeridos

- **Exportar el PDF anotado** (incrustar resaltados, tinta y post-its en el propio PDF con pdf-lib).
- **Sincronización automática en la nube**: hoy la carpeta compartida avisa y trae a petición (v0.8). Un adaptador sobre `createStore` (Supabase o servidor propio) podría replicar `kv`, `pdfs` e `ink` sin intervención.

- **Fuente Unicode incrustada** al exportar (para griego y símbolos sin transliterar).
- **PWA instalable** (service worker) para abrirla como app en Windows.
