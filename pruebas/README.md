# Pruebas

Suite de extremo a extremo con **Playwright (Python)** sobre Chromium. No hay pruebas
unitarias: casi todo lo que puede romperse aquí es de interfaz, almacenamiento o lápiz, y
eso solo se ve en un navegador de verdad.

## Correr

```bash
npm install
pip install playwright && python -m playwright install chromium
./pruebas/correr.sh            # todos los casos
./pruebas/correr.sh f6 v22     # solo esos
```

Cada caso levanta su propio servidor en un puerto distinto, abre la app compilada con
esbuild (no con Vite: arranca en un segundo) y afirma cosas con `ok(nombre, condición)`.
Al final imprime `SUMMARY aciertos / total`; el runner falla si no son iguales.

## Qué hay dentro

| Carpeta | Qué es |
|---|---|
| `casos/` | Un archivo por grupo de pruebas. `f2`–`f15` son por función; `e2e*` recorren la app completa; `v12`–`v22` cubren lo que trajo cada versión |
| `herramientas/` | Compilación para pruebas (`build.mjs`), para el artefacto web (`build-art.mjs`) y para el HTML de un solo archivo; generadores de los PDF de prueba |
| `fixtures/` | Material fijo (p. ej. el árbol de carpetas falso de los resúmenes) |
| `trabajo/` | Lo que se genera al correr. No se versiona |

Los PDF de prueba se **generan**: su texto está inventado y no son GPC reales.

## Límites conocidos

- **No hay WebKit**, así que Safari y iPad no se prueban aquí; se usa Chromium con el
  tamaño y los gestos del dispositivo. Lo específico de Safari se verifica a mano.
- Hay dos o tres casos sensibles al tiempo que fallan de vez en cuando por temporizadores;
  si uno falla, vuelve a correrlo solo antes de buscar el error.

## Nota sobre los tipos

El `tsconfig.json` de la raíz es el que vale. Durante el desarrollo de esta suite se usó
una configuración aparte con *shims* de tipos, porque el entorno donde se escribió no podía
instalar `@types/react`; esa configuración no se versionó para no competir con la real.
