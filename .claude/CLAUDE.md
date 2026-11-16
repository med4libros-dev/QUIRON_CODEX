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
