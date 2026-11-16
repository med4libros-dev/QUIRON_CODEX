# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

# replica (11 skills, MIT · Jake Schincariol)
Clonar una app: `replica-recon` (ingeniería inversa), `replica-architect` (stack y base de datos),
`replica-design` (sistema de diseño), `replica-build` (reconstruir pantallas), `replica-backend`
(auth, pagos, correo), `replica-test` (pruebas y bugs), `replica-diff` (qué tan cerca está del
original), `replica-entrepreneur` (qué odian sus usuarios), `replica-brand` (nombre y marca propia),
`replica-launch` (landing y fichas de tienda), `replica-deploy` (ponerlo en línea).
Cada una en `.claude/skills/<nombre>/SKILL.md`; licencia en `.claude/skills/REPLICA-LICENSE.md`.
Reconstruyen lo que una app *hace*, nunca lo que *posee* (ni su código, logo, textos o contenido).

# antislop (6 skills, MIT · miqdadbadjuber)
Reglas contra el «slop» de IA en UI, texto y código: `antislop` (núcleo), `antislop-ui`,
`antislop-layoutmobile`, `antislop-copywriting`, `antislop-code`, `antislop-human`.
Licencia en `.claude/skills/ANTISLOP-LICENSE.md`.

# find-skills (MIT · Vercel)
Buscar e instalar skills del ecosistema (`npx skills find/add`). `.claude/skills/find-skills/SKILL.md`.

# notebooklm (MIT · teng-lin)
Operar Gemini Notebook (antes NotebookLM) por CLI o API de Python: `.claude/skills/notebooklm/SKILL.md`.
La librería en sí se instala aparte en tu equipo: `pip install "notebooklm-py[browser]"`.

# Interfaz visual (instaladas para mejorar la UI)
- `web-design-guidelines` (MIT · Vercel) — auditar una pantalla contra reglas de interfaz y accesibilidad.
- `react-best-practices`, `composition-patterns` (MIT · Vercel) — rendimiento y arquitectura de componentes React.
- `ui-ux-pro-max` (MIT · Next Level Builder) — biblioteca local: paletas, pares tipográficos, 120 pautas de UX, iconos y tipos de gráfica.
- `design-system` (MIT · Next Level Builder) — tokens en tres capas (primitivo → semántico → componente), que es como ya está hecho `global.css`.
Licencias en `.claude/skills/VERCEL-SKILLS-LICENSE.md` y `.claude/skills/UI-UX-PRO-MAX-LICENSE.md`.
Nota: el sistema visual del proyecto («Pistache» y «Cristal líquido / Dark Academia») manda sobre cualquier
sugerencia de estas skills; sirven para auditar y afinar, no para rehacer la identidad.

# Pruebas
- `playwright-skill` (MIT · TestDino) — guías de Playwright al día (selectores, esperas, trazas, flaky,
  accesibilidad, CI, page objects y diseño de casos). La suite de este proyecto vive fuera del repo
  (`/tmp/tc/*.py`, Playwright de Python); esta skill sirve para escribirla mejor y para traerla al repo
  si algún día se decide versionarla. Licencia en `.claude/skills/PLAYWRIGHT-SKILL-LICENSE.md`.
