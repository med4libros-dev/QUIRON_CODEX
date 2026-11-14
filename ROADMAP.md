# Quirón Codex · Internado — Roadmap técnico

Objetivo: la herramienta de estudio definitiva para el año de internado médico de pregrado en México. Funciona sin conexión y está optimizada para Surface con lápiz.

## Decisión de arquitectura

Se construye **sobre la base de Quirón Codex** (el nombre anterior de Quirón Codex), no desde cero. Ya existen y están probados el lector de PDF (pdf.js en Web Worker, render diferido), el lienzo con presión y "solo lápiz", el editor tipo Word, los cuadernos, el Pomodoro y el respaldo. Rehacerlos costaría semanas sin ganar nada.

| Capa | Elección | Motivo |
|---|---|---|
| UI | React 19 + TypeScript (SPA) | Sin servidor: funciona como archivo único (`Quiron Codex.html`) y offline |
| Build | Vite (desarrollo) + compilación a un solo archivo | Doble clic en la Surface, sin instalar nada |
| Estilos | Sistema propio «Pistache» (CSS con tokens) | Ya existe y es coherente. Tailwind no aporta aquí y añadiría otra convención |
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
- **Estilo «Cristal líquido» con paleta «Dark Academia / Parnaso»** (por defecto, oscuro: espresso #1C1917, ámbar #F59E0B/#FB923C, pizarra #6366F1/#818CF8, texto pergamino; versión clara en pergamino). «Mate» conserva el estilo Pistache original.
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

### Fase 3 · Lienzo clínico avanzado
- Plantillas de **flujogramas** (diagnóstico y tratamiento) y cajas/flechas que se ajustan solas.
- Reconocimiento de formas: un trazo a mano alzada se convierte en rectángulo, círculo o flecha.
- Capas (borrador / limpio), lazo para mover y escalar trazos, recortes del PDF pegados en el lienzo.
- Búsqueda en todas las notas (texto) y etiquetas.

### Fase 4 · Active recall avanzado (parcialmente cubierto por la Fase 3b)
- **Flashcards con FSRS**: se crean desde resaltados, perlas ENARM y huecos (cloze) del texto; tienen una cola diaria integrada a la lección del día.
- **Mini-examen del día** tipo ENARM: caso clínico corto, 4–5 opciones, retroalimentación inmediata y la **cita de la GPC con su página**. Se generan con Claude a partir del texto de la guía vinculada (opcional, con API key) y se guardan en un banco local editable. Sin internet usa solo el banco.
- Estadísticas de desempeño por especialidad y tema; los temas débiles reciben más repaso.
- **Replanificación adaptativa**: si te atrasas o fallas, el algoritmo redistribuye desde hoy.

### Fase 5 · Pulido y portabilidad
- App instalable (PWA) en Edge con ícono propio; modo guardia (repasos de 5–10 min con una mano).
- Sincronización opcional en la nube (por ejemplo Supabase) además de la carpeta de OneDrive.
- Exportar el plan al calendario (.ics) y un informe semanal de avance.

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
