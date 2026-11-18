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
- **Estilo**: pack «Códice», único. Ajustes → «Tema» para día, noche o automático.

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

### v0.25
- **Empezar de cero** (Herramientas → Empezar de cero): reinicia el temario para arrancar limpio. Eliges qué se borra —progreso, plan completo, tus cambios al temario, flashcards, simulacros, fichas y casos, bitácora— y cada opción dice exactamente qué se lleva. Viene marcado **solo el progreso**; todo lo demás es opcional.
- Antes de borrar **descarga un respaldo completo**, y pide escribir `REINICIAR` para confirmar. Tus notas, cuadernos, lienzos, perlas HY y los PDF que subiste no se tocan ahí.

### v0.24
- **Vidrio líquido**: pack visual nuevo y por omisión, traducido del lenguaje *Liquid Glass* de Apple. Las superficies desenfocan y saturan lo que tienen detrás, llevan un filo especular arriba, esquinas redondeadas y botones en cápsula, y responden al puntero y al dedo. **Códice sigue ahí**, en Preferencias → Estilo, y vuelve el selector de pack.
- **El desenfoque no le quita tiempo al lápiz**: se apaga solo mientras escribes (`[data-ink-busy]`) y vuelve en la primera pausa real, y tampoco se enciende en ahorro de batería ni con «reducir transparencia» del sistema. Si el navegador no soporta `backdrop-filter`, las superficies se vuelven opacas en vez de ilegibles.
- Los bordes de los controles se midieron de verdad: **3.3:1 de día y 5.5:1 de noche** compuestos sobre lo que hay detrás (WCAG 1.4.11). La primera versión del pack se quedaba en 2.3:1.
- **Arreglo**: las copias por día del respaldo se nombraban con la fecha **UTC**. En México eso significaba que todo lo respaldado después de las 18:00 llevaba la fecha de mañana. Ahora usan tu fecha local, igual que el nombre del archivo descargado.

### v0.23
- **Fichas de guardia desde tu GPC**: en la ficha del tema → Vista de Guardia, «Proponer desde mi GPC» lee la guía que **tú** adjuntaste y propone criterios, primera y segunda línea y criterios de referencia, **citando la página** de cada línea. Es un borrador: no toca tu ficha hasta que pasas cada campo, y la pantalla te recuerda verificar las dosis contra tu guía. El sistema tiene prohibido inventar una dosis que no esté en el texto; si la guía no la da, escribe el fármaco sin dosis.
- **Bitácora en el teléfono**: pestaña nueva en Bolsillo para registrar un caso (tres líneas anónimas, con el mismo detector de nombres, camas, NSS y CURP) y sumar procedimientos de un toque.
- **PDF con símbolos**: el exportador propio escribe en WinAnsi, así que los acentos salen bien pero el griego, las flechas, ≥ y µ se transliteran. El botón nuevo guarda el PDF por la impresora del navegador, que sí maneja Unicode.
- **Las pruebas viven en el repositorio**: `pruebas/` con ~900 verificaciones de extremo a extremo (Playwright sobre Chromium) y un workflow que las corre en cada cambio. Antes vivían fuera del repo.

### v0.22
- **Respaldo en iPad y teléfono**: ahí **no existe** el respaldo automático — iOS no permite apuntar a una carpeta, y ningún navegador de iPad puede, porque todos usan Safari por dentro. La app ahora lo dice con claridad y, lo importante, **te avisa**: si llevas 5 días sin respaldar en ese dispositivo (o nunca lo has hecho y ya tienes un plan), aparece una barra para descargarlo de un toque. Se puede posponer un día, no para siempre.
- El mensaje de «tu navegador no permite elegir carpetas» ya no te manda a instalar Chrome, que en iPad no sirve de nada.

### v0.21
- **Botón «Buscar actualización»** en Preferencias → Versión. El aviso automático pregunta una vez al día; este no espera. Distingue tres cosas que suelen confundirse: estás al día, hay una versión nueva, o no se pudo preguntar (sin red o GitHub caído) — nunca dice «al día» cuando en realidad no pudo comprobarlo.
- En la versión web ofrece **recargar** en vez de descargar un instalador, que es como se actualiza ahí.

### v0.20
- **Arreglado el lienzo en Safari y iPad**: la app usaba `100vh`, que en iOS mide la ventana **sin** la barra de direcciones; quedaba más alta que la pantalla y, con `body` en `overflow: hidden`, el panel de abajo se volvía inalcanzable. Ahora usa `100dvh`, que mide lo que de verdad se ve y se reajusta cuando la barra aparece o se esconde.
- **Colapsar un panel**: dos asas en el separador de Estudio. Una deja el lienzo a pantalla completa, la otra el PDF, y una pestaña en el borde regresa a los dos. Con el dedo son objetivos de 44 px, porque arrastrar un separador de 7 px en una tableta no es realista.
- **Versión web para compartir**: `https://med4libros-dev.github.io/QUIRON_CODEX/`, publicada sola en cada versión. Rutas relativas en el manifiesto y el service worker para que la misma compilación sirva en la raíz (escritorio) y bajo un subdirectorio (Pages).

### v0.19
- **Estrategia de estudio** (Herramientas → Estrategia): un cuestionario corto sobre **tu realidad** —cuánto tiempo real tienes, cómo quedas postguardia, dónde estudias, qué te importa más— junto con **lo que la app ya sabe de cómo estudias**: cumplimiento del plan, minutos reales por día y por hora, olvidos al repasar, aciertos en simulacros y temas flojos.
- De ahí salen **ajustes concretos al plan** —minutos diarios, fin de semana, postguardia, enfoque en la rotación, exigencia del repaso, recordatorios— cada uno con el dato que lo sostiene, y **los apruebas uno por uno**. El planificador sigue siendo determinista: la IA solo mueve sus perillas.
- **Sin estilos de aprendizaje.** Emparejar la enseñanza con un supuesto estilo (visual, auditivo, kinestésico) no mejora los resultados, y la app lo dice en la propia pantalla. Tus preferencias de formato solo deciden **qué herramienta de la app se te sugiere**, porque la que no te pesa es la que acabas usando.
- **Funciona sin IA**: sin clave configurada, las propuestas salen de reglas de la app con los mismos datos. Y lo que el motor devuelve se valida contra un catálogo cerrado: una propuesta de «9000 minutos diarios» se recorta a 240, y una acción que no existe se descarta.
- El aviso de versión nueva ahora recuerda **cerrar la app antes de instalar**: los widgets pueden dejar el proceso vivo y el instalador no alcanza a reemplazarlo.

### v0.18
- **Aviso de versión nueva**: la app de escritorio consulta una vez al día si hay una publicada y te lo dice, con un botón para descargarla. Si no hay internet no aparece, y una versión que rechazas no vuelve a avisar. En el navegador y el teléfono no sale: la PWA se actualiza sola al recargar.
- **«Antes de empezar el internado»**: en Inicio aparece lo que falta para que la app aguante el año — carpeta de respaldo, carpeta de resúmenes y tus primeras fichas de guardia — con el porqué de cada uno. Se resuelven desde ahí y la tarjeta desaparece sola cuando ya no queda nada.
- Pendiente: la **actualización silenciosa** (bajar e instalar sin que hagas nada) necesita una llave de firma de Tauri que no se puede generar en el entorno donde se construye esto. Queda anotada para la 1.0.

### v0.17
- **Bolsillo**: en una pantalla de teléfono la app abre en un modo de cuatro cosas — **ficha de guardia, dosis por peso, las 17 escalas y la cola de repaso** — con la barra abajo y todo a una mano. Es lo que sirve a las 3 a.m., sin la tableta. «Ver todo» abre la app completa y se recuerda.
- **Pensado para el Galaxy Z Fold**: cerrado (~344 px) abre en Bolsillo; al desplegar (~690 px) pasa a la app completa **en el momento**, sin recargar ni perder lo que estabas viendo; al cerrar, vuelve.
- **Todo se puede tocar**: ningún control baja de 44 px con el dedo (WCAG 2.5.8), ni en el teléfono ni en la tableta. Antes **75 de ellos sí**: la barra lateral eran botones de 55 × 31.
- Las fichas de guardia en Bolsillo son **solo lectura**: en guardia se consulta, no se captura. Se llenan en la tableta, con lo que dice tu GPC.

### v0.16
- **El respaldo deja de sobrescribirse a sí mismo**: en la carpeta queda **una copia por día** (los últimos 7 días, y más atrás la del lunes de cada semana). Antes, si un dato se corrompía o borrabas algo por error, el respaldo bueno desaparecía en los dos minutos siguientes. Ahora puedes volver a cualquiera de esos días desde Ajustes → Respaldo → «Días anteriores».
- **La fecha la pone el propio respaldo**, no el disco: OneDrive reescribe las fechas al sincronizar, así que la copia del día se decide por el `exportedAt` que el archivo declara.
- **Probado borrando todo**: una prueba nueva respalda, borra hasta el último dato y restaura, para comprobar que el progreso vuelve completo. Nunca se había verificado de punta a punta.
- **La carpeta sirve aunque el navegador no recuerde el permiso**: antes, si no podía guardarlo, elegir la carpeta fallaba por completo; ahora funciona en esa sesión y te lo vuelve a pedir después.
- Borrar algo (una nota, una guía) ya cuenta como cambio para el respaldo automático.

### v0.15
- **Tus ultrarresúmenes, dentro de la app**: nueva vista **Resúmenes**. Le apuntas una vez a la carpeta donde los guardas y quedan a mano. **No se copian a ningún lado**: siguen siendo tus archivos, se leen de la carpeta cuando abres uno, así que una colección de varios gigas no engorda la app ni el navegador (el índice pesa kilobytes).
- **Se reconocen solos**: de cada PDF lee **solo la primera página**, saca el título de verdad —no el nombre del archivo, que suele ser «Med Interna 7»— y lo empareja con tu temario resolviendo siglas (RCP, EVC, IAM, EPOC…) y palabras con otra terminación. Lo que atina queda fijo; lo dudoso te lo marca **para que lo confirmes** de un toque, y puedes cambiar el tema a mano.
- **En la ficha del tema**: los resúmenes de ese tema aparecen junto a tus PDFs y se abren en el mismo lector, con resaltado, lápiz y notas de siempre.
- **Sin internet y sin IA**: todo el emparejamiento es local. Si mueves o borras un archivo, la siguiente revisión te dice cuáles ya no están.

### v0.14
- **Disco de instrumentos**: la barra de plumas desaparece y en su lugar hay tres anillos concéntricos alrededor de la herramienta activa — **instrumento**, **color** y **grosor**, de dentro hacia fuera.
- **Se gira, no se toca**: apoyas el lápiz en un anillo y lo giras; la selección sigue al dedo y se queda donde lo sueltas. El grosor es continuo (el arco se va engrosando) con un hueco abajo que le da principio y fin.
- **Siempre en la misma esquina**: el del lector arriba a la derecha, el del lienzo arriba a la izquierda, para que la mano aprenda el gesto sin mirar. Cerrado ocupa 48 px y muestra con qué escribes.
- **Con teclado**: cada anillo es un deslizador (`role="slider"`); se entra con Tab y se gira con las flechas.
- Las plumas favoritas y el color libre quedan debajo del disco, con el mismo comportamiento de siempre (mantener presionado guarda la pluma actual).

### v0.13
- **Corrección**: al exportar una nota a PDF se respeta el tamaño de hoja. En la 0.12 una nota apaisada o en rollo salía deformada porque la exportación seguía fija en A4.
- **Transcribir la clase grabada**: botón «Transcribir» en la barra de grabación. Pasa el audio a texto con marcas de tiempo, lo guarda en la nota y entra en Ctrl+K. Necesita el motor **Gemini**: la API de Claude no recibe audio.
- **Lienzo rápido con cuadernos largos**: con hojas continuas y rollo un cuaderno llega a cientos de hojas; ahora solo se monta lo que se ve, y la barra de desplazamiento conserva su tamaño.
- **Flashcards desde el margen del PDF**: botón nuevo en la barra del lector que lee lo escrito en la franja y lo pasa a texto o a tarjeta.
- **Ponerme al día** (en «Pendientes»): reparte lo atrasado en los próximos 21 días con espacio, saltándose guardias y días en modo supervivencia. Si algo no cabe te dice cuánto quedó fuera en vez de reventar un día.
- **Mini-examen del día**: cinco casos de los temas de hoy, en modo estudio. Solo usa el banco que ya tienes.
- **Flujogramas**: tres plantillas de algoritmo en tinta (cajas y rombos vacíos para escribir dentro) y flechas que se enganchan solas al borde de las cajas cercanas.
- **Capas**: borrador debajo y más tenue, limpio encima. El borrador se oculta sin borrarse.
- **Instalable (PWA)**: la versión web se instala como aplicación en Edge y abre sin internet. No guarda nada tuyo en la caché: tus datos siguen en IndexedDB.
- **Símbolos al exportar**: más griego y notación médica se transliteran con nombre completo en lugar de perderse.

### v0.12
- **Lazo → texto, fórmula o flashcard**: encierra un párrafo escrito a mano y el botón «Aa» de la barra de selección lo transcribe. Lee solo ese recorte (no la hoja completa), lo puedes corregir y llevártelo al editor, al portapapeles o a una tarjeta.
- **Margen de notas junto al PDF**: una franja en blanco a la derecha de la guía para escribir sin encimar el texto; 30 % o 60 % del ancho de la página. La guía conserva su tamaño y lo que ya habías anotado no se mueve.
- **Miniaturas del lienzo**: columna lateral con una miniatura por hoja y la hoja actual marcada.
- **Tamaño de hoja**: A4 vertical, carta, A4 apaisada y **rollo continuo** (una tira sin cortes de hoja, para esquemas largos).
- **Fondo propio de la hoja**: fija una imagen tuya —una lámina, un formato del hospital— como plantilla de todas las hojas y escribe encima.
- **Grabar la clase**: mientras grabas, cada trazo guarda su minuto; después, «Tocar para saltar» te lleva del apunte al momento en que lo escribiste. Es para clases y seminarios, no para el pase de visita. El audio se queda en tu equipo y no entra en los respaldos.
- **Examen largo**: varios bloques cronometrados seguidos, con descanso entre ellos, para ensayar la jornada completa. Cada bloque queda en el historial y al final ves el acumulado.
- **Reconocer la letra en segundo plano** (Preferencias, apagado de fábrica): transcribe solas las notas en reposo para que lo escrito a mano entre al buscador sin pedirlo hoja por hoja.
- **Traer solo lo de la otra computadora** (Preferencias, apagado de fábrica): revisa la carpeta compartida cada dos minutos y trae lo nuevo sin preguntar, pero solo cuando aquí no hay cambios sin respaldar.
- **Accesibilidad**: los bordes que identifican un control llegan a 3:1, los campos recuperan el anillo de foco del teclado y la selección de texto usa el cardenillo del pack en vez del verde del tema viejo.

### v0.11 (Códice)
- **Identidad propia**: un solo pack visual, «Códice», hecho a medida para esta app. Papel cálido en los tres niveles (mesa → lámina → página, y la página siempre es la más clara), filetes de tinta en lugar de sombras y desenfoques, esquinas casi rectas, versales pequeñas en los rótulos y la serif **Lora** —incrustada en la app, sin pedir nada a internet— para los títulos y para todo lo que se lee. Se fueron el cristal esmerilado y los resplandores de colores.
- **Once estilos de hoja**: rayada, con margen, mitad dibujo y mitad renglón, lisa, punteada, cuadrícula, milimetrada, papel de electro, lámina con pie, Cornell y dos columnas. Agrupados en el selector por para qué sirve cada uno.
- **Hojas continuas**: al escribir en la última hoja sale otra debajo, como en los cuadernos digitales. La hoja de más no se guarda; si borras lo que escribiste, se retira sola. Se apaga con la flecha de la barra del lienzo.

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
