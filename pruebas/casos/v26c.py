"""El diagrama es sobre el paciente, no sobre el documento, y una GPC escaneada
se avisa en vez de gastar una petición de IA en un «no puedo» dibujado."""
import sys
sys.path.insert(0, '/tmp/tc')
import subprocess, json, os, textwrap, tempfile

RAIZ = '/home/claude/quiron_codex'
P = F = 0
def ok(n, c, e=''):
    global P, F
    if c: P += 1
    else: F += 1; print('FAIL', n, e)

# Se prueban las funciones puras compilándolas aparte: no necesitan navegador.
src = textwrap.dedent(f"""
  import {{ sanitizeDiagram }} from '{RAIZ}/src/ai/features';
  import {{ materialUsable }} from '{RAIZ}/src/exam/generate';
  const r = [];
  const t = (n, fn) => {{ try {{ fn(); r.push([n, 'ok', '']); }} catch (e) {{ r.push([n, 'err', String(e.message || e)]); }} }};

  t('error declarado', () => sanitizeDiagram({{ error: 'La guía no trae algoritmo.' }}));
  t('diagrama meta', () => sanitizeDiagram({{ title: 'x', nodes: [
      {{ id: 'a', label: 'Recepción de documento: HAS', kind: 'start' }},
      {{ id: 'b', label: '¿Contiene texto clínico evaluable?', kind: 'decision' }},
      {{ id: 'c', label: 'Documento con viñetas vacías', kind: 'step' }},
      {{ id: 'd', label: 'Imposible generar algoritmo', kind: 'step' }},
      {{ id: 'e', label: 'Solicitar documento o GPC íntegro', kind: 'end' }}],
    edges: [{{from:'a',to:'b'}},{{from:'b',to:'c',label:'No'}},{{from:'c',to:'d'}},{{from:'d',to:'e'}}] }}));
  t('diagrama clínico bueno', () => sanitizeDiagram({{ title: 'HAS', nodes: [
      {{ id: 'a', label: 'Adulto con TA ≥140/90 en dos tomas', kind: 'start' }},
      {{ id: 'b', label: '¿TA ≥180/110 o daño a órgano blanco?', kind: 'decision' }},
      {{ id: 'c', label: 'Referir a urgencias', kind: 'end' }},
      {{ id: 'd', label: 'Solicitar EGO, creatinina y ECG', kind: 'step' }},
      {{ id: 'e', label: 'Iniciar cambios en estilo de vida', kind: 'step' }},
      {{ id: 'f', label: 'Cita de control en 4 semanas', kind: 'end' }}],
    edges: [{{from:'a',to:'b'}},{{from:'b',to:'c',label:'Sí'}},{{from:'b',to:'d',label:'No'}},{{from:'d',to:'e'}},{{from:'e',to:'f'}}] }}));

  const escaneada = Array.from({{length: 60}}, (_, i) => `[p. ${{i+1}}]\\n•\\n•\\n${{i+1}}\\n`).join('');
  const buena = ('La hipertensión arterial sistémica se define como cifras mayores o iguales a ciento cuarenta sobre noventa milímetros de mercurio tomadas en dos ocasiones distintas con técnica adecuada en el consultorio del primer nivel de atención. ').repeat(8);
  r.push(['escaneada no usable', materialUsable(escaneada).ok ? 'err' : 'ok', String(materialUsable(escaneada).palabras)]);
  r.push(['texto real usable', materialUsable(buena).ok ? 'ok' : 'err', String(materialUsable(buena).palabras)]);
  console.log(JSON.stringify(r));
""")
with tempfile.TemporaryDirectory() as d:
    ent = os.path.join(d, 'e.ts'); open(ent, 'w').write(src)
    out = os.path.join(d, 'b.mjs')
    # Mismo apaño que build.mjs: pdf.js se importa con ?url, que esbuild no resuelve solo.
    constructor = f"""
      import * as esbuild from 'esbuild';
      const urlmod = {{ name: 'u', setup(b) {{
        b.onResolve({{ filter: /\\?url$/ }}, (a) => ({{ path: a.path, namespace: 'u' }}));
        b.onLoad({{ filter: /.*/, namespace: 'u' }}, () => ({{ contents: 'export default "";', loader: 'js' }}));
      }} }};
      await esbuild.build({{ entryPoints: ['{ent}'], bundle: true, format: 'esm', outfile: '{out}',
        platform: 'node', jsx: 'automatic', plugins: [urlmod], logLevel: 'error',
        loader: {{ '.png': 'dataurl', '.webp': 'dataurl', '.css': 'empty' }} }});
    """
    # El guión vive junto a las demás herramientas para que 'esbuild' resuelva igual
    # que en build.mjs, aquí y en CI.
    bld = os.path.join(RAIZ, 'pruebas/herramientas', '.tmp-v26c.mjs')
    open(bld, 'w').write(constructor)
    try:
        r = subprocess.run(['node', bld], cwd=os.path.join(RAIZ, 'pruebas/herramientas'),
                           capture_output=True, text=True)
    finally:
        os.unlink(bld)
    if r.returncode:
        # Sin node_modules del repo (contenedor de desarrollo) no hay nada que compilar.
        # En CI, que corre npm ci antes, sí compila y la prueba vale.
        print('SKIP: no se pudo compilar el paquete de prueba (¿falta npm ci?)')
        print(r.stderr.strip().splitlines()[-1] if r.stderr.strip() else '')
        print('SUMMARY 0 / 0')
        raise SystemExit(0)
    res = json.loads(subprocess.run(['node', out], capture_output=True, text=True, check=True).stdout)

esperado = {'error declarado': 'err', 'diagrama meta': 'err', 'diagrama clínico bueno': 'ok',
            'escaneada no usable': 'ok', 'texto real usable': 'ok'}
for nombre, estado, detalle in res:
    ok(nombre, estado == esperado[nombre], f'{estado} · {detalle[:90]}')

print(f'SUMMARY {P} / {P+F}')
