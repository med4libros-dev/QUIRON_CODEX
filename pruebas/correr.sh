#!/usr/bin/env bash
# Corre la suite de pruebas de Quirón Codex.
#
#   ./pruebas/correr.sh            # todo
#   ./pruebas/correr.sh f6 v22     # solo esos casos
#
# Necesita: node + npm install, y Playwright para Python con Chromium
# (pip install playwright && python -m playwright install chromium).
#
# Los casos esperan su material en /tmp/tc (así nacieron, fuera del repo). El enlace de
# abajo apunta esa ruta a pruebas/trabajo/, que se regenera y no se versiona.
set -euo pipefail
cd "$(dirname "$0")/.."

TRABAJO="$PWD/pruebas/trabajo"
mkdir -p "$TRABAJO/dist" "$TRABAJO/shots"
export QC_TC="$TRABAJO"

if [ ! -e /tmp/tc ] || [ -L /tmp/tc ]; then
  ln -sfn "$TRABAJO" /tmp/tc
else
  echo "Aviso: /tmp/tc ya existe y no es un enlace; se usará tal cual." >&2
fi

# e2e-art sirve el paquete de un solo archivo desde /tmp/art, que es donde nació.
# Sin este enlace el caso no encuentra nada y tumba la suite entera en CI.
mkdir -p "$TRABAJO/art"
if [ ! -e /tmp/art ] || [ -L /tmp/art ]; then
  ln -sfn "$TRABAJO/art" /tmp/art
else
  echo "Aviso: /tmp/art ya existe y no es un enlace; se usará tal cual." >&2
fi

echo "· Compilando la app para pruebas"
node pruebas/herramientas/build.mjs
node pruebas/herramientas/build-art.mjs

echo "· Generando los PDF de prueba (inventados, no son GPC reales)"
[ -f "$TRABAJO/043GER_Neumonia.pdf" ] || node pruebas/herramientas/mkpdf.cjs
[ -f "$TRABAJO/big.pdf" ] || node pruebas/herramientas/mkbig.cjs
cp -n pruebas/fixtures/* "$TRABAJO/" 2>/dev/null || true

CASOS=("$@")
if [ ${#CASOS[@]} -eq 0 ]; then
  mapfile -t CASOS < <(cd pruebas/casos && ls *.py | sed 's/\.py$//' | sort)
fi

fallos=0
for c in "${CASOS[@]}"; do
  printf '%-10s ' "$c"
  salida=$(cd "$TRABAJO" && timeout 600 python3 "$OLDPWD/pruebas/casos/$c.py" 2>&1 || true)
  resumen=$(echo "$salida" | grep -E '^SUMMARY' | tail -1)
  if [ -z "$resumen" ]; then
    echo "SIN RESULTADO"; echo "$salida" | tail -3; fallos=$((fallos+1))
  else
    echo "$resumen"
    echo "$salida" | grep -E '^FAIL' || true
    echo "$resumen" | grep -qE 'SUMMARY ([0-9]+) / \1$' || fallos=$((fallos+1))
  fi
done

echo
if [ $fallos -gt 0 ]; then echo "$fallos caso(s) con fallos"; exit 1; fi
echo "Todo verde"
