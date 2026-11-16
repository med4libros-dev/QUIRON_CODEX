# Quirón Codex · estación de estudio para medicina

Lector de PDF con resaltado, subrayado, escritura a mano, post-its y marcadores; notas tipo Word y a mano (optimizadas para Surface Pen) organizadas en cuadernos; calendario de estudio, progreso, Pomodoro y hojas de repaso exportables a PDF y Word. Todo se guarda **en tu navegador**, sin cuenta y sin nube.

> Antes se llamaba **Alquimia**. Tu progreso se conserva: los datos viven en el navegador con la misma clave interna, y el respaldo sigue leyendo los archivos `alquimia-datos.json` anteriores.

## Cómo abrirla

### Opción fácil: `Quiron Codex.html` (sin instalar nada)
Doble clic en **`Quiron Codex.html`** y se abre en tu navegador. Funciona sin internet. Usa siempre **Microsoft Edge** o Chrome y abre siempre el mismo archivo: tu progreso queda guardado en ese navegador.

### Opción de desarrollo: `iniciar.bat`
Para modificar el código: instala **Node.js LTS** (<https://nodejs.org>) y haz doble clic en `iniciar.bat` (se abre en `http://localhost:5173`).

```bash
npm install     # solo la primera vez
npm run dev     # abre la app
npm run build   # versión optimizada en /dist
```

### Opción app de escritorio (Windows, sin navegador)
El proyecto ya está configurado con **Tauri 2** (`src-tauri/`). Genera un instalador `.msi` y uno `.exe` que instalan **Quirón Codex** con su ícono en el menú Inicio; usa el motor WebView2 que ya trae Windows 11 y ocupa pocos MB.

- **Con GitHub (recomendado):** sube el proyecto a un repositorio y entra a *Actions → «Instalador de Windows» → Run workflow*. En ~10 min descargas los instaladores desde el resultado (o, si publicas una etiqueta `v0.3.0`, quedan en un borrador de *Release*). No instalas nada en tu PC.
- **En tu PC:** doble clic en `construir-escritorio.bat` (necesita Node.js, Rust y «Visual Studio Build Tools» con C++ una sola vez). Los instaladores quedan en `src-tauri\target\release\bundle`.
- **Tu progreso:** la app de escritorio guarda sus datos aparte del navegador. Para pasarlos: en el navegador, *Respaldo → Elegir carpeta* (OneDrive); en la app, *Respaldo → misma carpeta → Traer progreso*.
- Todo funciona sin internet. La búsqueda de GPC se abre en tu navegador cuando hay conexión.

## Usarla en tu Surface

1. Esta carpeta está en **OneDrive › Escritorio**: si tu Surface usa la misma cuenta de Microsoft, `Quiron Codex.html` ya aparece ahí. Si no, cópiala con una USB o envíatela.
2. Ábrela con **Edge**. Para que parezca una app: menú **⋯ › Más herramientas › Anclar a la barra de tareas** (o arrastra el archivo a la barra de tareas).
3. Pantalla completa con **F11**. En modo tableta funciona igual.
4. **Solo lápiz** viene activado: la mano y la palma no escriben ni anotan; con el dedo solo desplazas la página. Puedes apagarlo con el botón «Solo lápiz» (en el lienzo y en la barra de herramientas del PDF).
5. El **botón borrador** del Surface Pen (la parte de atrás) borra trazos en cualquier herramienta.

## Tu progreso: dónde se guarda y cómo respaldarlo

- Se guarda **solo y al instante** en el navegador: PDFs, resaltados, post-its, marcadores, notas, cuadernos, calendario, metas y minutos de Pomodoro. Sigue ahí aunque cierres o apagues la computadora.
- Solo se pierde si borras los datos de navegación de Edge, o si abres el archivo en otro navegador u otra computadora (cada uno guarda por separado).
- **Respaldo automático (recomendado)**: **Ajustes** (abajo en la barra izquierda) → **Respaldo** → «Elegir carpeta de respaldo». Elige una carpeta de **OneDrive** (por ejemplo `OneDrive/QuironCodex-respaldo`). Quirón Codex guarda tu progreso ahí cada 2 minutos y al cerrar la ventana.
  - Al reabrir la app, Edge puede pedir permiso otra vez: verás un punto naranja en «Respaldo» → «Reconectar carpeta».
- **Pasar el progreso a la Surface**: en la Surface abre `Quiron Codex.html` → Respaldo → elige **la misma carpeta de OneDrive** → «Traer progreso». Para volver a la PC, haz lo mismo al revés. Usa una computadora a la vez y trae el progreso antes de empezar.
- **Respaldo en archivo**: Respaldo → «Descargar con PDFs» genera un solo archivo `.json`; «Restaurar archivo» lo carga en cualquier computadora.

## Inicio: tu año de internado

La primera vez, **Inicio** te pide la fecha de inicio, tus rotaciones, tu esquema de guardias y cuánto tiempo puedes estudiar. Con eso reparte el temario (139 temas de 6 especialidades) en todo el año:

- **Lección de hoy**: temas nuevos y repasos espaciados del día. **Empezar** / **Estudiar** abren los apuntes del tema (con plantilla clínica) en el cuaderno de su especialidad. **GPC** busca la guía solo en sitios oficiales (IMSS, gob.mx, ISSSTE).
- **Pendientes**: lo que quedó sin marcar en las últimas 3 semanas.
- **Calendario**: cada día muestra la rotación (barra de color) y las guardias (punto). Toca un día para ver su lección.
- **Ajustar plan**: cambia rotaciones, guardias o tiempos; el plan se recalcula al instante y conserva lo que ya marcaste.

### Fase 2
- **Temario** (Inicio) → ficha de cada tema: sube la **GRR** y la **GER** (se reconocen por el nombre), vista de guardia, casos y flashcards.
- **Perlas**: en Estudio, selecciona texto con el mouse o encierra una zona con la herramienta **Recorte (R)** usando el lápiz. Elige Apunte, Flashcard, Lienzo o Guardia.
- **Herramientas → Guardia** (barra lateral): fichas de bolsillo y calculadoras. Las dosis las copias tú desde la GPC; la app no trae dosis precargadas.
- **Hoy no doy más / Postguardia** (lección de hoy): reprograma lo pendiente y te deja 10 min de flashcards. Botón Deshacer.
- **Casos vistos**: 3 líneas sin datos identificables.

### Fase 3a
- **Herramientas → Nota SOAP** (barra lateral): elige tipo de nota y tema, llena signos vitales y hallazgos, copia. Los datos del paciente no se guardan.
- **Perlas HY**: mnemotecnias y datos de alto rendimiento por tema; exporta/importa para compartir.
- **Música**: botón redondo abajo a la izquierda → «Elegir carpeta».
- **Estilo**: Ajustes → «Estilo: Cristal / Mate».

### Fase 3b
- **Simulacros** (barra lateral): genera casos tipo ENARM desde tu GER (necesita tu API key de Anthropic) o escríbelos; resuélvelos en bloques cronometrados.
- **Progreso → Mapa de debilidades**; en Inicio verás tus temas débiles y repasos de «Refuerzo» en el plan.
- **Turno**: tus pacientes del día con pendientes; se borra al terminar el turno.
- **Ctrl+K**: busca en todo, incluso dentro de tus PDF.
- **Escuchar** (bocina) en Perlas HY y en cada nota.
- **Guardia → Fármacos por peso**: crea fichas con la dosis de tu GPC y calcula por kg.

### v0.5 (19 mejoras)
- **Bitácora** (barra lateral): procedimientos con conteo observé/asistí/realicé y meta por procedimiento, todos tus casos y un **diario** privado del internado (una entrada por día).
- **Turno**: pendientes con hora, signos vitales marcados ↑/↓ según **tu** tabla por edad (Guardia → Signos vitales) y **Ensayo** del pase de visita con cronómetro de 60–120 s.
- **Ajustes → Preferencias**: **recordatorios** de Windows (flashcards y refuerzo del día, pendientes con hora, 30 min antes del fin del turno) y **modo noche** (sin luz azul, automático por horario).
- **Respaldo → Cifrado con contraseña** (AES-256). La contraseña no se guarda: si la olvidas, el respaldo no se recupera.
- **PDF**: % leído y «retomar p. X»; marcadores como página clave (algoritmo, tabla, dosis, criterios); botón **?** para preguntas rápidas con IA desde tus subrayados; **Comparar lado a lado** dos guías del tema con scroll sincronizado.
- **Ficha del tema**: **Diagrama** del algoritmo con IA desde tu GPC (editable y se pega en el lienzo), % completo de tu nota.
- **Notas**: plantillas por especialidad (Cirugía, Pediatría, GO) y detector de apartados vacíos (chip «% · n/m»).
- **GPC → Mapa GPC**: qué guías tienes, cuáles has leído y cuáles faltan por especialidad.
- **Inicio**: fármaco del día (de tus fichas), resumen de la semana exportable a PDF, «Repasar preguntadas».
- **«Me lo preguntaron»** (botón con micrófono) en preguntas, perlas y flashcards: se repasan primero y tienen su propio simulacro y filtro.
- **Perlas HY → Mnemotecnias con IA** para tus temas débiles: eliges cuáles se guardan.

### v0.5.1 (pulido visual)
- Barra lateral más corta: **Herramientas** agrupa GPC, Guardia y Nota SOAP; **Ajustes** agrupa Respaldo, Preferencias, Tema y Estilo. Cabe en la Surface sin desplazar.
- **Inicio**: franja con flashcards de hoy, temas débiles, pendientes del turno y días para el ENARM (toca para poner la fecha). Las tarjetas de la derecha se pliegan con la flecha y se recuerda tu elección.
- Menos ámbar: queda para la acción principal y lo urgente; «Prioridad alta» ahora es un punto junto al tema.
- Bitácora y signos vitales se ven como tabla limpia; se editan con «Editar metas» / «Editar rangos».
- **Lección de hoy** rediseñada: anillo con los minutos que llevas, «Sigue» con el próximo tema en grande y el botón Empezar a la vista; al terminar el día, el anillo se pone verde.
- Turno con tarjetas más anchas cuando hay pocos pacientes, estados vacíos con ejemplo y botón, números en la tipografía del Codex, aviso de **Noche** en la barra superior (tócalo para apagarlo) y transiciones suaves entre vistas.

### v0.6
- **Flashcards de huecos**: en el PDF, menú **⋯ → Flashcards de huecos** (desde tus subrayados) o **Huecos** al seleccionar texto. La app sugiere qué esconder (cifras con unidad o el término clave); tocas las palabras para cambiarlo.
- **PDF anotado**: menú **⋯ → Exportar PDF anotado**. Tu guía con resaltados, subrayados, tinta, post-its y una hoja final con tus marcadores; el original no se toca.
- **Ajustes → Preferencias → IA**: tu API key y el modelo en un solo lugar (lo usan síntesis, simulacros, mnemotecnias, diagramas y preguntas).
- **Atajos**: **?** muestra la lista; **G** abre la Vista de Guardia desde cualquier parte.
- **Novedades**: al actualizar verás una vez qué cambió.

### v0.6.5 (estabilidad y pulido, sin funciones nuevas)
- **Arranque más rápido**: las vistas que no usas al abrir y la exportación a PDF se cargan solo cuando las usas.
- **Ahorro de batería** (Ajustes → Preferencias): con la Surface desconectada se quita el fondo animado y se suaviza el cristal.
- **Surface en vertical**: Estudio con el PDF arriba y las notas abajo; el calendario muestra los 7 días.
- **Datos más seguros**: el respaldo en la carpeta se verifica, te avisa si falla (punto en Ajustes), puedes **deshacer la última restauración** y te avisa si el almacenamiento está casi lleno o si un cambio no se pudo guardar. Los PDF dañados ya no entran a la biblioteca.
- Objetivos táctiles más grandes, mensajes y nombres unificados.

### v0.6.7
- **Zoom con dos dedos / Ctrl + rueda** en el PDF y en el lienzo de notas (botones − / % / + en el lienzo).
- **Escritura rápida**: el trazo recién soltado se pinta solo él (antes se redibujaba toda la hoja y trababa el inicio del siguiente); suavizado adaptable; punta predictiva opcional en Preferencias → Lápiz.

### v0.6.6
- **Tinta sin retraso** con el Surface Pen (lienzo y PDF): cada punto se dibuja en el mismo instante en que llega, la punta usa la predicción del sistema y el trazo va en una capa de baja latencia.

### v0.10
- **Widgets flotantes** (solo app de escritorio): ventanitas siempre encima con la **cápsula de estudio** (hora, minutos de hoy, tema que toca), los **pendientes del turno** por hora, el **repaso pendiente** y la **captura rápida**. Se arrastran de su barra y se cierran con su ✕.
- **Atajos del sistema**: `Ctrl+Alt+Q` captura una perla, nota o flashcard desde cualquier programa; `Ctrl+Alt+K` abre la búsqueda; `Ctrl+Alt+G` muestra u oculta la cápsula.
- **Ventanas sincronizadas**: lo que captures o marques en un widget aparece en la app al instante, y al revés, sin recargar.

### v0.9
- **Doble plana** en el lector (dos páginas a la vez) y **controles flotantes** en pantalla completa: acerca el lápiz al borde de arriba y aparecen página, zoom, búsqueda y doble plana.
- **Organizar hojas** del lienzo: miniaturas que arrastras para reordenar, fusionar con la anterior (el contenido baja debajo de lo que ya había) y mandar la selección del lazo a la hoja de arriba o de abajo.
- **Repaso con FSRS** en lugar de SM-2: cada tarjeta guarda su estabilidad y dificultad, y de ahí sale el día exacto. La exigencia (relajado / normal / estricto) se ajusta en Preferencias.
- **Repaso de guardia**: 10 minutos, botones grandes, con una mano (Herramientas).
- **Historial de simulacros**: tendencia intento a intento, desglose por especialidad y repetir solo las falladas.
- **Glosario de abreviaturas** para el reconocimiento de letra y **transcribir un cuaderno completo** de una pasada.
- **Temario editable**: cambia títulos y prioridades, parte un tema en dos, quita los que no vas a estudiar y agrega los tuyos; el plan se recalcula y lo estudiado se conserva.
- **Informe semanal**: minutos reales contra los planeados, temas cerrados y pendientes que se movieron.
- **Turno por hora**: todos los pendientes con hora juntos y en orden, con atajos «+30m / +1h / +2h».
- **Espacio y revisión** (Respaldo): cuánto llevas usado, qué guías pesan más y si la carpeta compartida de verdad escribe.

### v0.8.1
- **Arreglo**: en pantalla completa la guía se quedaba sin ancho (al ocultar la barra lateral el contenido caía en una columna de 0 px). Ahora la rejilla queda de una sola columna y el PDF ocupa todo.

### v0.8
- **Buscar en lo que escribiste a mano**: menú «⋯» de la nota → *Reconocer mi letra*. Transcribe tus hojas con el motor de IA que elegiste, lo deja buscable en Ctrl+K y, si quieres, lo pasa al texto de la nota.
- **Ctrl+F dentro de la guía**: cuenta las coincidencias, salta entre ellas y las marca sobre la página.
- **Pestañas** de varias guías abiertas, **recorte de márgenes** (4 % / 7 %) e **índice del propio PDF** junto a tus marcadores.
- **Oclusión de imágenes**: recorta un esquema, tapa sus etiquetas y sale una flashcard por cada una.
- **Hoja de resaltados del tema**: ficha del tema → *Resaltados*; todo lo marcado en sus guías, con su página y filtrable por color.
- **Tapar y repasar** la columna izquierda en hojas Cornell y de dos columnas.
- **Papelera de 30 días** (notas, guías y hojas, con su tinta y sus resaltados) e **historial de versiones** de cada nota.
- **Etiquetas** con filtro en Cuadernos y **dictado por voz** a la nota.
- **Surface ↔ PC**: si la otra computadora dejó algo más nuevo en la carpeta compartida, la app te ofrece traerlo al abrir.
- **Llevarlo a otro lado** (Respaldo): paquete `.html` de solo lectura para repasar en el celular y plan en `.ics` para el calendario del teléfono.
- **Cuaderno completo a PDF** con portada e índice.

### v0.7
- **Lazo** en el lienzo: encierra trazos y muévelos, escálalos, cámbiales el color, duplícalos o bórralos.
- **Formas rectas**: línea, flecha, rectángulo y elipse al dejar el lápiz quieto (Preferencias → Lápiz para apagarlo).
- **Plumas favoritas** (4, a un toque; mantener presionado guarda la actual) y **botón lateral** del lápiz como borrador o lazo.
- **Hojas del lienzo**: insertar, subir, bajar y quitar; plantillas **Cornell** y **dos columnas**.
- **Guía en oscuro** y **pantalla completa** de lectura, desde el menú «⋯» del PDF.
- **Reloj de estudio automático**: cuenta el tiempo real leyendo o escribiendo y lo guarda en Progreso; se detiene solo a los 2 min sin actividad.
- **Gemini o Claude**: elige el motor de IA y tu clave en Ajustes → Preferencias → IA.
- **Diagnóstico del lápiz**: mide el retraso real (eventos, dibujo, cuadros) y señala la causa.
- Escritura: el trazo recién soltado ya no obliga a redibujar la hoja ni a guardar en medio de la palabra.

Roadmap del proyecto: [ROADMAP.md](ROADMAP.md).

## Uso rápido

**PDF (barra izquierda)**

| Herramienta | Tecla | Qué hace |
|---|---|---|
| Navegar | **V** | Leer y desplazarte |
| Resaltar área | **H** | Arrastra sobre el texto. 7 colores con significado: concepto clave, definición, perla ENARM, duda, fisiopatología, fármacos y alarma |
| Subrayar | **U** | Arrastra a lo largo de la línea. Ajusta el color y el grosor |
| Escribir / dibujar | **D** | Pluma, lápiz, rotulador o marcatextos. Cada uno guarda su propio color (paleta o cualquier color) y su grosor |
| Post-it | **N** | Toca la página para pegarlo. Se arrastra, se minimiza y cambia de color |
| Borrar | **E** | Arrastra sobre trazos o toca un resaltado. El botón borrador del lápiz funciona siempre |
| Marcador | **B** | Marca la página actual (cinta verde). La lista ☰ permite saltar, renombrar e **insertar en la nota** |
| Deshacer | **Ctrl+Z** | Deshace la última anotación del PDF |

Con el dedo desplazas la página; con el lápiz o el mouse anotas.

**Distribución de la pantalla** (arriba a la derecha, en Estudio)

- **PDF · ▥ · Notas**: amplía solo el PDF, vuelve a la pantalla dividida o amplía solo las notas (**Alt+1 / Alt+2 / Alt+3**).
- **⇄ Intercambiar**: pone las notas a la izquierda y el PDF a la derecha, o al revés (**Alt+S**).
- Arrastra el separador para ajustar los tamaños (doble clic lo restablece). El PDF y la nota no se recargan al cambiar de modo.

**Notas**

- **Texto**: editor tipo Word con estilos (Título 1–3, cita), fuente, tamaño, negrita, cursiva, subrayado, tachado, superíndice y subíndice, color de texto y de resaltado, alineación, viñetas, numeración, listas de verificación, sangrías (Tab), tablas, línea, fecha y deshacer/rehacer. Los enlaces 📑 a páginas del PDF se abren con un clic.
- **Lienzo**: escritura a mano con los mismos instrumentos. **Solo lápiz** evita que la palma dibuje; hojas rayadas, cuadriculadas o lisas.
- **Síntesis**: genera una hoja de repaso con tus resaltados, notas, post-its y páginas del PDF.
- Exporta cada nota a **PDF** o a **Word**.

**Cuadernos**: agrupa notas por materia («Uno por materia» los crea todos) o por tema (por ejemplo «Choque séptico»). En el panel de notas puedes ver las notas del PDF abierto o las de un cuaderno, y mover una nota con el selector «Cuaderno».

**Calendario**: escribe en «+ Añadir tema» y presiona Enter. Arrastra las sesiones entre días. **Pomodoro**: está arriba a la derecha; haz clic en el tiempo para elegir materia y duración. **Tema**: botón inferior del menú (claro, oscuro o automático).

## Síntesis con IA (opcional)

En **Síntesis → Claude (IA)** pega tu API key de Anthropic. La clave se guarda solo en este navegador, y el material se envía a la API únicamente cuando presionas **Generar**. Sin clave, el motor **Local** funciona offline.

Más detalles técnicos en [ARCHITECTURE.md](ARCHITECTURE.md).
