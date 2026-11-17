# Quirón Codex · Internado — Roadmap técnico

Objetivo: la herramienta de estudio definitiva para el año de internado médico de pregrado en México. Funciona sin conexión y está optimizada para Surface con lápiz.

## Decisión de arquitectura

Se construye **sobre la base de Quirón Codex** (el nombre anterior de Quirón Codex), no desde cero. Ya existen y están probados el lector de PDF (pdf.js en Web Worker, render diferido), el lienzo con presión y "solo lápiz", el editor tipo Word, los cuadernos, el Pomodoro y el respaldo. Rehacerlos costaría semanas sin ganar nada.

| Capa | Elección | Motivo |
|---|---|---|
| UI | React 19 + TypeScript (SPA) | Sin servidor: funciona como archivo único (`Quiron Codex.html`) y offline |
| Build | Vite (desarrollo) + compilación a un solo archivo | Doble clic en la Surface, sin instalar nada |
| Estilos | Sistema propio «Códice» (CSS con tokens en tres capas) | Identidad propia de la app desde la 0.11: papel, filetes de tinta y serif incrustada. Tailwind no aporta aquí y añadiría otra convención |
| PDF | pdf.js | Estándar de facto; maneja PDFs pesados en segundo plano |
| Lápiz | Canvas 2D propio (Pointer Events + presión + coalesced events) | Ya optimizado para Surface Pen; no depende de bibliotecas |
| Datos | IndexedDB + localStorage (local-first) | Privado, rápido y offline. El respaldo en carpeta de OneDrive sincroniza la PC y la Surface |
| Planificación | Algoritmo determinista propio (`internship/planner.ts`) | Explicable, rápido (~10 ms por año) y sin dependencias |
| Repaso espaciado (fase 4) | FSRS (`ts-fsrs`) | Algoritmo moderno, mejor que SM-2 |
| Preguntas tipo ENARM (fase 4) | API de Claude con el texto de la GPC como fuente + banco local revisado | Las preguntas citan la página de la guía; nada se inventa sin fuente |

## Situación de las GPC (noviembre 2026)

- En 2025 CENETEC pasó a ser la DGMoSS y **el Catálogo Maestro quedó suspendido**.
- **El dominio antiguo del catálogo (`cenetec-difusion.com`) hoy es un sitio de casinos.** No debe enlazarse nunca.
- Los PDFs de GPC del **IMSS** siguen publicados (`imss.gob.mx/sites/all/statics/guiasclinicas/<clave>GER.pdf`).
- Por eso el módulo de GPC: (1) busca cada tema solo en dominios oficiales (`imss.gob.mx`, `gob.mx`, `issste.gob.mx`); (2) en la fase 2 permite **vincular el PDF oficial descargado** a cada tema. Así la biblioteca no depende de un catálogo que puede volver a desaparecer.

## Fases

### Fase 1 · Esqueleto y planificador del año ✅ (Sprint 1, entregado)
- Vista **Inicio**: lección del día, pendientes, próximos días, calendario mensual con rotaciones y guardias, línea de tiempo de rotaciones y progreso del temario por especialidad.
- **Temario base**: 139 temas en 6 especialidades (MI, CG, GO, PED, URG, SP/MF) con prioridad sugerida.
- **Asistente de plan**: fecha de inicio, orden y duración de rotaciones, guardias (ABC/ABCD), minutos por tipo de día, postguardia, semanas de repaso final y enfoque en la rotación.
- **Algoritmo de distribución anual** (ver abajo).
- "Estudiar" abre la nota del tema en el cuaderno de su especialidad, con una plantilla clínica: definición, fisiopatología, cuadro clínico, diagnóstico, tratamiento, perlas ENARM y dudas.
- Criterio de aceptación: con 60 min entre semana y 120 min en fin de semana, el temario completo y sus repasos caben en el año sin exceder ningún día. **Cumplido.**

### Fase 2 · Biblioteca GPC, perlas y modo guardia ✅ (entregada, noviembre 2026)
- **Varios documentos por tema**: GRR, GER u otro (se clasifican solos por el nombre, p. ej. `043GER.pdf`). «Estudiar» abre la GER en temas nuevos y la GRR en repasos. Botón de búsqueda oficial (IMSS, gob.mx, ISSSTE) en cada tema.
- **Extractor de perlas**: capa de texto de pdf.js + herramienta **Recorte (R)**. Al seleccionar texto o encerrar una zona con el lápiz aparece un menú: **Apunte** (al final de la nota del tema con 📑 referencia a la página), **Flashcard** (texto al reverso, tú escribes la pregunta), **Lienzo** (imagen en el lienzo para rayar encima) y **Guardia** (a la ficha de bolsillo).
- **Vista de Guardia**: ficha por tema (criterios, 1ª y 2ª línea con dosis *tomadas de tu GPC*, criterios de referencia) + 17 escalas y calculadoras (Glasgow, Wells TEP/TVP, CURB-65, qSOFA, CHA₂DS₂-VASc, Centor, APGAR, Silverman, Bishop, Alvarado, Child-Pugh, Parkland, Na corregido, brecha aniónica, CKD-EPI 2021, IMC). Acceso desde la barra lateral.
- **Modo supervivencia** («Hoy no doy más / Postguardia»): mueve lo pendiente del día a los días con más hueco (primero esta semana, nunca a guardias), sin regenerar el plan anual; deja una sesión exprés de flashcards de 10 min. Se puede deshacer.
- **Bitácora de casos**: 3 líneas anónimas por paciente, ligadas al tema, con aviso si detecta nombre, cama, NSS/expediente o CURP.
- **Flashcards** con repetición espaciada tipo SM-2 (Otra vez / Difícil / Bien / Fácil) y cola diaria en Inicio.
- Pendiente para fases siguientes: editor del temario, FSRS, mini-exámenes.

### Fase 3a · Herramientas del internado ✅ (entregada, noviembre 2026)
- **Nota médica en 1 clic** (barra lateral → Nota SOAP): evolución (SOAP), ingreso, postquirúrgica y egreso con los apartados de la NOM-004 (fecha/hora, signos vitales, evolución, resultados, diagnóstico, pronóstico, plan, firma). Criterios, manejo y datos de alarma salen de *tu* ficha de guardia; los datos del paciente no se guardan en disco. Plantillas editables.
- **Perlas HY**: repositorio de mnemotecnias, tríadas, signos y fármacos de elección por tema; 20 epónimos clásicos de semiología de base; repaso relámpago, favoritas, convertir en flashcard, enviar a la nota, exportar/importar para compartir con compañeros; acción «Perla HY» en el menú de perlas del PDF.
- **Estilo «Cristal líquido» con paleta «Dark Academia / Parnaso»** y «Mate» (Pistache). *Ambos retirados en la v0.11, sustituidos por el pack único «Códice».*
- **Mini reproductor** de música local (carpeta completa, .mp3/.wav/.flac/.ogg).
- **App de escritorio para Windows (Tauri 2)**: instalador .msi/.exe con el logo del centauro, enlaces externos al navegador predeterminado, compilación en GitHub Actions o local (`construir-escritorio.bat`). Ajustes táctiles para la Surface (objetivos de 44–56 px con dedo/lápiz, deslizadores que no arrastran la página).
- **Nuevo nombre: Quirón Codex** (antes Alquimia). Los datos se conservan; el respaldo lee también los archivos con el nombre anterior.

### Fase 3b · Examen, hospital y repaso ✅ (entregada, noviembre 2026)
- Se retiró el hub de NotebookLM (a petición del usuario).
- **Simulacros ENARM**: casos con viñeta, distractores y explicación de cada opción, generados con Claude desde la GER adjunta (citando la página) o tus apuntes; entran «por revisar». Bloques de 10–100 preguntas, 1 min por pregunta, modo examen o estudio, prioridad a las nunca vistas y falladas, desglose por especialidad, banco editable con exportar/importar.
- **Mapa de debilidades + plan adaptativo**: dominio por tema (simulacros + flashcards) en Progreso; los 3 temas más bajos reciben un repaso de refuerzo de 15 min en la semana sin regenerar el plan.
- **Turno**: lista temporal de pacientes (cama, sexo, edad, peso, tema, pendientes por tipo), fuera de los respaldos, caduca al terminar el turno; conecta con Nota SOAP, dosis por peso y la bitácora de casos.
- **Búsqueda global (Ctrl+K)**: temas, notas, texto de los PDF por página (índice guardado fuera de los respaldos), perlas, fragmentos, casos, flashcards y preguntas.
- **Escuchar**: lectura en voz alta de perlas y notas con las voces en español del sistema, sin internet.
- **Fármacos por peso**: fichas que capturas de la GPC (mg/kg por dosis o por día, presentación, máximos); la app calcula mg y mL y avisa/ajusta si se rebasa tu máximo.

### v0.5 · 19 mejoras del internado ✅ (entregada, noviembre 2026)
- **Recordatorios** del sistema (plugin de notificaciones de Tauri; API Notification en navegador; aviso interno como respaldo) mientras la app está abierta.
- **Bitácora**: procedimientos por rotación con conteo y meta, casos de todas las rotaciones, diario de reflexión privado.
- **Ensayo del pase de visita** desde la tarjeta del Turno (guion solo con lo capturado + cronómetro).
- **Mnemotecnias con IA** para temas débiles; **preguntas desde subrayados**; **diagrama del algoritmo** desde la GPC, editable y pegado en el lienzo.
- **Resumen semanal** (domingo) exportable a PDF; **fármaco del día** de tus fichas.
- **Respaldo cifrado** (AES-GCM 256 + PBKDF2 250 000 iteraciones; contraseña solo en memoria; respaldo automático en pausa si está bloqueado).
- **Seguimiento de lectura** por página (8 s = leída) y **páginas clave**; **comparador** de dos guías con scroll proporcional.
- **Plantillas por especialidad** (CG, PED, GO) y **detector de huecos** en notas.
- **Modo noche** (velo ámbar sin azul, automático por horario).
- **Signos vitales por edad** capturados por el usuario; Turno marca fuera de rango.
- **Mapa de GPC** por especialidad (sin GPC / adjunta / leyendo / leída).
- **«Me lo preguntaron»** en preguntas, perlas y flashcards como repaso prioritario.

### v0.5.1 · Pulido visual ✅ (noviembre 2026)
- Barra lateral de 17 a 11 botones (menús «Herramientas» y «Ajustes»); franja de 4 indicadores en Inicio con cuenta regresiva al ENARM; tarjetas plegables; ámbar reservado para la acción principal; prioridad como punto; tablas en modo lectura con edición explícita; estados vacíos con ejemplo y acción; aviso de modo noche; transiciones de 120 ms (respetan «reducir movimiento»).
- v0.5.2: «Lección de hoy» como tarjeta principal: anillo de avance del día, bloque «Sigue» con el próximo tema, resumen de lecciones, ornamento y estado de día completo.

### v0.6 · Huecos, PDF anotado y pulido ✅ (noviembre 2026)
- **Flashcards de huecos (cloze)** desde los subrayados del PDF o desde una selección (menú de perlas): sugerencia automática (cifra con unidad o término más largo), edición tocando palabras, varias por lote, ligadas al tema y a la página.
- **Exportar PDF anotado** (pdf-lib): resaltados como rectángulos translúcidos, subrayados, tinta con presión, post-its como recuadros con texto e índice de marcadores en una hoja final.
- Menú **⋯** en la barra del PDF (preguntas con IA, huecos, exportar anotado).
- **Preferencias**: noche, recordatorios e **IA** (API key y modelo) en un solo lugar; versión visible.
- **Atajos globales** (G, ?) y ventana de **Novedades** una vez por versión (no aparece en instalaciones nuevas).

### v0.6.5 · Estabilidad y pulido ✅ (noviembre 2026)
- Rendimiento: pdf-lib y 7 vistas con carga diferida (el paquete de arranque baja de ~1.56 MB a ~1.0 MB en producción); modo ahorro de batería (auto con `navigator.getBattery`).
- Tableta: división vertical en Surface en retrato, semana completa en el calendario, objetivos táctiles de 40–50 px.
- Datos: verificación del respaldo en carpeta, aviso persistente de fallas, copia previa y «Deshacer restauración», aviso de almacenamiento > 85 %, aviso si una escritura falla, validación de cabecera `%PDF-`.
- Textos y nombres unificados (GPC y temario, Ajustes → Preferencias), estados vacíos con acción.

### v0.6.7 · Zoom y escritura rápida ✅ (noviembre 2026)
- `usePinchZoom` (pellizco y Ctrl + rueda con vista previa por transform), zoom del lienzo (`settings.inkZoom`), desplazamiento horizontal con el dedo.
- Tinta: confirmación incremental al soltar (sin redibujar la hoja), se retiró `desynchronized` y la predicción quedó opcional, `stabilize` adaptable, la punta solo borra su zona.

### v0.6.6 · Tinta de baja latencia ✅ (noviembre 2026)
- Trazo en vivo incremental (solo el tramo nuevo, sin `requestAnimationFrame` ni redibujar el trazo completo), canvas `desynchronized`, eventos `pointerrawupdate`, punta con `getPredictedEvents()` en una capa aparte que se borra en cada evento, opacidad del marcatextos/lápiz en la capa y estabilización más ligera (0.75).

### v0.7 · Lápiz primero ✅ (noviembre 2026)
- **Lazo** (`strokesInLasso`, `applyXf`), **reconocimiento de formas** (`recognizeShape`: línea, flecha, rectángulo, elipse), **plumas favoritas**, **botón lateral** configurable, **hojas** (insertar/mover/quitar con remapeo de trazos e imágenes) y plantillas Cornell/columnas.
- **Guía en oscuro** (filtro invert+hue-rotate sobre el canvas) y **modo lectura** a pantalla completa.
- **Reloj de estudio automático** (`lib/autoFocus.ts`) que alimenta el mismo registro de foco del Pomodoro.
- **Motor de IA intercambiable**: Claude o Gemini (`lib/ai.ts`), con clave y modelo por proveedor.
- **Rendimiento del lápiz**: confirmación incremental sin redibujar la hoja, grupos estables por página (`lib/groups.ts`), guardados aplazados mientras escribes (`lib/inkBusy.ts`), hojas lejanas sueltan sus canvas, Estudio sin fondo animado ni desenfoque.
- **Diagnóstico del lápiz**: mide eventos/s, tiempo de dibujo, evento→pintado, cuadro y pintado→pantalla.

### v0.8 · Lo escrito a mano, buscable ✅ (noviembre 2026)
- **Reconocimiento de escritura** (`lib/inkOcr.ts` + visión en `lib/ai.ts`): la hoja se dibuja a PNG y el motor elegido la transcribe; el texto vive en `Note.inkText`, entra en Ctrl+K y puede volcarse al editor.
- **Buscar en el PDF abierto** (`lib/findInPage.ts` + `features/pdf/FindBar.tsx`): coincidencias contadas desde el índice de texto y marcadas con rectángulos sobre la capa de texto.
- **Pestañas** (`settings.openDocs`), **recorte de márgenes** (`settings.pdfCrop`, por `clip-path` + márgenes negativos: las anotaciones no se mueven) e **índice del archivo** (`outlineOf`).
- **Oclusión de imágenes** (`flashcards/OcclusionModal.tsx`, `Card.occlusion`), **hoja de resaltados por tema** y **tapar la columna Cornell**.
- **Papelera de 30 días** (`store/trash.ts`) e **historial de notas** (`lib/noteHistory.ts`).
- **Etiquetas** (`Note.tags`), **dictado** (`lib/dictation.ts`), **paquete de repaso** (`lib/studyPack.ts`), **.ics** (`lib/ics.ts`) y **cuaderno a PDF** (`exportNotebookToPdf`).
- **Sincronización asistida** Surface ↔ PC (`syncCheck`/`startSyncWatch` + `features/backup/SyncBar.tsx`): avisa y trae, nunca sobreescribe sin preguntar.

### v0.9 · Lector, repaso y temario propios ✅ (noviembre 2026)
- **FSRS** (`flashcards/fsrs.ts`) sustituye a SM-2, con exigencia configurable y cola de guardia a una mano.
- **Doble plana**, **barra flotante en pantalla completa**, **organizar hojas** (reordenar, fusionar, mover la selección).
- **Temario editable** sin perder lo estudiado (`internship/curriculumStore.ts`, `applyCurriculumEdits`).
- **Historial de simulacros** con tendencia y repetición de falladas; **informe semanal** con planeado vs. real.
- **Glosario de abreviaturas** y transcripción de un cuaderno completo; **espacio y revisión** del respaldo.

### v0.10 · Widgets de escritorio ✅ (noviembre 2026)
- Ventanitas siempre encima (cápsula de estudio, pendientes del turno, repaso, captura rápida), inspiradas en los *glance widgets* de DeskBox pero escritas desde cero para este proyecto.
- Atajos globales `Ctrl+Alt+Q/K/G` con `tauri-plugin-global-shortcut`.
- Sincronía entre ventanas por `BroadcastChannel`: una escritura avisa su clave y las demás ventanas releen solo esa.

### v0.11 · Códice ✅ (noviembre 2026)
- **Pack visual único «Códice»**, hecho a medida: tres niveles de papel (mesa → lámina → página, y la página siempre es la superficie más clara), filetes de tinta en lugar de sombras, desenfoques y resplandores, esquinas casi rectas (2 px), guía activa con filete en vez de bloque relleno, versales pequeñas en los rótulos. Paleta: tinta roja `#9a2a22` / `#d4674f` y cardenillo `#2f5d50` / `#8fb3a4`. Se retiran «Cristal líquido» y «Pistache», y con ellos el selector de estilo.
- **Tipografía propia**: serif **Lora** (variable, subconjunto latino, WOFF en base64 dentro de `src/styles/fonts.css`, ~120 KB) para títulos y para todo lo que se lee; `Segoe UI Variable` para la interfaz. No se pide nada a internet. Licencia OFL vendida en `src/styles/fonts/`.
- **Once estilos de hoja** (`PaperStyle`): rayada, con margen, mitad dibujo y mitad renglón, lisa, punteada, cuadrícula, milimetrada, papel de electro, lámina con pie, Cornell y dos columnas; agrupados en el selector por para qué sirven. Todos en CSS puro sobre `--line`, así que escalan con el zoom y no entran en el recorte ni en la exportación.
- **Hojas continuas** (`settings.inkAuto`, activadas por omisión): al escribir en la última hoja aparece otra debajo. La hoja de más es virtual (`pages = reserved + 1` cuando hay tinta en la última), no se persiste, se retira sola al borrar lo escrito y el organizador de hojas no la cuenta.

### v0.12 · El lienzo manda ✅ (noviembre 2026)
- **Lazo → texto, fórmula o flashcard** (`lib/ink.ts:renderInkCrop`, `lib/inkOcr.ts:recognizeCrop`, `features/notes/InkCropModal.tsx`): transcribe solo el recorte encerrado, con un margen de aire, en vez de la hoja entera. Se corrige antes de llevárselo.
- **Margen de notas junto al PDF** (`settings.pdfMargin`): franja en blanco al 30 % o 60 % del ancho de la página. La escala de la tinta no cambia: lo anotado antes sigue en su sitio y lo escrito en la franja simplemente tiene x > 1000.
- **Columna de miniaturas** (`features/notes/SheetRail.tsx`) con la hoja actual marcada, para cuadernos largos.
- **Tamaño de hoja** (`SheetKind`: A4, carta, apaisada, rollo) y **fondo propio** (`Note.sheetBg`): el ancho lógico sigue siendo 1000, solo cambia el alto.
- **Grabar la clase** (`lib/classAudio.ts`, `features/notes/ClassAudioBar.tsx`): cada trazo guarda su segundo (`Stroke.t`) y tocarlo salta a ese momento. Solo clases; el audio vive en el almacén binario con prefijo `audio:` y queda fuera de los respaldos.
- **Examen largo** (`exam/LongExam.tsx`): bloques cronometrados encadenados con descanso; cada bloque se guarda como intento propio y al final se muestra el acumulado.
- **Reconocimiento en segundo plano** (`lib/inkOcrAuto.ts`) y **sincronización automática** (`startSyncWatch` + `settings.syncAuto`), ambos apagados de fábrica y con reglas para no estorbar ni reemplazar nada en silencio.
- **Accesibilidad**: `--border-strong` sube a 3:1 contra la lámina (WCAG 1.4.11), los campos recuperan el anillo de foco con `:focus-visible` y se retiran los últimos verdes del tema anterior.

### v0.13 · Lo que faltaba ✅ (noviembre 2026)
- **Arreglo de la 0.12**: `buildPdf` recibe `sheet` y usa `sheetH`; las miniaturas, el OCR y el recorte del lazo también. Una nota apaisada o en rollo ya no se exporta deformada.
- **Transcribir la clase** (`lib/classAudio.ts:transcribeClass`, `Note.classText`): el audio va por `callAi({ audio })`, que solo acepta Gemini (la API de Claude no recibe audio) y lo dice con un mensaje claro. El grabador baja a 32 kbps para que una hora quepa en el límite de 16 MB.
- **Virtualización del lienzo** (`InkCanvas`): ventana de hojas montadas con separadores arriba y abajo; el alto se mide de una hoja real, así vale para cualquier tamaño y zoom. Por debajo de 12 hojas no se virtualiza.
- **Flashcards desde el margen del PDF**: `renderInkCrop` acepta un ancho de página mayor que 1000, que es donde vive lo escrito en la franja.
- **Replanificación adaptativa** (`planner.ts:catchUpMoves`, `lateCount`): reparte el atraso en los próximos 21 días por capacidad real, con los repasos limitados a 7 días; lo que no cabe se queda y se informa.
- **Mini-examen del día** (`exam/MiniExam.tsx`): cinco preguntas de los temas del día, reusando `Runner` en modo estudio.
- **Flujogramas** (`lib/shapes.ts`: `flowTemplate`, `snapArrowToBoxes`): plantillas en tinta normal (el lazo y el borrador las tratan como a todo lo demás) y enganche de flechas al borde de las cajas cercanas.
- **Capas** (`Stroke.layer`, `tools.layer`/`showDraft`): el borrador se dibuja al 38 % y se puede ocultar sin borrarlo.
- **PWA** (`public/manifest.webmanifest`, `public/sw.js`): instalable en Edge, red primero y caché como respaldo; no se registra en la app de escritorio ni en el HTML de un solo archivo.

### v0.14 · Disco de instrumentos ✅ (noviembre 2026)
- `components/PenDial.tsx` sustituye a `PenControls`: tres anillos concéntricos (instrumento, color, grosor) que **se giran** en lugar de botones. Cada anillo es una zona de arrastre `role="slider"`: el `pointerdown` engancha, los `pointermove` van siguiendo el ángulo y se suelta donde quieras.
- El grosor es continuo sobre un arco de 300°, con el hueco abajo para que tenga principio y fin; el arco se va engrosando y un marcador señala dónde estás.
- Posición fija por esquina (`corner="tr"` en el lector, `corner="tl"` en el lienzo) para que el gesto se aprenda sin mirar. Cerrado ocupa 48 px.
- Las plumas favoritas y el color libre quedan bajo el disco; se retira `PenControls` y su CSS.

### v0.15 · Resúmenes de la carpeta ✅ (noviembre 2026)
- Vista **Resúmenes**: se le apunta a la carpeta de ultrarresúmenes y se indexa **en su sitio**, sin copiar nada. Una colección de ~2 GB deja un índice de kilobytes, y la app y el instalador siguen pesando lo mismo.
- El nombre del archivo no sirve («Med Interna 7»), así que el título sale de la **primera página** de cada PDF (`lib/summaryTitle.ts`) y se empareja con el temario con cobertura en ambos sentidos, raíces y siglas. `seguro` queda fijo; `probable` y `ninguno` se confirman a mano desde la lista.
- Los resúmenes de un tema aparecen en su ficha, junto a los PDFs, y abren en el lector de siempre (`loadPdfData` lee de la carpeta cuando el `docId` empieza por `sum:`).
- Todo local: sin internet y sin IA. En Windows conviene tener **Google Drive para escritorio** para que la carpeta compartida exista como carpeta del sistema.

### Camino a la 1.0 (noviembre 2026)

La 1.0 es «la app en la que confías un año entero», no una con más funciones. Cinco frentes:

1. **Que no se pierda nada** ✅ v0.16 — copias por día, restauración probada de cero, borrados que cuentan.
2. **Aguantar la colección real** — medir con ~2 GB de resúmenes y GPC, no con cinco PDFs de prueba.
3. **Quirón de bolsillo** ✅ v0.17 — ficha de guardia, dosis, escalas y repaso en el teléfono, con el Fold (cerrado y desplegado) como blanco.
4. **Actualizarse sola** y una primera vez clara — ✅ v0.18 el aviso de versión nueva y la tarjeta «Antes de empezar el internado»; la instalación silenciosa (llave de firma de Tauri) queda pendiente.
5. **Congelar**: regresión completa, instalador y nada nuevo durante la primera semana de guardias.

Fuera de la 1.0 por ahora: fuente Unicode al exportar y mover la suite de pruebas al repo.

### Fase 3 · Lienzo clínico avanzado
- Plantillas de **flujogramas** (diagnóstico y tratamiento) y cajas/flechas que se ajustan solas.
- Reconocimiento de formas: un trazo a mano alzada se convierte en rectángulo, círculo o flecha.
- Capas (borrador / limpio), lazo para mover y escalar trazos, recortes del PDF pegados en el lienzo.
- ~~Búsqueda en todas las notas (texto) y etiquetas~~ ✅ v0.8 (incluye lo escrito a mano).

### Fase 4 · Active recall avanzado (parcialmente cubierto por la Fase 3b)
- ~~**Flashcards con FSRS**~~ ✅ v0.9. Se crean desde resaltados, perlas ENARM y huecos (cloze) del texto; tienen una cola diaria integrada a la lección del día.
- **Mini-examen del día** tipo ENARM: caso clínico corto, 4–5 opciones, retroalimentación inmediata y la **cita de la GPC con su página**. Se generan con Claude a partir del texto de la guía vinculada (opcional, con API key) y se guardan en un banco local editable. Sin internet usa solo el banco.
- Estadísticas de desempeño por especialidad y tema; los temas débiles reciben más repaso.
- **Replanificación adaptativa**: si te atrasas o fallas, el algoritmo redistribuye desde hoy.

### Fase 5 · Pulido y portabilidad
- App instalable (PWA) en Edge con ícono propio; modo guardia (repasos de 5–10 min con una mano).
- Sincronización opcional en la nube (por ejemplo Supabase) además de la carpeta de OneDrive.
- ~~Exportar el plan al calendario (.ics)~~ ✅ v0.8. Informe semanal de avance: pendiente.

## Algoritmo de distribución anual (Fase 1)

1. **Capacidad por día**: entre semana, fin de semana, día de guardia (solo repaso breve) y postguardia (fracción configurable).
2. **Ritmo uniforme**: `ritmo = min(1, minutos_temario / (75 % de la capacidad))`. Los temas nuevos se reparten en todo el año y el 25 % restante queda para repasos.
3. **Enfoque en la rotación**: cada día, el 70 % (configurable) del tiempo de temas nuevos va a la especialidad que estás rotando y el resto se intercala con las demás.
4. **Reserva**: al intercalar, primero se refuerzan especialidades ya rotadas o sin rotación. Las futuras solo aportan lo que exceda lo que se estudiará durante su propia rotación, así ninguna rotación llega sin temas.
5. **Prioridad**: dentro de cada especialidad, primero los temas de prioridad alta.
6. **Partición**: un tema largo se divide en partes de 15 minutos o más, según la capacidad del día.
7. **Repaso espaciado**: 10 minutos a los 3, 10 y 30 días de terminar cada tema; si no cabe, pasa al día siguiente.
8. **Repaso integral**: las últimas semanas cubren primero lo pendiente y luego rotan los temas de prioridad alta y media.

Resultado con la configuración por defecto: 139 temas (133 h) + 70 h de repaso espaciado + repaso final; cada rotación dedica 61–82 % del tiempo a su especialidad; ningún día excede su capacidad.
